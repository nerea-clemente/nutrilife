import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_DAYS = 60;
export const COOKIE = 'nl_session';
const isProd = process.env.NODE_ENV === 'production';

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw, stored) {
  const [, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export function createSession(res, userId) {
  const id = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expires);
  res.cookie(COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: SESSION_DAYS * 86400000,
    path: '/',
  });
}

export function destroySession(req, res) {
  const id = req.cookies?.[COOKIE];
  if (id) db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  res.clearCookie(COOKIE, { path: '/' });
}

export function loadUser(req, _res, next) {
  const id = req.cookies?.[COOKIE];
  if (id) {
    const row = db
      .prepare(
        'SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?'
      )
      .get(id);
    if (row && row.expires_at > Date.now()) req.user = { id: row.id, email: row.email, name: row.name };
    else if (row) db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  next();
}

// Protección CSRF básica: las peticiones que modifican datos deben venir del mismo origen.
export function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    const host = req.get('x-forwarded-host') || req.get('host');
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: 'Origen no permitido' });
    } catch {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
  }
  next();
}

// Límite sencillo de intentos de login por IP.
const attempts = new Map();
export function loginRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < 15 * 60000);
  if (a.length >= 10) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  a.push(now);
  attempts.set(key, a);
  next();
}

export function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}
