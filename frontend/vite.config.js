// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'recharts-vendor';
            if (id.includes('react-router')) return 'router-vendor';
            return 'vendor'; // everything else goes here
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  }
});