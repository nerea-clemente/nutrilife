// Lógica del ciclo menstrual compartida entre cliente y servidor.
// Todas las fechas son cadenas 'YYYY-MM-DD' (fecha local, sin zona horaria).

const DAY = 86400000;

export function toUTC(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date, n) {
  return fromUTC(toUTC(date) + n * DAY);
}

export function diffDays(a, b) {
  return Math.round((toUTC(a) - toUTC(b)) / DAY);
}

export const DEFAULT_CYCLE = 28;
export const DEFAULT_PERIOD = 5;

export const PHASES = {
  menstrual: { label: 'Menstrual', short: 'Mens.', color: '#C4505E' },
  folicular: { label: 'Folicular', short: 'Fol.', color: '#2F8FB5' },
  ovulatoria: { label: 'Ovulatoria', short: 'Ovul.', color: '#B8860B' },
  lutea: { label: 'Lútea', short: 'Lút.', color: '#7B68C8' },
};

/**
 * Calcula estadísticas a partir de la lista de reglas [{start_date, end_date}].
 */
export function cycleStats(periods) {
  const sorted = [...periods]
    .filter((p) => p.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = diffDays(sorted[i].start_date, sorted[i - 1].start_date);
    if (len >= 15 && len <= 60) lengths.push(len);
  }
  const recent = lengths.slice(-6);
  const avgCycle = recent.length
    ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
    : DEFAULT_CYCLE;
  const periodLens = sorted
    .filter((p) => p.end_date)
    .map((p) => diffDays(p.end_date, p.start_date) + 1)
    .filter((l) => l >= 1 && l <= 15)
    .slice(-6);
  const avgPeriod = periodLens.length
    ? Math.round(periodLens.reduce((a, b) => a + b, 0) / periodLens.length)
    : DEFAULT_PERIOD;
  return { sorted, avgCycle, avgPeriod, cycleLengths: lengths, basedOn: recent.length };
}

/**
 * Fase aproximada dado el día del ciclo.
 * Ovulación estimada ~14 días antes de la siguiente regla.
 */
export function phaseFor(cycleDay, avgCycle, periodLen) {
  const ovulation = Math.max(avgCycle - 14, periodLen + 2);
  if (cycleDay <= periodLen) return 'menstrual';
  if (cycleDay < ovulation - 1) return 'folicular';
  if (cycleDay <= ovulation + 1) return 'ovulatoria';
  return 'lutea';
}

/**
 * Información de ciclo para una fecha concreta, o null si no hay historial.
 */
export function cycleInfo(date, stats) {
  const { sorted, avgCycle, avgPeriod } = stats;
  let current = null;
  for (const p of sorted) {
    if (p.start_date <= date) current = p;
    else break;
  }
  if (!current) return null;
  const cycleDay = diffDays(date, current.start_date) + 1;
  // Si han pasado demasiados días sin registrar regla, no inventamos datos.
  if (cycleDay > Math.max(avgCycle * 2, 60)) return null;
  const periodLen = current.end_date
    ? diffDays(current.end_date, current.start_date) + 1
    : avgPeriod;
  const inPeriod = current.end_date
    ? date <= current.end_date
    : cycleDay <= avgPeriod;
  let phase = phaseFor(cycleDay, avgCycle, periodLen);
  if (inPeriod) phase = 'menstrual';
  else if (phase === 'menstrual') phase = 'folicular';
  return { cycleDay, phase, periodStart: current.start_date, inPeriod, late: cycleDay > avgCycle };
}

/** Predice próximas reglas a partir de la última registrada. */
export function predictions(stats, count = 3) {
  const { sorted, avgCycle, avgPeriod } = stats;
  if (!sorted.length) return [];
  const last = sorted[sorted.length - 1].start_date;
  const out = [];
  for (let i = 1; i <= count; i++) {
    const start = addDays(last, avgCycle * i);
    out.push({ start, end: addDays(start, avgPeriod - 1) });
  }
  return out;
}

/** Fase prevista para fechas futuras (sin regla registrada todavía). */
export function predictedInfo(date, stats) {
  const real = cycleInfo(date, stats);
  if (real && !real.late) return real;
  const preds = predictions(stats, 6);
  let base = null;
  for (const p of preds) if (p.start <= date) base = p.start;
  if (!base) return real;
  const cycleDay = diffDays(date, base) + 1;
  return {
    cycleDay,
    phase: phaseFor(cycleDay, stats.avgCycle, stats.avgPeriod),
    periodStart: base,
    inPeriod: cycleDay <= stats.avgPeriod,
    predicted: true,
  };
}
