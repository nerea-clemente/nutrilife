import { Hono } from 'hono';
import { ensureSchema, getSettings, saveSettings } from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, loadUser, requireUser, sameOrigin, loginRateLimit,
} from './auth.js';
import { normalizeEntry } from '../shared/constants.js';
import { runReminders, vapidPublicKey, sendTo } from './push.js';

const app = new Hono().basePath('/api');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MEAL_KEYS = ['desayuno', 'comida', 'snack', 'cena'];
const bad = (c, msg = 'Datos no válidos', code = 400) => c.json({ error: msg }, code);

app.use('*', async (c, next) => {
  await ensureSchema(c.env.DB);
  await next();
  c.header('Cache-Control', c.res.headers.get('Cache-Control') || 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
});
app.use('*', sameOrigin);
app.use('*', loadUser);

// ---------- Autenticación ----------
async function signupAllowed(c) {
  const { n } = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  return n === 0; // aplicación personal: una sola cuenta
}

app.get('/auth/status', async (c) =>
  c.json({ user: c.get('user') || null, canSignup: await signupAllowed(c), needsSetupCode: !!c.env.SETUP_CODE })
);

app.post('/auth/signup', loginRateLimit, async (c) => {
  if (!(await signupAllowed(c))) return bad(c, 'El registro está cerrado.', 403);
  const { email, password, name, setup_code } = await c.req.json().catch(() => ({}));
  if (c.env.SETUP_CODE && setup_code !== c.env.SETUP_CODE) return bad(c, 'Código de configuración incorrecto.', 403);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return bad(c, 'Email no válido.');
  if (!password || password.length < 8) return bad(c, 'La contraseña debe tener al menos 8 caracteres.');
  const r = await c.env.DB.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .bind(email.trim(), (name || '').trim() || null, await hashPassword(password)).run();
  await createSession(c, r.meta.last_row_id);
  return c.json({ ok: true });
});

app.post('/auth/login', loginRateLimit, async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}));
  const u = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(String(email || '').trim()).first();
  if (!u || !password || !(await verifyPassword(String(password), u.password_hash)))
    return bad(c, 'Email o contraseña incorrectos.', 401);
  await createSession(c, u.id);
  return c.json({ ok: true });
});

app.post('/auth/logout', async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

app.post('/auth/password', requireUser, async (c) => {
  const uid = c.get('user').id;
  const { current, next } = await c.req.json().catch(() => ({}));
  const u = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(uid).first();
  if (!(await verifyPassword(String(current || ''), u.password_hash))) return bad(c, 'La contraseña actual no es correcta.');
  if (!next || next.length < 8) return bad(c, 'Mínimo 8 caracteres.');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next), uid),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid),
  ]);
  await createSession(c, uid);
  return c.json({ ok: true });
});

// A partir de aquí todo requiere sesión
app.use('*', requireUser);

// ---------- Entradas diarias ----------
app.get('/entries', async (c) => {
  const { from, to } = c.req.query();
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) return bad(c, 'Fecha no válida');
  const uid = c.get('user').id;
  const [rows, counts] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT date, data, updated_at FROM entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date').bind(uid, from, to),
    c.env.DB.prepare('SELECT date, COUNT(*) AS n FROM photos WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date').bind(uid, from, to),
  ]);
  const pc = Object.fromEntries(counts.results.map((p) => [p.date, p.n]));
  return c.json(rows.results.map((r) => ({ date: r.date, data: normalizeEntry(JSON.parse(r.data)), updated_at: r.updated_at, photos: pc[r.date] || 0 })));
});

app.get('/entries/:date', async (c) => {
  const date = c.req.param('date');
  if (!DATE_RE.test(date)) return bad(c, 'Fecha no válida');
  const uid = c.get('user').id;
  const [row, photos] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT data, updated_at FROM entries WHERE user_id = ? AND date = ?').bind(uid, date),
    c.env.DB.prepare('SELECT id, meal, created_at FROM photos WHERE user_id = ? AND date = ? ORDER BY created_at').bind(uid, date),
  ]);
  const r = row.results[0];
  return c.json({ date, exists: !!r, data: normalizeEntry(r ? JSON.parse(r.data) : null), updated_at: r?.updated_at || null, photos: photos.results });
});

