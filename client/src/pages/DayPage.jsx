import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEntry } from '../lib/useEntry.js';
import { useData } from '../lib/store.jsx';
import { todayStr, nowTime, addDays } from '../lib/dates.js';
import { MEALS, BRISTOL, BLOAT_ZONES, GAS_LEVELS, BOTTLE_ML } from '@shared/constants.js';
import { PHASES } from '@shared/cycle.js';
import { fmtDate, cap, dayNumber, bottles } from '@shared/format.js';
import { Card, Seg, YesNo, Rating, AutoTextarea, bloatColor } from '../components/ui.jsx';
import { IcLeft, IcRight, IcClock, IcTrash, Bottle } from '../components/Icons.jsx';
import TagBar from '../components/TagBar.jsx';
import PhotoStrip from '../components/PhotoStrip.jsx';
import BristolIcon from '../components/BristolIcon.jsx';

const STATUS = {
  idle: '', pending: 'Guardando…', saving: 'Guardando…', saved: 'Guardado', error: 'Sin conexión · se guardará luego',
};

export default function DayPage() {
  const params = useParams();
  const today = todayStr();
  const date = params.date || today;
  const nav = useNavigate();
  const { settings, infoFor, cycleDays } = useData();
  const { entry, set, status, photos, reloadPhotos } = useEntry(date);

  const go = (n) => {
    const d = addDays(date, n);
    nav(d === today ? '/' : `/dia/${d}`);
  };

  const dayN = dayNumber(date, settings?.start_date || (entry ? date : null));
  const ci = infoFor(date);
  const flow = cycleDays[date]?.flow;

  return (
    <div className="page">
      <div className="day-head">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Día anterior"><IcLeft width={20} /></button>
        <div className="mid">
          <div className="date">{date === today ? 'Hoy' : date === addDays(today, -1) ? 'Ayer' : cap(fmtDate(date, { weekday: 'long' }))}</div>
          <div className="meta">{cap(fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
        </div>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Día siguiente" disabled={date >= today} style={date >= today ? { opacity: 0.35 } : null}>
          <IcRight width={20} />
        </button>
      </div>

      <div className="badges">
        {dayN && <span className="badge">Día nº {dayN}</span>}
        {ci && (
          <Link to="/ciclo" className="badge" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="dot" style={{ background: PHASES[ci.phase].color }} />
            Ciclo día {ci.cycleDay} · {PHASES[ci.phase].label}{flow ? ` · ${flow}` : ''}
          </Link>
        )}
        <span className={`badge save-ind ${status === 'pending' ? 'saving' : status}`} aria-live="polite" style={{ display: STATUS[status] ? '' : 'none' }}>
          <span className="d" />{STATUS[status]}
        </span>
      </div>

      {!entry ? (
        <p className="empty">Cargando…</p>
      ) : (
        <>
          {MEALS.map((m) => (
            <MealCard
              key={m.key}
              meal={m}
              value={entry.meals[m.key]}
              set={(k, v) => set(`meals.${m.key}.${k}`, v)}
              date={date}
              photos={photos.filter((p) => p.meal === m.key)}
              reloadPhotos={reloadPhotos}
            />
          ))}

          <Card icon="🫖" title="Bebidas">
            <AutoTextarea value={entry.drinks} onChange={(v) => set('drinks', v)} placeholder="Café con leche, infusión de jengibre…" rows={2} />
            <TagBar text={entry.drinks} onChange={(v) => set('drinks', v)} />
          </Card>

          <WaterCard ml={entry.water_ml} onChange={(v) => set('water_ml', v)} />
          <BowelCard bowel={entry.bowel} set={(v) => set('bowel', v)} />
          <SymptomsCard s={entry.symptoms} set={(k, v) => set(`symptoms.${k}`, v)} />

          <Card icon="🌙" title="Sueño y estrés">
            <span className="label">Calidad del sueño</span>
            <Rating value={entry.sleep.quality} onChange={(v) => set('sleep.quality', v)} low="Muy malo" high="Muy bueno" />
            <span className="label">Horas dormidas</span>
            <div className="row">
              <button className="btn soft sm" onClick={() => set('sleep.hours', Math.max(0, (entry.sleep.hours ?? 7.5) - 0.5))} aria-label="Menos">−</button>
              <input
                className="input num"
                inputMode="decimal"
                value={entry.sleep.hours == null ? '' : String(entry.sleep.hours).replace('.', ',')}
                placeholder="—"
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  set('sleep.hours', v === '' ? null : Math.min(24, Math.max(0, Number(v) || 0)));
                }}
              />
              <button className="btn soft sm" onClick={() => set('sleep.hours', Math.min(24, (entry.sleep.hours ?? 7) + 0.5))} aria-label="Más">+</button>
              <span className="muted small">horas</span>
            </div>
            <span className="label">Nivel de estrés</span>
            <Rating value={entry.stress} onChange={(v) => set('stress', v)} low="Nada" high="Mucho" />
          </Card>

          <Card icon="📝" title="Notas">
            <AutoTextarea value={entry.notes} onChange={(v) => set('notes', v)} placeholder="Cualquier cosa que quieras comentar con tu nutricionista…" rows={3} />
          </Card>
          <p className="center tiny muted" style={{ marginBottom: 8 }}>Los cambios se guardan automáticamente.</p>
        </>
      )}
    </div>
  );
}

