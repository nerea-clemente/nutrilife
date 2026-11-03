import { Router } from 'express';
import { db } from '../db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, requireUser, loginRateLimit,
} from '../auth.js';

const r = Router();

function signupAllowed() {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  // Aplicación personal: sólo se puede crear una cuenta, y la primera.
  if (n > 0) return false;
  // En producción hace falta un código de configuración para evitar que otra persona se adelante.
  if (process.env.NODE_ENV === 'production' && !process.env.SETUP_CODE) return false;
  return true;
}

r.get('/status', (req, res) => {
  res.json({
    user: req.user || null,
    canSignup: signupAllowed(),
    needsSetupCode: !!process.env.SETUP_CODE,
  });
});

r.post('/signup', loginRateLimit, (req, res) => {
  if (!signupAllowed()) return res.status(403).json({ error: 'El registro está cerrado.' });
  const { email, password, name, setup_code } = req.body || {};
  if (process.env.SETUP_CODE && setup_code !== process.env.SETUP_CODE)
    return res.status(403).json({ error: 'Código de configuración incorrecto.' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Email no válido.' });
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  const info = db
    .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(email.trim(), (name || '').trim() || null, hashPassword(password));
  createSession(res, Number(info.lastInsertRowid));
  res.json({ ok: true });
});

r.post('/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(String(email || '').trim());
  if (!u || !password || !verifyPassword(String(password), u.password_hash))
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  createSession(res, u.id);
  res.json({ ok: true });
});

r.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

r.post('/password', requireUser, (req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(String(current || ''), u.password_hash))
    return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  if (!next || next.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
  // Cerrar el resto de sesiones
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  createSession(res, req.user.id);
  res.json({ ok: true });
});

export default r;
