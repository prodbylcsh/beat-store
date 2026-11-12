import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: { outDir: 'dist', target: 'es2022' },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/media': 'http://localhost:8787',
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as any);
