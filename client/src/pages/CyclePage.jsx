import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { monthGrid, WEEKDAYS, todayStr } from '../lib/dates.js';
import { FLOW, CYCLE_SYMPTOMS } from '@shared/constants.js';
import { PHASES, phaseFor, diffDays, addDays } from '@shared/cycle.js';
import { fmtDate, cap } from '@shared/format.js';
import MonthNav from '../components/MonthNav.jsx';
import { Card, Sheet } from '../components/ui.jsx';

const short = (d) => fmtDate(d, { day: 'numeric', month: 'short' });

function Ring({ day, len, periodLen }) {
  const R = 44, cx = 54, cy = 54, sw = 9;
  const segs = [];
  for (let i = 1; i <= len; i++) {
    const a0 = ((i - 1) / len) * Math.PI * 2 - Math.PI / 2 + 0.02;
    const a1 = (i / len) * Math.PI * 2 - Math.PI / 2 - 0.02;
    const p = phaseFor(i, len, periodLen);
    const d = `M ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`;
    segs.push(<path key={i} d={d} stroke={PHASES[p].color} strokeOpacity={i <= (day || 0) ? 1 : 0.25} strokeWidth={sw} fill="none" />);
  }
  const am = day ? ((Math.min(day, len) - 0.5) / len) * Math.PI * 2 - Math.PI / 2 : null;
  return (
    <svg className="ring" viewBox="0 0 108 108" role="img" aria-label={day ? `Día ${day} de ${len}` : 'Sin datos'}>
      {segs}
      {am != null && <circle cx={cx + R * Math.cos(am)} cy={cy + R * Math.sin(am)} r="7" fill="#fff" stroke="#1F2D2F" strokeWidth="2.5" />}
      <text x="54" y="52" textAnchor="middle" fontSize="24" fontWeight="600" fill="#1F2D2F">{day ?? '–'}</text>
      <text x="54" y="68" textAnchor="middle" fontSize="10" fill="#6B7B7D">{day ? 'día del ciclo' : 'sin datos'}</text>
    </svg>
  );
}

