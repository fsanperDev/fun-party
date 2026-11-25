import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_URL = process.env.VITE_API_PROXY || 'http://localhost:8001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
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
