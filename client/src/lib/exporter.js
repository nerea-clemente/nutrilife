// Genera el PDF y el CSV directamente en el dispositivo a partir de los datos de la API.
import { api, photoUrl } from './api.js';
import { normalizeEntry, MEALS, BRISTOL } from '@shared/constants.js';
import { cycleStats, cycleInfo, PHASES } from '@shared/cycle.js';
import { fmtDate, cap, dayNumber, bottles, yesNo } from '@shared/format.js';
import fontRegular from '@fontsource/poppins/files/poppins-latin-400-normal.woff?url';
import fontMedium from '@fontsource/poppins/files/poppins-latin-500-normal.woff?url';
import fontBold from '@fontsource/poppins/files/poppins-latin-600-normal.woff?url';

async function loadRange(from, to, withPhotos) {
  const [rows, cycle, settings, photos] = await Promise.all([
    api(`/entries?from=${from}&to=${to}`),
    api('/cycle'),
    api('/settings'),
    api(`/photos?from=${from}&to=${to}`),
  ]);
  const stats = cycleStats(cycle.periods);
  const cdays = Object.fromEntries(cycle.days.map((d) => [d.date, d]));
  const ordered = [...photos].reverse();
  return rows.map((r) => ({
    date: r.date,
    data: normalizeEntry(r.data),
    dayN: dayNumber(r.date, settings.start_date),
    cycle: cycleInfo(r.date, stats),
    cycleDay: cdays[r.date] || null,
    photos: withPhotos !== false ? ordered.filter((p) => p.date === r.date) : [],
    photoCount: photos.filter((p) => p.date === r.date).length,
  }));
}

