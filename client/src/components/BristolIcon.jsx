// Iconos simplificados de la escala de heces de Bristol
const C = '#8A6A4F';
export default function BristolIcon({ n }) {
  const f = { fill: C };
  switch (n) {
    case 1:
      return <svg viewBox="0 0 30 22" aria-hidden="true"><circle cx="6" cy="8" r="3.3" {...f} /><circle cx="15" cy="6" r="3" {...f} /><circle cx="24" cy="9" r="3.4" {...f} /><circle cx="10" cy="16" r="3" {...f} /><circle cx="20" cy="16" r="3.2" {...f} /></svg>;
    case 2:
      return <svg viewBox="0 0 30 22" aria-hidden="true"><g {...f}><circle cx="6" cy="11" r="4.2" /><circle cx="12" cy="10" r="4.6" /><circle cx="18.5" cy="11" r="4.4" /><circle cx="24.5" cy="11.5" r="4" /></g></svg>;
    case 3:
      return <svg viewBox="0 0 30 22" aria-hidden="true"><rect x="2" y="7" width="26" height="9" rx="4.5" {...f} /><path d="M9 7.5l1.5 3M15 15.5l1-3M21 7.5l-1 3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 4:
      return <svg viewBox="0 0 30 22" aria-hidden="true"><path d="M3 14c4-7 8 3 12-3s8-2 12 0" stroke={C} strokeWidth="5.5" fill="none" strokeLinecap="round" /></svg>;
    case 5:
      return <svg viewBox="0 0 30 22" aria-hidden="true"><g {...f}><rect x="2" y="5" width="9" height="6.5" rx="3.2" /><rect x="14" y="4" width="10" height="7" rx="3.5" /><rect x="7" y="13" width="10" height="6.5" rx="3.2" /><rect x="20" y="13" width="7.5" height="6" rx="3" /></g></svg>;
    case 6:
      return <svg viewBox="0 0 30 22" aria-hidden="true"><path d="M3 13c0-3 3-5 5-3 1-3 5-4 7-1 2-3 7-2 7 1 3-1 6 2 4 5 1 3-3 4-5 3-2 2-6 2-7 0-2 2-6 1-6-1-3 0-5-2-5-4z" {...f} /></svg>;
    case 7:
      return <svg viewBox="0 0 30 22" aria-hidden="true"><path d="M2 15c3-2 5 1 8-1s5 1 8-1 6 1 10-1v3c-4 2-7-1-10 1s-5-1-8 1-5-1-8 1z" {...f} opacity="0.85" /><circle cx="9" cy="8" r="1.5" {...f} opacity="0.6" /><circle cx="20" cy="7" r="1.2" {...f} opacity="0.6" /></svg>;
    default:
      return null;
  }
}
