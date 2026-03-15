import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    '__SENTINEL_MODE__': JSON.stringify(process.env.SENTINEL_MODE ?? 'local'),
  },
  server: {
    port: 5173,
    proxy: {
      '/trpc': 'http://localhost:5678',
      '/images': 'http://localhost:5678',
    },
  },
});
