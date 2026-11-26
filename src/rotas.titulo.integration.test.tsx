import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from './services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from './test/apiFalsa'
import { rotaInicioFalsa } from './test/inicioFalsos'
import { renderizarApp } from './test/renderizarApp'
import { tiposApi } from './test/tiposFalsos'
import { usuarioRapido } from './test/usuario'

/**
 * F12.1 (RNF-05, itens M4 e M5 da revisão de acessibilidade de 24/11/2026) — título do documento por
 * rota e foco ao navegar, com a aplicação completa (sessão → acesso → layout → página real).
 *
 * Títulos:
 * - abas: "{Aba} · PED" (ex.: "Início · PED", "Tipos · PED", "Fechamentos · PED");
 * - login: "Entrar · PED";
 * - página não encontrada (404): "Página não encontrada · PED".
 * Antes, o título era sempre "PED - Sistema de Cadastro" (`index.html`).
 *
 * Ao navegar pelas abas, o foco vai para o `<h1>` da página nova. O link "Pular para o conteúdo"
 * aparece no layout e leva o foco ao `<main>`.
 */
describe('F12.1 — Título do documento por rota e foco ao navegar (integração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    document.title = 'PED - Sistema de Cadastro'
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function comTokenSalvo() {
    sessionStorage.setItem('ped.token', 'token-salvo')
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/inicio': rotaInicioFalsa('admin'),
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
    })
  }

  it('login (sem sessão): título "Entrar · PED"', async () => {
    simularApi(fetchFalso, {})
    renderizarApp('/login')

    await screen.findByRole('heading', { level: 1, name: 'Programa de Excelência em Distribuição' })
    await waitFor(() => expect(document.title).toBe('Entrar · PED'))
  })

  it('Início: título "Início · PED"', async () => {
    comTokenSalvo()
    renderizarApp('/')

    await screen.findByRole('heading', { level: 1, name: 'Início' })
    await waitFor(() => expect(document.title).toBe('Início · PED'))
  })

  it('abrir /tipos direto: título "Tipos · PED"', async () => {
    comTokenSalvo()
    renderizarApp('/tipos')

    await screen.findByRole('heading', { level: 1, name: 'Tipos' })
    await waitFor(() => expect(document.title).toBe('Tipos · PED'))
  })

  it('URL inexistente (404): título "Página não encontrada · PED"', async () => {
    comTokenSalvo()
    renderizarApp('/nao-existe')

    await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })
    await waitFor(() => expect(document.title).toBe('Página não encontrada · PED'))
  })

  it('do Início para Tipos pela aba: o título passa a "Tipos · PED" e o foco vai para o <h1> "Tipos"', async () => {
    const user = usuarioRapido()
    comTokenSalvo()
    renderizarApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Início' })

    await user.click(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Tipos/ }))

    const titulo = await screen.findByRole('heading', { level: 1, name: 'Tipos' })
    await waitFor(() => expect(titulo).toHaveFocus())
    expect(document.title).toBe('Tipos · PED')
  })

  it('voltar ao Início pela aba leva o foco ao <h1> "Início" e o título a "Início · PED"', async () => {
    const user = usuarioRapido()
    comTokenSalvo()
    renderizarApp('/tipos')
    await screen.findByRole('heading', { level: 1, name: 'Tipos' })

    await user.click(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Início/ }))

    const titulo = await screen.findByRole('heading', { level: 1, name: 'Início' })
    await waitFor(() => expect(titulo).toHaveFocus())
    expect(document.title).toBe('Início · PED')
  })

  it('"Pular para o conteúdo" é o primeiro Tab da tela e leva o foco ao <main>', async () => {
    const user = usuarioRapido()
    comTokenSalvo()
    renderizarApp('/tipos')
    await screen.findByRole('heading', { level: 1, name: 'Tipos' })

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('main')).toHaveFocus()
  })
})
