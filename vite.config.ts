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
      define: {
        // Use the user-provided DEEPSEEK_API_KEY for the application's API_KEY
        'process.env.API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY) // Keep for compatibility
      },
      resolve: {
        alias: {
          // FIX: Use import.meta.url to get directory path in an ES module context, as __dirname is not available.
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      }
    };
});