import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import {
  APONTAMENTO_CONCILIACAO_API,
  APONTAMENTO_ROTEIRO_API,
  apontamentosApi,
  respostaApontamentosApi,
} from '../../test/apontamentosFalsos'
import { useApontamentos } from './useApontamentos'

const ROTA_LISTA = 'GET /api/ped/apontamentos'

describe('F4.2 — useApontamentos (hook de listagem de apontamentos)', () => {
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

  it('começa carregando, sem apontamentos, sem contagem, sem erro e com os filtros padrão (busca vazia, todas, sem tipo)', () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaApontamentosApi()) })

    const { result } = renderHook(() => useApontamentos())

    expect(result.current.carregando).toBe(true)
    expect(result.current.apontamentos).toEqual([])
    expect(result.current.contagemPorTipo).toEqual([])
    expect(result.current.erro).toBeNull()
    expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas', tipo: null })
  })

  it('carrega GET /api/ped/apontamentos ao montar (uma única vez, sem busca nem tipo na query) e expõe a lista convertida', async () => {
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: () => respostaJson(respostaApontamentosApi([APONTAMENTO_ROTEIRO_API, APONTAMENTO_CONCILIACAO_API])),
    })

    const { result } = renderHook(() => useApontamentos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBeNull()
    expect(result.current.apontamentos).toEqual([
      expect.objectContaining({ id: 1, nome: 'Roteiro de visitas elaborado', tipoValor: 'porcentagem', vinculadoADashboard: true }),
      expect.objectContaining({ id: 2, nome: 'Conciliação bancária concluída', ativo: false, desativadoMasUsadoEmIndicadorAtivo: true }),
    ])
    const gets = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/apontamentos')
    expect(gets).toHaveLength(1)
    expect(gets[0].url.searchParams.has('busca')).toBe(false)
    expect(gets[0].url.searchParams.has('tipo')).toBe(false)
  })

  it('expõe a contagem por tipo devolvida pela API', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaApontamentosApi()) })

    const { result } = renderHook(() => useApontamentos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.contagemPorTipo).toEqual([
      { id: 1, nome: 'Comercial', quantidade: 2 },
      { id: 2, nome: 'Financeiro', quantidade: 1 },
      { id: 3, nome: 'Recursos Humanos', quantidade: 1 },
      { id: 4, nome: 'Tecnologia da Informação', quantidade: 1 },
    ])
  })

  it('lista vazia da API resulta em apontamentos [] e contagem [] sem erro', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson({ apontamentos: [], 'contagem por tipo': [] }) })

    const { result } = renderHook(() => useApontamentos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.apontamentos).toEqual([])
    expect(result.current.contagemPorTipo).toEqual([])
    expect(result.current.erro).toBeNull()
  })

  it('erro da API: expõe a mensagem da ApiError em erro, encerra o carregamento e mantém a lista vazia', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaErro(500, 'Falha ao consultar os apontamentos.') })

    const { result } = renderHook(() => useApontamentos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe('Falha ao consultar os apontamentos.')
    expect(result.current.apontamentos).toEqual([])
  })

  it('erro sem mensagem da API usa a mensagem padrão do status', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaErro(500) })

    const { result } = renderHook(() => useApontamentos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe(mensagemPadraoPorStatus(500))
  })

  it('falha de rede expõe a mensagem padrão de conexão', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useApontamentos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO)
  })

  it('recarregar() chama a API de novo, limpa o erro anterior e atualiza a lista', async () => {
    let tentativa = 0
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: () => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : respostaJson(respostaApontamentosApi())
      },
    })

    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.erro).toBe('Falha temporária.'))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBeNull()
    expect(result.current.carregando).toBe(false)
    expect(result.current.apontamentos).toHaveLength(5)
    expect(chamadas.filter((c) => c.metodo === 'GET')).toHaveLength(2)
  })

  it('recarregar() volta a indicar carregando enquanto a nova chamada não termina e mantém o erro anterior até o sucesso', async () => {
    let liberar: () => void = () => {}
    let tentativa = 0
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () => {
        tentativa += 1
        if (tentativa === 1) return respostaErro(500, 'Falha temporária.')
        return new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(respostaApontamentosApi()))
        })
      },
    })

    const { result } = renderHook(() => useApontamentos())
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
    expect(result.current.carregando).toBe(false)
    expect(result.current.apontamentos).toHaveLength(5)
  })

  it('recarregar() que falha depois de uma lista carregada expõe o erro e mantém a lista anterior', async () => {
    let tentativa = 0
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () => {
        tentativa += 1
        return tentativa === 1 ? respostaJson(respostaApontamentosApi()) : respostaErro(500, 'Falha ao consultar os apontamentos.')
      },
    })

    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBe('Falha ao consultar os apontamentos.')
    expect(result.current.carregando).toBe(false)
    expect(result.current.apontamentos).toHaveLength(5)
  })

  it('só o resultado da última requisição é aplicado quando duas cargas respondem fora de ordem', async () => {
    let liberarPrimeira: () => void = () => {}
    let tentativa = 0
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () => {
        tentativa += 1
        if (tentativa === 1) {
          return new Promise<Response>((resolve) => {
            liberarPrimeira = () => resolve(respostaJson(respostaApontamentosApi()))
          })
        }
        return respostaJson(respostaApontamentosApi(apontamentosApi().slice(0, 2)))
      },
    })

    const { result } = renderHook(() => useApontamentos())

    await act(async () => {
      await result.current.recarregar()
    })
    expect(result.current.apontamentos).toHaveLength(2)

    await act(async () => {
      liberarPrimeira()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.apontamentos).toHaveLength(2)
    expect(result.current.carregando).toBe(false)
  })

  it('desmontar durante a carga inicial não gera erro nem aviso de setState quando a resposta chega', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(respostaApontamentosApi()))
        }),
    })

    const { unmount } = renderHook(() => useApontamentos())
    unmount()

    await act(async () => {
      liberar()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(consoleErro).not.toHaveBeenCalled()
  })

  it('expõe as ações como funções: setBusca, setSituacao, setTipo, limparFiltros, recarregar, criar, alterarSituacao e excluir', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaApontamentosApi()) })

    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    expect(typeof result.current.setBusca).toBe('function')
    expect(typeof result.current.setSituacao).toBe('function')
    expect(typeof result.current.setTipo).toBe('function')
    expect(typeof result.current.limparFiltros).toBe('function')
    expect(typeof result.current.recarregar).toBe('function')
    expect(typeof result.current.criar).toBe('function')
    expect(typeof result.current.alterarSituacao).toBe('function')
    expect(typeof result.current.excluir).toBe('function')
  })
})
