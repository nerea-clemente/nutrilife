import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  resolve: { alias: { '@shared': new URL('./shared', import.meta.url).pathname } },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:3001' },
    fs: { allow: ['..'] },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
