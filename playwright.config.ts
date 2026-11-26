/**
 * Testes de ponta a ponta (E2E) com Playwright — `npm run test:e2e`.
 *
 * - Os specs ficam em `e2e/*.e2e.ts`, fora de `src/`: o Vitest (`src/**\/*.test.ts(x)`) e os scripts de
 *   requisitos/lotes/commit não os enxergam.
 * - A aplicação roda pelo servidor de desenvolvimento do Vite (`vite --port 5199`), sem build: a build é
 *   responsabilidade do agente `build-validado`, e o modo de desenvolvimento do React expõe no console os
 *   avisos (chaves, efeitos) que os specs verificam.
 * - O back-end é simulado em cada spec com `page.route` (ver `e2e/apoio/apiSimulada.ts`); o proxy `/api` do
 *   Vite aponta para uma porta fechada, para que nenhuma chamada escape para o servidor real.
 * - Só Chromium. A versão do `@playwright/test` (1.62.1) usa o build `chromium-1234` já instalado.
 */
import { defineConfig, devices } from '@playwright/test'

const PORTA = 5199
const URL_BASE = `http://localhost:${PORTA}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './test-results',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: URL_BASE,
    locale: 'pt-BR',
    timezoneId: 'America/Campo_Grande',
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${PORTA} --strictPort`,
    url: URL_BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_API_URL: '/api',
      // Porta fechada: uma rota não interceptada falha na hora em vez de chegar ao back-end real.
      VITE_API_PROXY_TARGET: 'http://127.0.0.1:9',
    },
  },
})