// ---------- CSV ----------
export async function buildCsv(from, to) {
  const days = await loadRange(from, to, false);
  const header = [
    'Fecha', 'Día nº', 'Día del ciclo', 'Fase', 'Flujo',
    ...MEALS.flatMap((m) => [`${m.label} hora`, m.label]),
    'Bebidas', 'Agua (ml)', 'Botellas', 'Deposiciones', 'Bristol', 'Horas deposiciones',
    'Distensión (0-10)', 'Zona distensión', 'Distensión visible', 'Gases', 'Gases cuándo',
    'Dolor', 'Dolor dónde', 'Náuseas', 'Sueño (1-5)', 'Horas dormidas', 'Estrés (1-5)', 'Síntomas del ciclo', 'Notas', 'Fotos',
  ];
  const lines = [header];
  for (const d of days) {
    const e = d.data;
    const s = e.symptoms;
    const b = e.bowel;
    lines.push([
      d.date, d.dayN ?? '', d.cycle?.cycleDay ?? '', d.cycle ? PHASES[d.cycle.phase].label : '', d.cycleDay?.flow || '',
      ...MEALS.flatMap((m) => [e.meals[m.key].time, e.meals[m.key].text]),
      e.drinks, e.water_ml || '', e.water_ml ? bottles(e.water_ml) : '',
      b.none ? 0 : b.items.length || '', b.items.map((i) => i.bristol || '?').join(', '), b.items.map((i) => i.time || '?').join(', '),
      s.bloating ?? '', (s.bloating_zones || []).join(', '), yesNo(s.bloating_visible), s.gases || '', s.gases_when,
      yesNo(s.pain), s.pain_where, yesNo(s.nausea), e.sleep.quality ?? '', String(e.sleep.hours ?? '').replace('.', ','), e.stress ?? '',
      (d.cycleDay?.symptoms || []).join(', '), e.notes, d.photoCount,
    ]);
  }
  const esc = (v) => {
    const t = String(v ?? '');
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = '﻿' + lines.map((l) => l.map(esc).join(';')).join('\r\n');
  return new File([csv], `diario-${from}_${to}.csv`, { type: 'text/csv' });
}

// ---------- PDF ----------
const C = { accent: '#33666B', text: '#1F2D2F', muted: '#6B7B7D', line: '#DCE5E4', soft: '#EEF4F3' };
const buf = async (url) => new Uint8Array(await (await fetch(url, { credentials: 'same-origin' })).arrayBuffer());
const fmtN = (v, dec, unit) => (v == null ? '—' : v.toFixed(dec).replace('.', ',') + unit);

export async function buildPdf(from, to, { withPhotos = true, userName = '' } = {}) {
  const [{ default: PDFDocument }, days, fR, fM, fB] = await Promise.all([
    import('pdfkit'),
    loadRange(from, to, withPhotos),
    buf(fontRegular), buf(fontMedium), buf(fontBold),
  ]);
  // Descargar fotos en paralelo
  const imgs = {};
  if (withPhotos) {
    const all = days.flatMap((d) => d.photos);
    await Promise.all(all.map(async (p) => { try { imgs[p.id] = await buf(photoUrl(p.id, 'full')); } catch { /* omitir */ } }));
  }

  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, font: fR, info: { Title: 'Diario de nutrición y digestión' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((r) => doc.on('end', r));
  doc.registerFont('R', fR);
  doc.registerFont('M', fM);
  doc.registerFont('B', fB);

  const W = doc.page.width - 96;
  const L = 48;
  const ensure = (h) => { if (doc.y + h > doc.page.height - 60) doc.addPage(); };
  const label = (t, x, y, w) => doc.font('M').fontSize(8.5).fillColor(C.muted).text(t.toUpperCase(), x, y, { width: w, characterSpacing: 0.4 });

  // Cabecera y resumen
  doc.font('B').fontSize(20).fillColor(C.accent).text('Diario de nutrición y digestión', L, 56);
  doc.font('R').fontSize(10.5).fillColor(C.muted).text(
    `${userName ? `${userName} · ` : ''}${cap(fmtDate(from, { day: 'numeric', month: 'long', year: 'numeric' }))} – ${fmtDate(to, { day: 'numeric', month: 'long', year: 'numeric' })}`
  );
  doc.moveDown(1);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const nums = (f) => days.map(f).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  const summary = [
    ['Días registrados', String(days.length)],
    ['Distensión media', fmtN(avg(nums((d) => d.data.symptoms.bloating)), 1, '/10')],
    ['Agua media', fmtN(avg(nums((d) => d.data.water_ml || null)), 0, ' ml')],
    ['Sueño medio', fmtN(avg(nums((d) => d.data.sleep.quality)), 1, '/5')],
    ['Horas de sueño', fmtN(avg(nums((d) => d.data.sleep.hours)), 1, ' h')],
    ['Estrés medio', fmtN(avg(nums((d) => d.data.stress)), 1, '/5')],
    ['Días sin deposición', String(days.filter((d) => d.data.bowel.none).length)],
  ];
  const boxW = (W - 30) / 4;
  const top = doc.y;
  summary.forEach(([k, v], i) => {
    const x = L + (i % 4) * (boxW + 10);
    const yy = top + Math.floor(i / 4) * 58;
    doc.roundedRect(x, yy, boxW, 50, 8).fill(C.soft);
    doc.font('R').fontSize(8).fillColor(C.muted).text(k, x + 10, yy + 9, { width: boxW - 20 });
    doc.font('B').fontSize(13).fillColor(C.accent).text(v, x + 10, yy + 23, { width: boxW - 20 });
  });
  doc.y = top + Math.ceil(summary.length / 4) * 58 + 12;
  doc.x = L;
  if (!days.length) doc.font('R').fontSize(11).fillColor(C.muted).text('No hay registros en este rango de fechas.', L);

  for (const d of days) {
    const e = d.data;
    ensure(140);
    const y0 = doc.y;
    doc.roundedRect(L, y0, W, 28, 8).fill(C.accent);
    doc.font('B').fontSize(11).fillColor('#FFFFFF').text(`${d.dayN ? `Día ${d.dayN} · ` : ''}${cap(fmtDate(d.date))}`, L + 12, y0 + 8, { width: W * 0.62 });
    if (d.cycle) {
      const ct = `Ciclo día ${d.cycle.cycleDay} · ${PHASES[d.cycle.phase].label}${d.cycleDay?.flow ? ` · flujo ${d.cycleDay.flow}` : ''}`;
      doc.font('R').fontSize(9).fillColor('#FFFFFF').text(ct, L + W * 0.55, y0 + 9.5, { width: W * 0.45 - 12, align: 'right' });
    }
    doc.y = y0 + 38;

    for (const m of MEALS) {
      const meal = e.meals[m.key];
      const ph = d.photos.filter((p) => p.meal === m.key && imgs[p.id]);
      if (!meal.text && !meal.time && !ph.length) continue;
      ensure(30);
      const y = doc.y;
      doc.font('M').fontSize(9.5).fillColor(C.accent).text(m.label, L, y, { width: 70 });
      doc.font('R').fontSize(9).fillColor(C.muted).text(meal.time || '—', L + 72, y + 0.5, { width: 40 });
      doc.font('R').fontSize(9.5).fillColor(C.text).text(meal.text || '—', L + 115, y, { width: W - 115 });
      doc.y += 4;
      if (ph.length) {
        ensure(96);
        let x = L + 115;
        const py = doc.y;
        for (const p of ph) {
          if (x + 90 > L + W) break;
          try {
            doc.save().roundedRect(x, py, 88, 88, 6).clip();
            doc.image(imgs[p.id], x, py, { cover: [88, 88], align: 'center', valign: 'center' });
            doc.restore();
            x += 96;
          } catch { doc.restore(); }
        }
        doc.y = py + 96;
      }
    }
    doc.x = L;

    const s = e.symptoms;
    const b = e.bowel;
    const bowelTxt = b.none ? 'No hubo' : b.items.length
      ? `${b.items.length} ${b.items.length === 1 ? 'vez' : 'veces'}: ${b.items.map((i) => `${i.time || '?'} (Bristol ${i.bristol || '?'})`).join(', ')}`
      : '—';
    const cells = [
      ['Bebidas', e.drinks || '—'],
      ['Agua', e.water_ml ? `${e.water_ml} ml (${bottles(e.water_ml)} botellas)` : '—'],
      ['Deposiciones', bowelTxt],
      ['Distensión', [
        s.bloating != null ? `${s.bloating}/10` : null,
        s.bloating_zones?.length ? `zona: ${s.bloating_zones.join(', ').toLowerCase()}` : null,
        s.bloating_visible != null ? `visible: ${yesNo(s.bloating_visible).toLowerCase()}` : null,
      ].filter(Boolean).join(' · ') || '—'],
      ['Gases · dolor · náuseas', [
        s.gases ? `Gases: ${s.gases}${s.gases_when ? ` (${s.gases_when})` : ''}` : null,
        s.pain != null ? `Dolor: ${s.pain ? `sí${s.pain_where ? ` (${s.pain_where})` : ''}` : 'no'}` : null,
        s.nausea != null ? `Náuseas: ${yesNo(s.nausea).toLowerCase()}` : null,
      ].filter(Boolean).join(' · ') || '—'],
      ['Sueño · estrés', [
        e.sleep.quality != null ? `Sueño ${e.sleep.quality}/5` : null,
        e.sleep.hours != null ? `${String(e.sleep.hours).replace('.', ',')} h` : null,
        e.stress != null ? `Estrés ${e.stress}/5` : null,
      ].filter(Boolean).join(' · ') || '—'],
    ];
    if (d.cycleDay?.symptoms?.length) cells.push(['Síntomas del ciclo', d.cycleDay.symptoms.join(', ')]);
    doc.moveTo(L, doc.y + 2).lineTo(L + W, doc.y + 2).lineWidth(0.6).strokeColor(C.line).stroke();
    doc.y += 8;
    const colW = (W - 16) / 2;
    for (let i = 0; i < cells.length; i += 2) {
      const pair = cells.slice(i, i + 2);
      doc.font('R').fontSize(9.5);
      const h = Math.max(...pair.map(([, v]) => doc.heightOfString(v, { width: colW }))) + 16;
      ensure(h + 4);
      const y = doc.y;
      pair.forEach(([k, v], j) => {
        const x = L + j * (colW + 16);
        label(k, x, y, colW);
        doc.font('R').fontSize(9.5).fillColor(C.text).text(v, x, y + 12, { width: colW });
      });
      doc.y = y + h + 2;
    }
    if (e.notes) {
      doc.font('R').fontSize(9.5);
      ensure(doc.heightOfString(e.notes, { width: W }) + 20);
      label('Notas', L, doc.y, W);
      doc.font('R').fontSize(9.5).fillColor(C.text).text(e.notes, L, doc.y + 2, { width: W });
    }
    doc.x = L;
    doc.y += 18;
  }

  ensure(110);
  doc.font('M').fontSize(9).fillColor(C.muted).text('ESCALA DE BRISTOL', L, doc.y, { characterSpacing: 0.4 });
  doc.font('R').fontSize(8.5).fillColor(C.muted);
  for (const bt of BRISTOL) doc.text(`${bt.n}. ${bt.desc} (${bt.group.toLowerCase()})`, L);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('R').fontSize(8).fillColor(C.muted)
      .text(`NutriLife · página ${i + 1} de ${range.count}`, L, doc.page.height - 36, { width: W, align: 'right', lineBreak: false });
  }
  doc.end();
  await done;
  return new File(chunks, `diario-${from}_${to}.pdf`, { type: 'application/pdf' });
}
