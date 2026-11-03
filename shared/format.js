import { toUTC, diffDays } from './cycle.js';
import { BOTTLE_ML } from './constants.js';

export function fmtDate(date, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('es-ES', { ...opts, timeZone: 'UTC' }).format(new Date(toUTC(date)));
}

export function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function dayNumber(date, startDate) {
  if (!startDate) return null;
  const n = diffDays(date, startDate) + 1;
  return n >= 1 ? n : null;
}

export function bottles(ml) {
  const b = Math.round((ml / BOTTLE_ML) * 10) / 10;
  return String(b).replace('.', ',');
}

export function yesNo(v) {
  return v === true ? 'Sí' : v === false ? 'No' : '';
}
