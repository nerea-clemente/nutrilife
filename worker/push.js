import { buildPushHTTPRequest } from '@pushforge/builder';
import { getSettings } from './db.js';
import { normalizeEntry, MEALS } from '../shared/constants.js';

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Claves VAPID generadas una sola vez y guardadas en la base de datos: sin configuración manual.
async function vapid(db) {
  const row = await db.prepare("SELECT v FROM app_kv WHERE k = 'vapid'").first();
  if (row) return JSON.parse(row.v);
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privateJWK = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
  const v = { privateJWK, publicKey };
  await db.prepare("INSERT OR IGNORE INTO app_kv (k, v) VALUES ('vapid', ?)").bind(JSON.stringify(v)).run();
  return JSON.parse((await db.prepare("SELECT v FROM app_kv WHERE k = 'vapid'").first()).v);
}

export async function vapidPublicKey(db) {
  return (await vapid(db)).publicKey;
}

export async function sendTo(db, userId, payload) {
  const { privateJWK } = await vapid(db);
  const subs = (await db.prepare('SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?').bind(userId).all()).results;
  let sent = 0;
  for (const s of subs) {
    try {
      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK,
        subscription: { endpoint: s.endpoint, keys: JSON.parse(s.keys) },
        message: { payload, adminContact: 'mailto:nutrilife@example.com', options: { ttl: 3600 } },
      });
      const res = await fetch(endpoint, { method: 'POST', headers, body });
      if (res.status === 404 || res.status === 410) await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(s.endpoint).run();
      else if (res.ok) sent++;
      else console.warn('push', res.status, await res.text());
    } catch (e) {
      console.warn('push error', e.message);
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

export async function runReminders(db) {
  const users = (await db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all()).results;
  for (const { user_id } of users) {
    const s = await getSettings(db, user_id);
    if (!s.reminders.enabled) continue;
    let now;
    try { now = localNow(s.timezone); } catch { now = localNow('Europe/Madrid'); }
    const row = await db.prepare('SELECT data FROM entries WHERE user_id = ? AND date = ?').bind(user_id, now.date).first();
    const entry = normalizeEntry(row ? JSON.parse(row.data) : null);
    const once = async (key) => (await db.prepare('INSERT OR IGNORE INTO reminder_log (user_id, key) VALUES (?, ?)').bind(user_id, `${now.date}:${key}`).run()).meta.changes > 0;

    for (const m of MEALS) {
      if (!s.reminders.meals_on[m.key] || s.reminders.meals[m.key] !== now.time) continue;
      if (entry.meals[m.key].text.trim()) continue; // ya registrada
      if (await once(`meal:${m.key}`))
        await sendTo(db, user_id, { title: `${m.icon} ¿Qué has tomado en ${m.label.toLowerCase()}?`, body: 'Apúntalo ahora en tu diario.', url: '/' });
    }
    const w = s.reminders.water;
    if (w.on) {
      const cur = toMin(now.time), from = toMin(w.from), to = toMin(w.to);
      if (cur >= from && cur <= to && (cur - from) % (w.every_hours * 60) === 0 && (await once(`water:${now.time}`))) {
        const b = String(Math.round((entry.water_ml / 750) * 10) / 10).replace('.', ',');
        await sendTo(db, user_id, { title: '💧 Hora de beber agua', body: `Llevas ${entry.water_ml} ml hoy (${b} botellas).`, url: '/' });
      }
    }
  }
  await db.prepare("DELETE FROM reminder_log WHERE substr(key, 1, 10) < date('now', '-3 days')").run();
}
