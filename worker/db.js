// Esquema de la base de datos D1. Se crea automáticamente en la primera petición.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT,
    password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS entries (
    user_id INTEGER NOT NULL, date TEXT NOT NULL, data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, date))`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, date TEXT NOT NULL, meal TEXT NOT NULL,
    file TEXT NOT NULL, thumb TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS photos_user_date ON photos(user_id, date)`,
  `CREATE TABLE IF NOT EXISTS periods (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT)`,
  `CREATE TABLE IF NOT EXISTS cycle_days (
    user_id INTEGER NOT NULL, date TEXT NOT NULL, flow TEXT, symptoms TEXT NOT NULL DEFAULT '[]', PRIMARY KEY (user_id, date))`,
  `CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, uses INTEGER NOT NULL DEFAULT 0, UNIQUE (user_id, name))`,
  `CREATE TABLE IF NOT EXISTS settings (user_id INTEGER PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, user_id INTEGER NOT NULL, keys TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reminder_log (user_id INTEGER NOT NULL, key TEXT NOT NULL, PRIMARY KEY (user_id, key))`,
  `CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT NOT NULL, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
];

let ready = null;
export function ensureSchema(db) {
  if (!ready) ready = db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { ready = null; throw e; });
  return ready;
}

export const DEFAULT_SETTINGS = {
  start_date: null,
  timezone: 'Europe/Madrid',
  reminders: {
    enabled: false,
    meals: { desayuno: '09:30', comida: '15:00', snack: '18:00', cena: '22:00' },
    meals_on: { desayuno: true, comida: true, snack: false, cena: true },
    water: { on: true, every_hours: 3, from: '10:00', to: '21:00' },
  },
};

export async function getSettings(db, userId) {
  const row = await db.prepare('SELECT data FROM settings WHERE user_id = ?').bind(userId).first();
  const s = row ? JSON.parse(row.data) : {};
  const d = DEFAULT_SETTINGS.reminders;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    reminders: {
      ...d,
      ...(s.reminders || {}),
      meals: { ...d.meals, ...(s.reminders?.meals || {}) },
      meals_on: { ...d.meals_on, ...(s.reminders?.meals_on || {}) },
      water: { ...d.water, ...(s.reminders?.water || {}) },
    },
  };
}

export function saveSettings(db, userId, s) {
  return db
    .prepare('INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data')
    .bind(userId, JSON.stringify(s))
    .run();
}
