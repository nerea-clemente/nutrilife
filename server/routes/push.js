import { Router } from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR, getSettings } from '../db.js';
import { requireUser } from '../auth.js';
import { normalizeEntry, MEALS } from '../../shared/constants.js';

// Claves VAPID: de variables de entorno o generadas y guardadas en el directorio de datos.
function vapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  const f = path.join(DATA_DIR, 'vapid.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const k = webpush.generateVAPIDKeys();
  fs.writeFileSync(f, JSON.stringify(k), { mode: 0o600 });
  return k;
}
const keys = vapidKeys();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@localhost', keys.publicKey, keys.privateKey);

const r = Router();
r.use(requireUser);

r.get('/key', (_req, res) => res.json({ publicKey: keys.publicKey }));

r.post('/subscribe', (req, res) => {
  const s = req.body?.subscription;
  if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return res.status(400).json({ error: 'Suscripción no válida' });
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, keys) VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys`
  ).run(s.endpoint, req.user.id, JSON.stringify(s.keys));
  res.json({ ok: true });
});

r.post('/unsubscribe', (req, res) => {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(String(req.body?.endpoint || ''), req.user.id);
  res.json({ ok: true });
});

r.post('/test', async (req, res) => {
  const n = await sendTo(req.user.id, { title: 'NutriLife', body: '¡Las notificaciones funcionan! 🌿', url: '/' });
  res.json({ sent: n });
});

async function sendTo(userId, payload) {
  const subs = db.prepare('SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?').all(userId);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410)
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
      else console.warn('push error', e.statusCode || e.message);
    }
  }
  return sent;
}

function localNow(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}` };
}

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

async function tick() {
  const users = db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all();
  for (const { user_id } of users) {
    const s = getSettings(user_id);
    if (!s.reminders.enabled) continue;
    let now;
    try { now = localNow(s.timezone); } catch { now = localNow('Europe/Madrid'); }
    const row = db.prepare('SELECT data FROM entries WHERE user_id = ? AND date = ?').get(user_id, now.date);
    const entry = normalizeEntry(row ? JSON.parse(row.data) : null);
    const once = (key) => {
      const k = `${now.date}:${key}`;
      const res = db.prepare('INSERT OR IGNORE INTO reminder_log (user_id, key) VALUES (?, ?)').run(user_id, k);
      return res.changes > 0;
    };
    for (const m of MEALS) {
      const t = s.reminders.meals[m.key];
      if (!s.reminders.meals_on[m.key] || !t) continue;
      // Sólo avisamos si esa comida aún no está registrada
      if (now.time === t && !entry.meals[m.key].text.trim() && once(`meal:${m.key}`))
        await sendTo(user_id, { title: `${m.icon} ¿Qué has tomado en ${m.label.toLowerCase()}?`, body: 'Apúntalo ahora en tu diario.', url: '/' });
    }
    const w = s.reminders.water;
    if (w.on) {
      const cur = toMin(now.time), from = toMin(w.from), to = toMin(w.to);
      if (cur >= from && cur <= to && (cur - from) % (w.every_hours * 60) === 0 && once(`water:${now.time}`)) {
        const bottles = (entry.water_ml / 750).toFixed(1).replace('.0', '').replace('.', ',');
        await sendTo(user_id, { title: '💧 Hora de beber agua', body: `Llevas ${entry.water_ml} ml hoy (${bottles} botellas).`, url: '/' });
      }
    }
  }
  // Limpieza del registro de avisos antiguos
  db.prepare("DELETE FROM reminder_log WHERE substr(key, 1, 10) < date('now', '-3 days')").run();
}

export function startScheduler() {
  const run = () => tick().catch((e) => console.error('scheduler', e));
  // Alinear al inicio de cada minuto
  setTimeout(() => {
    run();
    setInterval(run, 60000).unref();
  }, 60000 - (Date.now() % 60000) + 500).unref();
}

export default r;
