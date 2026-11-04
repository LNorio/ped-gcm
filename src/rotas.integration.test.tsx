import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from './test/usuario'
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAMINHOS, rotas } from './rotas'
import { limparToken } from './services/sessao'
import { SessaoProvider } from './sessao/SessaoProvider'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from './test/apiFalsa'
import { renderizarApp } from './test/renderizarApp'

const ABAS_ADMIN = ['Início', 'Tipos', 'Apontamentos', 'Dados Externos', 'Indicadores', 'Faixas', 'Dashboards', 'Preenchimento', 'Fechamentos']

/** Elemento que falha ao renderizar, para exercitar o `errorElement` das rotas reais. */
function Explode(): never {
  throw new Error('Falha proposital de renderização')
}

/** Rotas reais + aba fictícia `/explode` (filha do layout) que lança ao renderizar. */
function rotasComRotaQueLanca(): RouteObject[] {
  return rotas.map((rota) =>
    rota.path === CAMINHOS.inicio
      ? { ...rota, children: [...(rota.children ?? []), { path: 'explode', element: <Explode /> }] }
      : rota,
  )
}

/** Como `renderizarApp`, mas com a tabela de rotas acrescida da rota que lança. */
function renderizarAppComRotaQueLanca(caminhoInicial: string) {
  const roteador = createMemoryRouter(rotasComRotaQueLanca(), { initialEntries: [caminhoInicial] })
  render(
    <SessaoProvider>
      <RouterProvider router={roteador} />
    </SessaoProvider>,
  )
  return roteador
}

