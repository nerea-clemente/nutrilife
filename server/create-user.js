// Crea (o actualiza la contraseña de) la usuaria desde la terminal:
//   npm run create-user -- email@ejemplo.com "contraseña" "Nombre"
import { db } from './db.js';
import { hashPassword } from './auth.js';

const [email, password, name] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Uso: npm run create-user -- <email> <contraseña (mín. 8)> [nombre]');
  process.exit(1);
}
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare('UPDATE users SET password_hash = ?, name = COALESCE(?, name) WHERE id = ?').run(hashPassword(password), name || null, existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log('Contraseña actualizada para', email);
} else {
  db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(email, name || null, hashPassword(password));
  console.log('Usuaria creada:', email);
}
