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
          // Utiliza o padrão moderno import.meta.url para garantir a resolução correta do caminho em ambientes de Módulos ES.
          '@': fileURLToPath(new URL('.', import.meta.url)),
        }
      }
    };
});
