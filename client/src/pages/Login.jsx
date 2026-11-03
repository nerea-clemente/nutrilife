import { useState } from 'react';
import { api } from '../lib/api.js';

export default function Login({ status, onDone }) {
  const signup = status.canSignup;
  const [f, setF] = useState({ email: '', password: '', name: '', setup_code: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api(signup ? '/auth/signup' : '/auth/login', { method: 'POST', body: f });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth" onSubmit={submit}>
      <div className="brand">
        <img src="/icons/icon-192.png" alt="" />
        <div>
          <h1>NutriLife</h1>
          <div className="muted small">Diario de nutrición y digestión</div>
        </div>
      </div>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>{signup ? 'Crea tu cuenta' : 'Inicia sesión'}</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          {signup ? 'Es tu diario personal: sólo se puede crear una cuenta y nadie más tendrá acceso.' : 'Tus datos son privados y sólo tú puedes verlos.'}
        </p>
        {status.offline && <div className="err">No hay conexión con el servidor.</div>}
        {err && <div className="err">{err}</div>}
        {signup && (
          <>
            <label className="label" htmlFor="n">Nombre (opcional)</label>
            <input id="n" className="input" value={f.name} onChange={up('name')} autoComplete="given-name" />
          </>
        )}
        <label className="label" htmlFor="e">Email</label>
        <input id="e" className="input" type="email" value={f.email} onChange={up('email')} autoComplete="username" required />
        <label className="label" htmlFor="p">Contraseña</label>
        <input id="p" className="input" type="password" value={f.password} onChange={up('password')} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} required />
        {signup && status.needsSetupCode && (
          <>
            <label className="label" htmlFor="c">Código de configuración</label>
            <input id="c" className="input" value={f.setup_code} onChange={up('setup_code')} required />
          </>
        )}
        <button className="btn block mt" disabled={busy}>{busy ? '…' : signup ? 'Crear cuenta' : 'Entrar'}</button>
      </div>
    </form>
  );
}
