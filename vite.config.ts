import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const projectRoot = __dirname;
const clientRoot = resolve(projectRoot, 'src/client');

export default defineConfig({
  // Treat src/client as the Vite root so splash.html and game.html are
  // emitted at the top level of dist/client, matching both Vercel and Devvit.
  root: clientRoot,
  plugins: [react()],
  // User-supplied font files and the generated browser content manifest live
  // outside the client source directory but must be copied to the web root.
  publicDir: resolve(projectRoot, 'public'),
  build: {
    outDir: resolve(projectRoot, 'dist/client'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        splash: resolve(clientRoot, 'splash.html'),
        game: resolve(clientRoot, 'game.html'),
      },
    },
  },
  server: { host: '0.0.0.0', port: 5173 },
});
