/**
 * E2E — login, logout, navegação do Admin pelas 9 abas e menu por perfil.
 */
import { instalarApi, TOKEN } from './apoio/apiSimulada'
import { ABAS_ADMIN, ABAS_PREENCHEDOR, MENSAGEM_RESPOSTA_INVALIDA, abrirAba, expect, nomesDasAbas, test } from './apoio/teste'

const TITULO_LOGIN = 'Programa de Excelência em Distribuição'

test.describe('Login e sessão', () => {
  test('login com sucesso abre o Início com o cabeçalho do usuário', async ({ page, console }) => {
    const api = await instalarApi(page, 'admin', { logado: false })
    api.definir({ 'POST /api/valida-usuario': () => Response.json({ token: TOKEN }) })

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeVisible()
    await expect(page).toHaveTitle('Entrar · PED')

    await page.getByRole('textbox', { name: 'Usuário' }).fill('fulano')
    await page.getByRole('textbox', { name: 'Senha' }).fill('segredo')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
    await expect(page).toHaveTitle('Início · PED')
    const cabecalho = page.getByRole('banner')
    await expect(cabecalho.getByText('Olá, Fulano')).toBeVisible()
    await expect(cabecalho.getByText('Admin')).toBeVisible()

    const [login] = api.de('POST', '/api/valida-usuario')
    expect(login.corpo).toEqual({ usuario: 'fulano', senha: 'segredo' })
    const [acesso] = api.de('GET', '/api/ped/acesso')
    expect(acesso.cabecalhos['authorization']).toBe(`Bearer ${TOKEN}`)
    expect(await page.evaluate(() => sessionStorage.getItem('ped.token'))).toBe(TOKEN)
    const guardado = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))
    expect(guardado).not.toContain('segredo')

    await page.waitForLoadState('networkidle')
    expect(api.naoSimuladas).toEqual([])
    expect(console.erros).toEqual([])
  })

  test('credencial inválida mostra a mensagem da API e permanece no login sem token', async ({ page, console }) => {
    const api = await instalarApi(page, 'admin', { logado: false })
    api.definir({ 'POST /api/valida-usuario': () => Response.json({ mensagem: 'Usuário ou senha inválidos.' }, { status: 401 }) })

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Usuário' }).fill('fulano')
    await page.getByRole('textbox', { name: 'Senha' }).fill('errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('alert')).toHaveText('Usuário ou senha inválidos.')
    await expect(page.getByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(api.de('GET', '/api/ped/acesso')).toHaveLength(0)
    expect(await page.evaluate(() => sessionStorage.getItem('ped.token'))).toBeNull()
    expect(console.erros).toEqual([])
    // O 401 aparece no console do Chromium como "Failed to load resource" (esperado).
    expect(console.errosDeRede.every((linha) => linha.includes('/api/valida-usuario'))).toBe(true)
  })

  test('"Sair" encerra a sessão, volta ao login e a recarga não reabre o sistema', async ({ page, console }) => {
    await instalarApi(page, 'admin')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()

    await page.getByRole('banner').getByRole('button', { name: 'Sair' }).click()

    await expect(page.getByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate(() => sessionStorage.getItem('ped.token'))).toBeNull()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeVisible()
    await page.goto('/tipos')
    await expect(page).toHaveURL(/\/login$/)
    expect(console.erros).toEqual([])
  })
})

test.describe('Admin navega pelas 9 abas', () => {
  test('cada aba: título "{Aba} · PED", <h1> visível, sem "Resposta inválida do servidor." e sem erro no console', async ({
    page,
    console,
  }) => {
    test.setTimeout(120_000)
    const api = await instalarApi(page, 'admin')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
    expect(await nomesDasAbas(page)).toEqual([...ABAS_ADMIN])

    const problemas: string[] = []
    for (const aba of ABAS_ADMIN) {
      await test.step(aba, async () => {
        const errosAntes = console.erros.length
        const naoSimuladasAntes = api.naoSimuladas.length
        await abrirAba(page, aba)
        await page.waitForLoadState('networkidle')
        // Dá tempo às telas de renderizar a resposta (tabelas, avisos).
        await expect(page.getByRole('main').getByRole('status').filter({ hasText: /^Carregando/ })).toHaveCount(0)
        await expect.soft(page.getByText(MENSAGEM_RESPOSTA_INVALIDA)).toHaveCount(0)
        const novosErros = console.erros.slice(errosAntes)
        const novasRotas = api.naoSimuladas.slice(naoSimuladasAntes)
        if (novosErros.length > 0) problemas.push(`${aba}: console → ${novosErros.join(' | ')}`)
        if (novasRotas.length > 0) problemas.push(`${aba}: rotas não simuladas → ${novasRotas.join(', ')}`)
        await expect.soft(page.getByRole('alert').filter({ hasText: /Erro|Não foi possível|inválid/ })).toHaveCount(0)
      })
    }
    expect(problemas).toEqual([])
  })
})

test.describe('Menu por perfil', () => {
  test('Preenchedor vê só Início, Apontamentos, Dados Externos e Preenchimento; abas proibidas voltam ao Início', async ({
    page,
    console,
  }) => {
    const api = await instalarApi(page, 'preenchedor')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
    await expect(page.getByRole('banner').getByText('Preenchedor')).toBeVisible()
    expect(await nomesDasAbas(page)).toEqual([...ABAS_PREENCHEDOR])

    for (const aba of ABAS_PREENCHEDOR) await abrirAba(page, aba)

    await page.goto('/fechamentos')
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)

    await page.waitForLoadState('networkidle')
    expect(api.naoSimuladas).toEqual([])
    expect(console.erros).toEqual([])
  })

  test('Validador vê todas as abas', async ({ page, console }) => {
    await instalarApi(page, 'validador')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
    await expect(page.getByRole('banner').getByText('Validador')).toBeVisible()
    expect(await nomesDasAbas(page)).toEqual([...ABAS_ADMIN])
    await abrirAba(page, 'Fechamentos')
    expect(console.erros).toEqual([])
  })
})
