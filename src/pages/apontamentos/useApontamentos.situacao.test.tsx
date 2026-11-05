import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_CONCILIACAO_API,
  APONTAMENTO_RELATORIO_API,
  APONTAMENTO_ROTEIRO_API,
  apontamentosApi,
  rotaListarApontamentos,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { useApontamentos } from './useApontamentos'

const ROTA = '/api/ped/apontamentos'

describe('F4.5 — useApontamentos.alterarSituacao (ativar/desativar)', () => {
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
   * API com estado: o PUT grava a situação na lista do GET e devolve o apontamento atualizado.
   * Como a API, recalcula "desativado mas usado em indicador ativo" (inativo e com indicador).
   */
  function simularApiComEstado(opcoes: { aoAlterar?: (id: number) => Response | Promise<Response> | undefined; getLento?: () => Promise<Response> } = {}) {
    let lista = apontamentosApi()
    const rotaAlterar = (id: number) => (init: RequestInit | undefined) => {
      const personalizada = opcoes.aoAlterar?.(id)
      if (personalizada) return personalizada
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      let atualizado: ApontamentoApiFalso | undefined
      lista = lista.map((a) => {
        if (a.id !== id) return a
        atualizado = {
          ...a,
          ativo,
          'desativado mas usado em indicador ativo': !ativo && a.indicadores.length > 0,
          'situacao alterada em': '2026-11-03 11:20:00',
          'situacao alterada por': 'Fulano',
        }
        return atualizado
      })
      return respostaJson(atualizado)
    }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: opcoes.getLento ?? rotaListarApontamentos(() => lista),
      [`PUT ${ROTA}/${APONTAMENTO_ROTEIRO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_ROTEIRO_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_CONCILIACAO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_CONCILIACAO_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_CHAMADOS_API.id}/situacao`]: rotaAlterar(APONTAMENTO_CHAMADOS_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_RELATORIO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_RELATORIO_API.id),
    })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET')
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function montar(opcoes?: Parameters<typeof simularApiComEstado>[0]) {
    const chamadas = simularApiComEstado(opcoes)
    const resultado = renderHook(() => useApontamentos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('alterarSituacao(id, false) faz PUT /api/ped/apontamentos/{id}/situacao com { ativo: false } e resolve com o apontamento atualizado', async () => {
    const { result, chamadas } = await montar()

    let atualizado: unknown
    await act(async () => {
      atualizado = await result.current.alterarSituacao(4, false)
    })

    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/4/situacao`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: false })
    expect(atualizado).toMatchObject({ id: 4, ativo: false, situacaoAlteradaEm: '2026-11-03 11:20:00', situacaoAlteradaPor: 'Fulano' })
  })

  it('com sucesso, substitui o item na lista pela resposta da API (situação, quem alterou e quando), mantendo a posição e os demais itens', async () => {
    const { result } = await montar()
    const antes = result.current.apontamentos

    await act(async () => {
      await result.current.alterarSituacao(4, false)
    })

    const depois = result.current.apontamentos
    expect(depois.map((a) => a.id)).toEqual([1, 2, 3, 4, 5])
    expect(depois[3]).toMatchObject({ id: 4, ativo: false, situacaoAlteradaEm: '2026-11-03 11:20:00', situacaoAlteradaPor: 'Fulano' })
    expect(depois[0]).toBe(antes[0])
    expect(depois[1]).toBe(antes[1])
    expect(depois[2]).toBe(antes[2])
    expect(depois[4]).toBe(antes[4])
  })

  it('atualiza a lista com a resposta sem refazer a consulta (nenhum GET adicional)', async () => {
    const { result, chamadas } = await montar()

    await act(async () => {
      await result.current.alterarSituacao(4, false)
    })

    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.apontamentos[3].ativo).toBe(false)
  })

  it('alterarSituacao(id, true) envia { ativo: true } e o item volta a ativo', async () => {
    const { result, chamadas } = await montar()
    expect(result.current.apontamentos[4]).toMatchObject({ id: 5, ativo: false })

    await act(async () => {
      await result.current.alterarSituacao(5, true)
    })

    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ ativo: true })
    expect(result.current.apontamentos[4]).toMatchObject({ id: 5, ativo: true, situacaoAlteradaPor: 'Fulano' })
  })

  it('erro da API (403) rejeita com a ApiError original e não altera a lista nem o erro de carga', async () => {
    const { result } = await montar({ aoAlterar: () => respostaErro(403, 'Apenas Admin e Validador alteram a situação.') })

    let erro: unknown
    await act(async () => {
      erro = await result.current.alterarSituacao(4, false).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 403, mensagem: 'Apenas Admin e Validador alteram a situação.' })
    expect(result.current.apontamentos[3]).toMatchObject({ id: 4, ativo: true, situacaoAlteradaEm: null })
    expect(result.current.erro).toBeNull()
  })

  it('falha de rede rejeita com ApiError status 0 e mantém a lista', async () => {
    const { result } = await montar({ aoAlterar: () => Promise.reject(new TypeError('Failed to fetch')) })

    await expect(result.current.alterarSituacao(4, false)).rejects.toMatchObject({ status: 0 })
    expect(result.current.apontamentos[3].ativo).toBe(true)
  })

  it('corrida recarregar × alterarSituacao: o GET antigo é descartado (a situação não "volta") e a lista é reconsultada ao fim dele', async () => {
    let liberarGet: () => void = () => {}
    let numeroGet = 0
    const listaOriginal = apontamentosApi()
    const listaDoServidorDepois = apontamentosApi().map((a) => (a.id === 4 ? { ...a, ativo: false } : a))
    const { result, chamadas } = await montar({
      getLento: () => {
        numeroGet += 1
        if (numeroGet === 1) return Promise.resolve(respostaJson({ apontamentos: listaOriginal, 'contagem por tipo': [] }))
        if (numeroGet === 2) {
          return new Promise<Response>((resolve) => {
            liberarGet = () => resolve(respostaJson({ apontamentos: listaOriginal, 'contagem por tipo': [] }))
          })
        }
        // Recarga automática depois da ação local: o servidor já reflete a mudança.
        return Promise.resolve(respostaJson({ apontamentos: listaDoServidorDepois, 'contagem por tipo': [] }))
      },
    })

    let recarga: Promise<void> = Promise.resolve()
    act(() => {
      recarga = result.current.recarregar()
    })
    await act(async () => {
      await result.current.alterarSituacao(4, false)
    })
    expect(result.current.apontamentos[3].ativo).toBe(false)

    await act(async () => {
      liberarGet()
      await recarga
    })
    expect(result.current.apontamentos[3]).toMatchObject({ id: 4, ativo: false })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.apontamentos[3]).toMatchObject({ id: 4, ativo: false })
  })

  it('desmontar durante alterarSituacao não gera erro no console e a promessa resolve', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    let liberar: () => void = () => {}
    const { result, unmount } = await montar({
      aoAlterar: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson({ ...APONTAMENTO_CHAMADOS_API, ativo: false }))
        }),
    })

    const promessa = result.current.alterarSituacao(4, false)
    unmount()
    liberar()
    await promessa

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(consoleErro).not.toHaveBeenCalled()
  })
  describe('item que deixa de corresponder ao filtro de situação (decisão de 04/11/2026)', () => {
    async function montarComSituacao(situacao: 'ativos' | 'inativos' | 'problemas' | 'todas') {
      const montado = await montar()
      act(() => {
        montado.result.current.setSituacao(situacao)
      })
      await waitFor(() => expect(montado.result.current.filtros.situacao).toBe(situacao))
      await waitFor(() => expect(montado.result.current.carregando).toBe(false))
      return montado
    }

    it('"ativos": desativar tira o item da lista na hora, sem nova consulta, e zera (remove) o tipo dele na contagem', async () => {
      const { result, chamadas } = await montarComSituacao('ativos')
      expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 3, 4])
      expect(result.current.contagemPorTipo).toEqual([
        { id: 1, nome: 'Comercial', quantidade: 1 },
        { id: 3, nome: 'Recursos Humanos', quantidade: 1 },
        { id: 4, nome: 'Tecnologia da Informação', quantidade: 1 },
      ])
      const getsAntes = gets(chamadas).length

      await act(async () => {
        await result.current.alterarSituacao(4, false)
      })

      expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 3])
      expect(result.current.contagemPorTipo).toEqual([
        { id: 1, nome: 'Comercial', quantidade: 1 },
        { id: 3, nome: 'Recursos Humanos', quantidade: 1 },
      ])
      expect(gets(chamadas)).toHaveLength(getsAntes)
    })

    it('"inativos": ativar tira o item da lista e decrementa a contagem do tipo dele', async () => {
      const { result } = await montarComSituacao('inativos')
      expect(result.current.apontamentos.map((a) => a.id)).toEqual([2, 5])

      await act(async () => {
        await result.current.alterarSituacao(5, true)
      })

      expect(result.current.apontamentos.map((a) => a.id)).toEqual([2])
      expect(result.current.contagemPorTipo).toEqual([{ id: 2, nome: 'Financeiro', quantidade: 1 }])
    })

    it('"problemas": ativar o apontamento com problema tira-o da lista (a correspondência vem da resposta do PUT)', async () => {
      const { result } = await montarComSituacao('problemas')
      expect(result.current.apontamentos.map((a) => a.id)).toEqual([2])

      await act(async () => {
        await result.current.alterarSituacao(2, true)
      })

      expect(result.current.apontamentos).toEqual([])
      expect(result.current.contagemPorTipo).toEqual([])
    })

    it('"ativos": desativar um apontamento com indicador também o tira da lista (a resposta diz que ficou inativo)', async () => {
      const { result } = await montarComSituacao('ativos')

      await act(async () => {
        await result.current.alterarSituacao(1, false)
      })

      expect(result.current.apontamentos.map((a) => a.id)).toEqual([3, 4])
      expect(result.current.contagemPorTipo.map((item) => item.id)).toEqual([3, 4])
    })

    it('"todas": o item continua na lista, só com a situação alterada, e a contagem não muda', async () => {
      const { result } = await montarComSituacao('todas')
      const contagemAntes = result.current.contagemPorTipo

      await act(async () => {
        await result.current.alterarSituacao(4, false)
      })

      expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 2, 3, 4, 5])
      expect(result.current.apontamentos[3]).toMatchObject({ id: 4, ativo: false })
      expect(result.current.contagemPorTipo).toEqual(contagemAntes)
    })

    it('filtro só de tipo (situação "todas"): o item continua na lista após desativar', async () => {
      const { result } = await montar()
      act(() => {
        result.current.setTipo(4)
      })
      await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([4]))

      await act(async () => {
        await result.current.alterarSituacao(4, false)
      })

      expect(result.current.apontamentos).toEqual([expect.objectContaining({ id: 4, ativo: false })])
      expect(result.current.filtros.tipo).toBe(4)
    })

    it('falha do PUT com filtro ativo não tira o item da lista nem muda a contagem', async () => {
      const { result } = await montar({ aoAlterar: () => respostaErro(403, 'Apenas Admin e Validador alteram a situação.') })
      act(() => {
        result.current.setSituacao('ativos')
      })
      await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 3, 4]))
      const contagemAntes = result.current.contagemPorTipo

      await act(async () => {
        await result.current.alterarSituacao(4, false).catch(() => {})
      })

      expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 3, 4])
      expect(result.current.contagemPorTipo).toEqual(contagemAntes)
    })
  })
})

describe('F4.5 — useApontamentos.alterarSituacao com 2xx sem o apontamento na resposta (resolve null)', () => {
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

  /** API com estado: o PUT grava a situação na lista do GET, mas responde com `resposta`. */
  function simularPutSemItem(resposta: () => Response) {
    let lista = apontamentosApi()
    const rotaAlterar = (id: number) => (init: RequestInit | undefined) => {
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      lista = lista.map((a) =>
        a.id === id ? { ...a, ativo, 'situacao alterada em': '2026-11-05 09:00:00', 'situacao alterada por': 'Fulano' } : a,
      )
      return resposta()
    }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`PUT ${ROTA}/${APONTAMENTO_ROTEIRO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_ROTEIRO_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_CONCILIACAO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_CONCILIACAO_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_CHAMADOS_API.id}/situacao`]: rotaAlterar(APONTAMENTO_CHAMADOS_API.id),
      [`PUT ${ROTA}/${APONTAMENTO_RELATORIO_API.id}/situacao`]: rotaAlterar(APONTAMENTO_RELATORIO_API.id),
    })
  }

  async function montar(resposta: () => Response) {
    const chamadas = simularPutSemItem(resposta)
    const resultado = renderHook(() => useApontamentos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('resposta 2xx só com { mensagem } resolve null, sem erro e sem rejeitar', async () => {
    const { result } = await montar(() => respostaJson({ mensagem: 'situação alterada' }))

    let valor: unknown = 'nao chamado'
    await act(async () => {
      valor = await result.current.alterarSituacao(4, false)
    })

    expect(valor).toBeNull()
    expect(result.current.erro).toBeNull()
  })

  it('com null, recarrega a lista: nova consulta e o item mostra a situação gravada no servidor', async () => {
    const { result, chamadas } = await montar(() => respostaJson({ mensagem: 'situação alterada' }))
    expect(gets(chamadas)).toHaveLength(1)

    await act(async () => {
      await result.current.alterarSituacao(4, false)
    })

    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.apontamentos.find((a) => a.id === 4)).toMatchObject({ ativo: false, situacaoAlteradaPor: 'Fulano' })
    expect(result.current.erro).toBeNull()
  })

  it('200 com corpo vazio resolve null, sem erro, e recarrega a lista', async () => {
    const { result, chamadas } = await montar(() => new Response('', { status: 200 }))

    let valor: unknown = 'nao chamado'
    await act(async () => {
      valor = await result.current.alterarSituacao(4, false)
    })

    expect(valor).toBeNull()
    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.apontamentos.find((a) => a.id === 4)).toMatchObject({ ativo: false })
    expect(result.current.erro).toBeNull()
  })

  it('com o filtro "ativos", a recarga tira da lista o item que deixou de estar ativo', async () => {
    const { result } = await montar(() => respostaJson({ mensagem: 'situação alterada' }))
    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 3, 4]))

    await act(async () => {
      await result.current.alterarSituacao(4, false)
    })

    expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 3])
  })

  it('erro 500 rejeita com ApiError e não recarrega a lista', async () => {
    const { result, chamadas } = await montar(() => respostaErro(500))

    let erro: unknown
    await act(async () => {
      erro = await result.current.alterarSituacao(4, false).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 500 })
    expect(gets(chamadas)).toHaveLength(1)
  })
})
