import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { dadosExternosApi, filtrarDadosExternosApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import { ATRASO_BUSCA_MS as ATRASO_EXPORTADO, FILTROS_PADRAO, useDadosExternos } from './useDadosExternos'

const ROTA_LISTA = 'GET /api/ped/dados-externos-cadastro'
/** Mesma regra da aba Apontamentos: a busca consulta 500 ms após a última mudança. */
const ATRASO_BUSCA_MS = 500

describe('F5.3 — useDadosExternos: filtros consultados na API (busca e situação)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/dados-externos-cadastro')

  function ultimoGet(chamadas: ChamadaRegistrada[]) {
    const lista = gets(chamadas)
    return lista[lista.length - 1]
  }

  async function montar() {
    const chamadas = simularApi(fetchFalso, { [ROTA_LISTA]: rotaListarDadosExternos(dadosExternosApi) })
    const resultado = renderHook(() => useDadosExternos())
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
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.nome)).toEqual(['Faturamento líquido']))
  })

  it('digitação seguida gera uma única consulta, com o último texto', async () => {
    const { result, chamadas } = await montar()

    for (const texto of ['v', 'vol', 'volume']) {
      act(() => {
        result.current.setBusca(texto)
      })
      await avancar(200)
    }
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('volume')
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.nome)).toEqual(['Volume de vendas']))
  })

  it('a busca é enviada como digitada (acentos e maiúsculas são tratados pela API)', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('DEVOLUÇÕES')
    })
    await avancar()

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('DEVOLUÇÕES'))
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.nome)).toEqual(['Devoluções de venda']))
  })

  it.each([
    ['ativos', ['Faturamento líquido', 'Chamados atendidos no prazo', 'Volume de vendas']],
    ['inativos', ['Cobertura de clientes']],
    ['construcao', ['Devoluções de venda', 'Prazo médio de recebimento']],
    ['problemas', ['Cobertura de clientes']],
  ] as const)('setSituacao("%s") consulta na hora com situacao na query e expõe a lista devolvida', async (situacao, nomes) => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao(situacao)
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe(situacao)
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.nome)).toEqual(nomes))
    expect(result.current.filtros.situacao).toBe(situacao)
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
      result.current.setBusca('senior')
    })
    act(() => {
      result.current.setSituacao('construcao')
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('senior')
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('construcao')
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
    await waitFor(() => expect(result.current.dadosExternos).toHaveLength(6))
  })

  it('proteção de corrida: resposta atrasada de um filtro antigo não sobrescreve a do atual', async () => {
    let liberarAntiga: () => void = () => {}
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('situacao') === 'inativos') {
          return new Promise<Response>((resolve) => {
            liberarAntiga = () => resolve(respostaJson(filtrarDadosExternosApi(dadosExternosApi(), url)))
          })
        }
        return respostaJson(filtrarDadosExternosApi(dadosExternosApi(), url))
      },
    })
    const { result } = renderHook(() => useDadosExternos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setSituacao('inativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setSituacao('construcao')
    })
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.id)).toEqual([3, 4]))

    await act(async () => {
      liberarAntiga()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.dadosExternos.map((d) => d.id)).toEqual([3, 4])
    expect(result.current.filtros.situacao).toBe('construcao')
  })

  it('erro na consulta filtrada vai para erro; recarregar() repete com os mesmos filtros', async () => {
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('situacao') === 'ativos' && falhar) {
          falhar = false
          return respostaErro(500, 'Falha ao filtrar.')
        }
        return respostaJson(filtrarDadosExternosApi(dadosExternosApi(), url))
      },
    })
    const { result } = renderHook(() => useDadosExternos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(result.current.erro).toBe('Falha ao filtrar.'))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBeNull()
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('ativos')
    expect(result.current.dadosExternos).toHaveLength(3)
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
