import { useState } from 'react';
import { todayStr, addDays } from '../lib/dates.js';
import { Card, Switch } from '../components/ui.jsx';
import { IcDownload, IcShare } from '../components/Icons.jsx';

export default function ExportPage() {
  const today = todayStr();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const presets = [
    { label: 'Última semana', f: addDays(today, -6) },
    { label: '2 semanas', f: addDays(today, -13) },
    { label: 'Este mes', f: `${today.slice(0, 8)}01` },
    { label: '30 días', f: addDays(today, -29) },
  ];

  const fetchFile = async (kind) => {
    const q = new URLSearchParams({ from, to, ...(kind === 'pdf' && photos ? { photos: '1' } : {}) });
    const res = await fetch(`/api/export.${kind}?${q}`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('No se pudo generar el archivo');
    const blob = await res.blob();
    return new File([blob], `diario-${from}_${to}.${kind}`, { type: kind === 'pdf' ? 'application/pdf' : 'text/csv' });
  };

  const run = async (kind, share) => {
    setErr('');
    setBusy(kind + (share ? 's' : ''));
    try {
      const file = await fetchFile(kind);
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Diario de nutrición' });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e) {
      if (e.name !== 'AbortError') setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="page">
      <div className="topbar"><h1>Exportar</h1></div>
      <p className="subtitle">Genera un informe limpio para enviárselo a tu nutricionista.</p>
      <Card title="Rango de fechas" icon="📅">
        <div className="chips" style={{ marginBottom: 12 }}>
          {presets.map((p) => (
            <button key={p.label} className={`chip ${from === p.f && to === today ? 'on' : ''}`} onClick={() => { setFrom(p.f); setTo(today); }}>{p.label}</button>
          ))}
        </div>
        <div className="row">
          <label className="grow"><span className="label">Desde</span><input type="date" className="input" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label className="grow"><span className="label">Hasta</span><input type="date" className="input" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        </div>
      </Card>

      {err && <div className="err">{err}</div>}

      <Card title="PDF" icon="📄">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="grow">
            <div style={{ fontWeight: 500 }}>Incluir fotos de las comidas</div>
            <div className="muted tiny">El archivo será más pesado</div>
          </div>
          <Switch checked={photos} onChange={setPhotos} label="Incluir fotos" />
        </div>
        <div className="row">
          <button className="btn grow" onClick={() => run('pdf')} disabled={!!busy}><IcDownload width={18} /> {busy === 'pdf' ? 'Generando…' : 'Descargar PDF'}</button>
          {canShare && <button className="btn soft" onClick={() => run('pdf', true)} disabled={!!busy} aria-label="Compartir PDF"><IcShare width={18} /> Compartir</button>}
        </div>
      </Card>

      <Card title="CSV (Excel)" icon="📊">
        <p className="muted small" style={{ marginTop: -4 }}>Una fila por día, separado por punto y coma. Se abre directamente en Excel o Google Sheets.</p>
        <div className="row">
          <button className="btn soft grow" onClick={() => run('csv')} disabled={!!busy}><IcDownload width={18} /> {busy === 'csv' ? 'Generando…' : 'Descargar CSV'}</button>
          {canShare && <button className="btn soft" onClick={() => run('csv', true)} disabled={!!busy} aria-label="Compartir CSV"><IcShare width={18} /></button>}
        </div>
      </Card>
    </div>
  );
}
