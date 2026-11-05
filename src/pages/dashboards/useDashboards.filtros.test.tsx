import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { dashboardsApi, filtrarDashboardsApi, rotaListarDashboards } from '../../test/dashboardsFalsos'
import { ATRASO_BUSCA_MS as ATRASO_EXPORTADO, FILTROS_PADRAO, useDashboards } from './useDashboards'

const ROTA_LISTA = 'GET /api/ped/dashboards'
/** Mesma regra das abas anteriores: a busca consulta 500 ms após a última mudança. */
const ATRASO_BUSCA_MS = 500

describe('F7.2 — useDashboards: filtros consultados na API (busca e situação — RF-47)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/dashboards')

  function ultimoGet(chamadas: ChamadaRegistrada[]) {
    const lista = gets(chamadas)
    return lista[lista.length - 1]
  }

  async function montar() {
    const chamadas = simularApi(fetchFalso, { [ROTA_LISTA]: rotaListarDashboards(dashboardsApi) })
    const resultado = renderHook(() => useDashboards())
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
      result.current.setBusca('gerentes')
    })
    expect(result.current.filtros.busca).toBe('gerentes')
    await avancar(ATRASO_BUSCA_MS - 100)
    expect(gets(chamadas)).toHaveLength(1)

    await avancar(100)
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('gerentes')
    await waitFor(() => expect(result.current.dashboards.map((d) => d.nome)).toEqual(['PED Gerentes']))
  })

  it('a busca alcança item vinculado e indicador (resolvida pela API)', async () => {
    const { result } = await montar()

    act(() => {
      result.current.setBusca('102')
    })
    await avancar()
    await waitFor(() => expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 4]))

    act(() => {
      result.current.setBusca('faturamento')
    })
    await avancar()
    await waitFor(() => expect(result.current.dashboards.map((d) => d.id)).toEqual([1, 2]))
  })

  it('digitação seguida gera uma única consulta, com o último texto', async () => {
    const { result, chamadas } = await montar()

    for (const texto of ['l', 'log', 'logist']) {
      act(() => {
        result.current.setBusca(texto)
      })
      await avancar(200)
    }
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('logist')
    await waitFor(() => expect(result.current.dashboards.map((d) => d.nome)).toEqual(['PED Logística']))
  })

  it.each([
    ['ativos', [1, 2]],
    ['inativos', [5]],
    ['construcao', [3, 4]],
    ['problemas', [2]],
  ] as const)('setSituacao("%s") consulta na hora com situacao na query e expõe a lista devolvida', async (situacao, ids) => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao(situacao)
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe(situacao)
    await waitFor(() => expect(result.current.dashboards.map((d) => d.id)).toEqual(ids))
    expect(result.current.filtros.situacao).toBe(situacao)
  })

  it('situação "todas" é omitida da query; o mesmo valor não reconsulta', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('todas')
    })
    await avancar()
    expect(gets(chamadas)).toHaveLength(1)

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

  it('setSituacao durante a espera da busca consulta na hora com os dois filtros e cancela a espera', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('ped')
    })
    act(() => {
      result.current.setSituacao('construcao')
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('ped')
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
    await waitFor(() => expect(result.current.dashboards).toHaveLength(5))
  })

  it('proteção de corrida: resposta atrasada de um filtro antigo não sobrescreve a do atual', async () => {
    let liberarAntiga: () => void = () => {}
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('situacao') === 'inativos') {
          return new Promise<Response>((resolve) => {
            liberarAntiga = () => resolve(respostaJson(filtrarDashboardsApi(dashboardsApi(), url)))
          })
        }
        return respostaJson(filtrarDashboardsApi(dashboardsApi(), url))
      },
    })
    const { result } = renderHook(() => useDashboards())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setSituacao('inativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setSituacao('problemas')
    })
    await waitFor(() => expect(result.current.dashboards.map((d) => d.id)).toEqual([2]))

    await act(async () => {
      liberarAntiga()
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.dashboards.map((d) => d.id)).toEqual([2])
    expect(result.current.filtros.situacao).toBe('problemas')
  })

  it('erro na consulta filtrada vai para erro; recarregar() repete com os mesmos filtros', async () => {
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: (_init, url) => {
        if (url.searchParams.get('situacao') === 'construcao' && falhar) {
          falhar = false
          return respostaErro(500, 'Falha ao filtrar.')
        }
        return respostaJson(filtrarDashboardsApi(dashboardsApi(), url))
      },
    })
    const { result } = renderHook(() => useDashboards())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setSituacao('construcao')
    })
    await waitFor(() => expect(result.current.erro).toBe('Falha ao filtrar.'))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(result.current.erro).toBeNull()
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('construcao')
    expect(result.current.dashboards.map((d) => d.id)).toEqual([3, 4])
  })

  it('desmontar com a espera da busca pendente não consulta depois', async () => {
    const { result, chamadas, unmount } = await montar()

    act(() => {
      result.current.setBusca('comercial')
    })
    unmount()
    await avancar(ATRASO_BUSCA_MS * 2)

    expect(gets(chamadas)).toHaveLength(1)
  })
})
