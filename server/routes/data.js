import { Router } from 'express';
import { db, getSettings, saveSettings, getPeriods } from '../db.js';
import { requireUser } from '../auth.js';
import { normalizeEntry } from '../../shared/constants.js';

const r = Router();
r.use(requireUser);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function checkDate(d) {
  if (!DATE_RE.test(String(d || ''))) {
    const e = new Error('Fecha no válida');
    e.status = 400;
    e.expose = true;
    throw e;
  }
  return d;
}

// ---------- Entradas diarias ----------
r.get('/entries', (req, res) => {
  const from = checkDate(req.query.from);
  const to = checkDate(req.query.to);
  const rows = db
    .prepare('SELECT date, data, updated_at FROM entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date')
    .all(req.user.id, from, to);
  const photoCounts = db
    .prepare('SELECT date, COUNT(*) AS n FROM photos WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date')
    .all(req.user.id, from, to);
  const pc = Object.fromEntries(photoCounts.map((p) => [p.date, p.n]));
  res.json(rows.map((r) => ({ date: r.date, data: normalizeEntry(JSON.parse(r.data)), updated_at: r.updated_at, photos: pc[r.date] || 0 })));
});

r.get('/entries/:date', (req, res) => {
  const date = checkDate(req.params.date);
  const row = db.prepare('SELECT data, updated_at FROM entries WHERE user_id = ? AND date = ?').get(req.user.id, date);
  const photos = db
    .prepare('SELECT id, meal, created_at FROM photos WHERE user_id = ? AND date = ? ORDER BY created_at')
    .all(req.user.id, date)
    .map((p) => ({ ...p }));
  res.json({
    date,
    exists: !!row,
    data: normalizeEntry(row ? JSON.parse(row.data) : null),
    updated_at: row?.updated_at || null,
    photos,
  });
});

