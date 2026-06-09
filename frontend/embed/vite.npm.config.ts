
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'qr-remote.mjs' : 'qr-remote.cjs',
      cssFileName: 'qr-remote',
    },
    rollupOptions: {
      output: { exports: 'named' },
    },
  },
});
