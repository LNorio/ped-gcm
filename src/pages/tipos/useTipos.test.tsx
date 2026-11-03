import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_FIXOS_API, TIPO_LOGISTICA_API, tiposApi } from '../../test/tiposFalsos'
import { useTipos } from './useTipos'

describe('F3.2 — useTipos (hook de listagem de tipos)', () => {
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

  it('começa carregando, sem tipos e sem erro', () => {
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
    })

    const { result } = renderHook(() => useTipos())

    expect(result.current.carregando).toBe(true)
    expect(result.current.tipos).toEqual([])
    expect(result.current.erro).toBeNull()
  })

  it('carrega os tipos de GET /api/ped/tipos-apontamento ao montar e os expõe convertidos para o domínio', async () => {
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson([TIPOS_FIXOS_API[0], TIPO_LOGISTICA_API]),
    })

    const { result } = renderHook(() => useTipos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBeNull()
    expect(result.current.tipos).toEqual([
      { id: 1, nome: 'Comercial', origem: 'Fixo', quantidadeUsuarios: 3, quantidadeApontamentos: 7 },
      { id: 8, nome: 'Logística', origem: 'Personalizado', quantidadeUsuarios: 2, quantidadeApontamentos: 0 },
    ])
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/tipos-apontamento')).toHaveLength(1)
  })

  it('lista vazia da API resulta em tipos [] sem erro', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson([]),
    })

    const { result } = renderHook(() => useTipos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.tipos).toEqual([])
    expect(result.current.erro).toBeNull()
  })

  it('erro da API: expõe a mensagem da ApiError em erro, encerra o carregamento e mantém tipos vazios', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaErro(500, 'Falha ao consultar os tipos.'),
    })

    const { result } = renderHook(() => useTipos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe('Falha ao consultar os tipos.')
    expect(result.current.tipos).toEqual([])
  })

  it('erro sem mensagem da API usa a mensagem padrão do status', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaErro(500),
    })

    const { result } = renderHook(() => useTipos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe(mensagemPadraoPorStatus(500))
  })

  it('falha de rede expõe a mensagem padrão de conexão', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useTipos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO)
  })

  it('recarregar() chama a API de novo, limpa o erro anterior e atualiza a lista', async () => {
    let tentativa = 0
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : respostaJson(tiposApi())
      },
    })

    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.erro).toBe('Falha temporária.'))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBeNull()
    expect(result.current.carregando).toBe(false)
    expect(result.current.tipos).toHaveLength(9)
    expect(chamadas.filter((c) => c.metodo === 'GET')).toHaveLength(2)
  })

  it('recarregar() volta a indicar carregando enquanto a nova chamada não termina', async () => {
    let liberar: () => void = () => {}
    let tentativa = 0
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => {
        tentativa += 1
        if (tentativa === 1) return respostaJson(tiposApi())
        return new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(tiposApi().slice(0, 7)))
        })
      },
    })

    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let promessa: Promise<void> = Promise.resolve()
    act(() => {
      promessa = result.current.recarregar()
    })
    await waitFor(() => expect(result.current.carregando).toBe(true))

    await act(async () => {
      liberar()
      await promessa
    })

    expect(result.current.carregando).toBe(false)
    expect(result.current.tipos).toHaveLength(7)
  })

  it('recarregar() que falha depois de uma lista carregada expõe o erro', async () => {
    let tentativa = 0
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => {
        tentativa += 1
        return tentativa === 1 ? respostaJson(tiposApi()) : respostaErro(500, 'Falha ao consultar os tipos.')
      },
    })

    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBe('Falha ao consultar os tipos.')
    expect(result.current.carregando).toBe(false)
  })

  it('recarregar() mantém a mensagem de erro enquanto a nova chamada não termina e a limpa no sucesso', async () => {
    let liberar: () => void = () => {}
    let tentativa = 0
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => {
        tentativa += 1
        if (tentativa === 1) return respostaErro(500, 'Falha temporária.')
        return new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(tiposApi()))
        })
      },
    })

    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.erro).toBe('Falha temporária.'))

    let promessa: Promise<void> = Promise.resolve()
    act(() => {
      promessa = result.current.recarregar()
    })
    await waitFor(() => expect(result.current.carregando).toBe(true))
    expect(result.current.erro).toBe('Falha temporária.')

    await act(async () => {
      liberar()
      await promessa
    })

    expect(result.current.erro).toBeNull()
    expect(result.current.tipos).toHaveLength(9)
    expect(result.current.carregando).toBe(false)
  })

  it('desmontar durante a carga inicial não gera erro nem aviso de setState quando a resposta chega', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(tiposApi()))
        }),
    })

    const { unmount } = renderHook(() => useTipos())
    unmount()

    await act(async () => {
      liberar()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(consoleErro).not.toHaveBeenCalled()
  })

  it('expõe recarregar e excluir como funções', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
    })

    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    expect(typeof result.current.recarregar).toBe('function')
    expect(typeof result.current.excluir).toBe('function')
  })
})
