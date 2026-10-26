import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // reachable from phones on the LAN
    proxy: {
      '/healthz': serverUrl,
      '/api': serverUrl,
      '/socket.io': { target: serverUrl, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
