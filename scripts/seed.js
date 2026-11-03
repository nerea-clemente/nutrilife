// Rellena la app (local) con una semana de datos de ejemplo a través de la API.
//   npm run preview        (en otra terminal)
//   npm run seed           -> cuenta demo@nutrilife.app / demo1234
// Uso: node scripts/seed.js [url]   (por defecto http://localhost:8787)
// Las "fotos" son ilustraciones generadas con Playwright (si no está instalado, se omiten).
import { createRequire } from 'node:module';
import path from 'node:path';
import { emptyEntry } from '../shared/constants.js';
import { addDays } from '../shared/cycle.js';

const BASE = process.argv[2] || 'http://localhost:8787';
const EMAIL = process.env.SEED_EMAIL || 'demo@nutrilife.app';
const PASS = process.env.SEED_PASSWORD || 'demo1234';
let cookie = '';

async function call(p, { method = 'GET', body, form } = {}) {
  const headers = { cookie, origin: BASE };
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + '/api' + p, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${p}: ${data?.error || res.status}`);
  return data;
}

const d = new Date();
const T = process.env.SEED_TODAY || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const st = await call('/auth/status');
if (st.canSignup) await call('/auth/signup', { method: 'POST', body: { email: EMAIL, password: PASS, name: 'Nerea' } });
else await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASS } });

const start = addDays(T, -6);
await call('/settings', { method: 'PUT', body: { start_date: start, timezone: 'Europe/Madrid' } });

// Ciclo: reglas cada ~28-29 días; la última empezó hace 3 días y sigue en curso.
const lastStart = addDays(T, -3);
const existing = await call('/cycle');
for (const p of existing.periods) await call(`/cycle/periods/${p.id}`, { method: 'DELETE' });
for (const n of [-117, -88, -60, -31]) {
  const s = addDays(lastStart, n);
  await call('/cycle/periods', { method: 'POST', body: { start_date: s, end_date: addDays(s, 4) } });
}
await call('/cycle/periods', { method: 'POST', body: { start_date: lastStart } });
const flows = ['medio', 'abundante', 'medio', 'ligero'];
for (let i = 0; i < 4; i++) {
  const day = addDays(lastStart, i);
  if (day > T) break;
  const sym = i === 0 ? ['Calambres', 'Hinchazón', 'Cansancio'] : i === 1 ? ['Calambres', 'Dolor lumbar'] : [];
  await call(`/cycle/days/${day}`, { method: 'PUT', body: { flow: flows[i], symptoms: sym } });
}
await call(`/cycle/days/${addDays(lastStart, -2)}`, { method: 'PUT', body: { flow: null, symptoms: ['Antojos', 'Sensibilidad mamaria'] } });

const TAGS = [['arroz integral', 6], ['ternera', 4], ['brócoli', 5], ['huevos', 7], ['aguacate', 5], ['yogur natural', 6], ['avena', 5], ['plátano', 4], ['pollo', 4], ['salmón', 3], ['kéfir', 3], ['infusión de jengibre', 4]];
for (const [name, uses] of TAGS) {
  const t = await call('/tags', { method: 'POST', body: { name } });
  for (let i = t.uses; i < uses; i++) await call(`/tags/${t.id}/use`, { method: 'POST' });
}

const DAYS = [
  {
    meals: [['08:30', 'Avena con kéfir, plátano y canela'], ['14:15', 'Lentejas estofadas con verduras, ensalada verde'], ['17:45', 'Yogur natural con nueces'], ['21:30', 'Merluza al horno con patata y judías verdes']],
    drinks: 'Café con leche sin lactosa, infusión de manzanilla', water: 2250, bowel: [['09:10', 4]],
    s: { bloating: 3, zones: ['Bajo vientre'], visible: false, gases: 'pocos', when: 'tarde', pain: false, nausea: false }, sleep: [4, 7.5], stress: 2, notes: '',
  },
  {
    meals: [['08:15', 'Tostada de pan de centeno con aguacate y huevos revueltos'], ['14:30', 'Arroz integral con pollo y verduras salteadas'], ['18:00', 'Manzana y un puñado de almendras'], ['21:45', 'Crema de calabacín y tortilla francesa']],
    drinks: 'Café solo, agua con limón', water: 1875, bowel: [['08:50', 3]],
    s: { bloating: 4, zones: ['Alrededor del ombligo'], visible: false, gases: 'pocos', when: 'después de comer', pain: false, nausea: false }, sleep: [3, 6.5], stress: 3, notes: 'Mucho trabajo, comí rápido al mediodía.',
  },
  {
    meals: [['09:00', 'Yogur natural con avena, frutos rojos y semillas de chía'], ['14:00', 'Ternera a la plancha con arroz integral y brócoli'], ['', ''], ['22:00', 'Pizza casera con verduras y mozzarella']],
    drinks: 'Café con leche, una copa de vino tinto en la cena', water: 1500, bowel: [],
    s: { bloating: 6, zones: ['Todo el abdomen'], visible: true, gases: 'muchos', when: 'noche, tras la cena', pain: true, where: 'lado izquierdo, bajo vientre', nausea: false }, sleep: [3, 6], stress: 4, notes: 'Cena fuera de casa. Me noté muy hinchada antes de dormir.', bowelNone: true,
  },
  {
    meals: [['08:45', 'Avena con kéfir y plátano'], ['14:20', 'Salmón al horno con quinoa y espárragos'], ['18:15', 'Kéfir con canela'], ['21:15', 'Sopa de verduras y pechuga de pollo']],
    drinks: 'Infusión de jengibre, café con leche', water: 2625, bowel: [['10:30', 2], ['19:00', 4]],
    s: { bloating: 7, zones: ['Bajo vientre', 'Todo el abdomen'], visible: true, gases: 'muchos', when: 'todo el día', pain: true, where: 'bajo vientre', nausea: false }, sleep: [2, 5.5], stress: 3, notes: 'Me ha bajado la regla. Calambres por la mañana.',
  },
  {
    meals: [['09:15', 'Tostada con tomate, aceite de oliva y jamón serrano'], ['14:45', 'Garbanzos con espinacas'], ['18:30', 'Plátano'], ['21:30', 'Revuelto de huevos con champiñones y pan']],
    drinks: 'Café con leche, infusión de jengibre', water: 2000, bowel: [['09:40', 5]],
    s: { bloating: 6, zones: ['Bajo vientre'], visible: true, gases: 'pocos', when: 'tarde', pain: true, where: 'zona lumbar', nausea: true }, sleep: [3, 7], stress: 3, notes: 'Algo de náuseas al despertar.',
  },
  {
    meals: [['10:00', 'Tortitas de avena y plátano con yogur natural'], ['15:00', 'Paella de verduras y ensalada'], ['18:30', 'Yogur natural con nueces'], ['21:45', 'Crema de calabaza y tortilla de patatas']],
    drinks: 'Café con leche, agua con gas', water: 2250, bowel: [['11:00', 4]],
    s: { bloating: 4, zones: ['Alrededor del ombligo'], visible: false, gases: 'pocos', when: 'después de comer', pain: false, nausea: false }, sleep: [4, 8.5], stress: 2, notes: 'Domingo tranquilo, paseo largo.',
  },
  {
    meals: [['08:30', 'Avena con kéfir, plátano y canela'], ['14:15', 'Ternera con arroz integral y brócoli'], ['', ''], ['', '']],
    drinks: 'Café con leche', water: 1125, bowel: [['08:55', 4]],
    s: { bloating: 2, zones: [], visible: null, gases: 'no', when: '', pain: false, nausea: false }, sleep: [4, 7.5], stress: 2, notes: '',
  },
];

const MEAL_KEYS = ['desayuno', 'comida', 'snack', 'cena'];
for (let i = 0; i < DAYS.length; i++) {
  const dd = DAYS[i];
  const e = emptyEntry();
  dd.meals.forEach(([time, text], j) => { e.meals[MEAL_KEYS[j]] = { time, text }; });
  e.drinks = dd.drinks;
  e.water_ml = dd.water;
  e.bowel = dd.bowelNone ? { none: true, items: [] } : { none: false, items: dd.bowel.map(([time, bristol]) => ({ time, bristol })) };
  e.symptoms = {
    bloating: dd.s.bloating, bloating_zones: dd.s.zones, bloating_visible: dd.s.visible, gases: dd.s.gases, gases_when: dd.s.when,
    pain: dd.s.pain, pain_where: dd.s.where || '', nausea: dd.s.nausea,
  };
  e.sleep = { quality: dd.sleep[0], hours: dd.sleep[1] };
  e.stress = dd.stress;
  e.notes = dd.notes;
  await call(`/entries/${addDays(start, i)}`, { method: 'PUT', body: { data: e } });
}

// ---- Fotos ilustrativas ----
const PLATES = {
  avena: { bg: '#E9DCC6', items: [['#F3E7CF', 150, 160, 120], ['#F2D35B', 120, 120, 22], ['#F2D35B', 170, 130, 22], ['#F2D35B', 140, 175, 22], ['#8B5A3C', 190, 180, 8], ['#8B5A3C', 110, 170, 8]] },
  lentejas: { bg: '#D8E2D0', items: [['#8B5A3C', 150, 150, 115], ['#E07A3F', 120, 130, 14], ['#E07A3F', 175, 165, 14], ['#5C9E4B', 160, 120, 12]] },
  arroz: { bg: '#E3E8E2', items: [['#F4EEDC', 125, 150, 70], ['#E8C79A', 185, 130, 45], ['#4F8F45', 180, 195, 26], ['#4F8F45', 205, 175, 22]] },
  salmon: { bg: '#DCE6EA', items: [['#F08C6C', 140, 140, 55], ['#E9DFC4', 190, 185, 42], ['#6E9F4A', 110, 200, 12], ['#6E9F4A', 130, 210, 12]] },
  tostada: { bg: '#EDE2D2', items: [['#C9925A', 150, 150, 90], ['#7FA650', 140, 130, 50], ['#F5C842', 175, 175, 28], ['#FFFFFF', 175, 175, 40]] },
  yogur: { bg: '#E7E3EE', items: [['#FFFFFF', 150, 150, 105], ['#B23A5A', 120, 130, 13], ['#4A3A78', 165, 125, 12], ['#B23A5A', 175, 170, 13], ['#C8A27A', 130, 180, 10]] },
  ternera: { bg: '#E6E0D8', items: [['#8E4E3A', 130, 140, 55], ['#F4EEDC', 190, 160, 45], ['#3F8540', 140, 205, 24], ['#3F8540', 115, 195, 20]] },
  crema: { bg: '#E9E4D6', items: [['#7EA34E', 150, 150, 100], ['#F6F0DF', 160, 140, 18]] },
  pizza: { bg: '#E7DACD', items: [['#E8B45A', 150, 150, 110], ['#C8402E', 150, 150, 95], ['#F5EBD0', 120, 130, 18], ['#F5EBD0', 175, 170, 18], ['#3F8540', 160, 120, 10]] },
};
function plateSvg(p) {
  const circles = p.items.map(([c, x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="${p.bg}"/>
    <ellipse cx="160" cy="160" rx="135" ry="135" fill="#000" opacity=".08"/>
    <circle cx="150" cy="150" r="135" fill="#FAFAF7"/><circle cx="150" cy="150" r="118" fill="#F1F1EC"/>
    <clipPath id="c"><circle cx="150" cy="150" r="118"/></clipPath><g clip-path="url(#c)">${circles}</g></svg>`;
}
const PHOTO_PLAN = [
  [0, 'desayuno', 'avena'], [0, 'comida', 'lentejas'], [1, 'desayuno', 'tostada'], [1, 'comida', 'arroz'],
  [2, 'desayuno', 'yogur'], [2, 'comida', 'ternera'], [2, 'cena', 'pizza'], [3, 'comida', 'salmon'],
  [4, 'cena', 'crema'], [5, 'snack', 'yogur'], [6, 'desayuno', 'avena'], [6, 'comida', 'ternera'],
];

let pw = null;
try { pw = (await import('playwright')).default; } catch {
  for (const base of (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) {
    try { pw = createRequire(path.join(base, 'x.js'))('playwright'); break; } catch { /* siguiente */ }
  }
}
const have = await call(`/photos?from=${start}&to=${T}`);
for (const p of have) await call(`/photos/${p.id}`, { method: 'DELETE' });
if (pw) {
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  for (const [di, meal, kind] of PHOTO_PLAN) {
    await page.setContent(`<body style="margin:0">${plateSvg(PLATES[kind])}</body>`);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 85 });
    const form = new FormData();
    form.append('date', addDays(start, di));
    form.append('meal', meal);
    form.append('file', new Blob([jpg], { type: 'image/jpeg' }), 'foto.jpg');
    await call('/photos', { method: 'POST', form });
  }
  await browser.close();
} else console.log('Playwright no disponible: se omiten las fotos de ejemplo.');

console.log(`Datos de ejemplo listos en ${BASE}: ${EMAIL} / ${PASS} (${start} → ${T})`);
