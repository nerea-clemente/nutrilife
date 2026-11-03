import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { todayStr, addDays } from '../lib/dates.js';
import { PHASES } from '@shared/cycle.js';
import { Card, Seg } from '../components/ui.jsx';
import Chart from '../components/Chart.jsx';

const RANGES = [
  { key: 7, label: '7 días' },
  { key: 14, label: '14 días' },
  { key: 30, label: '30 días' },
  { key: 90, label: '90 días' },
];

const SLEEP = '#2F8FB5';
const STRESS = '#C9824A';
const ACCENT = '#33666B';

export default function ChartsPage() {
  const today = todayStr();
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState(null);
  const { infoFor } = useData();
  const from = addDays(today, -(days - 1));

  useEffect(() => {
    api(`/entries?from=${from}&to=${today}`).then(setRows);
  }, [from, today]);

  const d = useMemo(() => {
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
    const by = Object.fromEntries((rows || []).map((r) => [r.date, r.data]));
    const phases = dates.map((dt) => infoFor(dt)?.phase || null);
    const pick = (f) => dates.map((dt) => (by[dt] ? f(by[dt]) ?? null : null));
    return {
      dates, phases,
      bloat: pick((e) => e.symptoms.bloating),
      water: pick((e) => e.water_ml || null),
      sleep: pick((e) => e.sleep.quality),
      stress: pick((e) => e.stress),
    };
  }, [rows, days, from, infoFor]);

  const byPhase = useMemo(() => {
    const acc = {};
    d.bloat.forEach((v, i) => {
      const p = d.phases[i];
      if (v == null || !p) return;
      (acc[p] ||= []).push(v);
    });
    return Object.keys(PHASES).map((k) => ({ k, n: acc[k]?.length || 0, avg: acc[k] ? acc[k].reduce((a, b) => a + b, 0) / acc[k].length : null }));
  }, [d]);

  const hasPhases = d.phases.some(Boolean);
  const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const f1 = (v) => (v == null ? '—' : v.toFixed(1).replace('.', ','));
  const waterMax = Math.max(3000, Math.ceil((Math.max(...d.water.filter(Boolean), 0) + 1) / 750) * 750);

  return (
    <div className="page">
      <div className="topbar"><h1>Gráficas</h1></div>
      <Seg options={RANGES} value={days} onChange={setDays} allowNone={false} />
      {hasPhases && (
        <div className="legend" style={{ margin: '12px 4px 4px' }}>
          <span className="muted">Fondo:</span>
          {Object.entries(PHASES).map(([k, p]) => <span key={k}><i style={{ background: p.color }} />{p.label}</span>)}
        </div>
      )}
      <div style={{ height: 10 }} />

      {!rows ? <p className="empty">Cargando…</p> : (
        <>
          <Card title="Distensión diaria" right={<span className="muted small">media {f1(avg(d.bloat))}/10</span>}>
            <Chart dates={d.dates} phases={d.phases} yMax={10} yTicks={[0, 5, 10]}
              series={[{ key: 'b', label: 'Distensión', color: ACCENT, values: d.bloat, type: 'line', fmt: (v) => `${v}/10` }]} />
          </Card>

          {hasPhases && (
            <Card title="Distensión media por fase">
              {byPhase.map((p) => (
                <div key={p.k} className="row" style={{ marginBottom: 8 }}>
                  <span className="small" style={{ width: 86 }}>{PHASES[p.k].label}</span>
                  <div className="grow" style={{ background: 'var(--accent-50)', borderRadius: 6, height: 14, position: 'relative' }}>
                    {p.avg != null && <div style={{ width: `${(p.avg / 10) * 100}%`, minWidth: 4, height: '100%', borderRadius: 6, background: PHASES[p.k].color }} />}
                  </div>
                  <span className="small" style={{ width: 70, textAlign: 'right' }}>
                    <strong>{f1(p.avg)}</strong> <span className="muted tiny">({p.n} d)</span>
                  </span>
                </div>
              ))}
              <p className="tiny muted" style={{ margin: '4px 0 0' }}>Amplía el rango a 90 días para ver patrones más fiables.</p>
            </Card>
          )}

          <Card title="Agua" right={<span className="muted small">media {avg(d.water) ? Math.round(avg(d.water)).toLocaleString('es-ES') : '—'} ml</span>}>
            <Chart dates={d.dates} phases={d.phases} yMax={waterMax} yTicks={[0, 1500, 3000].filter((t) => t <= waterMax)} unitFmt={(v) => (v ? `${v / 1000}L`.replace('.', ',') : '0')}
              series={[{ key: 'w', label: 'Agua', color: ACCENT, values: d.water, type: 'bar', fmt: (v) => `${v.toLocaleString('es-ES')} ml` }]} />
          </Card>

          <Card title="Sueño y estrés">
            <div className="legend" style={{ marginTop: -4, marginBottom: 8 }}>
              <span><i style={{ background: SLEEP, borderRadius: '50%' }} />Sueño · media {f1(avg(d.sleep))}</span>
              <span><i style={{ background: STRESS, borderRadius: '50%' }} />Estrés · media {f1(avg(d.stress))}</span>
            </div>
            <Chart dates={d.dates} phases={d.phases} yMax={5} yTicks={[1, 3, 5]}
              series={[
                { key: 's', label: 'Sueño', color: SLEEP, values: d.sleep, type: 'line', fmt: (v) => `${v}/5` },
                { key: 'e', label: 'Estrés', color: STRESS, values: d.stress, type: 'line', fmt: (v) => `${v}/5` },
              ]} />
          </Card>
          <p className="center tiny muted">Toca o desliza sobre una gráfica para ver el detalle de cada día.</p>
        </>
      )}
    </div>
  );
}
