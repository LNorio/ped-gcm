import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { rotaInicioFalsa } from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'
// Carregado de antemão, como as demais páginas em `renderizarApp` (a rota carrega a página sob demanda).
import './ResumoPage'

/**
 * F2.14 — Página pública /resumo com o diário de implementação e a documentação do projeto
 * (integração: rotas reais + SessaoProvider + conteúdo real de docs/diario-implementacao.md e
 * docs/documentacao.md).
 *
 * A rota é pública, como o /backend (F2.13): abre sem sessão (sem redirecionar ao login e sem chamar a
 * API) e também com sessão; fica fora do layout principal e do menu de abas. Os arquivos reais mudam
 * todos os dias, então os testes afirmam só trechos estáveis (o título `# ` de cada arquivo) e regras
 * gerais (toda âncora interna tem destino; nenhum link leva a arquivo relativo).
 */
const ABAS_ADMIN = ['Início', 'Tipos', 'Apontamentos', 'Dados Externos', 'Indicadores', 'Faixas', 'Dashboards', 'Preenchimento', 'Fechamentos']
const ABAS_PREENCHEDOR = ['Início', 'Apontamentos', 'Dados Externos', 'Preenchimento']

const TITULO_PAGINA = 'Resumo do projeto'
const ABA_DIARIO = 'Diário de implementação'
const ABA_DOCUMENTACAO = 'Documentação'
const TITULO_DIARIO = 'Diário de Implementação — PED'
const TITULO_DOCUMENTACAO = 'Documentação — PED'

const listaDeAbas = () => screen.getByRole('tablist', { name: 'Documentos do projeto' })
const aba = (nome: string) => within(listaDeAbas()).getByRole('tab', { name: nome })

