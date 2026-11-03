import { useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { Card } from '../components/ui.jsx';

export default function SettingsPage({ user }) {
  const { settings, setSettings, showToast } = useData();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);

  const saveStart = async (v) => {
    const s = await api('/settings', { method: 'PUT', body: { start_date: v || null } });
    setSettings(s);
    showToast('Guardado');
  };
  const changePw = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/password', { method: 'POST', body: pw });
      setPw({ current: '', next: '' });
      setMsg({ ok: 'Contraseña cambiada. Se han cerrado las demás sesiones.' });
    } catch (e2) { setMsg({ err: e2.message }); }
  };

  return (
    <div className="page">
      <div className="topbar"><h1>Ajustes</h1></div>
      <Card title="Diario" icon="📔">
        <label className="label" htmlFor="sd">Fecha del día nº 1</label>
        <input id="sd" type="date" className="input" value={settings?.start_date || ''} onChange={(e) => saveStart(e.target.value)} />
        <p className="tiny muted">Se fija automáticamente con tu primer registro. Cámbiala si tu nutricionista cuenta los días desde otra fecha.</p>
      </Card>
      <Card title="Cuenta" icon="🔒">
        <p className="small muted" style={{ marginTop: -4 }}>{user.email}</p>
        <form onSubmit={changePw}>
          {msg?.ok && <div className="ok">{msg.ok}</div>}
          {msg?.err && <div className="err">{msg.err}</div>}
          <label className="label" htmlFor="pc">Contraseña actual</label>
          <input id="pc" className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          <label className="label" htmlFor="pn">Nueva contraseña</label>
          <input id="pn" className="input" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          <button className="btn block mt">Cambiar contraseña</button>
        </form>
      </Card>
      <p className="center tiny muted">Tus datos y fotos se guardan en tu servidor, sin URLs públicas: sólo se pueden ver con tu sesión iniciada.</p>
    </div>
  );
}