function MealCard({ meal, value, set, date, photos, reloadPhotos }) {
  return (
    <Card
      icon={meal.icon}
      title={meal.label}
      right={
        <div className="meal-time">
          <input type="time" className="input time" value={value.time} onChange={(e) => set('time', e.target.value)} aria-label={`Hora ${meal.label}`} />
          {!value.time && (
            <button className="btn ghost sm" onClick={() => set('time', nowTime())} aria-label="Poner hora actual"><IcClock width={18} /> Ahora</button>
          )}
        </div>
      }
    >
      <AutoTextarea value={value.text} onChange={(v) => set('text', v)} placeholder="¿Qué has comido?" rows={2} />
      <TagBar text={value.text} onChange={(v) => set('text', v)} />
      <PhotoStrip date={date} meal={meal.key} photos={photos} onChange={reloadPhotos} />
    </Card>
  );
}

function WaterCard({ ml, onChange }) {
  const [editing, setEditing] = useState(false);
  const full = Math.floor(ml / BOTTLE_ML);
  const rest = (ml % BOTTLE_ML) / BOTTLE_ML;
  return (
    <Card icon="💧" title="Agua" right={<span className="muted tiny">Owala · 750 ml</span>}>
      <div className="water-total">
        {editing ? (
          <input
            autoFocus
            className="input num"
            style={{ width: 120, fontSize: 22 }}
            inputMode="numeric"
            defaultValue={ml || ''}
            onBlur={(e) => { onChange(Math.max(0, Math.round(Number(e.target.value) || 0))); setEditing(false); }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <button className="big" style={{ border: 0, background: 'none', padding: 0, cursor: 'text' }} onClick={() => setEditing(true)} aria-label="Editar ml a mano">
            {ml.toLocaleString('es-ES')}
          </button>
        )}
        <span className="muted">ml · {bottles(ml)} {ml === BOTTLE_ML ? 'botella' : 'botellas'}</span>
      </div>
      <div className="bottles" aria-hidden="true">
        {Array.from({ length: full }, (_, i) => <Bottle key={i} fill={1} />)}
        {rest > 0 && <Bottle fill={rest} />}
        {ml === 0 && <span className="muted small" style={{ alignSelf: 'center' }}>Aún no has registrado agua</span>}
      </div>
      <div className="water-btns">
        <button className="btn soft" onClick={() => onChange(Math.max(0, ml - BOTTLE_ML / 2))} disabled={ml <= 0}>− ½</button>
        <button className="btn soft" onClick={() => onChange(ml + BOTTLE_ML / 2)}>+ ½</button>
        <button className="btn" onClick={() => onChange(ml + BOTTLE_ML)}>+ 1 botella</button>
      </div>
      <button className="btn ghost sm mt" onClick={() => setEditing(true)} style={{ padding: 0 }}>Escribir ml a mano</button>
    </Card>
  );
}

function BowelCard({ bowel, set }) {
  const items = bowel.items;
  const update = (i, k, v) => set({ ...bowel, none: false, items: items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) });
  return (
    <Card icon="🚽" title="Deposiciones" right={!bowel.none && items.length ? <span className="muted small">{items.length} {items.length === 1 ? 'vez' : 'veces'}</span> : null}>
      <div className="row">
        <button className={`chip ${bowel.none ? 'on' : ''}`} onClick={() => set({ none: !bowel.none, items: bowel.none ? items : [] })}>No hubo</button>
        <button className="chip add" onClick={() => set({ none: false, items: [...items, { time: nowTime(), bristol: null }] })}>+ Añadir deposición</button>
      </div>
      {!bowel.none && items.map((it, i) => (
        <div className="bowel-item" key={i}>
          <div className="row" style={{ marginBottom: 10 }}>
            <strong className="grow small">{i + 1}ª deposición</strong>
            <input type="time" className="input time" value={it.time || ''} onChange={(e) => update(i, 'time', e.target.value)} aria-label="Hora" />
            <button className="btn ghost sm" aria-label="Eliminar" onClick={() => set({ ...bowel, items: items.filter((_, j) => j !== i) })}><IcTrash width={18} /></button>
          </div>
          <div className="bristol" role="radiogroup" aria-label="Escala de Bristol">
            {BRISTOL.map((b) => (
              <button key={b.n} type="button" role="radio" aria-checked={it.bristol === b.n} className={it.bristol === b.n ? 'on' : ''} onClick={() => update(i, 'bristol', it.bristol === b.n ? null : b.n)} title={b.desc}>
                <BristolIcon n={b.n} />
                {b.n}
              </button>
            ))}
          </div>
          <div className="bristol-desc">
            {it.bristol ? <><strong>Tipo {it.bristol}:</strong> {BRISTOL[it.bristol - 1].desc} · <em>{BRISTOL[it.bristol - 1].group}</em></> : 'Elige la consistencia (escala de Bristol)'}
          </div>
        </div>
      ))}
    </Card>
  );
}

