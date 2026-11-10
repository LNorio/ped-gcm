/**
 * F2.9 — Carregamento sob demanda das abas (integração: app completo com rede simulada).
 *
 * O `import()` das páginas é simulado com `vi.mock`: a página de Tipos só termina de "baixar"
 * quando o teste libera e a de Faixas falha ao "baixar" (como um chunk que deixou de existir após a
 * publicação de uma versão nova). Enquanto a importação é estática, os módulos são carregados já na
 * coleta do arquivo (sem retenção nem falha), e os testes falham porque a aba aparece de imediato.
 *
 * Não usa `renderizarApp`, que importa as páginas de antemão para acelerar os demais testes.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rotas } from './rotas'
import { limparToken } from './services/sessao'
import { SessaoProvider } from './sessao/SessaoProvider'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from './test/apiFalsa'
import { usuarioRapido } from './test/usuario'

const carregamento = vi.hoisted(() => ({
  /** Quando `true`, a próxima importação de TiposPage fica pendente até `liberarTipos()`. */
  segurarTipos: false,
  liberarTipos: null as null | (() => void),
  importacoesTipos: 0,
  /** Quando `true`, a importação de FaixasPage falha (chunk indisponível). */
  falharFaixas: false,
  importacoesFaixas: 0,
}))

vi.mock('./pages/tipos/TiposPage', async () => {
  carregamento.importacoesTipos += 1
  if (carregamento.segurarTipos) {
    await new Promise<void>((resolver) => {
      carregamento.liberarTipos = resolver
    })
  }
  return { TiposPage: () => <h1>Tipos</h1> }
})

vi.mock('./pages/faixas/FaixasPage', async () => {
  carregamento.importacoesFaixas += 1
  if (carregamento.falharFaixas) {
    throw new TypeError('Failed to fetch dynamically imported module: /assets/FaixasPage-abc123.js')
  }
  return { FaixasPage: () => <h1>Faixas</h1> }
})

function renderizar(caminhoInicial = '/') {
  const roteador = createMemoryRouter(rotas, { initialEntries: [caminhoInicial] })
  render(
    <SessaoProvider>
      <RouterProvider router={roteador} />
    </SessaoProvider>,
  )
  return roteador
}

describe('F2.9 — Carregamento sob demanda das abas (integração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
    })
  })

  afterEach(() => {
    carregamento.segurarTipos = false
    carregamento.liberarTipos?.()
    carregamento.liberarTipos = null
    carregamento.falharFaixas = false
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('a página de uma aba só é baixada ao abrir a aba; enquanto baixa, mostra "Carregando..." sem esconder cabeçalho e abas', async () => {
    const user = usuarioRapido()
    renderizar('/')
    await screen.findByRole('heading', { level: 1, name: 'Início' })

    // Abrir o Início não baixa a página de Tipos.
    expect(carregamento.importacoesTipos).toBe(0)

    carregamento.segurarTipos = true
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    await user.click(within(abas).getByRole('link', { name: 'Tipos' }))

    await waitFor(() => expect(carregamento.importacoesTipos).toBe(1))
    expect(await within(screen.getByRole('main')).findByRole('status')).toHaveTextContent('Carregando...')
    expect(screen.getByRole('banner')).toHaveTextContent('Olá, Fulano')
    expect(within(abas).getByRole('link', { name: 'Tipos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Tipos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Início' })).not.toBeInTheDocument()

    await act(async () => {
      carregamento.liberarTipos?.()
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Tipos' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('Olá, Fulano')
  })

  it('falha ao baixar a página de uma aba mostra a página de erro em português, e "Voltar ao Início" recupera a aplicação', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = usuarioRapido()
    const roteador = renderizar('/')
    await screen.findByRole('heading', { level: 1, name: 'Início' })
    expect(carregamento.importacoesFaixas).toBe(0)

    carregamento.falharFaixas = true
    await user.click(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: 'Faixas' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Ocorreu um erro inesperado' })).toBeInTheDocument()
    expect(carregamento.importacoesFaixas).toBe(1)
    expect(screen.queryByRole('heading', { level: 1, name: 'Faixas' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch dynamically imported module/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Voltar ao Início' }))

    expect(roteador.state.location.pathname).toBe('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('Olá, Fulano')
    expect(screen.queryByRole('heading', { name: 'Ocorreu um erro inesperado' })).not.toBeInTheDocument()
  })
})
