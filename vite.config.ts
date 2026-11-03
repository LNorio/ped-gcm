import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    // Em desenvolvimento, /api é encaminhado ao back-end para evitar CORS (ver .env.example).
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://192.168.7.18:8080',
          changeOrigin: true,
        },
      },
    },
    test: {
      // Por padrão o Vitest zera qualquer import de .css, inclusive `arquivo.css?raw`.
      // Libera o `?raw` para que testes possam ler o conteúdo literal de arquivos CSS
      // (ex.: src/estilos/tema.test.ts). Imports normais de CSS continuam vazios.
      css: { include: [/\.css\?raw$/] },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            exclude: ['src/**/*.integration.test.{ts,tsx}'],
            setupFiles: ['./src/test/setup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'integration',
            environment: 'jsdom',
            include: ['src/**/*.integration.test.{ts,tsx}'],
            setupFiles: ['./src/test/setup.ts'],
          },
        },
      ],
    },
  }
})
