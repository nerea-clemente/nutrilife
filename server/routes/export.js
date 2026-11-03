import { Router } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { db, getSettings, getPeriods, UPLOAD_DIR } from '../db.js';
import { requireUser } from '../auth.js';
import { normalizeEntry, MEALS, BRISTOL } from '../../shared/constants.js';
import { cycleStats, cycleInfo, PHASES } from '../../shared/cycle.js';
import { fmtDate, cap, dayNumber, bottles, yesNo } from '../../shared/format.js';

const require = createRequire(import.meta.url);
const fontDir = path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const FONT = {
  regular: path.join(fontDir, 'poppins-latin-400-normal.woff'),
  medium: path.join(fontDir, 'poppins-latin-500-normal.woff'),
  bold: path.join(fontDir, 'poppins-latin-600-normal.woff'),
};

const r = Router();
r.use(requireUser);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function loadRange(userId, from, to) {
  const rows = db
    .prepare('SELECT date, data FROM entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date')
    .all(userId, from, to);
  const settings = getSettings(userId);
  const stats = cycleStats(getPeriods(userId));
  const cdays = Object.fromEntries(
    db.prepare('SELECT date, flow, symptoms FROM cycle_days WHERE user_id = ? AND date BETWEEN ? AND ?')
      .all(userId, from, to).map((d) => [d.date, { flow: d.flow, symptoms: JSON.parse(d.symptoms) }])
  );
  const photos = db
    .prepare('SELECT id, date, meal, file FROM photos WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY created_at')
    .all(userId, from, to);
  return rows.map((row) => {
    const data = normalizeEntry(JSON.parse(row.data));
    return {
      date: row.date,
      data,
      dayN: dayNumber(row.date, settings.start_date),
      cycle: cycleInfo(row.date, stats),
      cycleDay: cdays[row.date] || null,
      photos: photos.filter((p) => p.date === row.date),
    };
  });
}

function range(req, res) {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '') || from > to) {
    res.status(400).json({ error: 'Rango de fechas no válido' });
    return null;
  }
  return { from, to };
}

function bowelSummary(b) {
  if (b.none) return { n: 0, types: '', times: '' };
  return {
    n: b.items.length || '',
    types: b.items.map((i) => i.bristol || '?').join(', '),
    times: b.items.map((i) => i.time || '?').join(', '),
  };
}

