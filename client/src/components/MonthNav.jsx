import { IcLeft, IcRight } from './Icons.jsx';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function useMonthLabel(y, m) {
  return `${MONTHS[m]} ${y}`;
}

export default function MonthNav({ y, m, onChange }) {
  const move = (n) => {
    const d = new Date(Date.UTC(y, m + n, 1));
    onChange(d.getUTCFullYear(), d.getUTCMonth());
  };
  return (
    <div className="cal-head">
      <button className="icon-btn" onClick={() => move(-1)} aria-label="Mes anterior"><IcLeft width={20} /></button>
      <div className="m">{MONTHS[m]} {y}</div>
      <button className="icon-btn" onClick={() => move(1)} aria-label="Mes siguiente"><IcRight width={20} /></button>
    </div>
  );
}
