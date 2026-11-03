import { NavLink, useLocation } from 'react-router-dom';
import { IcToday, IcCalendar, IcCycle, IcChart, IcMore } from './Icons.jsx';

const MORE = ['/mas', '/galeria', '/exportar', '/recordatorios', '/etiquetas', '/ajustes'];

export default function BottomNav() {
  const loc = useLocation();
  const items = [
    { to: '/', label: 'Hoy', Icon: IcToday, active: loc.pathname === '/' || loc.pathname.startsWith('/dia/') },
    { to: '/calendario', label: 'Historial', Icon: IcCalendar },
    { to: '/ciclo', label: 'Ciclo', Icon: IcCycle },
    { to: '/graficas', label: 'Gráficas', Icon: IcChart },
    { to: '/mas', label: 'Más', Icon: IcMore, active: MORE.includes(loc.pathname) },
  ];
  return (
    <nav className="nav" aria-label="Navegación principal">
      <div className="nav-inner">
        {items.map(({ to, label, Icon, active }) => (
          <NavLink key={to} to={to} className={({ isActive }) => ((active ?? isActive) ? 'active' : '')} end>
            <Icon />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
