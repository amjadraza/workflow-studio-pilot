import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createApi } from './server/api.js';

export default defineConfig(({ mode }) => {
  /* Server-side settings from .env (APP_PIN, ANTHROPIC_API_KEY ...). They are not exposed to the page. */
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [
      react(),
      /* run the same /api routes inside the dev server */
      { name: 'api', configureServer: server => { server.middlewares.use(createApi(env)); } },
    ],
  };
});
