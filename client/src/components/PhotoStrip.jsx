import { useRef, useState } from 'react';
import { api, photoUrl } from '../lib/api.js';
import { prepareImage } from '../lib/image.js';
import { IcCamera } from './Icons.jsx';
import Lightbox from './Lightbox.jsx';

export default function PhotoStrip({ date, meal, photos, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(0);
  const [open, setOpen] = useState(null);

  const upload = async (files) => {
    const list = [...files];
    setBusy(list.length);
    for (const f of list) {
      try {
        const { full, thumb } = await prepareImage(f);
        const form = new FormData();
        form.append('date', date);
        form.append('meal', meal);
        form.append('file', full, 'foto.jpg');
        form.append('thumb', thumb, 'mini.jpg');
        await api('/photos', { method: 'POST', form });
      } catch (e) {
        alert(`No se pudo subir la foto: ${e.message}`);
      }
      setBusy((b) => b - 1);
    }
    onChange();
  };

  return (
    <>
      <div className="photos">
        {photos.map((p) => (
          <img key={p.id} className="thumb" src={photoUrl(p.id)} alt="Foto de la comida" loading="lazy" onClick={() => setOpen(p)} />
        ))}
        {Array.from({ length: busy }, (_, i) => <div key={`b${i}`} className="thumb" aria-label="Subiendo" />)}
        <button type="button" className="thumb-add" onClick={() => input.current?.click()} aria-label="Añadir fotos">
          <span><IcCamera /><br />Foto</span>
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      </div>
      {open && (
        <Lightbox
          photo={open}
          onClose={() => setOpen(null)}
          onDelete={async () => {
            if (!confirm('¿Eliminar esta foto?')) return;
            await api(`/photos/${open.id}`, { method: 'DELETE' });
            setOpen(null);
            onChange();
          }}
        />
      )}
    </>
  );
}