describe('F2.3 — Rotas e layout principal (integração: token salvo → acesso → layout)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function comTokenSalvo(perfil: 'admin' | 'validador' | 'preenchedor' = 'admin') {
    sessionStorage.setItem('ped.token', 'token-salvo')
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil, 'todas as filiais': perfil !== 'preenchedor', filiais: FILIAIS_API })),
    })
  }

  it('com token salvo, mostra "Carregando...", obtém o acesso com o Bearer e monta o layout com o Início', async () => {
    const chamadas = comTokenSalvo('admin')

    renderizarApp('/')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando...')
    expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    const cabecalho = screen.getByRole('banner')
    expect(within(cabecalho).getByRole('img', { name: 'Comercial Mariano' })).toBeInTheDocument()
    expect(within(cabecalho).getByText('PED')).toBeInTheDocument()
    expect(within(cabecalho).getByText('Olá, Fulano')).toBeInTheDocument()
    expect(within(cabecalho).getByText('Admin')).toBeInTheDocument()
    expect(within(cabecalho).getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano',
    )
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].caminho).toBe('/api/ped/acesso')
    expect(new Headers(chamadas[0].init?.headers).get('Authorization')).toBe('Bearer token-salvo')
  })

  it('a barra de abas lista as abas do Admin na ordem e marca a aba da URL como ativa', async () => {
    comTokenSalvo('admin')

    renderizarApp('/dashboards')

    await screen.findByRole('heading', { level: 1, name: 'Dashboards' })
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getAllByRole('link').map((link) => link.textContent)).toEqual(ABAS_ADMIN)
    expect(within(abas).getByRole('link', { name: 'Dashboards' })).toHaveAttribute('aria-current', 'page')
    expect(within(abas).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it.each([
    ['/tipos', 'Tipos'],
    ['/apontamentos', 'Apontamentos'],
    ['/dados-externos', 'Dados Externos'],
    ['/indicadores', 'Indicadores'],
    ['/faixas', 'Faixas'],
    ['/preenchimento', 'Preenchimento'],
    ['/fechamentos', 'Fechamentos'],
  ])('a URL %s abre a aba "%s" diretamente', async (caminho, titulo) => {
    comTokenSalvo('admin')

    renderizarApp(caminho)

    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getByRole('link', { name: titulo })).toHaveAttribute('aria-current', 'page')
  })

  it('navegar pelas abas troca a página e a aba ativa, sem nova chamada de acesso', async () => {
    const chamadas = comTokenSalvo('validador')
    const user = usuarioRapido()

    renderizarApp('/')
    await screen.findByRole('heading', { level: 1, name: 'Início' })
    const abas = screen.getByRole('navigation', { name: 'Abas' })

    await user.click(within(abas).getByRole('link', { name: 'Fechamentos' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Fechamentos' })).toBeInTheDocument()
    expect(within(abas).getByRole('link', { name: 'Fechamentos' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(abas).getByRole('link', { name: 'Início' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(within(abas).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    expect(within(abas).getByRole('link', { name: 'Fechamentos' })).not.toHaveAttribute('aria-current')

    expect(chamadas.filter((chamada) => chamada.caminho === '/api/ped/acesso')).toHaveLength(1)
  })

  it('com token salvo, abrir /login leva ao Início', async () => {
    comTokenSalvo('admin')

    renderizarApp('/login')

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()
  })

  it('Validador vê a etiqueta "Validador" e todas as abas, inclusive Tipos, Faixas e Fechamentos', async () => {
    comTokenSalvo('validador')

    renderizarApp('/')

    await screen.findByRole('heading', { level: 1, name: 'Início' })
    expect(within(screen.getByRole('banner')).getByText('Validador')).toBeInTheDocument()
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).getAllByRole('link').map((link) => link.textContent)).toEqual(ABAS_ADMIN)
  })

  describe('rota desconhecida (404)', () => {
    it('com token salvo, uma URL desconhecida restaura a sessão e mostra "Página não encontrada" dentro do layout', async () => {
      const chamadas = comTokenSalvo('admin')

      const { roteador } = renderizarApp('/nao-existe')

      expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
      const cabecalho = screen.getByRole('banner')
      expect(within(cabecalho).getByText('Olá, Fulano')).toBeInTheDocument()
      expect(within(cabecalho).getByRole('button', { name: 'Sair' })).toBeInTheDocument()
      expect(within(screen.getByRole('navigation', { name: 'Abas' })).getAllByRole('link').map((link) => link.textContent)).toEqual(ABAS_ADMIN)
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/nao-existe')
      expect(chamadas.filter((chamada) => chamada.caminho === '/api/ped/acesso')).toHaveLength(1)
    })

    it('"Voltar ao Início" na página não encontrada leva ao Início sem nova chamada de acesso', async () => {
      const chamadas = comTokenSalvo('admin')
      const user = usuarioRapido()

      renderizarApp('/nao-existe')
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })

      await user.click(screen.getByRole('link', { name: 'Voltar ao Início' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Página não encontrada' })).not.toBeInTheDocument()
      expect(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: 'Início' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(chamadas.filter((chamada) => chamada.caminho === '/api/ped/acesso')).toHaveLength(1)
    })

    it('sem sessão, uma URL desconhecida leva ao login sem chamar a API', async () => {
      const { roteador } = renderizarApp('/nao-existe')

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Página não encontrada' })).not.toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/login')
      expect(fetchFalso).not.toHaveBeenCalled()
    })
  })

  describe('erro de renderização (errorElement)', () => {
    it('um erro ao renderizar uma aba mostra a página de erro em português e "Voltar ao Início" recupera a aplicação', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      comTokenSalvo('admin')
      const user = usuarioRapido()

      const roteador = renderizarAppComRotaQueLanca('/explode')

      expect(await screen.findByRole('heading', { level: 1, name: 'Ocorreu um erro inesperado' })).toBeInTheDocument()
      expect(screen.queryByText(/Unexpected Application Error/i)).not.toBeInTheDocument()
      expect(screen.queryByText('Falha proposital de renderização')).not.toBeInTheDocument()

      await user.click(screen.getByRole('link', { name: 'Voltar ao Início' }))

      expect(roteador.state.location.pathname).toBe('/')
      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(screen.getByRole('banner')).toHaveTextContent('Olá, Fulano')
      expect(screen.queryByRole('heading', { name: 'Ocorreu um erro inesperado' })).not.toBeInTheDocument()
    })
  })
})
