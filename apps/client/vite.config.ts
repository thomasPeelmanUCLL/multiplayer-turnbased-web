import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API and WebSocket calls to the game server in dev
    proxy: {
      '/auth':    'http://localhost:2567',
      '/matches': 'http://localhost:2567',
      '/users':   'http://localhost:2567',
      '/health':  'http://localhost:2567',
    },
  },
});
