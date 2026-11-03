import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { MEALS } from '@shared/constants.js';
import { Card, Switch } from '../components/ui.jsx';

function b64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador no admite notificaciones. En iPhone, añade la app a la pantalla de inicio primero.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No has dado permiso para las notificaciones.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await api('/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
}

export default function RemindersPage() {
  const { settings, setSettings, showToast } = useData();
  const [r, setR] = useState(settings?.reminders);
  const [err, setErr] = useState('');
  useEffect(() => { if (settings && !r) setR(settings.reminders); }, [settings, r]);
  if (!r) return <div className="page"><p className="empty">Cargando…</p></div>;

  const save = async (next) => {
    setR(next);
    const s = await api('/settings', { method: 'PUT', body: { reminders: next } });
    setSettings(s);
  };

  const toggle = async (on) => {
    setErr('');
    if (on) {
      try { await subscribe(); } catch (e) { setErr(e.message); return; }
    }
    await save({ ...r, enabled: on });
    showToast(on ? 'Recordatorios activados' : 'Recordatorios desactivados');
  };

  const test = async () => {
    try {
      await subscribe();
      const res = await api('/push/test', { method: 'POST' });
      showToast(res.sent ? 'Notificación de prueba enviada' : 'No hay dispositivos suscritos');
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="page">
      <div className="topbar"><h1>Recordatorios</h1></div>
      <p className="subtitle">Notificaciones opcionales en el móvil. Sólo te avisa de una comida si aún no la has apuntado.</p>
      {err && <div className="err">{err}</div>}
      <Card>
        <div className="row">
          <div className="grow"><div style={{ fontWeight: 600 }}>Activar recordatorios</div><div className="muted tiny">Requiere permiso de notificaciones</div></div>
          <Switch checked={r.enabled} onChange={toggle} label="Activar recordatorios" />
        </div>
      </Card>
      <div style={{ opacity: r.enabled ? 1 : 0.5, pointerEvents: r.enabled ? 'auto' : 'none' }}>
        <Card title="Comidas" icon="🍽️">
          {MEALS.map((m) => (
            <div key={m.key} className="row" style={{ marginBottom: 10 }}>
              <span className="grow">{m.label}</span>
              <input type="time" className="input time" value={r.meals[m.key]} onChange={(e) => save({ ...r, meals: { ...r.meals, [m.key]: e.target.value } })} />
              <Switch checked={r.meals_on[m.key]} onChange={(v) => save({ ...r, meals_on: { ...r.meals_on, [m.key]: v } })} label={m.label} />
            </div>
          ))}
        </Card>
        <Card title="Agua" icon="💧" right={<Switch checked={r.water.on} onChange={(v) => save({ ...r, water: { ...r.water, on: v } })} label="Agua" />}>
          <div className="row">
            <span className="grow">Cada</span>
            <select className="input" style={{ width: 'auto' }} value={r.water.every_hours} onChange={(e) => save({ ...r, water: { ...r.water, every_hours: Number(e.target.value) } })}>
              {[1, 2, 3, 4].map((h) => <option key={h} value={h}>{h} {h === 1 ? 'hora' : 'horas'}</option>)}
            </select>
          </div>
          <div className="row mt">
            <span className="grow">Entre</span>
            <input type="time" className="input time" value={r.water.from} onChange={(e) => save({ ...r, water: { ...r.water, from: e.target.value } })} />
            <span>y</span>
            <input type="time" className="input time" value={r.water.to} onChange={(e) => save({ ...r, water: { ...r.water, to: e.target.value } })} />
          </div>
        </Card>
        <button className="btn soft block" onClick={test}>Enviar notificación de prueba</button>
      </div>
    </div>
  );
}
