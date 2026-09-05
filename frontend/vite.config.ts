import { defineConfig } from 'vite';

const proxy = {
  '/api': 'http://127.0.0.1:3000',
};

export default defineConfig({
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
});
