import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { indicadoresApi, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.7 — useIndicadores.excluir (exclusão de indicador — RF-37, RN-11)', () => {
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

  async function montar(aoExcluir: () => Response = () => respostaJson({ mensagem: 'indicador excluido' })) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadores(indicadoresApi),
      [`DELETE ${ROTA}/2`]: aoExcluir,
      [`DELETE ${ROTA}/4`]: aoExcluir,
      [`DELETE ${ROTA}/5`]: aoExcluir,
    })
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('excluir faz o DELETE e remove o item da lista, sem nova consulta (resolve undefined)', async () => {
    const { result, chamadas } = await montar()

    let retorno: unknown = 'nao-resolvido'
    await act(async () => {
      retorno = await result.current.excluir(5)
    })

    expect(retorno).toBeUndefined()
    expect(chamadas.find((c) => c.metodo === 'DELETE')?.caminho).toBe(`${ROTA}/5`)
    expect(result.current.indicadores.map((i) => i.id)).toEqual([1, 2, 3, 4, 6, 7])
    expect(gets(chamadas)).toHaveLength(1)
  })

  it('excluir um ativo com componente desativado decrementa o alerta correspondente', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.excluir(2)
    })

    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 2 })
  })

  it('excluir o automático aguardando meta decrementa "aguardando meta"', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.excluir(4)
    })

    expect(result.current.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 3 })
  })

  it('excluir um inativo não altera os alertas', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.excluir(5)
    })

    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3 })
  })

  it('400 { mensagem, dashboards } (indicador em dashboard — RN-11) rejeita com a ApiError original, com a lista em dados.dashboards', async () => {
    const { result } = await montar(() =>
      respostaJson({ mensagem: 'o indicador esta em dashboards e nao pode ser excluido', dashboards: ['PED Comercial'] }, 400),
    )

    let erro: unknown
    await act(async () => {
      erro = await result.current.excluir(2).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'o indicador esta em dashboards e nao pode ser excluido' })
    expect((erro as ApiError).dados).toMatchObject({ dashboards: ['PED Comercial'] })
    expect(result.current.indicadores).toHaveLength(7)
  })

  it('400 (está ou já esteve vinculado a dashboard — RN-11) rejeita com a ApiError original e mantém o item e os alertas', async () => {
    const { result } = await montar(() =>
      respostaJson({ mensagem: 'O indicador já foi vinculado a dashboard e não pode ser excluído.' }, 400),
    )

    let erro: unknown
    await act(async () => {
      erro = await result.current.excluir(2).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'O indicador já foi vinculado a dashboard e não pode ser excluído.' })
    expect(result.current.indicadores).toHaveLength(7)
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3 })
    expect(result.current.erro).toBeNull()
  })
})
