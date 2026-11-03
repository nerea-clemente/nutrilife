import { useEffect, useState } from 'react';
import { api, photoUrl } from '../lib/api.js';
import { todayStr, addDays } from '../lib/dates.js';
import { MEALS } from '@shared/constants.js';
import { fmtDate, cap } from '@shared/format.js';
import Lightbox from '../components/Lightbox.jsx';

export default function GalleryPage() {
  const today = todayStr();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [meal, setMeal] = useState('');
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(null);

  const load = () => {
    const q = new URLSearchParams({ from, to, ...(meal ? { meal } : {}) });
    api(`/photos?${q}`).then(setPhotos);
  };
  useEffect(load, [from, to, meal]);

  const groups = [];
  for (const p of photos || []) {
    const g = groups[groups.length - 1];
    if (g && g.date === p.date) g.items.push(p);
    else groups.push({ date: p.date, items: [p] });
  }

  return (
    <div className="page">
      <div className="topbar"><h1>Galería</h1></div>
      <div className="card">
        <div className="row">
          <label className="grow"><span className="label">Desde</span><input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className="grow"><span className="label">Hasta</span><input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        </div>
        <div className="chips mt">
          <button className={`chip ${!meal ? 'on' : ''}`} onClick={() => setMeal('')}>Todas</button>
          {MEALS.map((m) => <button key={m.key} className={`chip ${meal === m.key ? 'on' : ''}`} onClick={() => setMeal(m.key)}>{m.label}</button>)}
        </div>
      </div>
      {photos && !photos.length && <p className="empty">No hay fotos con estos filtros.</p>}
      {groups.map((g) => (
        <div key={g.date}>
          <div className="section-title">{cap(fmtDate(g.date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
          <div className="gal-grid">
            {g.items.map((p) => (
              <button key={p.id} onClick={() => setOpen(p)} aria-label={`Foto de ${p.meal}`}>
                <img src={photoUrl(p.id)} alt="" loading="lazy" />
                <span className="tagm">{MEALS.find((m) => m.key === p.meal)?.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {open && (
        <Lightbox photo={open} showDayLink onClose={() => setOpen(null)}
          onDelete={async () => { if (!confirm('¿Eliminar esta foto?')) return; await api(`/photos/${open.id}`, { method: 'DELETE' }); setOpen(null); load(); }} />
      )}
    </div>
  );
}
