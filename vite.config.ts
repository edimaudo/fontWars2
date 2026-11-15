import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        splash: resolve(__dirname, 'src/client/splash.html'),
        game: resolve(__dirname, 'src/client/game.html'),
      },
    },
  },
  server: { host: '0.0.0.0', port: 5173 },
});
