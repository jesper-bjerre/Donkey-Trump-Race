import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverUrl = process.env.DTR_SERVER_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': serverUrl,
      '/healthz': serverUrl,
      '/ws': { target: serverUrl.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
