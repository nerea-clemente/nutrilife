import { useEffect, useRef } from 'react';

export function Card({ icon, title, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || icon) && (
        <div className="card-h">
          {icon && <div className="ico" aria-hidden="true">{icon}</div>}
          <h2>{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Seg({ options, value, onChange, allowNone = true }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.key)}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          className={value === o.key ? 'on' : ''}
          onClick={() => onChange(allowNone && value === o.key ? null : o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function YesNo({ value, onChange }) {
  return <Seg options={[{ key: false, label: 'No' }, { key: true, label: 'Sí' }]} value={value} onChange={onChange} />;
}

export function Rating({ value, onChange, low, high, max = 5 }) {
  return (
    <div>
      <div className="rating" role="radiogroup">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} className={value === n ? 'on' : ''} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
      {(low || high) && <div className="rating-caption"><span>{low}</span><span>{high}</span></div>}
    </div>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function AutoTextarea({ value, onChange, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight + 2, 64)}px`;
  }, [value]);
  return <textarea ref={ref} className="textarea" value={value} onChange={(e) => onChange(e.target.value)} {...props} />;
}

export function Sheet({ onClose, children, title }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && <h2 style={{ fontSize: 17, margin: '0 0 12px' }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function bloatColor(v) {
  if (v == null) return '#C2D7D6';
  if (v <= 2) return '#4C9A7A';
  if (v <= 4) return '#8FB06A';
  if (v <= 6) return '#D1A23C';
  if (v <= 8) return '#D27A4E';
  return '#C4505E';
}
