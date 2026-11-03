import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { photoUrl } from '../lib/api.js';
import { IcClose, IcTrash } from './Icons.jsx';
import { MEALS } from '@shared/constants.js';
import { fmtDate, cap } from '@shared/format.js';

export default function Lightbox({ photo, onClose, onDelete, showDayLink }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const meal = MEALS.find((m) => m.key === photo.meal);
  return (
    <div className="lightbox" role="dialog" aria-modal="true">
      <div className="bar">
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{meal?.label}</div>
          {photo.date && <div className="tiny" style={{ opacity: 0.75 }}>{cap(fmtDate(photo.date))}</div>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IcClose width={20} /></button>
      </div>
      <img src={photoUrl(photo.id, 'full')} alt={`Foto de ${meal?.label}`} />
      <div className="bar bottom">
        {showDayLink && <Link className="btn soft sm" to={`/dia/${photo.date}`}>Ir al día</Link>}
        <div className="grow" />
        {onDelete && <button className="btn danger sm" onClick={onDelete}><IcTrash width={16} /> Eliminar</button>}
      </div>
    </div>
  );
}