function SymptomsCard({ s, set }) {
  const toggleZone = (z) => {
    const cur = s.bloating_zones || [];
    set('bloating_zones', cur.includes(z) ? cur.filter((x) => x !== z) : [...cur, z]);
  };
  return (
    <Card icon="🌿" title="Síntomas digestivos">
      <span className="label">Distensión abdominal</span>
      <div className="slider-wrap">
        <input
          type="range" min="0" max="10" step="1"
          className={s.bloating == null ? 'unset' : ''}
          value={s.bloating ?? 0}
          onChange={(e) => set('bloating', Number(e.target.value))}
          aria-label="Distensión de 0 a 10"
        />
        <div className="slider-val" style={{ background: bloatColor(s.bloating) }}>{s.bloating ?? '–'}</div>
      </div>
      <div className="rating-caption"><span>0 · nada</span><span>10 · máxima</span></div>

      {s.bloating > 0 && (
        <>
          <span className="label">Zona</span>
          <div className="chips">
            {BLOAT_ZONES.map((z) => (
              <button key={z} className={`chip ${s.bloating_zones?.includes(z) ? 'on' : ''}`} onClick={() => toggleZone(z)}>{z}</button>
            ))}
          </div>
          <span className="label">¿Es visible?</span>
          <YesNo value={s.bloating_visible} onChange={(v) => set('bloating_visible', v)} />
        </>
      )}

      <span className="label">Gases</span>
      <Seg options={GAS_LEVELS} value={s.gases} onChange={(v) => set('gases', v)} />
      {s.gases && s.gases !== 'no' && (
        <input className="input mt" value={s.gases_when} onChange={(e) => set('gases_when', e.target.value)} placeholder="¿Cuándo? (p. ej. después de comer)" />
      )}

      <span className="label">Dolor</span>
      <YesNo value={s.pain} onChange={(v) => set('pain', v)} />
      {s.pain && <input className="input mt" value={s.pain_where} onChange={(e) => set('pain_where', e.target.value)} placeholder="¿Dónde?" />}

      <span className="label">Náuseas</span>
      <YesNo value={s.nausea} onChange={(v) => set('nausea', v)} />
    </Card>
  );
}
