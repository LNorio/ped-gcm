import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAMINHOS, RotaProtegida, rotas } from './rotas'
import type { Sessao } from './sessao/SessaoProvider'
import { ProvedorSessaoFalso } from './test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from './test/sessaoFalsa'

function renderizarRotas(caminho: string, sessao: Partial<Sessao>, tabela: RouteObject[] = rotas) {
  const roteador = createMemoryRouter(tabela, { initialEntries: [caminho] })
  render(
    <ProvedorSessaoFalso sessao={sessao}>
      <RouterProvider router={roteador} />
    </ProvedorSessaoFalso>,
  )
  return roteador
}

/** Elemento que falha ao renderizar, para exercitar o `errorElement` das rotas. */
function Explode(): never {
  throw new Error('Falha proposital de renderização')
}

/**
 * Tabela de rotas real acrescida de uma aba fictícia `/explode` (filha do layout) que lança
 * durante a renderização. Permite verificar o `errorElement` configurado em `rotas`.
 */
function rotasComRotaQueLanca(): RouteObject[] {
  return rotas.map((rota) =>
    rota.path === CAMINHOS.inicio
      ? { ...rota, children: [...(rota.children ?? []), { path: 'explode', element: <Explode /> }] }
      : rota,
  )
}

const admin = () => acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
const semAcesso = () => acessoFalso({ perfil: null, filiais: [] })

