import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { dadosExternosApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import { useDadosExternos } from './useDadosExternos'

const ROTA = '/api/ped/dados-externos-cadastro'

describe('F5.9 — useDadosExternos.excluir (exclusão de dado externo — RF-31)', () => {
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

  async function montar(aoExcluir: () => Response = () => new Response(null, { status: 204 })) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDadosExternos(dadosExternosApi),
      [`DELETE ${ROTA}/1`]: aoExcluir,
    })
    const resultado = renderHook(() => useDadosExternos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('excluir faz o DELETE e remove o item da lista, sem nova consulta (resolve undefined)', async () => {
    const { result, chamadas } = await montar()

    let retorno: unknown = 'nao-resolvido'
    await act(async () => {
      retorno = await result.current.excluir(1)
    })

    expect(retorno).toBeUndefined()
    expect(chamadas.find((c) => c.metodo === 'DELETE')?.caminho).toBe(`${ROTA}/1`)
    expect(result.current.dadosExternos.map((d) => d.id)).toEqual([2, 3, 4, 5, 6])
    expect(gets(chamadas)).toHaveLength(1)
  })

  it('400 ("já compôs indicador" — A-10) rejeita com a ApiError original e mantém o item', async () => {
    const { result } = await montar(() =>
      respostaJson({ mensagem: 'O dado externo já compôs indicadores e não pode ser excluído.', indicadores: ['Antigo'] }, 400),
    )

    let erro: unknown
    await act(async () => {
      erro = await result.current.excluir(1).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'O dado externo já compôs indicadores e não pode ser excluído.' })
    expect(result.current.dadosExternos).toHaveLength(6)
    expect(result.current.erro).toBeNull()
  })
})
