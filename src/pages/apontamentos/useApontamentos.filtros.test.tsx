import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { apontamentosApi, filtrarApontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { useApontamentos } from './useApontamentos'

const ROTA_LISTA = 'GET /api/ped/apontamentos'

/** Espera da busca (decisão do usuário em 04/11/2026): a consulta sai 500 ms após a última digitação. */
const ATRASO_BUSCA_MS = 500

describe('F4.3 — useApontamentos: filtros consultados na API (busca, situação e tipo)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /** Avança o relógio falso (padrão: o tempo da espera da busca) e deixa as promessas resolverem. */
  async function avancar(ms = ATRASO_BUSCA_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  function simularListaFiltrada() {
    return simularApi(fetchFalso, { [ROTA_LISTA]: rotaListarApontamentos(apontamentosApi) })
  }

  function gets(chamadas: ChamadaRegistrada[]) {
    return chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/apontamentos')
  }

  function ultimoGet(chamadas: ChamadaRegistrada[]) {
    const lista = gets(chamadas)
    return lista[lista.length - 1]
  }

  async function montar() {
    const chamadas = simularListaFiltrada()
    const resultado = renderHook(() => useApontamentos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('setBusca atualiza filtros.busca na hora e, após a espera de 500 ms, refaz o GET com busca na query; a lista passa a ser a devolvida pela API', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('visitas')
    })
    expect(result.current.filtros.busca).toBe('visitas')
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('visitas')
    expect(ultimoGet(chamadas).url.searchParams.has('tipo')).toBe(false)
    await waitFor(() => expect(result.current.apontamentos.map((a) => a.nome)).toEqual(['Roteiro de visitas elaborado']))
    expect(result.current.filtros.busca).toBe('visitas')
  })

  it('a busca é enviada como digitada (quem ignora acentos e maiúsculas é a API)', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('CONCILIAÇÃO')
    })
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('CONCILIAÇÃO')
    await waitFor(() => expect(result.current.apontamentos.map((a) => a.nome)).toEqual(['Conciliação bancária concluída']))
  })

  it('setSituacao refaz o GET com situacao na query e atualiza filtros.situacao', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('inativos')
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos')
    await waitFor(() =>
      expect(result.current.apontamentos.map((a) => a.nome)).toEqual(['Conciliação bancária concluída', 'Relatório mensal entregue']),
    )
    expect(result.current.filtros.situacao).toBe('inativos')
  })

  it('situação "problemas" é enviada como está e a lista passa a ser a devolvida', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('problemas')
    })

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('problemas'))
    await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([2]))
  })

  it('setTipo(id) refaz o GET com tipo na query; a contagem por tipo vem da resposta (não muda com o filtro de tipo)', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setTipo(1)
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('tipo')).toBe('1')
    await waitFor(() =>
      expect(result.current.apontamentos.map((a) => a.nome)).toEqual(['Roteiro de visitas elaborado', 'Relatório mensal entregue']),
    )
    expect(result.current.filtros.tipo).toBe(1)
    expect(result.current.contagemPorTipo).toEqual([
      { id: 1, nome: 'Comercial', quantidade: 2 },
      { id: 2, nome: 'Financeiro', quantidade: 1 },
      { id: 3, nome: 'Recursos Humanos', quantidade: 1 },
      { id: 4, nome: 'Tecnologia da Informação', quantidade: 1 },
    ])
  })

  it('setTipo(null) remove o tipo da query e volta à lista completa', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setTipo(4)
    })
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(1))

    act(() => {
      result.current.setTipo(null)
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    expect(ultimoGet(chamadas).url.searchParams.has('tipo')).toBe(false)
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(5))
    expect(result.current.filtros.tipo).toBeNull()
  })

  it('a contagem por tipo acompanha busca e situação (vem da resposta de cada consulta)', async () => {
    const { result } = await montar()

    act(() => {
      result.current.setSituacao('inativos')
    })

    await waitFor(() =>
      expect(result.current.contagemPorTipo).toEqual([
        { id: 1, nome: 'Comercial', quantidade: 1 },
        { id: 2, nome: 'Financeiro', quantidade: 1 },
      ]),
    )
  })

  it('busca, situação e tipo combinam na mesma query', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setTipo(1)
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    act(() => {
      result.current.setBusca('roteiro')
    })
    await avancar()
    await waitFor(() => expect(gets(chamadas)).toHaveLength(4))

    const parametros = ultimoGet(chamadas).url.searchParams
    expect(parametros.get('busca')).toBe('roteiro')
    expect(parametros.get('situacao')).toBe('ativos')
    expect(parametros.get('tipo')).toBe('1')
    await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([1]))
    expect(result.current.filtros).toEqual({ busca: 'roteiro', situacao: 'ativos', tipo: 1 })
  })

  it('limparFiltros volta aos filtros padrão e refaz o GET sem busca nem tipo', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('roteiro')
    })
    await avancar()
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    act(() => {
      result.current.setTipo(1)
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(4))

    act(() => {
      result.current.limparFiltros()
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(5))
    expect(ultimoGet(chamadas).url.searchParams.has('busca')).toBe(false)
    expect(ultimoGet(chamadas).url.searchParams.has('tipo')).toBe(false)
    expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas', tipo: null })
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(5))
  })

  it('limparFiltros com os filtros já no padrão não quebra (no máximo refaz a consulta)', async () => {
    const { result } = await montar()

    await act(async () => {
      result.current.limparFiltros()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas', tipo: null })
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(5))
    expect(result.current.erro).toBeNull()
  })

  it('setBusca com o mesmo valor atual não dispara nova consulta', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('')
    })
    await avancar(ATRASO_BUSCA_MS * 2)

    expect(gets(chamadas)).toHaveLength(1)
  })

  it('proteção de corrida: a resposta atrasada de um filtro antigo não sobrescreve a do filtro atual', async () => {
    let liberarAntiga: () => void = () => {}
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('busca') === 'v') {
          return new Promise<Response>((resolve) => {
            liberarAntiga = () => resolve(respostaJson(filtrarApontamentosApi(apontamentosApi(), url)))
          })
        }
        return respostaJson(filtrarApontamentosApi(apontamentosApi(), url))
      },
    })
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setBusca('v')
    })
    await avancar()
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setBusca('visitas')
    })
    await avancar()
    await waitFor(() => expect(result.current.apontamentos.map((a) => a.nome)).toEqual(['Roteiro de visitas elaborado']))

    await act(async () => {
      liberarAntiga()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.apontamentos.map((a) => a.nome)).toEqual(['Roteiro de visitas elaborado'])
    expect(result.current.filtros.busca).toBe('visitas')
  })

  it('erro na consulta filtrada expõe a mensagem em erro; recarregar() repete a consulta com os mesmos filtros', async () => {
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('situacao') === 'inativos' && falhar) {
          falhar = false
          return respostaErro(500, 'Falha ao filtrar.')
        }
        return respostaJson(filtrarApontamentosApi(apontamentosApi(), url))
      },
    })
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setSituacao('inativos')
    })
    await waitFor(() => expect(result.current.erro).toBe('Falha ao filtrar.'))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBeNull()
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos')
    expect(result.current.apontamentos).toHaveLength(2)
  })

  it('desmontar com uma consulta filtrada pendente não gera erro no console', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.has('busca')) {
          return new Promise<Response>((resolve) => {
            liberar = () => resolve(respostaJson(filtrarApontamentosApi(apontamentosApi(), url)))
          })
        }
        return respostaJson(filtrarApontamentosApi(apontamentosApi(), url))
      },
    })
    const { result, unmount } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setBusca('x')
    })
    await avancar()
    unmount()

    await act(async () => {
      liberar()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(consoleErro).not.toHaveBeenCalled()
  })
  describe('espera da busca (debounce de 500 ms, decisão de 04/11/2026)', () => {
    it('nada é consultado antes de 500 ms; o GET sai depois da espera', async () => {
      const { result, chamadas } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      await avancar(ATRASO_BUSCA_MS - 100)
      expect(gets(chamadas)).toHaveLength(1)
      expect(result.current.filtros.busca).toBe('visitas')

      await avancar(100)
      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('visitas')
    })

    it('digitar "a", "ab", "abc" em sequência rápida gera um único GET, com busca=abc, 500 ms após a última mudança', async () => {
      const { result, chamadas } = await montar()

      act(() => {
        result.current.setBusca('a')
      })
      await avancar(200)
      act(() => {
        result.current.setBusca('ab')
      })
      await avancar(200)
      act(() => {
        result.current.setBusca('abc')
      })
      await avancar(ATRASO_BUSCA_MS - 100)
      // 800 ms desde a primeira mudança, mas só 400 ms desde a última: a espera recomeça a cada mudança.
      expect(gets(chamadas)).toHaveLength(1)

      await avancar(100)
      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('abc')

      await avancar(ATRASO_BUSCA_MS * 2)
      expect(gets(chamadas)).toHaveLength(2)
      expect(result.current.filtros.busca).toBe('abc')
    })

    it('trocar a situação durante a espera consulta na hora, já com a busca digitada, e cancela o GET pendente da busca', async () => {
      const { result, chamadas } = await montar()

      act(() => {
        result.current.setBusca('roteiro')
      })
      await avancar(100)
      act(() => {
        result.current.setSituacao('ativos')
      })

      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('roteiro')
      expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('ativos')

      await avancar(ATRASO_BUSCA_MS * 2)
      expect(gets(chamadas)).toHaveLength(2)
      await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([1]))
    })

    it('trocar o tipo durante a espera também consulta na hora com a busca digitada e cancela a espera', async () => {
      const { result, chamadas } = await montar()

      act(() => {
        result.current.setBusca('relatorio')
      })
      await avancar(100)
      act(() => {
        result.current.setTipo(1)
      })

      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('relatorio')
      expect(ultimoGet(chamadas).url.searchParams.get('tipo')).toBe('1')

      await avancar(ATRASO_BUSCA_MS * 2)
      expect(gets(chamadas)).toHaveLength(2)
    })

    it('"Limpar filtros" durante a espera consulta na hora sem busca e cancela o GET pendente da busca', async () => {
      const { result, chamadas } = await montar()

      act(() => {
        result.current.setBusca('roteiro')
      })
      await avancar(100)
      act(() => {
        result.current.limparFiltros()
      })

      expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas', tipo: null })
      await avancar(ATRASO_BUSCA_MS * 2)
      expect(gets(chamadas).some((c) => c.url.searchParams.get('busca') === 'roteiro')).toBe(false)
      await waitFor(() => expect(result.current.apontamentos).toHaveLength(5))
    })

    it('desmontar durante a espera não dispara o GET nem gera erro no console', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { result, chamadas, unmount } = await montar()

      act(() => {
        result.current.setBusca('visitas')
      })
      unmount()
      await avancar(ATRASO_BUSCA_MS * 2)

      expect(gets(chamadas)).toHaveLength(1)
      expect(consoleErro).not.toHaveBeenCalled()
    })
  })

  describe('tipo selecionado que some da contagem', () => {
    it('excluir o último apontamento do tipo selecionado: o tipo sai da contagem, filtros.tipo volta a null e a lista é reconsultada sem tipo', async () => {
      let lista = apontamentosApi()
      const chamadas = simularApi(fetchFalso, {
        [ROTA_LISTA]: rotaListarApontamentos(() => lista),
        'DELETE /api/ped/apontamentos/4': () => {
          lista = lista.filter((a) => a.id !== 4)
          return new Response(null, { status: 204 })
        },
      })
      const { result } = renderHook(() => useApontamentos())
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setTipo(4)
      })
      await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([4]))
      const getsAntes = gets(chamadas).length

      await act(async () => {
        await result.current.excluir(4)
      })

      expect(result.current.contagemPorTipo.map((item) => item.id)).not.toContain(4)
      await waitFor(() => expect(result.current.filtros.tipo).toBeNull())
      await waitFor(() => expect(gets(chamadas)).toHaveLength(getsAntes + 1))
      expect(ultimoGet(chamadas).url.searchParams.has('tipo')).toBe(false)
      await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 2, 3, 5]))
    })

    it('excluir um apontamento de um tipo que continua na contagem mantém o tipo selecionado e não reconsulta', async () => {
      let lista = apontamentosApi()
      const chamadas = simularApi(fetchFalso, {
        [ROTA_LISTA]: rotaListarApontamentos(() => lista),
        'DELETE /api/ped/apontamentos/5': () => {
          lista = lista.filter((a) => a.id !== 5)
          return new Response(null, { status: 204 })
        },
      })
      const { result } = renderHook(() => useApontamentos())
      await waitFor(() => expect(result.current.carregando).toBe(false))

      act(() => {
        result.current.setTipo(1)
      })
      await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 5]))
      const getsAntes = gets(chamadas).length

      await act(async () => {
        await result.current.excluir(5)
      })
      await avancar(100)

      expect(result.current.filtros.tipo).toBe(1)
      expect(result.current.apontamentos.map((a) => a.id)).toEqual([1])
      expect(result.current.contagemPorTipo.find((item) => item.id === 1)).toEqual({ id: 1, nome: 'Comercial', quantidade: 1 })
      expect(gets(chamadas)).toHaveLength(getsAntes)
    })
  })
})
