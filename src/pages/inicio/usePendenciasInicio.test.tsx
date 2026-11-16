import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  NOMES_DASHBOARDS_CONSTRUCAO,
  NOMES_INDICADORES_META_PENDENTE,
  ROTA_DASHBOARDS,
  ROTA_INDICADORES_CADASTRO,
  rotaDashboardsConstrucao,
  rotaIndicadoresMetaPendente,
} from '../../test/inicioBlocosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usePendenciasInicio } from './usePendenciasInicio'

/**
 * F11.6 — Hook dos blocos "Indicadores com meta pendente" e "Dashboards em construção" do Início
 * (`src/pages/inicio/usePendenciasInicio.ts`).
 *
 * `usePendenciasInicio()` (sem parâmetros) devolve
 * `{ visivel: boolean; indicadores: PendenciaInicio<Indicador>; dashboards: PendenciaInicio<Dashboard> }`,
 * com `PendenciaInicio<T> = { itens: T[] | null; carregando: boolean; erro: string | null }`.
 *
 * - `visivel` é `true` só para Admin e Validador (`useSessao().acesso.perfil`). Para o Preenchedor (ou sem
 *   acesso) é `false`, nenhuma consulta sai e as duas pendências ficam `{ itens: null, carregando: false,
 *   erro: null }`.
 * - Indicadores: `listarIndicadores({ situacao: 'meta' })` e `listarIndicadores({ situacao:
 *   'meta_filial_pendente' })` (os dois filtros de meta pendente da aba Indicadores — sem meta e meta
 *   pendente por filial). `itens` é a união das duas listas, sem repetir o mesmo `id`, em ordem alfabética
 *   do nome (pt-BR). Se qualquer uma das duas consultas falhar, `itens` fica `null` e `erro` traz a
 *   mensagem em pt-BR.
 * - Dashboards: `listarDashboards({ situacao: 'construcao' })`, na ordem da API. Falha → `itens: null` e
 *   `erro` com a mensagem.
 * - As consultas saem ao montar; `carregando` é `true` até a resposta. A falha de uma não afeta a outra.
 * - As rotas não usam filial: nenhuma consulta leva `filial` e trocar a filial do cabeçalho não consulta de
 *   novo.
 */
