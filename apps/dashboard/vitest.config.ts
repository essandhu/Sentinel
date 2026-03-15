import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    '__SENTINEL_MODE__': JSON.stringify('server'),
  },
  test: {
    name: 'dashboard',
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    exclude: ['dist/**', 'node_modules/**', 'e2e/**'],
  },
});
