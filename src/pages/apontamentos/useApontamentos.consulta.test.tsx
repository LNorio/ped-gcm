import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConsulta } from '../../hooks/useConsulta'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { apontamentosApi, filtrarApontamentosApi, type ApontamentoApiFalso } from '../../test/apontamentosFalsos'
import { useApontamentos } from './useApontamentos'

// Envolve o useConsulta real para verificar que o hook da aba é construído sobre ele.
vi.mock('../../hooks/useConsulta', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../hooks/useConsulta')>()
  return { ...real, useConsulta: vi.fn(real.useConsulta) }
})

const ROTA = '/api/ped/apontamentos'

describe('F4.2 — useApontamentos sobre useConsulta (carregouUmaVez e recarga após ação local)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    vi.mocked(useConsulta).mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  it('usa o hook genérico useConsulta para a consulta da aba', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: (_init, url) => respostaJson(filtrarApontamentosApi(apontamentosApi(), url)) })

    const { result } = renderHook(() => useApontamentos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(useConsulta).toHaveBeenCalled()
  })

  describe('carregouUmaVez', () => {
    it('é false antes da primeira resposta e true depois da carga inicial bem-sucedida', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: (_init, url) => respostaJson(filtrarApontamentosApi(apontamentosApi(), url)) })

      const { result } = renderHook(() => useApontamentos())

      expect(result.current.carregouUmaVez).toBe(false)
      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.carregouUmaVez).toBe(true)
    })

    it('também vira true quando a primeira resposta é um erro', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500, 'Falha ao consultar os apontamentos.') })

      const { result } = renderHook(() => useApontamentos())

      await waitFor(() => expect(result.current.erro).toBe('Falha ao consultar os apontamentos.'))
      expect(result.current.carregouUmaVez).toBe(true)
    })

    it('continua true durante uma reconsulta filtrada', async () => {
      let liberar: () => void = () => {}
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: (_init, url) => {
          const corpo = filtrarApontamentosApi(apontamentosApi(), url)
          if (!url.searchParams.has('situacao')) return respostaJson(corpo)
          return new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson(corpo))
          })
        },
      })
      const { result } = renderHook(() => useApontamentos())
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setSituacao('inativos')
      })
      await waitFor(() => expect(result.current.carregando).toBe(true))

      expect(result.current.carregouUmaVez).toBe(true)
      expect(result.current.apontamentos).toHaveLength(5)

      await act(async () => {
        liberar()
      })
      await waitFor(() => expect(result.current.apontamentos).toHaveLength(2))
    })
  })

  describe('ação local concluída com um GET de filtro pendente (recarga automática)', () => {
    /**
     * API com estado em que o GET do filtro "tipo=1" fica pendente até o teste liberar.
     * O DELETE remove o apontamento da lista do servidor.
     */
    function simularGetDeTipoPendente() {
      let lista: ApontamentoApiFalso[] = apontamentosApi()
      const pendentes: Array<() => void> = []
      const chamadas = simularApi(fetchFalso, {
        [`GET ${ROTA}`]: (_init, url) => {
          if (url.searchParams.get('tipo') === '1' && pendentes.length === 0) {
            const instantaneo = filtrarApontamentosApi(lista, url)
            return new Promise<Response>((resolve) => {
              pendentes.push(() => resolve(respostaJson(instantaneo)))
            })
          }
          return respostaJson(filtrarApontamentosApi(lista, url))
        },
        [`DELETE ${ROTA}/4`]: () => {
          lista = lista.filter((a) => a.id !== 4)
          return new Response(null, { status: 204 })
        },
        [`PUT ${ROTA}/4/situacao`]: (init) => {
          const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
          lista = lista.map((a) => (a.id === 4 ? { ...a, ativo } : a))
          return respostaJson(lista.find((a) => a.id === 4))
        },
      })
      return { chamadas, liberar: () => pendentes.forEach((liberar) => liberar()) }
    }

    it('excluir com o GET de tipo pendente: a resposta pendente é descartada e o filtro é reconsultado; a lista final corresponde ao filtro novo', async () => {
      const { chamadas, liberar } = simularGetDeTipoPendente()
      const { result } = renderHook(() => useApontamentos())
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setTipo(1)
      })
      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      await act(async () => {
        await result.current.excluir(4)
      })
      expect(result.current.apontamentos.map((a) => a.id)).not.toContain(4)

      await act(async () => {
        liberar()
      })

      await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
      expect(gets(chamadas)[2].url.searchParams.get('tipo')).toBe('1')
      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 5])
      expect(result.current.filtros.tipo).toBe(1)
      expect(result.current.erro).toBeNull()
    })

    it('alterarSituacao com o GET de tipo pendente: a lista final também vem da nova consulta do filtro atual', async () => {
      const { chamadas, liberar } = simularGetDeTipoPendente()
      const { result } = renderHook(() => useApontamentos())
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setTipo(1)
      })
      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      await act(async () => {
        await result.current.alterarSituacao(4, false)
      })

      await act(async () => {
        liberar()
      })

      await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
      expect(gets(chamadas)[2].url.searchParams.get('tipo')).toBe('1')
      await waitFor(() => expect(result.current.carregando).toBe(false))
      expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 5])
    })

    it('sem GET pendente, a ação local não dispara nova consulta', async () => {
      const { chamadas } = simularGetDeTipoPendente()
      const { result } = renderHook(() => useApontamentos())
      await waitFor(() => expect(result.current.carregando).toBe(false))

      await act(async () => {
        await result.current.excluir(4)
      })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(gets(chamadas)).toHaveLength(1)
      expect(result.current.carregando).toBe(false)
    })
  })
})
