import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/desktop/',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: '../../server/wwwroot/desktop',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api':   'http://localhost:8080',
      '/embed': 'http://localhost:8080',
    },
  },
});
