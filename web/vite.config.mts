/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../node_modules/.vite/web',
  server: {
    port: 3001,
    host: 'localhost',
  },
  preview: {
    port: 3001,
    host: 'localhost',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@llm/circuit-breaker': path.resolve(
        __dirname,
        '../packages/circuit-breaker/src/index.ts'
      ),
      '@llm/decorators': path.resolve(
        __dirname,
        '../packages/decorators/src/index.ts'
      ),
      '@llm/filters': path.resolve(
        __dirname,
        '../packages/filters/src/index.ts'
      ),
      '@llm/interceptors': path.resolve(
        __dirname,
        '../packages/interceptors/src/index.ts'
      ),
      '@llm/config': path.resolve(__dirname, '../packages/config/src/index.ts'),
      '@llm/repository': path.resolve(
        __dirname,
        '../packages/repository/src/index.ts'
      ),
      '@llm/rate-limiter': path.resolve(
        __dirname,
        '../packages/rate-limiter/src/index.ts'
      ),
      '@llm/redis': path.resolve(__dirname, '../packages/redis/src/index.ts'),
      '@llm/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
      '@llm/types': path.resolve(__dirname, '../packages/types/src/index.ts'),
      '@llm/utils': path.resolve(__dirname, '../packages/utils/src/index.ts'),
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