describe('F2.3 — Rotas e layout principal (rotas)', () => {
  describe('CAMINHOS', () => {
    it('define os caminhos de login, sem acesso e de cada aba', () => {
      expect(CAMINHOS).toEqual({
        login: '/login',
        semAcesso: '/sem-acesso',
        inicio: '/',
        tipos: '/tipos',
        apontamentos: '/apontamentos',
        dadosExternos: '/dados-externos',
        indicadores: '/indicadores',
        faixas: '/faixas',
        dashboards: '/dashboards',
        preenchimento: '/preenchimento',
        fechamentos: '/fechamentos',
      })
    })
  })

  describe('RotaProtegida', () => {
    function renderizarProtegida(sessao: Partial<Sessao>) {
      render(
        <ProvedorSessaoFalso sessao={sessao}>
          <MemoryRouter initialEntries={['/area']}>
            <Routes>
              <Route
                path="/area"
                element={
                  <RotaProtegida>
                    <p>Área protegida</p>
                  </RotaProtegida>
                }
              />
              <Route path="/login" element={<p>Página de login</p>} />
              <Route path="/sem-acesso" element={<p>Página sem acesso</p>} />
            </Routes>
          </MemoryRouter>
        </ProvedorSessaoFalso>,
      )
    }

    it('com sessão autenticada renderiza o conteúdo', () => {
      renderizarProtegida({ estado: 'autenticado', acesso: admin() })

      expect(screen.getByText('Área protegida')).toBeInTheDocument()
    })

    it('com sessão anônima redireciona para /login', () => {
      renderizarProtegida({ estado: 'anonimo', acesso: null })

      expect(screen.getByText('Página de login')).toBeInTheDocument()
      expect(screen.queryByText('Área protegida')).not.toBeInTheDocument()
    })

    it('com usuário sem acesso redireciona para /sem-acesso', () => {
      renderizarProtegida({ estado: 'sem-acesso', acesso: acessoFalso({ perfil: null, filiais: [] }) })

      expect(screen.getByText('Página sem acesso')).toBeInTheDocument()
      expect(screen.queryByText('Área protegida')).not.toBeInTheDocument()
    })

    it('enquanto carrega mostra a região de status "Carregando..." e não renderiza o conteúdo', () => {
      renderizarProtegida({ estado: 'carregando', acesso: null })

      expect(screen.getByRole('status')).toHaveTextContent('Carregando...')
      expect(screen.queryByText('Área protegida')).not.toBeInTheDocument()
      expect(screen.queryByText('Página de login')).not.toBeInTheDocument()
    })
  })

  describe('rotas da aplicação', () => {
    it.each([
      ['/', 'Início'],
      ['/tipos', 'Tipos'],
      ['/apontamentos', 'Apontamentos'],
      ['/dados-externos', 'Dados Externos'],
      ['/indicadores', 'Indicadores'],
      ['/faixas', 'Faixas'],
      ['/dashboards', 'Dashboards'],
      ['/preenchimento', 'Preenchimento'],
      ['/fechamentos', 'Fechamentos'],
    ])('%s renderiza a página "%s" dentro do layout principal (Admin)', (caminho, titulo) => {
      renderizarRotas(caminho, { estado: 'autenticado', acesso: admin() })

      expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
      expect(screen.getByRole('banner')).toHaveTextContent('Olá, Fulano')
      const abas = screen.getByRole('navigation', { name: 'Abas' })
      expect(within(abas).getByRole('link', { name: titulo })).toHaveAttribute('aria-current', 'page')
    })

    it('/login com sessão autenticada redireciona para o Início', () => {
      renderizarRotas('/login', { estado: 'autenticado', acesso: admin() })

      expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()
    })

    it('/login com sessão anônima mostra a tela de login', () => {
      renderizarRotas('/login', { estado: 'anonimo', acesso: null })

      expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    })

    it('/login enquanto a sessão salva é restaurada ("carregando") mostra "Carregando..." em vez do formulário', () => {
      renderizarRotas('/login', { estado: 'carregando', acesso: null })

      expect(screen.getByRole('status')).toHaveTextContent('Carregando...')
      expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
    })

    it('/login com usuário sem acesso redireciona para /sem-acesso (consistente com RotaProtegida)', () => {
      const roteador = renderizarRotas('/login', { estado: 'sem-acesso', acesso: semAcesso() })

      expect(
        screen.getByText('Usuário sem acesso ao sistema, favor verificar com a equipe de Departamento Pessoal'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe(CAMINHOS.semAcesso)
    })

    it('uma aba com sessão anônima leva ao login', () => {
      renderizarRotas('/tipos', { estado: 'anonimo', acesso: null })

      expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Tipos' })).not.toBeInTheDocument()
    })

    it('/sem-acesso mostra a tela de usuário sem acesso', () => {
      renderizarRotas('/sem-acesso', { estado: 'sem-acesso', acesso: acessoFalso({ perfil: null, filiais: [] }) })

      expect(
        screen.getByText('Usuário sem acesso ao sistema, favor verificar com a equipe de Departamento Pessoal'),
      ).toBeInTheDocument()
    })

    it('uma aba com usuário sem acesso leva à tela de sem acesso', () => {
      renderizarRotas('/', { estado: 'sem-acesso', acesso: acessoFalso({ perfil: null, filiais: [] }) })

      expect(
        screen.getByText('Usuário sem acesso ao sistema, favor verificar com a equipe de Departamento Pessoal'),
      ).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
    })
  })

  describe('rota desconhecida (404)', () => {
    it('URL desconhecida com sessão autenticada mostra "Página não encontrada" dentro do layout principal', () => {
      const roteador = renderizarRotas('/nao-existe', { estado: 'autenticado', acesso: admin() })

      expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
      expect(screen.getByRole('banner')).toHaveTextContent('Olá, Fulano')
      expect(screen.getByRole('navigation', { name: 'Abas' })).toBeInTheDocument()
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
      // A URL é preservada (não há redirecionamento silencioso).
      expect(roteador.state.location.pathname).toBe('/nao-existe')
    })

    it('a página não encontrada oferece o link "Voltar ao Início" apontando para "/"', async () => {
      const user = userEvent.setup()
      const roteador = renderizarRotas('/nao-existe', { estado: 'autenticado', acesso: admin() })

      const voltar = screen.getByRole('link', { name: 'Voltar ao Início' })
      expect(voltar).toHaveAttribute('href', CAMINHOS.inicio)

      await user.click(voltar)

      expect(roteador.state.location.pathname).toBe(CAMINHOS.inicio)
      expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Página não encontrada' })).not.toBeInTheDocument()
    })

    it('URL desconhecida aninhada (ex.: /tipos/abc/xyz) também mostra "Página não encontrada"', () => {
      renderizarRotas('/tipos/abc/xyz', { estado: 'autenticado', acesso: admin() })

      expect(screen.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1, name: 'Tipos' })).not.toBeInTheDocument()
    })

    it('na página não encontrada nenhuma aba fica marcada como ativa', () => {
      renderizarRotas('/nao-existe', { estado: 'autenticado', acesso: admin() })

      const abas = screen.getByRole('navigation', { name: 'Abas' })
      for (const link of within(abas).getAllByRole('link')) {
        expect(link).not.toHaveAttribute('aria-current')
      }
    })

    it('URL desconhecida sem sessão redireciona para /login', () => {
      const roteador = renderizarRotas('/nao-existe', { estado: 'anonimo', acesso: null })

      expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Página não encontrada' })).not.toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe(CAMINHOS.login)
    })
  })

  describe('erro de renderização (errorElement)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('um erro ao renderizar uma rota mostra "Ocorreu um erro inesperado" em português, sem o texto padrão do react-router', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      renderizarRotas('/explode', { estado: 'autenticado', acesso: admin() }, rotasComRotaQueLanca())

      expect(screen.getByRole('heading', { level: 1, name: 'Ocorreu um erro inesperado' })).toBeInTheDocument()
      expect(screen.queryByText(/Unexpected Application Error/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Hey developer/i)).not.toBeInTheDocument()
      expect(screen.queryByText('Falha proposital de renderização')).not.toBeInTheDocument()
    })

    it('a página de erro oferece "Voltar ao Início" que leva ao Início e sai do estado de erro', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const user = userEvent.setup()
      const roteador = renderizarRotas('/explode', { estado: 'autenticado', acesso: admin() }, rotasComRotaQueLanca())

      const voltar = screen.getByRole('link', { name: 'Voltar ao Início' })
      expect(voltar).toHaveAttribute('href', CAMINHOS.inicio)

      await user.click(voltar)

      expect(roteador.state.location.pathname).toBe(CAMINHOS.inicio)
      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Ocorreu um erro inesperado' })).not.toBeInTheDocument()
    })
  })
})
