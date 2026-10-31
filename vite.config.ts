import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // `npm run dev` + `npm start` in another terminal: the dev app talks to the local server.
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'node' },
} as Parameters<typeof defineConfig>[0]);
