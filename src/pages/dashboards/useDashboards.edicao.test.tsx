import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  dashboardsApi,
  respostaGravacaoApi,
  rotaListarDashboards,
  tarefaGravacaoApi,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import type { DadosDashboard } from '../../types/dominio'
import { useDashboards } from './useDashboards'

const ROTA = '/api/ped/dashboards'

const EDICAO: DadosDashboard = {
  nome: 'PED Gerentes de Loja',
  periodicidade: 'mensal',
  pontuacaoBaseMaxima: 50,
  tipoVinculo: 'cargos',
  itensVinculados: ['Gerente de Loja'],
  indicadores: [
    { idIndicador: 3, pontosBase: 30 },
    { idIndicador: 6, pontosBase: 20 },
  ],
  indicadorBaseDaFaixa: 3,
  formulaDePontuacao: 'Atingimento médio ponderado pelos pontos base.',
  observacaoParaTi: null,
  enviarTarefaTi: true,
}

describe('F7.8 — useDashboards: edição (editar) — RF-56; 2xx significa gravado', () => {
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
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  function montar(aoEditar?: () => Response) {
    let lista: DashboardApiFalso[] = dashboardsApi()
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      [`PUT ${ROTA}/2`]: () => {
        if (aoEditar) return aoEditar()
        lista = lista.map((d) => (d.id === 2 ? { ...d, nome: 'PED Gerentes de Loja', situacao: 'em_modificacao' as const } : d))
        return respostaJson(respostaGravacaoApi(lista[1], tarefaGravacaoApi('[PED] Modificar dashboard: PED Gerentes de Loja')))
      },
    })
    const resultado = renderHook(() => useDashboards())
    return { ...resultado, chamadas }
  }

  it('editar(id, dados) faz o PUT com "enviar tarefa ti", recarrega a lista e resolve { dashboard, tarefa }', async () => {
    const { result, chamadas } = montar()
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let resultado: Awaited<ReturnType<typeof result.current.editar>> | undefined
    await act(async () => {
      resultado = await result.current.editar(2, EDICAO)
    })

    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/2`)
    expect(corpoDaChamada(puts(chamadas)[0])).toMatchObject({ nome: 'PED Gerentes de Loja', 'enviar tarefa ti': true })
    expect(gets(chamadas)).toHaveLength(2)
    expect(resultado?.dashboard).toMatchObject({ id: 2, situacao: 'em_modificacao' })
    expect(resultado?.tarefa?.titulo).toBe('[PED] Modificar dashboard: PED Gerentes de Loja')
    expect(result.current.dashboards.find((d) => d.id === 2)).toMatchObject({ nome: 'PED Gerentes de Loja', situacao: 'em_modificacao' })
  })

  it('2xx sem corpo ("nenhuma alteracao" ou vazio) também recarrega e resolve { dashboard: null, tarefa: null }', async () => {
    const { result, chamadas } = montar(() => respostaJson({ mensagem: 'nenhuma alteracao' }))
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let resultado: Awaited<ReturnType<typeof result.current.editar>> | undefined
    await act(async () => {
      resultado = await result.current.editar(2, { ...EDICAO, enviarTarefaTi: false })
    })

    expect(resultado).toEqual({ dashboard: null, tarefa: null })
    expect(gets(chamadas)).toHaveLength(2)
  })

  it('erro da API: rejeita com a ApiError original, sem recarregar nem alterar a lista', async () => {
    const { result, chamadas } = montar(() => respostaErro(400, 'Não é possível enviar tarefa de modificação a um dashboard em construção.'))
    await waitFor(() => expect(result.current.carregando).toBe(false))
    const antes = result.current.dashboards

    let falha: unknown
    await act(async () => {
      falha = await result.current.editar(2, EDICAO).catch((e: unknown) => e)
    })

    expect(falha).toBeInstanceOf(ApiError)
    expect(falha).toMatchObject({ status: 400 })
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.dashboards).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})