// ---------- CSV ----------
r.get('/export.csv', (req, res) => {
  const rg = range(req, res);
  if (!rg) return;
  const days = loadRange(req.user.id, rg.from, rg.to);
  const header = [
    'Fecha', 'Día nº', 'Día del ciclo', 'Fase', 'Flujo',
    ...MEALS.flatMap((m) => [`${m.label} hora`, m.label]),
    'Bebidas', 'Agua (ml)', 'Botellas', 'Deposiciones', 'Bristol', 'Horas deposiciones',
    'Distensión (0-10)', 'Zona distensión', 'Distensión visible', 'Gases', 'Gases cuándo',
    'Dolor', 'Dolor dónde', 'Náuseas', 'Sueño (1-5)', 'Horas dormidas', 'Estrés (1-5)', 'Notas', 'Fotos',
  ];
  const lines = [header];
  for (const d of days) {
    const e = d.data;
    const s = e.symptoms;
    const b = bowelSummary(e.bowel);
    lines.push([
      d.date, d.dayN ?? '', d.cycle?.cycleDay ?? '', d.cycle ? PHASES[d.cycle.phase].label : '', d.cycleDay?.flow || '',
      ...MEALS.flatMap((m) => [e.meals[m.key].time, e.meals[m.key].text]),
      e.drinks, e.water_ml || '', e.water_ml ? bottles(e.water_ml) : '', b.n, b.types, b.times,
      s.bloating ?? '', (s.bloating_zones || []).join(', '), yesNo(s.bloating_visible), s.gases || '', s.gases_when,
      yesNo(s.pain), s.pain_where, yesNo(s.nausea), e.sleep.quality ?? '', e.sleep.hours ?? '', e.stress ?? '', e.notes, d.photos.length,
    ]);
  }
  const esc = (v) => {
    const t = String(v ?? '');
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = '﻿' + lines.map((l) => l.map(esc).join(';')).join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="diario-${rg.from}_${rg.to}.csv"`);
  res.send(csv);
});

// ---------- PDF ----------
const C = { accent: '#33666B', text: '#1F2D2F', muted: '#6B7B7D', line: '#DCE5E4', soft: '#EEF4F3' };

r.get('/export.pdf', (req, res) => {
  const rg = range(req, res);
  if (!rg) return;
  const withPhotos = req.query.photos === '1';
  const days = loadRange(req.user.id, rg.from, rg.to);
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: 'Diario de nutrición y digestión' } });
  doc.registerFont('R', FONT.regular);
  doc.registerFont('M', FONT.medium);
  doc.registerFont('B', FONT.bold);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="diario-${rg.from}_${rg.to}.pdf"`);
  doc.pipe(res);

  const W = doc.page.width - 96;
  const L = 48;
  const ensure = (h) => {
    if (doc.y + h > doc.page.height - 60) doc.addPage();
  };

  // Portada / resumen
  doc.font('B').fontSize(20).fillColor(C.accent).text('Diario de nutrición y digestión', L, 56);
  doc.font('R').fontSize(10.5).fillColor(C.muted)
    .text(`${req.user.name ? req.user.name + ' · ' : ''}${cap(fmtDate(rg.from, { day: 'numeric', month: 'long', year: 'numeric' }))} – ${fmtDate(rg.to, { day: 'numeric', month: 'long', year: 'numeric' })}`);
  doc.moveDown(1);

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
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
  const boxW = (W - 3 * 10) / 4;
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

  if (!days.length) {
    doc.font('R').fontSize(11).fillColor(C.muted).text('No hay registros en este rango de fechas.', L);
  }

  const label = (t, x, y, w) => doc.font('M').fontSize(8.5).fillColor(C.muted).text(t.toUpperCase(), x, y, { width: w, characterSpacing: 0.4 });

  for (const d of days) {
    const e = d.data;
    ensure(140);
    // Cabecera del día
    const y0 = doc.y;
    doc.roundedRect(L, y0, W, 28, 8).fill(C.accent);
    const title = `${d.dayN ? `Día ${d.dayN} · ` : ''}${cap(fmtDate(d.date))}`;
    doc.font('B').fontSize(11).fillColor('#FFFFFF').text(title, L + 12, y0 + 8, { width: W * 0.62 });
    if (d.cycle) {
      const ct = `Ciclo día ${d.cycle.cycleDay} · ${PHASES[d.cycle.phase].label}${d.cycleDay?.flow ? ` · flujo ${d.cycleDay.flow}` : ''}`;
      doc.font('R').fontSize(9).fillColor('#FFFFFF').text(ct, L + W * 0.55, y0 + 9.5, { width: W * 0.45 - 12, align: 'right' });
    }
    doc.y = y0 + 38;

    // Comidas
    for (const m of MEALS) {
      const meal = e.meals[m.key];
      if (!meal.text && !meal.time) continue;
      ensure(30);
      const y = doc.y;
      doc.font('M').fontSize(9.5).fillColor(C.accent).text(m.label, L, y, { width: 70 });
      doc.font('R').fontSize(9).fillColor(C.muted).text(meal.time || '—', L + 72, y + 0.5, { width: 40 });
      doc.font('R').fontSize(9.5).fillColor(C.text).text(meal.text || '—', L + 115, y, { width: W - 115 });
      doc.y += 4;
      if (withPhotos) {
        const ph = d.photos.filter((p) => p.meal === m.key);
        if (ph.length) {
          ensure(96);
          let x = L + 115;
          const py = doc.y;
          for (const p of ph) {
            const fp = path.join(UPLOAD_DIR, String(req.user.id), p.file);
            if (!fs.existsSync(fp)) continue;
            if (x + 90 > L + W) break;
            try {
              doc.save().roundedRect(x, py, 88, 88, 6).clip();
              doc.image(fp, x, py, { cover: [88, 88], align: 'center', valign: 'center' });
              doc.restore();
              x += 96;
            } catch { doc.restore(); }
          }
          doc.y = py + 96;
        }
      }
    }
    doc.x = L;

    // Rejilla de datos
    const s = e.symptoms;
    const b = e.bowel;
    const bowelTxt = b.none
      ? 'No hubo'
      : b.items.length
        ? `${b.items.length} ${b.items.length === 1 ? 'vez' : 'veces'}: ` +
          b.items.map((i) => `${i.time || '?'} (Bristol ${i.bristol || '?'})`).join(', ')
        : '—';
    const symptomsTxt = [
      s.bloating != null ? `Distensión ${s.bloating}/10` : null,
      s.bloating_zones?.length ? `zona: ${s.bloating_zones.join(', ').toLowerCase()}` : null,
      s.bloating_visible != null ? `visible: ${yesNo(s.bloating_visible).toLowerCase()}` : null,
    ].filter(Boolean).join(' · ') || '—';
    const otherTxt = [
      s.gases ? `Gases: ${s.gases}${s.gases_when ? ` (${s.gases_when})` : ''}` : null,
      s.pain != null ? `Dolor: ${s.pain ? `sí${s.pain_where ? ` (${s.pain_where})` : ''}` : 'no'}` : null,
      s.nausea != null ? `Náuseas: ${yesNo(s.nausea).toLowerCase()}` : null,
    ].filter(Boolean).join(' · ') || '—';
    const cells = [
      ['Bebidas', e.drinks || '—'],
      ['Agua', e.water_ml ? `${e.water_ml} ml (${bottles(e.water_ml)} botellas)` : '—'],
      ['Deposiciones', bowelTxt],
      ['Distensión', symptomsTxt],
      ['Gases · dolor · náuseas', otherTxt],
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

  // Leyenda Bristol y pie de página
  ensure(110);
  doc.font('M').fontSize(9).fillColor(C.muted).text('ESCALA DE BRISTOL', L, doc.y, { characterSpacing: 0.4 });
  doc.font('R').fontSize(8.5).fillColor(C.muted);
  for (const bt of BRISTOL) doc.text(`${bt.n}. ${bt.desc} (${bt.group.toLowerCase()})`, L);

  const range_ = doc.bufferedPageRange();
  for (let i = range_.start; i < range_.start + range_.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('R').fontSize(8).fillColor(C.muted)
      .text(`NutriLife · página ${i + 1} de ${range_.count}`, L, doc.page.height - 36, { width: W, align: 'right', lineBreak: false });
  }
  doc.end();
});

function fmtN(v, dec, unit) {
  if (v == null) return '—';
  return v.toFixed(dec).replace('.', ',') + unit;
}

export default r;
