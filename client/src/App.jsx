import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './lib/api.js';
import { DataProvider } from './lib/store.jsx';
import BottomNav from './components/BottomNav.jsx';
import Login from './pages/Login.jsx';
import DayPage from './pages/DayPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import CyclePage from './pages/CyclePage.jsx';
import ChartsPage from './pages/ChartsPage.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import ExportPage from './pages/ExportPage.jsx';
import MorePage from './pages/MorePage.jsx';
import RemindersPage from './pages/RemindersPage.jsx';
import TagsPage from './pages/TagsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  const [auth, setAuth] = useState(null);
  const check = () => api('/auth/status').then(setAuth).catch(() => setAuth({ user: null, offline: true }));
  useEffect(() => {
    check();
    const h = () => setAuth((a) => ({ ...(a || {}), user: null }));
    window.addEventListener('nl:unauthorized', h);
    return () => window.removeEventListener('nl:unauthorized', h);
  }, []);

  if (!auth) return <div className="auth"><p className="muted center">Cargando…</p></div>;
  if (!auth.user) return <Login status={auth} onDone={check} />;

  return (
    <DataProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<DayPage />} />
          <Route path="/dia/:date" element={<DayPage />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/ciclo" element={<CyclePage />} />
          <Route path="/graficas" element={<ChartsPage />} />
          <Route path="/galeria" element={<GalleryPage />} />
          <Route path="/exportar" element={<ExportPage />} />
          <Route path="/mas" element={<MorePage user={auth.user} onLogout={check} />} />
          <Route path="/recordatorios" element={<RemindersPage />} />
          <Route path="/etiquetas" element={<TagsPage />} />
          <Route path="/ajustes" element={<SettingsPage user={auth.user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </DataProvider>
  );
}
