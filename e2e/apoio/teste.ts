/**
 * `test` dos specs E2E: coleta os erros do console (`console.error`, `console.warn`) e as exceções não
 * tratadas da página (`pageerror`) de cada teste e os anexa ao relatório.
 *
 * Mensagens "Failed to load resource" (o Chromium registra toda resposta HTTP 4xx/5xx) ficam separadas em
 * `errosDeRede`: são esperadas nos cenários de erro (ex.: 401 do login) e verificadas à parte.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test'

export interface Console {
  /** Erros e avisos do console e exceções da página, exceto os de rede. */
  erros: string[]
  /** "Failed to load resource" (respostas HTTP de erro). */
  errosDeRede: string[]
}

export const test = base.extend<{ console: Console }>({
  console: [
    async ({ page }, use, testInfo) => {
      const registro: Console = { erros: [], errosDeRede: [] }
      page.on('console', (mensagem) => {
        if (mensagem.type() !== 'error' && mensagem.type() !== 'warning') return
        const texto = `[${mensagem.type()}] ${mensagem.text()}`
        if (/Failed to load resource/.test(mensagem.text())) registro.errosDeRede.push(`${texto} (${mensagem.location().url})`)
        else registro.erros.push(texto)
      })
      page.on('pageerror', (erro) => registro.erros.push(`[pageerror] ${erro.message}`))
      await use(registro)
      if (registro.erros.length > 0 || registro.errosDeRede.length > 0) {
        await testInfo.attach('console', {
          body: [...registro.erros, ...registro.errosDeRede].join('\n'),
          contentType: 'text/plain',
        })
      }
    },
    { auto: true },
  ],
})

export { expect }

export const MENSAGEM_RESPOSTA_INVALIDA = 'Resposta inválida do servidor.'

export const ABAS_ADMIN = [
  'Início',
  'Tipos',
  'Apontamentos',
  'Dados Externos',
  'Indicadores',
  'Faixas',
  'Dashboards',
  'Preenchimento',
  'Fechamentos',
] as const

export const ABAS_PREENCHEDOR = ['Início', 'Apontamentos', 'Dados Externos', 'Preenchimento'] as const

/** Barra de abas do layout. */
export const barraAbas = (page: Page): Locator => page.getByRole('navigation', { name: 'Abas' })

/** Link de uma aba (o nome pode trazer o marcador "Com alertas" depois do rótulo). */
export const linkAba = (page: Page, aba: string): Locator =>
  barraAbas(page).getByRole('link', { name: new RegExp(`^${aba}`) })

/** Nomes das abas visíveis, na ordem. */
export async function nomesDasAbas(page: Page): Promise<string[]> {
  const links = barraAbas(page).getByRole('link')
  const textos = await links.allTextContents()
  return textos.map((texto) => texto.trim())
}

/** Abre a aba pelo menu e espera o `<h1>` e o título do documento. */
export async function abrirAba(page: Page, aba: string): Promise<void> {
  await linkAba(page, aba).click()
  await expect(page.getByRole('heading', { level: 1, name: aba })).toBeVisible()
  await expect(page).toHaveTitle(`${aba} · PED`)
}
