import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { normalizeEntry } from '@shared/constants.js';

const pendingKey = (date) => `nl_pending_${date}`;

function setIn(obj, path, value) {
  const keys = path.split('.');
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}

/**
 * Carga y autoguarda la entrada de un día.
 * Guarda 700 ms después del último cambio, al salir de la página y al recuperar la conexión.
 * Si falla (sin cobertura), lo deja pendiente en el dispositivo y reintenta.
 */
export function useEntry(date) {
  const [entry, setEntry] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | pending | saving | saved | error
  const entryRef = useRef(null);
  const dirty = useRef(false);
  const timer = useRef(null);
  const dateRef = useRef(date);

  const save = useCallback(async (keepalive = false) => {
    clearTimeout(timer.current);
    if (!dirty.current || !entryRef.current) return;
    const d = dateRef.current;
    const data = entryRef.current;
    dirty.current = false;
    setStatus('saving');
    try {
      await api(`/entries/${d}`, { method: 'PUT', body: { data }, keepalive });
      localStorage.removeItem(pendingKey(d));
      if (d === dateRef.current) {
        setStatus('saved');
        setExists(true);
      }
    } catch (e) {
      if (e.status === 401) return;
      try { localStorage.setItem(pendingKey(d), JSON.stringify(data)); } catch { /* sin espacio */ }
      if (d === dateRef.current) setStatus('error');
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    const r = await api(`/entries/${dateRef.current}`);
    setPhotos(r.photos);
  }, []);

  useEffect(() => {
    dateRef.current = date;
    let cancelled = false;
    setEntry(null);
    setStatus('idle');
    api(`/entries/${date}`)
      .then((r) => {
        if (cancelled) return;
        let data = r.data;
        const local = localStorage.getItem(pendingKey(date));
        if (local) {
          data = normalizeEntry(JSON.parse(local));
          dirty.current = true;
          setStatus('pending');
          setTimeout(() => save(), 300);
        }
        entryRef.current = data;
        setEntry(data);
        setExists(r.exists);
        setPhotos(r.photos);
      })
      .catch(() => {
        const local = localStorage.getItem(pendingKey(date));
        const data = normalizeEntry(local ? JSON.parse(local) : null);
        entryRef.current = data;
        setEntry(data);
        setStatus('error');
      });
    return () => {
      cancelled = true;
      save(true);
    };
  }, [date, save]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && save(true);
    const onOnline = () => {
      if (localStorage.getItem(pendingKey(dateRef.current))) {
        dirty.current = true;
        save();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onHide);
    };
  }, [save]);

  const set = useCallback((path, value) => {
    const next = setIn(entryRef.current, path, value);
    entryRef.current = next;
    setEntry(next);
    dirty.current = true;
    setStatus('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 700);
  }, [save]);

  return { entry, set, status, photos, reloadPhotos: loadPhotos, exists, save };
}
