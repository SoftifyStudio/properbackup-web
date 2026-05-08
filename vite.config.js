import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const bufferTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:7100';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: bufferTarget,
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
