
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: '../../server/wwwroot/embed',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/iife.ts'),
      name: 'QRRemote',
      formats: ['iife'],
      fileName: () => 'qr-remote.js',
      cssFileName: 'qr-remote',
    },
    rollupOptions: {
      output: {
        extend: false,
        exports: 'named',
      },
    },
  },
});
