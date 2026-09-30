import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npx vite build --mode html` genera un único dist-html/index.html autocontenido (se abre con doble clic, sin servidor).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'html' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'html' ? { outDir: 'dist-html', assetsInlineLimit: 100_000_000 } : {},
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
  },
}));
