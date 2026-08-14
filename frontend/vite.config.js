import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import sirv from 'sirv';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    },
  }
});
