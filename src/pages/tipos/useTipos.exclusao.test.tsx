import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPO_LOGISTICA_API, TIPO_MARKETING_API, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { useTipos } from './useTipos'

describe('F3.3 — useTipos.excluir(id) (exclusão de tipo personalizado)', () => {
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

  /**
   * API com estado: o GET devolve a lista atual e o DELETE remove o tipo dela, para que o hook
   * possa tanto remover a linha localmente quanto recarregar a lista — os dois caminhos passam.
   */
  function simularApiComEstado(opcoes: { aoExcluir?: (id: number) => Response | undefined } = {}) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`]: () => {
        const personalizada = opcoes.aoExcluir?.(TIPO_LOGISTICA_API.id)
        if (personalizada) return personalizada
        lista = lista.filter((tipo) => tipo.id !== TIPO_LOGISTICA_API.id)
        return new Response(null, { status: 204 })
      },
    })
    return { chamadas, obterLista: () => lista }
  }

  it('chama DELETE /api/ped/tipos-apontamento/{id} com o token da sessão', async () => {
    const { chamadas } = simularApiComEstado()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.excluir(TIPO_LOGISTICA_API.id)
    })

    const exclusoes = chamadas.filter((c) => c.metodo === 'DELETE')
    expect(exclusoes).toHaveLength(1)
    expect(exclusoes[0].caminho).toBe(`/api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`)
    expect(cabecalhoDaChamada(exclusoes[0], 'Authorization')).toBe('Bearer token-123')
  })

  it('após excluir com sucesso, o tipo deixa de constar em tipos e os demais permanecem', async () => {
    simularApiComEstado()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    await act(async () => {
      await result.current.excluir(TIPO_LOGISTICA_API.id)
    })

    await waitFor(() => expect(result.current.tipos).toHaveLength(8))
    expect(result.current.tipos.map((tipo) => tipo.id)).not.toContain(TIPO_LOGISTICA_API.id)
    expect(result.current.tipos.map((tipo) => tipo.nome)).toContain('Marketing')
    expect(result.current.tipos.map((tipo) => tipo.nome)).toContain('Comercial')
    expect(result.current.erro).toBeNull()
    expect(result.current.carregando).toBe(false)
  })

  it('excluir resolve sem valor em caso de sucesso', async () => {
    simularApiComEstado()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let retorno: unknown = 'não resolvido'
    await act(async () => {
      retorno = await result.current.excluir(TIPO_LOGISTICA_API.id)
    })

    expect(retorno).toBeUndefined()
  })

  it('erro 400 da API: rejeita com a ApiError (mensagem da API), mantém a lista e não altera erro de carga', async () => {
    simularApiComEstado({
      aoExcluir: () => respostaErro(400, 'Tipo possui apontamentos vinculados.'),
    })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let erro: unknown
    await act(async () => {
      erro = await result.current.excluir(TIPO_LOGISTICA_API.id).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'Tipo possui apontamentos vinculados.' })
    expect(result.current.tipos).toHaveLength(9)
    expect(result.current.erro).toBeNull()
  })

  it('erro 403 da API (Validador recusado pela API) rejeita com a mensagem da API e mantém a lista', async () => {
    simularApiComEstado({
      aoExcluir: () => respostaErro(403, 'Apenas o administrador pode excluir tipos.'),
    })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    await act(async () => {
      await expect(result.current.excluir(TIPO_LOGISTICA_API.id)).rejects.toMatchObject({
        status: 403,
        mensagem: 'Apenas o administrador pode excluir tipos.',
      })
    })

    expect(result.current.tipos).toHaveLength(9)
  })

  it('falha de rede ao excluir rejeita com status 0 e mantém a lista', async () => {
    simularApiComEstado({
      aoExcluir: () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    await act(async () => {
      await expect(result.current.excluir(TIPO_LOGISTICA_API.id)).rejects.toMatchObject({
        status: 0,
        mensagem: MENSAGEM_SEM_CONEXAO,
      })
    })

    expect(result.current.tipos).toHaveLength(9)
  })

  it('excluir de um id inexistente repassa o 404 da API e mantém a lista', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      'DELETE /api/ped/tipos-apontamento/999': () => respostaErro(404, 'Tipo não encontrado.'),
    })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await expect(result.current.excluir(999)).rejects.toMatchObject({ status: 404, mensagem: 'Tipo não encontrado.' })
    })

    expect(result.current.tipos).toHaveLength(9)
  })

  it('corrida recarregar x excluir: a linha excluída não "volta" quando um GET antigo chega depois da exclusão', async () => {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    let liberarGetAntigo: () => void = () => {}
    let tentativa = 0
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => {
        tentativa += 1
        if (tentativa === 2) {
          // GET disparado por recarregar() antes da exclusão: fica pendente com a lista antiga (9 tipos).
          const instantaneo = lista.map((tipo) => ({ ...tipo }))
          return new Promise<Response>((resolve) => {
            liberarGetAntigo = () => resolve(respostaJson(instantaneo))
          })
        }
        return respostaJson(lista)
      },
      [`DELETE /api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`]: () => {
        lista = lista.filter((tipo) => tipo.id !== TIPO_LOGISTICA_API.id)
        return new Response(null, { status: 204 })
      },
    })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let recarga: Promise<void> = Promise.resolve()
    act(() => {
      recarga = result.current.recarregar()
    })
    await waitFor(() => expect(result.current.carregando).toBe(true))

    await act(async () => {
      await result.current.excluir(TIPO_LOGISTICA_API.id)
    })
    await waitFor(() => expect(result.current.tipos.map((tipo) => tipo.id)).not.toContain(TIPO_LOGISTICA_API.id))

    // O GET antigo responde com a lista de antes da exclusão: deve ser descartado.
    await act(async () => {
      liberarGetAntigo()
      await recarga
    })

    expect(result.current.tipos.map((tipo) => tipo.id)).not.toContain(TIPO_LOGISTICA_API.id)
    expect(result.current.tipos).toHaveLength(8)
    expect(result.current.carregando).toBe(false)
    expect(result.current.erro).toBeNull()
  })

  it('desmontar durante excluir não gera erro nem aviso de setState; a promessa resolve', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_LOGISTICA_API.id}`]: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(new Response(null, { status: 204 }))
        }),
    })
    const { result, unmount } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let promessa: Promise<void> = Promise.resolve()
    act(() => {
      promessa = result.current.excluir(TIPO_LOGISTICA_API.id)
    })
    unmount()
    liberar()

    await expect(promessa).resolves.toBeUndefined()
    expect(consoleErro).not.toHaveBeenCalled()
  })

  it('o hook não decide a regra de bloqueio: excluir de um tipo com apontamentos chama a API e repassa a recusa', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      [`DELETE /api/ped/tipos-apontamento/${TIPO_MARKETING_API.id}`]: () =>
        respostaErro(400, 'Tipo possui apontamentos vinculados.'),
    })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await expect(result.current.excluir(TIPO_MARKETING_API.id)).rejects.toMatchObject({ status: 400 })
    })
  })
})
