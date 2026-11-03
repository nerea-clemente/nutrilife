import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { monthGrid, WEEKDAYS, todayStr } from '../lib/dates.js';
import { MEALS } from '@shared/constants.js';
import { PHASES } from '@shared/cycle.js';
import { fmtDate, cap, dayNumber } from '@shared/format.js';
import MonthNav from '../components/MonthNav.jsx';
import { bloatColor } from '../components/ui.jsx';
import { IcRight } from '../components/Icons.jsx';

export default function CalendarPage() {
  const today = todayStr();
  const [ym, setYm] = useState(() => [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]);
  const [entries, setEntries] = useState({});
  const nav = useNavigate();
  const { infoFor, predictedFor, settings } = useData();
  const days = useMemo(() => monthGrid(ym[0], ym[1]), [ym]);

  useEffect(() => {
    api(`/entries?from=${days[0].date}&to=${days[days.length - 1].date}`).then((rows) =>
      setEntries(Object.fromEntries(rows.map((r) => [r.date, r])))
    );
  }, [days]);

  const monthEntries = days.filter((d) => d.inMonth && entries[d.date]).map((d) => entries[d.date]).reverse();
  const open = (date) => nav(date === today ? '/' : `/dia/${date}`);

  return (
    <div className="page">
      <div className="topbar"><h1>Historial</h1></div>
      <div className="card">
        <MonthNav y={ym[0]} m={ym[1]} onChange={(y, m) => setYm([y, m])} />
        <div className="cal">
          {WEEKDAYS.map((w) => <div key={w} className="wd">{w}</div>)}
          {days.map(({ date, inMonth }) => {
            const e = entries[date];
            const ci = infoFor(date);
            const pi = date > today ? predictedFor(date) : null;
            const cls = ['d', !inMonth && 'out', date === today && 'today', ci?.inPeriod && 'period', !ci?.inPeriod && pi?.predicted && pi.inPeriod && 'pred'].filter(Boolean).join(' ');
            return (
              <button key={date} className={cls} onClick={() => date <= today && open(date)} aria-label={fmtDate(date)} disabled={date > today}>
                {Number(date.slice(8))}
                <span className="marks">
                  {e && <i style={{ background: bloatColor(e.data.symptoms.bloating) }} />}
                  {e?.photos > 0 && <i style={{ background: '#9AA8A9' }} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span><i style={{ background: bloatColor(1), borderRadius: '50%' }} />Distensión baja</span>
          <span><i style={{ background: bloatColor(6), borderRadius: '50%' }} />Media</span>
          <span><i style={{ background: bloatColor(9), borderRadius: '50%' }} />Alta</span>
          <span><i style={{ background: '#9AA8A9', borderRadius: '50%' }} />Con fotos</span>
          <span><i style={{ background: 'var(--rose-50)', border: '1px solid var(--rose)' }} />Regla</span>
          <span><i style={{ border: '1.5px dashed var(--rose)' }} />Regla prevista</span>
        </div>
      </div>

      <div className="section-title">Días registrados</div>
      <div className="card" style={{ padding: '4px 14px' }}>
        {!monthEntries.length && <p className="empty">No hay registros este mes.</p>}
        {monthEntries.map((e) => {
          const ci = infoFor(e.date);
          const meals = MEALS.filter((m) => e.data.meals[m.key].text.trim()).length;
          const n = dayNumber(e.date, settings?.start_date);
          return (
            <div key={e.date} className="list-item" onClick={() => open(e.date)} role="button" tabIndex={0}>
              <div className="slider-val" style={{ background: bloatColor(e.data.symptoms.bloating), width: 40, height: 40, minWidth: 40, fontSize: 15 }} title="Distensión">
                {e.data.symptoms.bloating ?? '–'}
              </div>
              <div className="grow">
                <div className="t">{cap(fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'short' }))}{n ? <span className="muted small"> · Día {n}</span> : null}</div>
                <div className="s">
                  {meals}/4 comidas · {e.data.water_ml ? `${e.data.water_ml} ml` : 'sin agua'}
                  {ci ? <> · <span style={{ color: PHASES[ci.phase].color }}>●</span> {PHASES[ci.phase].label}</> : null}
                </div>
              </div>
              <IcRight width={18} className="chev" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
