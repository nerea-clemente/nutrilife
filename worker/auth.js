import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export const COOKIE = 'nl_session';
const SESSION_DAYS = 60;
const ITER = 100000; // máximo permitido por PBKDF2 en Workers

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await pbkdf2(pw, salt, ITER))}`;
}

export async function verifyPassword(pw, stored) {
  const [, iter, salt, hash] = stored.split('$');
  const actual = new Uint8Array(await pbkdf2(pw, unb64(salt), Number(iter)));
  const expected = unb64(hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function randomId() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createSession(c, userId) {
  const id = randomId();
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(id, userId, Date.now() + SESSION_DAYS * 86400000).run();
  setCookie(c, COOKIE, id, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: SESSION_DAYS * 86400,
    path: '/',
  });
}

export async function destroySession(c) {
  const id = getCookie(c, COOKIE);
  if (id) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  deleteCookie(c, COOKIE, { path: '/' });
}

export async function loadUser(c, next) {
  const id = getCookie(c, COOKIE);
  if (id) {
    const row = await c.env.DB.prepare(
      'SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?'
    ).bind(id).first();
    if (row && row.expires_at > Date.now()) c.set('user', { id: row.id, email: row.email, name: row.name });
    else if (row) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  }
  await next();
}

export async function requireUser(c, next) {
  if (!c.get('user')) return c.json({ error: 'No autenticado' }, 401);
  await next();
}

// Protección CSRF: las peticiones que modifican datos deben venir de la propia web.
export async function sameOrigin(c, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: 'Origen no permitido' }, 403);
  }
  await next();
}

// Máximo 10 intentos de login/registro cada 15 minutos por IP.
export async function loginRateLimit(c, next) {
  const ip = c.req.header('cf-connecting-ip') || 'local';
  const since = Date.now() - 15 * 60000;
  const db = c.env.DB;
  await db.prepare('DELETE FROM login_attempts WHERE ts < ?').bind(since).run();
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ?').bind(ip).first();
  if (n >= 10) return c.json({ error: 'Demasiados intentos. Espera unos minutos.' }, 429);
  await db.prepare('INSERT INTO login_attempts (ip, ts) VALUES (?, ?)').bind(ip, Date.now()).run();
  await next();
}
