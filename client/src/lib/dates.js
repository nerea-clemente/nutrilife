import { addDays } from '@shared/cycle.js';

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function monthGrid(year, month) {
  // month 0-11; semanas empiezan en lunes
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const dow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const start = addDays(first, -dow);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    days.push({ date: d, inMonth: Number(d.slice(5, 7)) === month + 1 });
  }
  // recortar la última semana si queda vacía
  if (!days[35].inMonth) days.length = 35;
  if (!days[28].inMonth) days.length = 28;
  return days;
}

export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export { addDays };
