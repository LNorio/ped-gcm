import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { rotaInicioFalsa } from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'
// Carregado de antemão, como as demais páginas em `renderizarApp` (a rota pode carregá-la sob demanda).
import './BackendPage'
import { DOCUMENTOS_BACKEND } from './documentosBackend'

/**
 * F2.13 — Página pública /backend com a documentação trocada com o back-end (integração: rotas reais
 * + SessaoProvider + documentos reais de docs/propostas-backend).
 *
 * A rota é pública: abre sem sessão (sem redirecionar ao login e sem chamar a API) e também com sessão.
 * Não aparece no menu de abas.
 */
const ABAS_ADMIN = ['Início', 'Tipos', 'Apontamentos', 'Dados Externos', 'Indicadores', 'Faixas', 'Dashboards', 'Preenchimento', 'Fechamentos']
const ABAS_PREENCHEDOR = ['Início', 'Apontamentos', 'Dados Externos', 'Preenchimento']

const TITULO_PAGINA = 'Documentação para o back-end'

describe('F2.13 — Página pública /backend (integração)', () => {
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

  function comTokenSalvo(perfil: 'admin' | 'validador' | 'preenchedor') {
    sessionStorage.setItem('ped.token', 'token-salvo')
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () =>
        respostaJson(acessoApi({ perfil, 'todas as filiais': perfil !== 'preenchedor', filiais: FILIAIS_API })),
      'GET /api/ped/inicio': rotaInicioFalsa(perfil),
    })
  }

  describe('sem sessão', () => {
    it('/backend abre a página, sem redirecionar ao login e sem chamar a API', async () => {
      simularApi(fetchFalso, {})
      const { roteador } = renderizarApp('/backend')

      expect(await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/backend')
      await waitFor(() => expect(document.title).toBe('Back-end · PED'))
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('lista todos os documentos reais e abre o mais recente (o primeiro)', async () => {
      simularApi(fetchFalso, {})
      renderizarApp('/backend')

      const nav = await screen.findByRole('navigation', { name: 'Documentos' })
      const links = within(nav).getAllByRole('link')
      expect(links).toHaveLength(DOCUMENTOS_BACKEND.length)
      expect(links.map((link) => link.textContent?.trim())).toEqual(DOCUMENTOS_BACKEND.map((documento) => documento.titulo))

      const primeiro = DOCUMENTOS_BACKEND[0]
      expect(within(nav).getByRole('link', { name: primeiro.titulo })).toHaveAttribute('aria-current', 'page')
      expect(within(screen.getByRole('article')).getAllByRole('heading', { name: primeiro.titulo }).length).toBeGreaterThan(0)
    })

    it('?doc abre o documento indicado (link compartilhado)', async () => {
      simularApi(fetchFalso, {})
      const pendencias24 = DOCUMENTOS_BACKEND.find((documento) => documento.id === 'PENDENCIAS-backend-2026-11-24')
      expect(pendencias24).toBeDefined()

      renderizarApp('/backend?doc=PENDENCIAS-backend-2026-11-24')

      const nav = await screen.findByRole('navigation', { name: 'Documentos' })
      expect(within(nav).getByRole('link', { name: pendencias24!.titulo })).toHaveAttribute('aria-current', 'page')
      expect(within(screen.getByRole('article')).getAllByRole('heading', { name: pendencias24!.titulo }).length).toBeGreaterThan(0)
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('escolher outro documento na lista troca o conteúdo e a URL, sem chamar a API', async () => {
      const user = usuarioRapido()
      simularApi(fetchFalso, {})
      const { roteador } = renderizarApp('/backend')
      const nav = await screen.findByRole('navigation', { name: 'Documentos' })
      const outro = DOCUMENTOS_BACKEND[1]

      await user.click(within(nav).getByRole('link', { name: outro.titulo }))

      await waitFor(() => expect(new URLSearchParams(roteador.state.location.search).get('doc')).toBe(outro.id))
      expect(roteador.state.location.pathname).toBe('/backend')
      expect(within(screen.getByRole('navigation', { name: 'Documentos' })).getByRole('link', { name: outro.titulo })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('?doc inexistente mostra "Documento não encontrado." e mantém a lista', async () => {
      simularApi(fetchFalso, {})
      renderizarApp('/backend?doc=NAO-EXISTE')

      expect(await screen.findByText('Documento não encontrado.')).toBeInTheDocument()
      expect(within(screen.getByRole('navigation', { name: 'Documentos' })).getAllByRole('link')).toHaveLength(DOCUMENTOS_BACKEND.length)
    })

    it('a página 404 continua valendo: URL inexistente leva ao login sem chamar a API', async () => {
      const { roteador } = renderizarApp('/nao-existe')

      expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/login')
      expect(fetchFalso).not.toHaveBeenCalled()
    })
  })

  describe('com sessão', () => {
    it.each(['admin', 'preenchedor'] as const)('%s: /backend também abre a página, sem consultas além do acesso da sessão', async (perfil) => {
      const chamadas = comTokenSalvo(perfil)
      const { roteador } = renderizarApp('/backend')

      expect(await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })).toBeInTheDocument()
      expect(await screen.findByRole('navigation', { name: 'Documentos' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/backend')
      // Espera a sessão terminar de restaurar, para confirmar que a página continua aberta.
      await waitFor(() => expect(chamadas.some((chamada) => chamada.caminho === '/api/ped/acesso')).toBe(true))
      expect(await screen.findByRole('heading', { level: 1, name: TITULO_PAGINA })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/backend')
      expect(chamadas.filter((chamada) => chamada.caminho !== '/api/ped/acesso')).toEqual([])
    })

    it.each([
      ['admin', ABAS_ADMIN],
      ['preenchedor', ABAS_PREENCHEDOR],
    ] as const)('%s: o menu de abas continua igual, sem link para /backend', async (perfil, abasEsperadas) => {
      comTokenSalvo(perfil)
      renderizarApp('/')

      await screen.findByRole('heading', { level: 1, name: 'Início' })
      const abas = screen.getByRole('navigation', { name: 'Abas' })
      expect(within(abas).getAllByRole('link').map((link) => link.textContent)).toEqual([...abasEsperadas])
      const linksParaBackend = screen
        .queryAllByRole('link')
        .filter((link) => (link.getAttribute('href') ?? '').startsWith('/backend'))
      expect(linksParaBackend).toEqual([])
    })

    it('a página 404 continua valendo para rotas inexistentes (inclusive abaixo de /backend)', async () => {
      comTokenSalvo('admin')
      const { roteador } = renderizarApp('/backend/nao-existe')

      expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1, name: TITULO_PAGINA })).not.toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/backend/nao-existe')
    })

    it('URL inexistente fora de /backend continua na página 404', async () => {
      comTokenSalvo('admin')
      renderizarApp('/nao-existe')

      expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument()
    })
  })
})
