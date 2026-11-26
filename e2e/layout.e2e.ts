/**
 * E2E — alertas do menu, acessibilidade básica (teclado) e responsividade (360×740).
 */
import { alertasMenuAdminApi } from '../src/test/alertasMenuFalsos'
import { respostaJson } from '../src/test/apiFalsa'
import { instalarApi } from './apoio/apiSimulada'
import { ABAS_ADMIN, MENSAGEM_RESPOSTA_INVALIDA, abrirAba, expect, linkAba, test } from './apoio/teste'

test.describe('Alertas do menu', () => {
  test('GET /api/ped/alertas-menu acende "Com alertas" em Indicadores e Dados Externos, com a dica', async ({ page, console }) => {
    const api = await instalarApi(page, 'admin')
    api.definir({ 'GET /api/ped/alertas-menu': () => respostaJson(alertasMenuAdminApi()) })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()

    const marcador = (aba: string) => linkAba(page, aba).getByRole('img', { name: 'Com alertas' })
    await expect(marcador('Indicadores')).toBeVisible()
    await expect(marcador('Dados Externos')).toBeVisible()
    await expect(marcador('Indicadores')).toHaveAccessibleDescription(/2 indicadores aguardando definição de meta/)
    await expect(marcador('Dados Externos')).toHaveAccessibleDescription('4 dados externos sem integração configurada')
    for (const aba of ABAS_ADMIN.filter((nome) => nome !== 'Indicadores' && nome !== 'Dados Externos')) {
      await expect(marcador(aba)).toHaveCount(0)
    }
    expect(api.de('GET', '/api/ped/alertas-menu').length).toBeGreaterThanOrEqual(1)
    expect(console.erros).toEqual([])
  })
})

test.describe('Acessibilidade básica', () => {
  /**
   * DEFEITO REAL (F12.1, item M4): no Chromium, o primeiro Tab da página NÃO vai para "Pular para o
   * conteúdo". O efeito da F12.2 em `src/layout/LayoutPrincipal.tsx` (`BarraAbas`) chama
   * `scrollIntoView` na aba ativa a cada troca de rota; o Chromium move o ponto de partida da navegação
   * sequencial para o elemento rolado, e o Tab seguinte vai para a aba DEPOIS da ativa (em /tipos, o
   * primeiro Tab cai em "Apontamentos"; em /, em "Tipos"). Confirmado neutralizando o `scrollIntoView`:
   * o primeiro Tab passa a ser o link. O teste de integração (jsdom) não pega o caso porque o jsdom não
   * implementa esse ponto de partida. Marcado `test.fail` até a correção (sem alterar o código de produção).
   */
  test('"Pular para o conteúdo" é o primeiro Tab da página', async ({ page }) => {
    test.fail(true, 'Defeito real: scrollIntoView da aba ativa (LayoutPrincipal.tsx, F12.2) desloca o ponto de partida do Tab')
    await instalarApi(page, 'admin')
    await page.goto('/tipos')
    await expect(page.getByRole('heading', { level: 1, name: 'Tipos' })).toBeVisible()
    await page.waitForLoadState('networkidle')

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused({ timeout: 2_000 })
  })

  test('"Pular para o conteúdo" aparece ao receber o foco e o Enter leva o foco ao <main>', async ({ page, console }) => {
    await instalarApi(page, 'admin')
    await page.goto('/tipos')
    await expect(page.getByRole('heading', { level: 1, name: 'Tipos' })).toBeVisible()

    const pular = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await pular.focus()
    await expect(pular).toBeVisible()
    // É o primeiro focável na ordem do documento (antes do cabeçalho e das abas).
    const primeiro = await page.evaluate(() => {
      const focaveis = document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
      return focaveis[0]?.textContent?.trim()
    })
    expect(primeiro).toBe('Pular para o conteúdo')

    await page.keyboard.press('Enter')
    await expect(page.getByRole('main')).toBeFocused()
    expect(console.erros).toEqual([])
  })

  test('Esc fecha o diálogo "Novo tipo de apontamento" e devolve o foco ao botão que o abriu', async ({ page, console }) => {
    await instalarApi(page, 'admin')
    await page.goto('/tipos')
    const novo = page.getByRole('button', { name: 'Novo tipo' })
    await expect(novo).toBeVisible()

    await novo.focus()
    await page.keyboard.press('Enter')
    const dialogo = page.getByRole('dialog', { name: 'Novo tipo de apontamento' })
    await expect(dialogo).toBeVisible()
    // O foco vai para dentro do diálogo ao abrir.
    await expect.poll(() => dialogo.evaluate((el) => el.contains(document.activeElement))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    await expect(novo).toBeFocused()
    expect(console.erros).toEqual([])
  })
})

test.describe('Responsividade (360×740)', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })

  test('as abas não têm rolagem horizontal na página', async ({ page, console }, testInfo) => {
    test.setTimeout(120_000)
    const api = await instalarApi(page, 'admin')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()

    const excessos: string[] = []
    for (const [indice, aba] of ABAS_ADMIN.entries()) {
      await test.step(aba, async () => {
        await abrirAba(page, aba)
        await page.waitForLoadState('networkidle')
        await expect(page.getByRole('main').getByRole('status').filter({ hasText: /^Carregando/ })).toHaveCount(0)
        await expect.soft(page.getByText(MENSAGEM_RESPOSTA_INVALIDA)).toHaveCount(0)
        const medida = await page.evaluate(() => ({
          rolagem: document.documentElement.scrollWidth,
          largura: window.innerWidth,
          // Elementos que passam da borda direita (para o relatório).
          largos: Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .filter((el) => {
              const caixa = el.getBoundingClientRect()
              if (caixa.width === 0 || caixa.right <= window.innerWidth + 1) return false
              // Ignora o que está dentro de um contêiner com rolagem própria (tabelas, barra de abas).
              for (let pai = el.parentElement; pai && pai !== document.body; pai = pai.parentElement) {
                const estilo = getComputedStyle(pai)
                if (/(auto|scroll|hidden|clip)/.test(estilo.overflowX)) return false
              }
              return true
            })
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className} (${Math.round(el.getBoundingClientRect().right)}px)`),
        }))
        const nome = `360-${String(indice + 1).padStart(2, '0')}-${aba.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[̀-ͯ]/g, '')}.png`
        await page.screenshot({ path: `e2e/resultados/${nome}`, fullPage: true })
        await testInfo.attach(nome, { path: `e2e/resultados/${nome}`, contentType: 'image/png' })
        if (medida.rolagem > medida.largura) {
          excessos.push(`${aba}: scrollWidth ${medida.rolagem} > innerWidth ${medida.largura} — ${medida.largos.join(', ')}`)
        }
      })
    }
    expect(api.naoSimuladas).toEqual([])
    expect(excessos).toEqual([])
    expect(console.erros).toEqual([])
  })
})
