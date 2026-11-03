import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { cycleStats, cycleInfo, predictedInfo, predictions } from '@shared/cycle.js';

const Ctx = createContext(null);

export function DataProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [cycle, setCycle] = useState({ periods: [], days: [] });
  const [tags, setTags] = useState([]);
  const [toast, setToast] = useState(null);

  const reloadCycle = useCallback(() => api('/cycle').then(setCycle), []);
  const reloadTags = useCallback(() => api('/tags').then(setTags), []);
  const reloadSettings = useCallback(() => api('/settings').then((s) => { setSettings(s); return s; }), []);

  useEffect(() => {
    reloadSettings().then((s) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && s.timezone !== tz) api('/settings', { method: 'PUT', body: { timezone: tz } }).then(setSettings);
    });
    reloadCycle();
    reloadTags();
  }, [reloadCycle, reloadTags, reloadSettings]);

  const stats = useMemo(() => cycleStats(cycle.periods), [cycle.periods]);
  const cycleDays = useMemo(() => Object.fromEntries(cycle.days.map((d) => [d.date, d])), [cycle.days]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const value = {
    settings, setSettings, reloadSettings,
    cycle, stats, cycleDays, reloadCycle,
    infoFor: (date) => cycleInfo(date, stats),
    predictedFor: (date) => predictedInfo(date, stats),
    predictions: (n) => predictions(stats, n),
    tags, setTags, reloadTags,
    showToast,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Ctx.Provider>
  );
}

export const useData = () => useContext(Ctx);
