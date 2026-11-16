import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import {
  NOMES_DASHBOARDS_CONSTRUCAO,
  NOMES_INDICADORES_META_PENDENTE,
  ROTA_DASHBOARDS,
  ROTA_INDICADORES_CADASTRO,
  rotaDashboardsConstrucao,
  rotaIndicadoresMetaPendente,
} from '../../test/inicioBlocosFalsos'
import { adiado, inicioAdminApi } from '../../test/inicioFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Acesso } from '../../types/dominio'
import { liberarPreConsultaInicio, liberarPreConsultaPendencias, preConsultarInicio, verPreConsultaInicio, verPreConsultaPendencias } from './consultasInicio'
import { usePendenciasInicio } from './usePendenciasInicio'

/**
 * F11.6 — usePendenciasInicio em <StrictMode> com a pré-consulta da primeira abertura (revisão de 16/11/2026).
 *
 * `main.tsx` usa <StrictMode>, que executa o efeito duas vezes na montagem. Com a pré-consulta das
 * pendências (já respondida ou ainda pendente), as consultas saem uma vez cada — as da pré-consulta: dois
 * GET de indicadores (situacao=meta e situacao=meta_filial_pendente) e um GET de dashboards.
 */
describe('F11.6 — usePendenciasInicio em <StrictMode> (pré-consulta sem consultas duplicadas, Admin)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let acesso: Acesso

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    acesso = acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
  })

  afterEach(() => {
    // Não deixa pré-consulta para os testes seguintes (estado do módulo).
    const preInicio = verPreConsultaInicio(acesso, null)
    if (preInicio) liberarPreConsultaInicio(preInicio)
    const prePendencias = verPreConsultaPendencias(acesso)
    if (prePendencias) liberarPreConsultaPendencias(prePendencias)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /** Raiz em <StrictMode>, como em `main.tsx` (efeitos executados duas vezes na montagem). */
  function renderizarEmStrictMode() {
    const sessao: Partial<Sessao> = { acesso, filialSelecionada: 'todas' }
    const wrapper = ({ children }: { children: ReactNode }) => <ProvedorSessaoFalso sessao={sessao}>{children}</ProvedorSessaoFalso>
    return renderHook(() => usePendenciasInicio(), { wrapper, reactStrictMode: true })
  }

  const getsIndicadores = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_INDICADORES_CADASTRO)
  const getsDashboards = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA_DASHBOARDS)
  const situacoes = (chamadas: ChamadaRegistrada[]) => chamadas.map((c) => c.url.searchParams.get('situacao')).sort()

  async function aguardarEfeitos() {
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 20))
    })
  }

  /** Rota que só responde depois de `liberacao` (uma resposta nova por chamada). */
  const segurar = (rota: RotaFalsa, liberacao: Promise<void>): RotaFalsa => (init, url) => liberacao.then(() => rota(init, url))

  it('pré-consulta já respondida: os blocos saem na primeira renderização e cada consulta sai uma única vez', async () => {
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/inicio': () => respostaJson(inicioAdminApi()),
      [`GET ${ROTA_INDICADORES_CADASTRO}`]: rotaIndicadoresMetaPendente(),
      [`GET ${ROTA_DASHBOARDS}`]: rotaDashboardsConstrucao(),
    })
    preConsultarInicio({ acesso, filialSelecionada: 'todas' })
    await waitFor(() => {
      const pre = verPreConsultaPendencias(acesso)
      expect(pre?.indicadores.resultado).toBeTruthy()
      expect(pre?.dashboards.resultado).toBeTruthy()
    })
    expect(getsIndicadores(chamadas)).toHaveLength(2)
    expect(getsDashboards(chamadas)).toHaveLength(1)

    const { result } = renderizarEmStrictMode()

    expect(result.current.indicadores.carregando).toBe(false)
    expect(result.current.dashboards.carregando).toBe(false)
    await aguardarEfeitos()
    expect(getsIndicadores(chamadas)).toHaveLength(2)
    expect(situacoes(getsIndicadores(chamadas))).toEqual(['meta', 'meta_filial_pendente'])
    expect(getsDashboards(chamadas)).toHaveLength(1)
    expect(result.current.indicadores.itens?.map((i) => i.nome)).toEqual([...NOMES_INDICADORES_META_PENDENTE])
    expect(result.current.dashboards.itens?.map((d) => d.nome)).toEqual([...NOMES_DASHBOARDS_CONSTRUCAO])
  })

  it('pré-consulta ainda pendente: aguarda as mesmas consultas, sem repeti-las', async () => {
    const liberacao = adiado<void>()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/inicio': () => respostaJson(inicioAdminApi()),
      [`GET ${ROTA_INDICADORES_CADASTRO}`]: segurar(rotaIndicadoresMetaPendente(), liberacao.promessa),
      [`GET ${ROTA_DASHBOARDS}`]: segurar(rotaDashboardsConstrucao(), liberacao.promessa),
    })
    preConsultarInicio({ acesso, filialSelecionada: 'todas' })

    const { result } = renderizarEmStrictMode()
    expect(result.current.indicadores.carregando).toBe(true)
    expect(result.current.dashboards.carregando).toBe(true)
    await aguardarEfeitos()

    await act(async () => {
      liberacao.resolver()
    })

    await waitFor(() => {
      expect(result.current.indicadores.carregando).toBe(false)
      expect(result.current.dashboards.carregando).toBe(false)
    })
    await aguardarEfeitos()
    expect(getsIndicadores(chamadas)).toHaveLength(2)
    expect(getsDashboards(chamadas)).toHaveLength(1)
    expect(result.current.indicadores.itens?.map((i) => i.nome)).toEqual([...NOMES_INDICADORES_META_PENDENTE])
    expect(result.current.dashboards.itens?.map((d) => d.nome)).toEqual([...NOMES_DASHBOARDS_CONSTRUCAO])
  })
})
