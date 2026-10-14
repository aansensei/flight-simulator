import { defineConfig } from 'vite';

export default defineConfig({
  base: '/flight-simulator/',
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: true,
    open: false
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false
  }
});
