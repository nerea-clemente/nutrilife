export const MEALS = [
  { key: 'desayuno', label: 'Desayuno', icon: '☀️' },
  { key: 'comida', label: 'Comida', icon: '🍽️' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
  { key: 'cena', label: 'Cena', icon: '🌙' },
];

export const BOTTLE_ML = 750;

export const BRISTOL = [
  { n: 1, label: 'Tipo 1', desc: 'Bolitas duras separadas', group: 'Estreñimiento' },
  { n: 2, label: 'Tipo 2', desc: 'Forma de salchicha, grumosa', group: 'Estreñimiento leve' },
  { n: 3, label: 'Tipo 3', desc: 'Salchicha con grietas', group: 'Normal' },
  { n: 4, label: 'Tipo 4', desc: 'Lisa y blanda, como serpiente', group: 'Ideal' },
  { n: 5, label: 'Tipo 5', desc: 'Trozos blandos de bordes definidos', group: 'Falta de fibra' },
  { n: 6, label: 'Tipo 6', desc: 'Trozos esponjosos, bordes irregulares', group: 'Diarrea leve' },
  { n: 7, label: 'Tipo 7', desc: 'Líquida, sin trozos sólidos', group: 'Diarrea' },
];

export const BLOAT_ZONES = ['Estómago (alta)', 'Alrededor del ombligo', 'Bajo vientre', 'Todo el abdomen', 'Lateral'];

export const GAS_LEVELS = [
  { key: 'no', label: 'No' },
  { key: 'pocos', label: 'Pocos' },
  { key: 'muchos', label: 'Muchos' },
];

export const FLOW = [
  { key: 'manchado', label: 'Manchado' },
  { key: 'ligero', label: 'Ligero' },
  { key: 'medio', label: 'Medio' },
  { key: 'abundante', label: 'Abundante' },
];

export const CYCLE_SYMPTOMS = [
  'Calambres', 'Dolor de cabeza', 'Hinchazón', 'Sensibilidad mamaria', 'Cansancio',
  'Acné', 'Antojos', 'Cambios de humor', 'Dolor lumbar', 'Insomnio',
];

export function emptyEntry() {
  return {
    meals: {
      desayuno: { time: '', text: '' },
      comida: { time: '', text: '' },
      snack: { time: '', text: '' },
      cena: { time: '', text: '' },
    },
    drinks: '',
    water_ml: 0,
    bowel: { none: false, items: [] },
    symptoms: {
      bloating: null,
      bloating_zones: [],
      bloating_visible: null,
      gases: null,
      gases_when: '',
      pain: null,
      pain_where: '',
      nausea: null,
    },
    sleep: { quality: null, hours: null },
    stress: null,
    notes: '',
  };
}

/** Mezcla profunda de una entrada guardada con la plantilla vacía. */
export function normalizeEntry(data) {
  const base = emptyEntry();
  if (!data || typeof data !== 'object') return base;
  const out = { ...base, ...data };
  out.meals = { ...base.meals };
  for (const k of Object.keys(base.meals)) out.meals[k] = { ...base.meals[k], ...(data.meals?.[k] || {}) };
  out.bowel = { ...base.bowel, ...(data.bowel || {}) };
  out.symptoms = { ...base.symptoms, ...(data.symptoms || {}) };
  out.sleep = { ...base.sleep, ...(data.sleep || {}) };
  return out;
}
