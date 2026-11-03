import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { loadUser, sameOrigin, cleanupSessions } from './auth.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import photoRoutes from './routes/photos.js';
import exportRoutes from './routes/export.js';
import pushRoutes, { startScheduler } from './routes/push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3001);
const isProd = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
if (process.env.TRUST_PROXY !== '0') app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), geolocation=(), microphone=()',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  if (isProd) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(loadUser);
app.use('/api', sameOrigin);
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', dataRoutes);
app.use('/api', photoRoutes);
app.use('/api', exportRoutes);
app.use('/api/push', pushRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));

// En producción servimos el frontend compilado.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders(res, file) {
        if (file.endsWith('sw.js') || file.endsWith('.html') || file.endsWith('.webmanifest'))
          res.set('Cache-Control', 'no-cache');
        else if (file.includes(`${path.sep}assets${path.sep}`))
          res.set('Cache-Control', 'public, max-age=31536000, immutable');
      },
    })
  );
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Error del servidor' });
});

cleanupSessions();
setInterval(cleanupSessions, 6 * 3600000).unref();
startScheduler();

app.listen(PORT, () => {
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  console.log(`NutriLife API en http://localhost:${PORT} (${users} usuario/s)`);
});
