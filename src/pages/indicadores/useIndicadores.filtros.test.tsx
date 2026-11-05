import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { filtrarIndicadoresApi, indicadoresApi, rotaListarIndicadores } from '../../test/indicadoresFalsos'
import { ATRASO_BUSCA_MS as ATRASO_EXPORTADO, FILTROS_PADRAO, useIndicadores } from './useIndicadores'

const ROTA_LISTA = 'GET /api/ped/indicadores-cadastro'
/** Mesma regra das abas Apontamentos e Dados Externos: a busca consulta 500 ms após a última mudança. */
const ATRASO_BUSCA_MS = 500

describe('F6.3 — useIndicadores: filtros consultados na API (busca e situação) e alertas', () => {
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

  async function avancar(ms = ATRASO_BUSCA_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/indicadores-cadastro')

  function ultimoGet(chamadas: ChamadaRegistrada[]) {
    const lista = gets(chamadas)
    return lista[lista.length - 1]
  }

  async function montar() {
    const chamadas = simularApi(fetchFalso, { [ROTA_LISTA]: rotaListarIndicadores(indicadoresApi) })
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('exporta FILTROS_PADRAO { busca: "", situacao: "todas" } e ATRASO_BUSCA_MS = 500', () => {
    expect(FILTROS_PADRAO).toEqual({ busca: '', situacao: 'todas' })
    expect(ATRASO_EXPORTADO).toBe(500)
  })

  it('setBusca atualiza filtros.busca na hora e consulta só após 500 ms, com busca na query', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('faturamento')
    })
    expect(result.current.filtros.busca).toBe('faturamento')
    await avancar(ATRASO_BUSCA_MS - 100)
    expect(gets(chamadas)).toHaveLength(1)

    await avancar(100)
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('faturamento')
    await waitFor(() => expect(result.current.indicadores.map((i) => i.nome)).toEqual(['Faturamento líquido mensal']))
  })

  it('a busca alcança apontamentos e dados externos da composição (resolvida pela API)', async () => {
    const { result } = await montar()

    act(() => {
      result.current.setBusca('roteiro')
    })
    await avancar()
    await waitFor(() => expect(result.current.indicadores.map((i) => i.nome)).toEqual(['Cobertura de visitas']))

    act(() => {
      result.current.setBusca('cobertura de clientes')
    })
    await avancar()
    await waitFor(() => expect(result.current.indicadores.map((i) => i.nome)).toEqual(['Cobertura da carteira']))
  })

  it('digitação seguida gera uma única consulta, com o último texto', async () => {
    const { result, chamadas } = await montar()

    for (const texto of ['c', 'cap', 'capacit']) {
      act(() => {
        result.current.setBusca(texto)
      })
      await avancar(200)
    }
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('capacit')
    await waitFor(() => expect(result.current.indicadores.map((i) => i.nome)).toEqual(['Capacitação']))
  })

  it('a busca é enviada como digitada (acentos e maiúsculas são tratados pela API)', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('DEVOLUÇÕES')
    })
    await avancar()

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('DEVOLUÇÕES'))
    await waitFor(() => expect(result.current.indicadores.map((i) => i.nome)).toEqual(['Devoluções de venda']))
  })

  it.each([
    ['ativos', [1, 2, 3, 4, 6, 7]],
    ['inativos', [5]],
    ['meta', [4]],
    ['problemas', [2, 6, 7]],
  ] as const)('setSituacao("%s") consulta na hora com situacao na query e expõe a lista devolvida', async (situacao, ids) => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao(situacao)
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe(situacao)
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual(ids))
    expect(result.current.filtros.situacao).toBe(situacao)
  })

  it('os alertas não mudam com o filtro (vêm da API sobre todos os indicadores)', async () => {
    const { result } = await montar()
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3 })

    act(() => {
      result.current.setSituacao('inativos')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([5]))

    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3 })
  })

  it('situação "todas" é omitida da query', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setSituacao('todas')
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    expect(ultimoGet(chamadas).url.searchParams.has('situacao')).toBe(false)
  })

  it('setSituacao com o mesmo valor não reconsulta', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('todas')
    })
    await avancar()

    expect(gets(chamadas)).toHaveLength(1)
  })

  it('setSituacao durante a espera da busca consulta na hora com os dois filtros e cancela a espera', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('venda')
    })
    act(() => {
      result.current.setSituacao('meta')
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('venda')
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('meta')
    await avancar(ATRASO_BUSCA_MS * 2)
    expect(gets(chamadas)).toHaveLength(2)
  })

  it('limparFiltros volta ao padrão e consulta sem busca nem situação', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('inativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))

    act(() => {
      result.current.limparFiltros()
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    expect(ultimoGet(chamadas).url.search).toBe('')
    expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas' })
    await waitFor(() => expect(result.current.indicadores).toHaveLength(7))
  })

  it('proteção de corrida: resposta atrasada de um filtro antigo não sobrescreve a do atual', async () => {
    let liberarAntiga: () => void = () => {}
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('situacao') === 'inativos') {
          return new Promise<Response>((resolve) => {
            liberarAntiga = () => resolve(respostaJson(filtrarIndicadoresApi(indicadoresApi(), url)))
          })
        }
        return respostaJson(filtrarIndicadoresApi(indicadoresApi(), url))
      },
    })
    const { result } = renderHook(() => useIndicadores())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setSituacao('inativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setSituacao('meta')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([4]))

    await act(async () => {
      liberarAntiga()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.indicadores.map((i) => i.id)).toEqual([4])
    expect(result.current.filtros.situacao).toBe('meta')
  })

  it('erro na consulta filtrada vai para erro; recarregar() repete com os mesmos filtros', async () => {
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('situacao') === 'problemas' && falhar) {
          falhar = false
          return respostaErro(500, 'Falha ao filtrar.')
        }
        return respostaJson(filtrarIndicadoresApi(indicadoresApi(), url))
      },
    })
    const { result } = renderHook(() => useIndicadores())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setSituacao('problemas')
    })
    await waitFor(() => expect(result.current.erro).toBe('Falha ao filtrar.'))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBeNull()
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('problemas')
    expect(result.current.indicadores.map((i) => i.id)).toEqual([2, 6, 7])
  })

  it('desmontar com a espera da busca pendente não consulta depois', async () => {
    const { result, chamadas, unmount } = await montar()

    act(() => {
      result.current.setBusca('faturamento')
    })
    unmount()
    await avancar(ATRASO_BUSCA_MS * 2)

    expect(gets(chamadas)).toHaveLength(1)
  })
})
