import { useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';
import { IcTrash } from '../components/Icons.jsx';

export default function TagsPage() {
  const { tags, reloadTags } = useData();
  const [name, setName] = useState('');
  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api('/tags', { method: 'POST', body: { name } });
    setName('');
    reloadTags();
  };
  return (
    <div className="page">
      <div className="topbar"><h1>Etiquetas rápidas</h1></div>
      <p className="subtitle">Tócalas bajo cada comida para añadir el alimento sin escribir. Las más usadas salen primero.</p>
      <form className="card row" onSubmit={add}>
        <input className="input grow" placeholder="p. ej. arroz integral" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn">Añadir</button>
      </form>
      <div className="card" style={{ padding: '4px 14px' }}>
        {!tags.length && <p className="empty">Todavía no tienes etiquetas.</p>}
        {tags.map((t) => (
          <div key={t.id} className="list-item">
            <span className="chip tag">{t.name}</span>
            <span className="grow muted tiny">{t.uses ? `usada ${t.uses} ${t.uses === 1 ? 'vez' : 'veces'}` : ''}</span>
            <button className="btn ghost sm" aria-label={`Eliminar ${t.name}`} onClick={async () => { await api(`/tags/${t.id}`, { method: 'DELETE' }); reloadTags(); }}><IcTrash width={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
