import { useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from '../lib/store.jsx';

/** Fila de etiquetas rápidas: al tocar, añade el alimento al texto. */
export default function TagBar({ text, onChange }) {
  const { tags, reloadTags } = useData();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const add = (t) => {
    const cur = text.trim();
    const already = cur.toLowerCase().split(/,\s*/).includes(t.name.toLowerCase());
    if (already) return;
    onChange(cur ? `${cur.replace(/[,\s]+$/, '')}, ${t.name}` : t.name);
    api(`/tags/${t.id}/use`, { method: 'POST' }).catch(() => {});
  };

  const create = async () => {
    const n = name.trim();
    setAdding(false);
    setName('');
    if (!n) return;
    const t = await api('/tags', { method: 'POST', body: { name: n } });
    reloadTags();
    add(t);
  };

  return (
    <div className="tags-scroll">
      {adding ? (
        <input
          autoFocus
          className="input"
          style={{ width: 160, padding: '5px 10px', borderRadius: 999 }}
          placeholder="Nueva etiqueta"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={create}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      ) : (
        <button type="button" className="chip add" onClick={() => setAdding(true)}>+ Etiqueta</button>
      )}
      {tags.map((t) => (
        <button type="button" key={t.id} className="chip tag" onClick={() => add(t)}>{t.name}</button>
      ))}
    </div>
  );
}
