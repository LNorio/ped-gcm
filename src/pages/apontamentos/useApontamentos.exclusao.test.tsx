import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_RELATORIO_API,
  APONTAMENTO_TREINAMENTOS_API,
  apontamentosApi,
  rotaListarApontamentos,
} from '../../test/apontamentosFalsos'
import { useApontamentos } from './useApontamentos'

const ROTA = '/api/ped/apontamentos'

describe('F4.6 — useApontamentos.excluir (exclusão de apontamento)', () => {
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

  /** API com estado: o DELETE remove o apontamento da lista devolvida pelo GET. */
  function simularApiComEstado(opcoes: { aoExcluir?: (id: number) => Response | Promise<Response> | undefined; getLento?: () => Promise<Response> } = {}) {
    let lista = apontamentosApi()
    const rotaExcluir = (id: number) => () => {
      const personalizada = opcoes.aoExcluir?.(id)
      if (personalizada) return personalizada
      lista = lista.filter((a) => a.id !== id)
      return new Response(null, { status: 204 })
    }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: opcoes.getLento ?? rotaListarApontamentos(() => lista),
      [`DELETE ${ROTA}/${APONTAMENTO_CHAMADOS_API.id}`]: rotaExcluir(APONTAMENTO_CHAMADOS_API.id),
      [`DELETE ${ROTA}/${APONTAMENTO_TREINAMENTOS_API.id}`]: rotaExcluir(APONTAMENTO_TREINAMENTOS_API.id),
      [`DELETE ${ROTA}/${APONTAMENTO_RELATORIO_API.id}`]: rotaExcluir(APONTAMENTO_RELATORIO_API.id),
    })
  }

  const deletes = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'DELETE')
  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET')

  async function montar(opcoes?: Parameters<typeof simularApiComEstado>[0]) {
    const chamadas = simularApiComEstado(opcoes)
    const resultado = renderHook(() => useApontamentos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('excluir(id) faz DELETE /api/ped/apontamentos/{id} e, com sucesso, remove o apontamento da lista', async () => {
    const { result, chamadas } = await montar()
    expect(result.current.apontamentos).toHaveLength(5)

    await act(async () => {
      await result.current.excluir(4)
    })

    expect(deletes(chamadas)).toHaveLength(1)
    expect(deletes(chamadas)[0].caminho).toBe(`${ROTA}/4`)
    expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 2, 3, 5])
    expect(result.current.erro).toBeNull()
  })

  it('resolve sem valor', async () => {
    const { result } = await montar()

    let retorno: unknown = 'não resolvido'
    await act(async () => {
      retorno = await result.current.excluir(4)
    })

    expect(retorno).toBeUndefined()
  })

  it('400 com { mensagem, indicadores } rejeita com a ApiError original (mensagem e dados.indicadores) e não altera a lista', async () => {
    const { result } = await montar({
      aoExcluir: () =>
        respostaJson(
          {
            mensagem: 'Apontamento compõe indicadores e não pode ser excluído.',
            indicadores: APONTAMENTO_TREINAMENTOS_API.indicadores,
          },
          400,
        ),
    })

    let erro: unknown
    await act(async () => {
      erro = await result.current.excluir(3).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({
      status: 400,
      mensagem: 'Apontamento compõe indicadores e não pode ser excluído.',
      dados: { indicadores: [{ id: 3, nome: 'Capacitação' }, { id: 4, nome: 'Desenvolvimento de equipe' }] },
    })
    expect(result.current.apontamentos).toHaveLength(5)
    expect(result.current.erro).toBeNull()
  })

  it('403 (não Admin) rejeita com a mensagem da API e mantém a lista', async () => {
    const { result } = await montar({ aoExcluir: () => respostaErro(403, 'Apenas o administrador exclui apontamentos.') })

    await expect(result.current.excluir(4)).rejects.toMatchObject({ status: 403, mensagem: 'Apenas o administrador exclui apontamentos.' })
    expect(result.current.apontamentos).toHaveLength(5)
  })

  it('falha de rede rejeita com ApiError status 0 e mantém a lista', async () => {
    const { result } = await montar({ aoExcluir: () => Promise.reject(new TypeError('Failed to fetch')) })

    await expect(result.current.excluir(4)).rejects.toMatchObject({ status: 0 })
    expect(result.current.apontamentos).toHaveLength(5)
  })

  it('corrida recarregar × excluir: o GET antigo é descartado (a linha não "volta") e a lista é reconsultada ao fim dele', async () => {
    let liberarGet: () => void = () => {}
    let numeroGet = 0
    const listaOriginal = apontamentosApi()
    const listaDoServidorDepois = apontamentosApi().filter((a) => a.id !== 4)
    const { result, chamadas } = await montar({
      getLento: () => {
        numeroGet += 1
        if (numeroGet === 1) return Promise.resolve(respostaJson({ apontamentos: listaOriginal, 'contagem por tipo': [] }))
        if (numeroGet === 2) {
          return new Promise<Response>((resolve) => {
            liberarGet = () => resolve(respostaJson({ apontamentos: listaOriginal, 'contagem por tipo': [] }))
          })
        }
        // Recarga automática depois da ação local: o servidor já não tem o apontamento 4.
        return Promise.resolve(respostaJson({ apontamentos: listaDoServidorDepois, 'contagem por tipo': [] }))
      },
    })

    let recarga: Promise<void> = Promise.resolve()
    act(() => {
      recarga = result.current.recarregar()
    })
    await act(async () => {
      await result.current.excluir(4)
    })
    expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 2, 3, 5])

    await act(async () => {
      liberarGet()
      await recarga
    })
    expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 2, 3, 5])

    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 2, 3, 5])
  })

  it('desmontar durante excluir não gera erro no console e a promessa resolve', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    let liberar: () => void = () => {}
    const { result, unmount } = await montar({
      aoExcluir: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(new Response(null, { status: 204 }))
        }),
    })

    const promessa = result.current.excluir(4)
    unmount()
    liberar()
    await promessa

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(consoleErro).not.toHaveBeenCalled()
  })
  describe('contagem por tipo após a exclusão', () => {
    it('decrementa a quantidade do tipo do apontamento excluído, sem nova consulta', async () => {
      const { result, chamadas } = await montar()
      expect(result.current.contagemPorTipo.find((item) => item.id === 1)).toEqual({ id: 1, nome: 'Comercial', quantidade: 2 })

      await act(async () => {
        await result.current.excluir(5)
      })

      expect(result.current.contagemPorTipo).toEqual([
        { id: 1, nome: 'Comercial', quantidade: 1 },
        { id: 2, nome: 'Financeiro', quantidade: 1 },
        { id: 3, nome: 'Recursos Humanos', quantidade: 1 },
        { id: 4, nome: 'Tecnologia da Informação', quantidade: 1 },
      ])
      expect(gets(chamadas)).toHaveLength(1)
    })

    it('remove o tipo da contagem quando a quantidade chega a zero', async () => {
      const { result } = await montar()

      await act(async () => {
        await result.current.excluir(4)
      })

      expect(result.current.contagemPorTipo).toEqual([
        { id: 1, nome: 'Comercial', quantidade: 2 },
        { id: 2, nome: 'Financeiro', quantidade: 1 },
        { id: 3, nome: 'Recursos Humanos', quantidade: 1 },
      ])
    })

    it('falha na exclusão não altera a contagem', async () => {
      const { result } = await montar({ aoExcluir: () => respostaErro(403, 'Apenas o administrador exclui apontamentos.') })
      const contagemAntes = result.current.contagemPorTipo

      await act(async () => {
        await result.current.excluir(4).catch(() => {})
      })

      expect(result.current.contagemPorTipo).toEqual(contagemAntes)
    })
  })
})