describe('F11.6 — usePendenciasInicio (indicadores com meta pendente e dashboards em construção)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let sessao: Partial<Sessao>

  const admin = () => acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
  const validador = () => acessoFalso({ perfil: 'validador', todasAsFiliais: true, filiais: FILIAIS })

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessao = { acesso: admin(), filialSelecionada: 'todas' }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function renderizar() {
    const wrapper = ({ children }: { children: ReactNode }) => <ProvedorSessaoFalso sessao={sessao}>{children}</ProvedorSessaoFalso>
    return renderHook(() => usePendenciasInicio(), { wrapper })
  }

  const rotasPadrao = () => ({
    [`GET ${ROTA_INDICADORES_CADASTRO}`]: rotaIndicadoresMetaPendente(),
    [`GET ${ROTA_DASHBOARDS}`]: rotaDashboardsConstrucao(),
  })

  const getsIndicadores = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_INDICADORES_CADASTRO)
  const getsDashboards = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_DASHBOARDS)
  const situacoes = (chamadas: ChamadaRegistrada[]) => chamadas.map((c) => c.url.searchParams.get('situacao')).sort()

  async function esperarCarga(result: { current: ReturnType<typeof usePendenciasInicio> }) {
    await waitFor(() => {
      expect(result.current.indicadores.carregando).toBe(false)
      expect(result.current.dashboards.carregando).toBe(false)
    })
  }

  describe('Admin', () => {
    it('visível; começa carregando os dois blocos, sem itens e sem erro', async () => {
      simularApi(fetchFalso, rotasPadrao())

      const { result } = renderizar()

      expect(result.current.visivel).toBe(true)
      expect(result.current.indicadores).toEqual({ itens: null, carregando: true, erro: null })
      expect(result.current.dashboards).toEqual({ itens: null, carregando: true, erro: null })
      await esperarCarga(result)
    })

    it('consulta os indicadores com situacao=meta e situacao=meta_filial_pendente e os dashboards com situacao=construcao, sem filial', async () => {
      const chamadas = simularApi(fetchFalso, rotasPadrao())

      const { result } = renderizar()
      await esperarCarga(result)

      expect(getsIndicadores(chamadas)).toHaveLength(2)
      expect(situacoes(getsIndicadores(chamadas))).toEqual(['meta', 'meta_filial_pendente'])
      expect(getsDashboards(chamadas)).toHaveLength(1)
      expect(getsDashboards(chamadas)[0].url.searchParams.get('situacao')).toBe('construcao')
      for (const chamada of chamadas) expect(chamada.url.searchParams.has('filial')).toBe(false)
    })

    it('indicadores: união das duas consultas, sem repetir o indicador das duas, em ordem alfabética', async () => {
      simularApi(fetchFalso, rotasPadrao())

      const { result } = renderizar()
      await esperarCarga(result)

      expect(result.current.indicadores.erro).toBeNull()
      expect(result.current.indicadores.itens?.map((i) => i.nome)).toEqual([...NOMES_INDICADORES_META_PENDENTE])
      const absenteismo = result.current.indicadores.itens?.find((i) => i.nome === 'Absenteísmo por filial')
      expect(absenteismo?.tipos).toEqual(['Logística', 'Financeiro'])
      expect(absenteismo?.filiaisSemMeta).toEqual(['100', '101', '102'])
    })

    it('dashboards: os em construção ou modificação, na ordem da API', async () => {
      simularApi(fetchFalso, rotasPadrao())

      const { result } = renderizar()
      await esperarCarga(result)

      expect(result.current.dashboards.erro).toBeNull()
      expect(result.current.dashboards.itens?.map((d) => d.nome)).toEqual([...NOMES_DASHBOARDS_CONSTRUCAO])
    })

    it('listas vazias: itens [] sem erro', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA_INDICADORES_CADASTRO}`]: rotaIndicadoresMetaPendente(() => []),
        [`GET ${ROTA_DASHBOARDS}`]: rotaDashboardsConstrucao(() => []),
      })

      const { result } = renderizar()
      await esperarCarga(result)

      expect(result.current.indicadores).toEqual({ itens: [], carregando: false, erro: null })
      expect(result.current.dashboards).toEqual({ itens: [], carregando: false, erro: null })
    })

    it('trocar a filial do cabeçalho não consulta de novo (as rotas não usam filial)', async () => {
      const chamadas = simularApi(fetchFalso, rotasPadrao())
      const { result, rerender } = renderizar()
      await esperarCarga(result)
      expect(chamadas).toHaveLength(3)

      sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
      rerender()

      await esperarCarga(result)
      expect(chamadas).toHaveLength(3)
      expect(result.current.indicadores.itens).toHaveLength(3)
      expect(result.current.dashboards.itens).toHaveLength(4)
    })
  })

  describe('falhas', () => {
    it('falha de uma das consultas de indicadores: indicadores sem itens e com a mensagem; dashboards carregam normalmente', async () => {
      const rotaIndicadores = rotaIndicadoresMetaPendente()
      simularApi(fetchFalso, {
        ...rotasPadrao(),
        [`GET ${ROTA_INDICADORES_CADASTRO}`]: (init, url) =>
          url.searchParams.get('situacao') === 'meta_filial_pendente' ? respostaErro(500, 'Falha ao listar os indicadores.') : rotaIndicadores(init, url),
      })

      const { result } = renderizar()
      await esperarCarga(result)

      expect(result.current.indicadores).toEqual({ itens: null, carregando: false, erro: 'Falha ao listar os indicadores.' })
      expect(result.current.dashboards.erro).toBeNull()
      expect(result.current.dashboards.itens).toHaveLength(4)
    })

    it('falha dos dashboards: dashboards sem itens e com a mensagem; indicadores carregam normalmente', async () => {
      simularApi(fetchFalso, { ...rotasPadrao(), [`GET ${ROTA_DASHBOARDS}`]: () => respostaErro(500, 'Falha ao listar os dashboards.') })

      const { result } = renderizar()
      await esperarCarga(result)

      expect(result.current.dashboards).toEqual({ itens: null, carregando: false, erro: 'Falha ao listar os dashboards.' })
      expect(result.current.indicadores.erro).toBeNull()
      expect(result.current.indicadores.itens).toHaveLength(3)
    })

    it('falha de rede: mensagem de conexão em pt-BR nos dois blocos', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      const { result } = renderizar()
      await esperarCarga(result)

      expect(result.current.indicadores.erro).toBe(MENSAGEM_SEM_CONEXAO)
      expect(result.current.dashboards.erro).toBe(MENSAGEM_SEM_CONEXAO)
      expect(result.current.indicadores.itens).toBeNull()
      expect(result.current.dashboards.itens).toBeNull()
    })
  })

  describe('Validador', () => {
    it('visível e consulta as mesmas rotas', async () => {
      sessao = { acesso: validador(), filialSelecionada: 'todas' }
      const chamadas = simularApi(fetchFalso, rotasPadrao())

      const { result } = renderizar()
      await esperarCarga(result)

      expect(result.current.visivel).toBe(true)
      expect(situacoes(getsIndicadores(chamadas))).toEqual(['meta', 'meta_filial_pendente'])
      expect(getsDashboards(chamadas)).toHaveLength(1)
      expect(result.current.indicadores.itens?.map((i) => i.nome)).toEqual([...NOMES_INDICADORES_META_PENDENTE])
      expect(result.current.dashboards.itens?.map((d) => d.nome)).toEqual([...NOMES_DASHBOARDS_CONSTRUCAO])
    })
  })

  describe('Preenchedor e sem acesso', () => {
    it('Preenchedor: não visível, nenhuma consulta e pendências vazias (sem carregar)', async () => {
      sessao = { acesso: acessoFalso({ perfil: 'preenchedor' }), filialSelecionada: FILIAIS[1] }
      simularApi(fetchFalso, rotasPadrao())

      const { result } = renderizar()

      expect(result.current.visivel).toBe(false)
      expect(result.current.indicadores).toEqual({ itens: null, carregando: false, erro: null })
      expect(result.current.dashboards).toEqual({ itens: null, carregando: false, erro: null })
      // Dá tempo a um efeito que dispararia consultas.
      await new Promise((resolver) => setTimeout(resolver, 20))
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('sem acesso carregado (null): não visível e nenhuma consulta', async () => {
      sessao = { acesso: null, filialSelecionada: null }
      simularApi(fetchFalso, rotasPadrao())

      const { result } = renderizar()

      expect(result.current.visivel).toBe(false)
      await new Promise((resolver) => setTimeout(resolver, 20))
      expect(fetchFalso).not.toHaveBeenCalled()
    })
  })
})
