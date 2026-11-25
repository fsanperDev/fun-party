import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * GitHub Pages no conoce las rutas de la SPA: al recargar /partida/... sirve 404.html.
 * Copiamos index.html como 404.html para que la app arranque igualmente.
 */
const spaFallback = (): Plugin => ({
  name: 'spa-404-fallback',
  apply: 'build',
  closeBundle() {
    const dist = path.resolve(__dirname, 'dist');
    if (fs.existsSync(path.join(dist, 'index.html'))) fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
  },
});

const API_URL = process.env.VITE_API_PROXY || 'http://localhost:8001';

export default defineConfig({
  // En GitHub Pages la web vive en /<nombre-del-repo>/ (VITE_BASE lo define el workflow).
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          charts: ['recharts'],
          motion: ['motion'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': { target: API_URL, changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: API_URL, changeOrigin: true } },
  },
});
