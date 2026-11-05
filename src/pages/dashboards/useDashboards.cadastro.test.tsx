import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  DASHBOARD_SUPERVISORES_API,
  dashboardsApi,
  respostaGravacaoApi,
  rotaListarDashboards,
  tarefaGravacaoApi,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import type { DadosDashboard } from '../../types/dominio'
import { useDashboards } from './useDashboards'

const ROTA = '/api/ped/dashboards'

const NOVO: DadosDashboard = {
  nome: 'PED Supervisores',
  periodicidade: 'semestral',
  pontuacaoBaseMaxima: 120,
  tipoVinculo: 'colaboradores',
  itensVinculados: [16, 11],
  indicadores: [
    { idIndicador: 1, pontosBase: 70 },
    { idIndicador: 8, pontosBase: 50 },
  ],
  indicadorBaseDaFaixa: 1,
  formulaDePontuacao: 'Pontos base × atingimento, sem limite.',
  observacaoParaTi: null,
}

describe('F7.7 — useDashboards: cadastro (criar) — RF-55; 2xx significa gravado', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  /** Lista sem o PED Supervisores; o POST o acrescenta (nasce em construção). */
  function montar(aoCriar?: () => Response) {
    let lista: DashboardApiFalso[] = dashboardsApi().filter((d) => d.id !== 3)
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      [`POST ${ROTA}`]: () => {
        if (aoCriar) return aoCriar()
        lista = [...lista, { ...DASHBOARD_SUPERVISORES_API }]
        return respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaGravacaoApi('[PED] Construir dashboard: PED Supervisores')), 201)
      },
    })
    const resultado = renderHook(() => useDashboards())
    return { ...resultado, chamadas }
  }

  it('criar(dados) faz o POST com o corpo da API, recarrega a lista e resolve { dashboard, tarefa }', async () => {
    const { result, chamadas } = montar()
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 2, 4, 5])

    let resultado: Awaited<ReturnType<typeof result.current.criar>> | undefined
    await act(async () => {
      resultado = await result.current.criar(NOVO)
    })

    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ nome: 'PED Supervisores', 'itens vinculados': [16, 11], 'pontuacao base maxima': 120 })
    expect(gets(chamadas)).toHaveLength(2)
    expect(resultado?.dashboard).toMatchObject({ id: 3, situacao: 'em_construcao' })
    expect(resultado?.tarefa).toMatchObject({ id: null, titulo: '[PED] Construir dashboard: PED Supervisores' })
    expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 2, 4, 5, 3])
  })

  it('2xx sem o dashboard no corpo também conta como gravado: resolve { dashboard: null, tarefa: null } e recarrega a lista', async () => {
    const { result, chamadas } = montar(() => new Response(null, { status: 204 }))
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let resultado: Awaited<ReturnType<typeof result.current.criar>> | undefined
    await act(async () => {
      resultado = await result.current.criar(NOVO)
    })

    expect(resultado).toEqual({ dashboard: null, tarefa: null })
    expect(gets(chamadas)).toHaveLength(2)
  })

  it('erro da API: rejeita com a ApiError original, sem recarregar nem alterar a lista e sem erro de carga', async () => {
    const { result, chamadas } = montar(() => respostaErro(400, 'A soma dos pontos base deve ser 120.'))
    await waitFor(() => expect(result.current.carregando).toBe(false))
    const antes = result.current.dashboards

    let falha: unknown
    await act(async () => {
      falha = await result.current.criar(NOVO).catch((e: unknown) => e)
    })

    expect(falha).toBeInstanceOf(ApiError)
    expect(falha).toMatchObject({ status: 400, mensagem: 'A soma dos pontos base deve ser 120.' })
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.dashboards).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})
