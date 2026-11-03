import { useEffect, useRef, useState } from 'react';
import { PHASES } from '@shared/cycle.js';
import { fmtDate } from '@shared/format.js';

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Gráfica temporal con bandas de fase del ciclo de fondo.
 * series: [{ key, label, color, values: (number|null)[], type: 'line' | 'bar', fmt }]
 */
export default function Chart({ dates, series, yMax, yTicks, phases, height = 180, unitFmt = (v) => v }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 34, r: 10, t: 10, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const n = dates.length;
  const step = iw / n;
  const x = (i) => pad.l + step * (i + 0.5);
  const y = (v) => pad.t + ih - (v / yMax) * ih;

  const labelEvery = Math.ceil(n / 6);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.floor((px - pad.l) / step);
    setHover(i >= 0 && i < n ? i : null);
  };

  const barSeries = series.filter((s) => s.type === 'bar');
  const bw = Math.max(2, Math.min(18, step - 2) / Math.max(1, barSeries.length));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="chart" width={W} height={height} viewBox={`0 0 ${W} ${height}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img">
        {/* bandas de fase */}
        {phases && dates.map((d, i) => {
          const p = phases[i];
          if (!p) return null;
          return (
            <g key={d}>
              <rect x={pad.l + step * i} y={pad.t} width={step + 0.5} height={ih} fill={PHASES[p].color} opacity={0.09} />
              <rect x={pad.l + step * i} y={pad.t + ih + 3} width={step + 0.5} height={4} fill={PHASES[p].color} />
            </g>
          );
        })}
        {/* rejilla */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E3EAE9" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#9AA8A9">{unitFmt(t)}</text>
          </g>
        ))}
        {dates.map((d, i) => (i % labelEvery === 0 || i === n - 1) && (n - 1 - i >= labelEvery / 2 || i === n - 1) ? (
          <text key={d} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#9AA8A9">{fmtDate(d, { day: 'numeric', month: 'numeric' })}</text>
        ) : null)}
        {/* barras */}
        {barSeries.map((s, si) => s.values.map((v, i) => v ? (
          <path key={`${s.key}${i}`}
            d={roundTop(x(i) - (bw * barSeries.length) / 2 + si * bw + 1, y(Math.min(v, yMax)), bw - 2, pad.t + ih - y(Math.min(v, yMax)), Math.min(4, (bw - 2) / 2))}
            fill={s.color} opacity={hover == null || hover === i ? 1 : 0.55} />
        ) : null))}
        {/* líneas */}
        {series.filter((s) => s.type === 'line').map((s) => {
          const segs = [];
          let cur = [];
          s.values.forEach((v, i) => {
            if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]);
          });
          if (cur.length) segs.push(cur);
          return (
            <g key={s.key}>
              {segs.map((sg, k) => sg.length > 1 && (
                <polyline key={k} points={sg.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {s.values.map((v, i) => v != null && (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : n > 45 ? 2.5 : 4} fill={s.color} stroke="#fff" strokeWidth="2" />
              ))}
            </g>
          );
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#6B7B7D" strokeWidth="1" strokeDasharray="3 3" />}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: Math.min(Math.max(x(hover), 70), W - 70), top: 0 }}>
          <b>{fmtDate(dates[hover], { weekday: 'short', day: 'numeric', month: 'short' })}</b>
          {series.map((s) => (
            <div key={s.key} className="tr">
              <span className="sw" style={{ background: s.color }} />
              {s.label}: <b>{s.values[hover] == null ? '—' : (s.fmt ? s.fmt(s.values[hover]) : s.values[hover])}</b>
            </div>
          ))}
          {phases?.[hover] && <div className="tr muted"><span className="sw" style={{ background: PHASES[phases[hover]].color }} />Fase {PHASES[phases[hover]].label.toLowerCase()}</div>}
        </div>
      )}
    </div>
  );
}

function roundTop(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
