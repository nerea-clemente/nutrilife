import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'nutrilife.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  meal TEXT NOT NULL,
  file TEXT NOT NULL,
  thumb TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS photos_user_date ON photos(user_id, date);

CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT
);

CREATE TABLE IF NOT EXISTS cycle_days (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  flow TEXT,
  symptoms TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keys TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_log (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
`);

export const DEFAULT_SETTINGS = {
  start_date: null, // fecha del día nº 1 del diario
  timezone: 'Europe/Madrid',
  reminders: {
    enabled: false,
    meals: { desayuno: '09:30', comida: '15:00', snack: '18:00', cena: '22:00' },
    meals_on: { desayuno: true, comida: true, snack: false, cena: true },
    water: { on: true, every_hours: 3, from: '10:00', to: '21:00' },
  },
};

export function getSettings(userId) {
  const row = db.prepare('SELECT data FROM settings WHERE user_id = ?').get(userId);
  const s = row ? JSON.parse(row.data) : {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    reminders: {
      ...DEFAULT_SETTINGS.reminders,
      ...(s.reminders || {}),
      meals: { ...DEFAULT_SETTINGS.reminders.meals, ...(s.reminders?.meals || {}) },
      meals_on: { ...DEFAULT_SETTINGS.reminders.meals_on, ...(s.reminders?.meals_on || {}) },
      water: { ...DEFAULT_SETTINGS.reminders.water, ...(s.reminders?.water || {}) },
    },
  };
}

export function saveSettings(userId, s) {
  db.prepare(
    'INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data'
  ).run(userId, JSON.stringify(s));
}

export function getPeriods(userId) {
  return db
    .prepare('SELECT id, start_date, end_date FROM periods WHERE user_id = ? ORDER BY start_date')
    .all(userId)
    .map((r) => ({ ...r }));
}