app.put('/entries/:date', async (c) => {
  const date = c.req.param('date');
  if (!DATE_RE.test(date)) return bad(c, 'Fecha no válida');
  const uid = c.get('user').id;
  const body = await c.req.json().catch(() => ({}));
  const data = normalizeEntry(body.data);
  for (const m of Object.values(data.meals)) {
    if (m.time && !TIME_RE.test(m.time)) m.time = '';
    m.text = String(m.text || '').slice(0, 4000);
  }
  data.water_ml = Math.max(0, Math.min(20000, Math.round(Number(data.water_ml) || 0)));
  data.notes = String(data.notes || '').slice(0, 10000);
  data.drinks = String(data.drinks || '').slice(0, 4000);
  const json = JSON.stringify(data);
  if (json.length > 200000) return bad(c, 'Entrada demasiado grande', 413);
  await c.env.DB.prepare(
    `INSERT INTO entries (user_id, date, data, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).bind(uid, date, json).run();
  const s = await getSettings(c.env.DB, uid);
  if (!s.start_date) await saveSettings(c.env.DB, uid, { ...s, start_date: date });
  return c.json({ ok: true });
});

app.delete('/entries/:date', async (c) => {
  await c.env.DB.prepare('DELETE FROM entries WHERE user_id = ? AND date = ?').bind(c.get('user').id, c.req.param('date')).run();
  return c.json({ ok: true });
});

// ---------- Ciclo ----------
const listPeriods = async (db, uid) =>
  (await db.prepare('SELECT id, start_date, end_date FROM periods WHERE user_id = ? ORDER BY start_date').bind(uid).all()).results;

app.get('/cycle', async (c) => {
  const uid = c.get('user').id;
  const days = (await c.env.DB.prepare('SELECT date, flow, symptoms FROM cycle_days WHERE user_id = ? ORDER BY date').bind(uid).all()).results;
  return c.json({ periods: await listPeriods(c.env.DB, uid), days: days.map((d) => ({ ...d, symptoms: JSON.parse(d.symptoms) })) });
});

async function overlaps(db, uid, start, end, exceptId) {
  const e = end || start;
  return (await listPeriods(db, uid)).some((p) => p.id !== exceptId && !(e < p.start_date || start > (p.end_date || p.start_date)));
}

app.post('/cycle/periods', async (c) => {
  const uid = c.get('user').id;
  const { start_date, end_date } = await c.req.json().catch(() => ({}));
  if (!DATE_RE.test(start_date || '') || (end_date && !DATE_RE.test(end_date))) return bad(c, 'Fecha no válida');
  if (end_date && end_date < start_date) return bad(c, 'El fin no puede ser anterior al inicio.');
  if (await overlaps(c.env.DB, uid, start_date, end_date)) return bad(c, 'Se solapa con otra regla registrada.');
  const r = await c.env.DB.prepare('INSERT INTO periods (user_id, start_date, end_date) VALUES (?, ?, ?)').bind(uid, start_date, end_date || null).run();
  return c.json({ id: r.meta.last_row_id });
});

app.patch('/cycle/periods/:id', async (c) => {
  const uid = c.get('user').id;
  const id = Number(c.req.param('id'));
  const p = await c.env.DB.prepare('SELECT * FROM periods WHERE id = ? AND user_id = ?').bind(id, uid).first();
  if (!p) return bad(c, 'No encontrado', 404);
  const b = await c.req.json().catch(() => ({}));
  const start = b.start_date ?? p.start_date;
  const end = b.end_date === null ? null : b.end_date ?? p.end_date;
  if (!DATE_RE.test(start) || (end && !DATE_RE.test(end))) return bad(c, 'Fecha no válida');
  if (end && end < start) return bad(c, 'El fin no puede ser anterior al inicio.');
  if (await overlaps(c.env.DB, uid, start, end, id)) return bad(c, 'Se solapa con otra regla registrada.');
  await c.env.DB.prepare('UPDATE periods SET start_date = ?, end_date = ? WHERE id = ?').bind(start, end, id).run();
  return c.json({ ok: true });
});

app.delete('/cycle/periods/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM periods WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.get('user').id).run();
  return c.json({ ok: true });
});

app.put('/cycle/days/:date', async (c) => {
  const date = c.req.param('date');
  if (!DATE_RE.test(date)) return bad(c, 'Fecha no válida');
  const uid = c.get('user').id;
  const b = await c.req.json().catch(() => ({}));
  const flow = ['manchado', 'ligero', 'medio', 'abundante'].includes(b.flow) ? b.flow : null;
  const symptoms = Array.isArray(b.symptoms) ? b.symptoms.map(String).slice(0, 30) : [];
  if (!flow && !symptoms.length) await c.env.DB.prepare('DELETE FROM cycle_days WHERE user_id = ? AND date = ?').bind(uid, date).run();
  else await c.env.DB.prepare(
    `INSERT INTO cycle_days (user_id, date, flow, symptoms) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET flow = excluded.flow, symptoms = excluded.symptoms`
  ).bind(uid, date, flow, JSON.stringify(symptoms)).run();
  return c.json({ ok: true });
});

// ---------- Etiquetas ----------
app.get('/tags', async (c) =>
  c.json((await c.env.DB.prepare('SELECT id, name, uses FROM tags WHERE user_id = ? ORDER BY uses DESC, name').bind(c.get('user').id).all()).results)
);
app.post('/tags', async (c) => {
  const uid = c.get('user').id;
  const name = String((await c.req.json().catch(() => ({}))).name || '').trim().slice(0, 60);
  if (!name) return bad(c, 'Nombre vacío');
  await c.env.DB.prepare('INSERT INTO tags (user_id, name) VALUES (?, ?) ON CONFLICT(user_id, name) DO NOTHING').bind(uid, name).run();
  return c.json(await c.env.DB.prepare('SELECT id, name, uses FROM tags WHERE user_id = ? AND name = ?').bind(uid, name).first());
});
app.post('/tags/:id/use', async (c) => {
  await c.env.DB.prepare('UPDATE tags SET uses = uses + 1 WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.get('user').id).run();
  return c.json({ ok: true });
});
app.delete('/tags/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').bind(Number(c.req.param('id')), c.get('user').id).run();
  return c.json({ ok: true });
});

// ---------- Ajustes ----------
app.get('/settings', async (c) => c.json(await getSettings(c.env.DB, c.get('user').id)));
app.put('/settings', async (c) => {
  const uid = c.get('user').id;
  const cur = await getSettings(c.env.DB, uid);
  const b = await c.req.json().catch(() => ({}));
  const next = { ...cur };
  if ('start_date' in b) {
    if (b.start_date && !DATE_RE.test(b.start_date)) return bad(c, 'Fecha no válida');
    next.start_date = b.start_date || null;
  }
  if (typeof b.timezone === 'string' && b.timezone.length < 64) next.timezone = b.timezone;
  if (b.reminders && typeof b.reminders === 'object') {
    const rm = b.reminders;
    const meals = { ...cur.reminders.meals };
    for (const k of MEAL_KEYS) if (TIME_RE.test(rm.meals?.[k] || '')) meals[k] = rm.meals[k];
    const meals_on = { ...cur.reminders.meals_on };
    for (const k of MEAL_KEYS) if (rm.meals_on && k in rm.meals_on) meals_on[k] = !!rm.meals_on[k];
    next.reminders = {
      enabled: !!rm.enabled,
      meals,
      meals_on,
      water: {
        on: !!rm.water?.on,
        every_hours: Math.min(8, Math.max(1, Number(rm.water?.every_hours) || 3)),
        from: TIME_RE.test(rm.water?.from || '') ? rm.water.from : cur.reminders.water.from,
        to: TIME_RE.test(rm.water?.to || '') ? rm.water.to : cur.reminders.water.to,
      },
    };
  }
  await saveSettings(c.env.DB, uid, next);
  return c.json(next);
});

// ---------- Fotos (privadas, en R2) ----------
function sniff(buf) {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8) return ['image/jpeg', 'jpg'];
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ['image/png', 'png'];
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return ['image/webp', 'webp'];
  return null;
}

app.post('/photos', async (c) => {
  const uid = c.get('user').id;
  const form = await c.req.formData();
  const date = form.get('date');
  const meal = form.get('meal');
  const file = form.get('file');
  const thumb = form.get('thumb') || file;
  if (!DATE_RE.test(date || '') || !MEAL_KEYS.includes(meal) || !(file instanceof File)) return bad(c);
  if (file.size > 12 * 1024 * 1024 || thumb.size > 12 * 1024 * 1024) return bad(c, 'Imagen demasiado grande', 413);
  const fb = await file.arrayBuffer();
  const tb = thumb === file ? fb : await thumb.arrayBuffer();
  const t1 = sniff(fb);
  const t2 = sniff(tb);
  if (!t1 || !t2) return bad(c, 'Formato de imagen no admitido');
  const id = crypto.randomUUID();
  const fileKey = `${uid}/${id}.${t1[1]}`;
  const thumbKey = `${uid}/${id}_t.${t2[1]}`;
  await c.env.PHOTOS.put(fileKey, fb, { httpMetadata: { contentType: t1[0] } });
  await c.env.PHOTOS.put(thumbKey, tb, { httpMetadata: { contentType: t2[0] } });
  await c.env.DB.prepare('INSERT INTO photos (id, user_id, date, meal, file, thumb) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, uid, date, meal, fileKey, thumbKey).run();
  return c.json({ id, meal, date });
});

app.get('/photos', async (c) => {
  const q = c.req.query();
  const where = ['user_id = ?'];
  const args = [c.get('user').id];
  if (DATE_RE.test(q.from || '')) { where.push('date >= ?'); args.push(q.from); }
  if (DATE_RE.test(q.to || '')) { where.push('date <= ?'); args.push(q.to); }
  if (MEAL_KEYS.includes(q.meal)) { where.push('meal = ?'); args.push(q.meal); }
  const rows = await c.env.DB.prepare(
    `SELECT id, date, meal, created_at FROM photos WHERE ${where.join(' AND ')} ORDER BY date DESC, created_at DESC LIMIT 500`
  ).bind(...args).all();
  return c.json(rows.results);
});

// Las fotos sólo se sirven a su propietaria, comprobando la sesión en cada petición.
app.get('/photos/:id/:kind{full|thumb}', async (c) => {
  const p = await c.env.DB.prepare('SELECT file, thumb FROM photos WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first();
  if (!p) return c.body(null, 404);
  const obj = await c.env.PHOTOS.get(c.req.param('kind') === 'thumb' ? p.thumb : p.file);
  if (!obj) return c.body(null, 404);
  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
});

app.delete('/photos/:id', async (c) => {
  const uid = c.get('user').id;
  const p = await c.env.DB.prepare('SELECT file, thumb FROM photos WHERE id = ? AND user_id = ?').bind(c.req.param('id'), uid).first();
  if (!p) return bad(c, 'No encontrada', 404);
  await c.env.PHOTOS.delete([p.file, p.thumb]);
  await c.env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ---------- Notificaciones push ----------
app.get('/push/key', async (c) => c.json({ publicKey: await vapidPublicKey(c.env.DB) }));
app.post('/push/subscribe', async (c) => {
  const s = (await c.req.json().catch(() => ({}))).subscription;
  if (!s?.endpoint?.startsWith('https://') || !s?.keys?.p256dh || !s?.keys?.auth) return bad(c, 'Suscripción no válida');
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, keys) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys`
  ).bind(s.endpoint, c.get('user').id, JSON.stringify(s.keys)).run();
  return c.json({ ok: true });
});
app.post('/push/test', async (c) => {
  const sent = await sendTo(c.env.DB, c.get('user').id, { title: 'NutriLife', body: '¡Las notificaciones funcionan! 🌿', url: '/' });
  return c.json({ sent });
});

app.all('*', (c) => bad(c, 'No encontrado', 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Error del servidor' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(ensureSchema(env.DB).then(() => runReminders(env.DB)));
  },
};