describe('F2.14 — Página pública /resumo (integração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let scrollOriginal: typeof Element.prototype.scrollIntoView | undefined

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    document.title = 'PED - Sistema de Cadastro'
    // O jsdom não implementa scrollIntoView; a página pode usá-lo para ir à âncora.
    scrollOriginal = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    Element.prototype.scrollIntoView = scrollOriginal as typeof Element.prototype.scrollIntoView
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function comTokenSalvo(perfil: 'admin' | 'validador' | 'preenchedor') {
    sessionStorage.setItem('ped.token', 'token-salvo')
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil, 'todas as filiais': perfil !== 'preenchedor', filiais: FILIAIS_API })),
      'GET /api/ped/inicio': rotaInicioFalsa(perfil),
    })
  }

  describe('sem sessão', () => {
    it('/resumo abre a página no diário, sem redirecionar ao login e sem chamar a API', async () => {
      simularApi(fetchFalso, {})
      const { roteador } = renderizarApp('/resumo')

      expect(await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/resumo')
      await waitFor(() => expect(document.title).toBe('Resumo · PED'))

      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
      const painel = screen.getByRole('tabpanel', { name: ABA_DIARIO })
      expect(within(painel).getByRole('heading', { name: TITULO_DIARIO })).toBeInTheDocument()
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('fica fora do layout principal: sem o menu de abas do sistema', async () => {
      simularApi(fetchFalso, {})
      renderizarApp('/resumo')

      await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })
      expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
    })

    it('trocar para "Documentação" mostra o conteúdo real de docs/documentacao.md e leva ?aba=documentacao à URL', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, {})
      const { roteador } = renderizarApp('/resumo')
      await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })

      await user.click(aba(ABA_DOCUMENTACAO))

      const painel = await screen.findByRole('tabpanel', { name: ABA_DOCUMENTACAO })
      expect(within(painel).getByRole('heading', { name: TITULO_DOCUMENTACAO })).toBeInTheDocument()
      expect(within(painel).getByRole('heading', { name: 'Índice' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/resumo')
      expect(new URLSearchParams(roteador.state.location.search).get('aba')).toBe('documentacao')
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('/resumo?aba=documentacao (link compartilhado) abre direto a documentação', async () => {
      simularApi(fetchFalso, {})
      renderizarApp('/resumo?aba=documentacao')

      const painel = await screen.findByRole('tabpanel', { name: ABA_DOCUMENTACAO })
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')
      expect(within(painel).getByRole('heading', { name: TITULO_DOCUMENTACAO })).toBeInTheDocument()
    })

    it('/resumo?aba inválido abre o diário', async () => {
      simularApi(fetchFalso, {})
      renderizarApp('/resumo?aba=nao-existe')

      const painel = await screen.findByRole('tabpanel', { name: ABA_DIARIO })
      expect(within(painel).getByRole('heading', { name: TITULO_DIARIO })).toBeInTheDocument()
    })

    it('na documentação real, todo link interno do índice (#...) tem destino no painel, com id único', async () => {
      simularApi(fetchFalso, {})
      renderizarApp('/resumo?aba=documentacao')

      const painel = await screen.findByRole('tabpanel', { name: ABA_DOCUMENTACAO })
      const internos = within(painel)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href') ?? '')
        .filter((href) => href.startsWith('#'))
      expect(internos.length).toBeGreaterThan(0)
      for (const href of internos) {
        const id = decodeURIComponent(href.slice(1))
        expect(painel.querySelectorAll(`[id="${id}"]`), `destino de ${href}`).toHaveLength(1)
        expect(document.querySelectorAll(`[id="${id}"]`), `id único de ${href}`).toHaveLength(1)
      }
    })

    it('clicar num link interno do índice real não sai da página nem troca de aba', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, {})
      const { roteador } = renderizarApp('/resumo?aba=documentacao')
      const painel = await screen.findByRole('tabpanel', { name: ABA_DOCUMENTACAO })
      const interno = within(painel)
        .getAllByRole('link')
        .find((link) => (link.getAttribute('href') ?? '').startsWith('#'))
      expect(interno).toBeDefined()

      await user.click(interno!)

      expect(roteador.state.location.pathname).toBe('/resumo')
      expect(new URLSearchParams(roteador.state.location.search).get('aba')).toBe('documentacao')
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('heading', { level: 1, name: TITULO_PAGINA })).toBeInTheDocument()
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it.each([
      [ABA_DIARIO, 'diario'],
      [ABA_DOCUMENTACAO, 'documentacao'],
    ])('%s real: todo link é âncora interna ou externo em nova aba (nenhum leva a arquivo relativo)', async (nome, valor) => {
      simularApi(fetchFalso, {})
      renderizarApp(`/resumo?aba=${valor}`)

      const painel = await screen.findByRole('tabpanel', { name: nome })
      for (const link of Array.from(painel.querySelectorAll('a[href]'))) {
        const href = link.getAttribute('href') ?? ''
        if (href.startsWith('#')) continue
        expect(href, `link ${href}`).toMatch(/^https?:\/\//i)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
      }
      expect(painel.querySelector('script')).toBeNull()
    })
  })

  describe('com sessão', () => {
    it('admin: /resumo também abre a página, sem consultas além do acesso da sessão', async () => {
      const chamadas = comTokenSalvo('admin')
      const { roteador } = renderizarApp('/resumo')

      expect(await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })).toBeInTheDocument()
      expect(await screen.findByRole('tablist', { name: 'Documentos do projeto' })).toBeInTheDocument()
      // Espera a sessão terminar de restaurar, para confirmar que a página continua aberta.
      await waitFor(() => expect(chamadas.some((chamada) => chamada.caminho === '/api/ped/acesso')).toBe(true))
      expect(await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/resumo')
      expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
      expect(chamadas.filter((chamada) => chamada.caminho !== '/api/ped/acesso')).toEqual([])
    })

    it.each([
      ['admin', ABAS_ADMIN],
      ['preenchedor', ABAS_PREENCHEDOR],
    ] as const)('%s: o menu de abas continua igual, sem link para /resumo', async (perfil, abasEsperadas) => {
      comTokenSalvo(perfil)
      renderizarApp('/')

      await screen.findByRole('heading', { level: 1, name: 'Início' })
      const abas = screen.getByRole('navigation', { name: 'Abas' })
      expect(within(abas).getAllByRole('link').map((link) => link.textContent)).toEqual([...abasEsperadas])
      const linksParaResumo = screen
        .queryAllByRole('link')
        .filter((link) => (link.getAttribute('href') ?? '').startsWith('/resumo'))
      expect(linksParaResumo).toEqual([])
    })

    it('/resumo/x cai na página 404 (URL preservada)', async () => {
      comTokenSalvo('admin')
      const { roteador } = renderizarApp('/resumo/x')

      expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1, name: TITULO_PAGINA })).not.toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/resumo/x')
    })
  })
})
