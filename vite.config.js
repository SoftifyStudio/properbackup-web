import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:37100',
        changeOrigin: true,
        rewrite: (path) => {
          const stripped = path.replace(/^\/api/, '');
          return stripped === '' ? '/' : stripped;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
});