r.put('/entries/:date', (req, res) => {
  const date = checkDate(req.params.date);
  const data = normalizeEntry(req.body?.data);
  // Validaciones ligeras
  for (const m of Object.values(data.meals)) {
    if (m.time && !TIME_RE.test(m.time)) m.time = '';
    m.text = String(m.text || '').slice(0, 4000);
  }
  data.water_ml = Math.max(0, Math.min(20000, Math.round(Number(data.water_ml) || 0)));
  data.notes = String(data.notes || '').slice(0, 10000);
  data.drinks = String(data.drinks || '').slice(0, 4000);
  const json = JSON.stringify(data);
  if (json.length > 200000) return res.status(413).json({ error: 'Entrada demasiado grande' });
  db.prepare(
    `INSERT INTO entries (user_id, date, data, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(req.user.id, date, json);
  // El primer registro fija el día nº 1 si aún no hay fecha de inicio
  const s = getSettings(req.user.id);
  if (!s.start_date) {
    const first = db.prepare('SELECT MIN(date) AS d FROM entries WHERE user_id = ?').get(req.user.id).d;
    saveSettings(req.user.id, { ...s, start_date: first });
  }
  res.json({ ok: true, updated_at: new Date().toISOString() });
});

r.delete('/entries/:date', (req, res) => {
  const date = checkDate(req.params.date);
  db.prepare('DELETE FROM entries WHERE user_id = ? AND date = ?').run(req.user.id, date);
  res.json({ ok: true });
});

// ---------- Ciclo ----------
r.get('/cycle', (req, res) => {
  const periods = getPeriods(req.user.id);
  const days = db
    .prepare('SELECT date, flow, symptoms FROM cycle_days WHERE user_id = ? ORDER BY date')
    .all(req.user.id)
    .map((d) => ({ date: d.date, flow: d.flow, symptoms: JSON.parse(d.symptoms) }));
  res.json({ periods, days });
});

function overlaps(userId, start, end, exceptId) {
  const rows = getPeriods(userId).filter((p) => p.id !== exceptId);
  const e = end || start;
  return rows.some((p) => !(e < p.start_date || start > (p.end_date || p.start_date)));
}

r.post('/cycle/periods', (req, res) => {
  const start = checkDate(req.body?.start_date);
  const end = req.body?.end_date ? checkDate(req.body.end_date) : null;
  if (end && end < start) return res.status(400).json({ error: 'El fin no puede ser anterior al inicio.' });
  if (overlaps(req.user.id, start, end)) return res.status(400).json({ error: 'Se solapa con otra regla registrada.' });
  const info = db
    .prepare('INSERT INTO periods (user_id, start_date, end_date) VALUES (?, ?, ?)')
    .run(req.user.id, start, end);
  res.json({ id: Number(info.lastInsertRowid) });
});

r.patch('/cycle/periods/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare('SELECT * FROM periods WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  const start = req.body?.start_date ? checkDate(req.body.start_date) : p.start_date;
  const end = req.body?.end_date === null ? null : req.body?.end_date ? checkDate(req.body.end_date) : p.end_date;
  if (end && end < start) return res.status(400).json({ error: 'El fin no puede ser anterior al inicio.' });
  if (overlaps(req.user.id, start, end, id)) return res.status(400).json({ error: 'Se solapa con otra regla registrada.' });
  db.prepare('UPDATE periods SET start_date = ?, end_date = ? WHERE id = ?').run(start, end, id);
  res.json({ ok: true });
});

r.delete('/cycle/periods/:id', (req, res) => {
  db.prepare('DELETE FROM periods WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

r.put('/cycle/days/:date', (req, res) => {
  const date = checkDate(req.params.date);
  const flow = ['manchado', 'ligero', 'medio', 'abundante'].includes(req.body?.flow) ? req.body.flow : null;
  const symptoms = Array.isArray(req.body?.symptoms) ? req.body.symptoms.map(String).slice(0, 30) : [];
  if (!flow && !symptoms.length) {
    db.prepare('DELETE FROM cycle_days WHERE user_id = ? AND date = ?').run(req.user.id, date);
  } else {
    db.prepare(
      `INSERT INTO cycle_days (user_id, date, flow, symptoms) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET flow = excluded.flow, symptoms = excluded.symptoms`
    ).run(req.user.id, date, flow, JSON.stringify(symptoms));
  }
  res.json({ ok: true });
});

// ---------- Etiquetas rápidas ----------
r.get('/tags', (req, res) => {
  res.json(
    db.prepare('SELECT id, name, uses FROM tags WHERE user_id = ? ORDER BY uses DESC, name').all(req.user.id).map((t) => ({ ...t }))
  );
});

r.post('/tags', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'Nombre vacío' });
  db.prepare('INSERT INTO tags (user_id, name) VALUES (?, ?) ON CONFLICT(user_id, name) DO NOTHING').run(req.user.id, name);
  const t = db.prepare('SELECT id, name, uses FROM tags WHERE user_id = ? AND name = ?').get(req.user.id, name);
  res.json({ ...t });
});

r.post('/tags/:id/use', (req, res) => {
  db.prepare('UPDATE tags SET uses = uses + 1 WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

r.delete('/tags/:id', (req, res) => {
  db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

// ---------- Ajustes ----------
r.get('/settings', (req, res) => res.json(getSettings(req.user.id)));

r.put('/settings', (req, res) => {
  const cur = getSettings(req.user.id);
  const b = req.body || {};
  const next = { ...cur };
  if ('start_date' in b) next.start_date = b.start_date ? checkDate(b.start_date) : null;
  if (typeof b.timezone === 'string' && b.timezone.length < 64) next.timezone = b.timezone;
  if (b.reminders && typeof b.reminders === 'object') {
    const rm = b.reminders;
    next.reminders = {
      enabled: !!rm.enabled,
      meals: Object.fromEntries(
        Object.entries({ ...cur.reminders.meals, ...(rm.meals || {}) }).map(([k, v]) => [k, TIME_RE.test(v) ? v : cur.reminders.meals[k]])
      ),
      meals_on: Object.fromEntries(Object.entries({ ...cur.reminders.meals_on, ...(rm.meals_on || {}) }).map(([k, v]) => [k, !!v])),
      water: {
        on: !!rm.water?.on,
        every_hours: Math.min(8, Math.max(1, Number(rm.water?.every_hours) || 3)),
        from: TIME_RE.test(rm.water?.from) ? rm.water.from : cur.reminders.water.from,
        to: TIME_RE.test(rm.water?.to) ? rm.water.to : cur.reminders.water.to,
      },
    };
  }
  saveSettings(req.user.id, next);
  res.json(next);
});

export default r;
