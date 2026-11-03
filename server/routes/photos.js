import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR } from '../db.js';
import { requireUser } from '../auth.js';

const r = Router();
r.use(requireUser);

const MEAL_KEYS = ['desayuno', 'comida', 'snack', 'cena'];
const OK_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => cb(null, !!OK_TYPES[file.mimetype]),
});

function userDir(userId) {
  const d = path.join(UPLOAD_DIR, String(userId));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Comprueba la firma real del archivo (no sólo el mimetype declarado)
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

r.post('/photos', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'thumb', maxCount: 1 }]), (req, res) => {
  const { date, meal } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !MEAL_KEYS.includes(meal))
    return res.status(400).json({ error: 'Datos no válidos' });
  const file = req.files?.file?.[0];
  const thumb = req.files?.thumb?.[0] || file;
  if (!file) return res.status(400).json({ error: 'Falta la imagen' });
  const t1 = sniff(file.buffer);
  const t2 = sniff(thumb.buffer);
  if (!t1 || !t2) return res.status(400).json({ error: 'Formato de imagen no admitido' });
  const id = crypto.randomUUID();
  const dir = userDir(req.user.id);
  const fileName = `${id}${OK_TYPES[t1]}`;
  const thumbName = `${id}_t${OK_TYPES[t2]}`;
  fs.writeFileSync(path.join(dir, fileName), file.buffer);
  fs.writeFileSync(path.join(dir, thumbName), thumb.buffer);
  db.prepare('INSERT INTO photos (id, user_id, date, meal, file, thumb) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, req.user.id, date, meal, fileName, thumbName
  );
  res.json({ id, meal, date });
});

r.get('/photos', (req, res) => {
  const where = ['user_id = ?'];
  const args = [req.user.id];
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { where.push('date >= ?'); args.push(req.query.from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { where.push('date <= ?'); args.push(req.query.to); }
  if (MEAL_KEYS.includes(req.query.meal)) { where.push('meal = ?'); args.push(req.query.meal); }
  const rows = db
    .prepare(`SELECT id, date, meal, created_at FROM photos WHERE ${where.join(' AND ')} ORDER BY date DESC, created_at DESC LIMIT 500`)
    .all(...args)
    .map((p) => ({ ...p }));
  res.json(rows);
});

// Las fotos sólo se sirven a su propietaria, nunca con URL pública.
function sendPhoto(kind) {
  return (req, res) => {
    const p = db.prepare('SELECT file, thumb FROM photos WHERE id = ? AND user_id = ?').get(String(req.params.id), req.user.id);
    if (!p) return res.status(404).end();
    const fp = path.join(userDir(req.user.id), kind === 'thumb' ? p.thumb : p.file);
    res.set('Cache-Control', 'private, max-age=86400');
    res.sendFile(fp);
  };
}
r.get('/photos/:id/full', sendPhoto('full'));
r.get('/photos/:id/thumb', sendPhoto('thumb'));

r.delete('/photos/:id', (req, res) => {
  const p = db.prepare('SELECT file, thumb FROM photos WHERE id = ? AND user_id = ?').get(String(req.params.id), req.user.id);
  if (!p) return res.status(404).json({ error: 'No encontrada' });
  const dir = userDir(req.user.id);
  for (const f of [p.file, p.thumb]) fs.rmSync(path.join(dir, f), { force: true });
  db.prepare('DELETE FROM photos WHERE id = ?').run(String(req.params.id));
  res.json({ ok: true });
});

export default r;