export default function CyclePage() {
  const today = todayStr();
  const { cycle, stats, cycleDays, infoFor, predictedFor, predictions, reloadCycle, showToast } = useData();
  const [ym, setYm] = useState(() => [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]);
  const [sel, setSel] = useState(null);
  const days = useMemo(() => monthGrid(ym[0], ym[1]), [ym]);

  const info = infoFor(today);
  const preds = predictions(3);
  const last = stats.sorted[stats.sorted.length - 1];
  const openPeriod = last && !last.end_date && diffDays(today, last.start_date) < 15 ? last : null;
  const next = preds[0];

  const startToday = async () => {
    try {
      await api('/cycle/periods', { method: 'POST', body: { start_date: today } });
      await reloadCycle();
      showToast('Inicio de la regla registrado');
    } catch (e) { alert(e.message); }
  };
  const endToday = async () => {
    await api(`/cycle/periods/${openPeriod.id}`, { method: 'PATCH', body: { end_date: today } });
    await reloadCycle();
    showToast('Fin de la regla registrado');
  };

  return (
    <div className="page">
      <div className="topbar"><h1>Ciclo</h1></div>

      <Card>
        <div className="cycle-hero">
          <Ring day={info?.cycleDay} len={stats.avgCycle} periodLen={stats.avgPeriod} />
          <div className="grow">
            {info ? (
              <>
                <div style={{ fontSize: 13 }} className="muted">Fase aproximada</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: PHASES[info.phase].color }}>{PHASES[info.phase].label}</div>
              </>
            ) : (
              <div className="muted small">Registra el inicio de tu regla para calcular el ciclo.</div>
            )}
            {next && (
              <div className="small mt">
                Próxima regla: <strong>{short(next.start)}</strong>
                <div className="muted tiny">
                  {diffDays(next.start, today) >= 0 ? `en ${diffDays(next.start, today)} días` : `retraso de ${-diffDays(next.start, today)} días`} · estimación
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt">
          {openPeriod ? (
            <button className="btn block" onClick={endToday}>Hoy ha terminado mi regla</button>
          ) : (
            <button className="btn block" onClick={startToday} disabled={info?.inPeriod && info.periodStart === today}>Hoy me ha bajado la regla</button>
          )}
          <p className="center tiny muted" style={{ margin: '8px 0 0' }}>Para otra fecha, toca el día en el calendario.</p>
        </div>
      </Card>

      <Card>
        <MonthNav y={ym[0]} m={ym[1]} onChange={(y, m) => setYm([y, m])} />
        <div className="cal">
          {WEEKDAYS.map((w) => <div key={w} className="wd">{w}</div>)}
          {days.map(({ date, inMonth }) => {
            const ci = date <= today ? infoFor(date) : predictedFor(date);
            const real = date <= today || (ci && !ci.predicted);
            const isPeriod = ci?.inPeriod && real && !ci.predicted;
            const isPred = ci?.predicted && ci.inPeriod;
            const color = ci ? PHASES[ci.phase].color : null;
            const cls = ['d', !inMonth && 'out', date === today && 'today', isPeriod && 'period', isPred && 'pred'].filter(Boolean).join(' ');
            return (
              <button key={date} className={cls} onClick={() => setSel(date)} aria-label={`${fmtDate(date)}${ci ? `, día ${ci.cycleDay}, fase ${PHASES[ci.phase].label}` : ''}`}
                style={!isPeriod && color ? { background: `${color}1A` } : undefined}>
                {Number(date.slice(8))}
                <span className="marks">
                  {cycleDays[date]?.flow && <i style={{ background: 'var(--rose)' }} />}
                  {cycleDays[date]?.symptoms?.length > 0 && <i style={{ background: '#7B68C8' }} />}
                  {ci && !cycleDays[date] && <span style={{ fontSize: 9, color: 'var(--muted)', lineHeight: '6px' }}>{ci.cycleDay}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend">
          {Object.entries(PHASES).map(([k, p]) => (
            <span key={k}><i style={{ background: p.color }} />{p.label}</span>
          ))}
          <span><i style={{ border: '1.5px dashed var(--rose)' }} />Prevista</span>
        </div>
      </Card>

      <Card title="Tu historial" icon="📊">
        <div className="stat-grid">
          <div className="stat"><div className="k">Ciclo medio</div><div className="v">{stats.avgCycle} días</div></div>
          <div className="stat"><div className="k">Regla media</div><div className="v">{stats.avgPeriod} días</div></div>
        </div>
        <p className="tiny muted">
          {stats.basedOn ? `Calculado con tus últimos ${stats.basedOn} ciclos.` : 'Aún no hay ciclos completos: se usa un ciclo estándar de 28 días.'} Las fases son aproximadas (ovulación estimada 14 días antes de la siguiente regla).
        </p>
        {[...stats.sorted].reverse().map((p, i, arr) => {
          const prev = arr[i + 1];
          const len = p.end_date ? diffDays(p.end_date, p.start_date) + 1 : null;
          const cyc = prev ? diffDays(p.start_date, prev.start_date) : null;
          return (
            <div key={p.id} className="list-item" onClick={() => setSel(p.start_date)} role="button" tabIndex={0}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--rose)' }} />
              <div className="grow">
                <div className="t">{short(p.start_date)}{p.end_date ? ` – ${short(p.end_date)}` : ' · en curso'}</div>
                <div className="s">{len ? `${len} días de regla` : 'Sin fecha de fin'}{cyc ? ` · ciclo de ${cyc} días` : ''}</div>
              </div>
            </div>
          );
        })}
        {preds.length > 0 && (
          <>
            <div className="label">Próximas reglas estimadas</div>
            <div className="chips">{preds.map((p) => <span key={p.start} className="chip" style={{ borderStyle: 'dashed', borderColor: 'var(--rose)' }}>{short(p.start)}</span>)}</div>
          </>
        )}
      </Card>

      {sel && <DaySheet date={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DaySheet({ date, onClose }) {
  const { stats, cycleDays, infoFor, reloadCycle, showToast } = useData();
  const today = todayStr();
  const ci = infoFor(date);
  const period = stats.sorted.find((p) => p.start_date <= date && date <= (p.end_date || addDays(p.start_date, stats.avgPeriod - 1)));
  const openBefore = [...stats.sorted].reverse().find((p) => p.start_date <= date && !p.end_date);
  const cd = cycleDays[date] || { flow: null, symptoms: [] };
  const [flow, setFlow] = useState(cd.flow);
  const [sym, setSym] = useState(cd.symptoms || []);

  const run = async (fn, msg) => {
    try {
      await fn();
      await reloadCycle();
      if (msg) showToast(msg);
    } catch (e) { alert(e.message); }
  };
  const saveDay = (f, s) => run(() => api(`/cycle/days/${date}`, { method: 'PUT', body: { flow: f, symptoms: s } }));

  return (
    <Sheet onClose={onClose} title={cap(fmtDate(date))}>
      {ci && (
        <p className="small" style={{ marginTop: -6 }}>
          <span style={{ color: PHASES[ci.phase].color }}>●</span> Día {ci.cycleDay} del ciclo · fase {PHASES[ci.phase].label.toLowerCase()}
        </p>
      )}
      <div className="card">
        <div className="label">Regla</div>
        {period ? (
          <>
            <p className="small" style={{ margin: '0 0 10px' }}>
              Regla del {short(period.start_date)} {period.end_date ? `al ${short(period.end_date)}` : '(sin fecha de fin)'}
            </p>
            <div className="row wrap">
              {date !== period.end_date && date >= period.start_date && (
                <button className="btn soft sm" onClick={() => run(() => api(`/cycle/periods/${period.id}`, { method: 'PATCH', body: { end_date: date } }), 'Fin de la regla guardado').then(onClose)}>
                  Marcar este día como fin
                </button>
              )}
              {date !== period.start_date && (
                <button className="btn soft sm" onClick={() => run(() => api(`/cycle/periods/${period.id}`, { method: 'PATCH', body: { start_date: date } }), 'Inicio movido').then(onClose)}>
                  Mover inicio aquí
                </button>
              )}
              <button className="btn danger sm" onClick={() => confirm('¿Eliminar esta regla del historial?') && run(() => api(`/cycle/periods/${period.id}`, { method: 'DELETE' }), 'Regla eliminada').then(onClose)}>
                Eliminar
              </button>
            </div>
          </>
        ) : (
          <div className="row wrap">
            {date <= today && (
              <button className="btn sm" onClick={() => run(() => api('/cycle/periods', { method: 'POST', body: { start_date: date } }), 'Inicio de la regla guardado').then(onClose)}>
                Inicio de regla este día
              </button>
            )}
            {openBefore && (
              <button className="btn soft sm" onClick={() => run(() => api(`/cycle/periods/${openBefore.id}`, { method: 'PATCH', body: { end_date: date } }), 'Fin de la regla guardado').then(onClose)}>
                Fin de regla este día
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="label">Intensidad del flujo (opcional)</div>
        <div className="chips">
          {FLOW.map((f) => (
            <button key={f.key} className={`chip ${flow === f.key ? 'on' : ''}`} onClick={() => { const v = flow === f.key ? null : f.key; setFlow(v); saveDay(v, sym); }}>{f.label}</button>
          ))}
        </div>
        <div className="label">Síntomas (opcional)</div>
        <div className="chips">
          {CYCLE_SYMPTOMS.map((s) => (
            <button key={s} className={`chip ${sym.includes(s) ? 'on' : ''}`} onClick={() => { const v = sym.includes(s) ? sym.filter((x) => x !== s) : [...sym, s]; setSym(v); saveDay(flow, v); }}>{s}</button>
          ))}
        </div>
      </div>
      <button className="btn block soft" onClick={onClose}>Hecho</button>
    </Sheet>
  );
}
