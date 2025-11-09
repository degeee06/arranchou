import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          // FIX: Use import.meta.url to get directory path in an ES module context, as __dirname is not available.
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      }
    };
});