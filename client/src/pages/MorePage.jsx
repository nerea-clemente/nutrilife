import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { IcPhoto, IcDownload, IcBell, IcTag, IcGear, IcLogout, IcRight } from '../components/Icons.jsx';

const ITEMS = [
  { to: '/galeria', label: 'Galería de fotos', sub: 'Tus comidas por fecha y tipo', Icon: IcPhoto },
  { to: '/exportar', label: 'Exportar PDF / CSV', sub: 'Para enviar a tu nutricionista', Icon: IcDownload },
  { to: '/recordatorios', label: 'Recordatorios', sub: 'Avisos para comidas y agua', Icon: IcBell },
  { to: '/etiquetas', label: 'Etiquetas rápidas', sub: 'Alimentos que repites', Icon: IcTag },
  { to: '/ajustes', label: 'Ajustes', sub: 'Día 1 del diario, contraseña', Icon: IcGear },
];

export default function MorePage({ user, onLogout }) {
  return (
    <div className="page">
      <div className="topbar"><h1>Más</h1></div>
      <p className="subtitle">{user.name ? `Hola, ${user.name}` : user.email}</p>
      <div className="card" style={{ padding: '4px 14px' }}>
        {ITEMS.map(({ to, label, sub, Icon }) => (
          <Link key={to} to={to} className="list-item">
            <div className="card-h" style={{ margin: 0 }}><div className="ico" style={{ color: 'var(--accent)' }}><Icon width={19} /></div></div>
            <div className="grow"><div className="t">{label}</div><div className="s">{sub}</div></div>
            <IcRight width={18} className="chev" />
          </Link>
        ))}
      </div>
      <button className="btn danger block" onClick={async () => { await api('/auth/logout', { method: 'POST' }); onLogout(); }}>
        <IcLogout width={18} /> Cerrar sesión
      </button>
    </div>
  );
}
