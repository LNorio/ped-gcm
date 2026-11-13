import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import {
  FECHAMENTO_COMERCIAL_API,
  FECHAMENTO_GERENTES_API,
  FECHAMENTO_VENDEDORES_API,
  copiarFechamento,
  criarApiFechamentosFalsa,
} from '../../test/fechamentosFalsos'
import { ATRASO_BUSCA_MS as ATRASO_EXPORTADO, FILTROS_PADRAO, useFechamentos } from './useFechamentos'

const ROTA = '/api/ped/fechamentos'
/** Mesma regra das abas anteriores: a busca consulta 500 ms após a última mudança. */
const ATRASO_BUSCA_MS = 500

describe('F10.2 — useFechamentos: lista de fechamentos com filtros consultados na API (RF-78, RF-79)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  function ultimoGet(chamadas: ChamadaRegistrada[]) {
    const lista = gets(chamadas)
    return lista[lista.length - 1]
  }

  async function montar(rotaLista?: RotaFalsa) {
    const api = criarApiFechamentosFalsa()
    const rotas = rotaLista ? { ...api.rotas, [`GET ${ROTA}`]: rotaLista } : api.rotas
    const chamadas = simularApi(fetchFalso, rotas)
    const resultado = renderHook(() => useFechamentos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  const nomes = (lista: Array<{ nome: string }>) => lista.map((f) => f.nome)

  it('exporta FILTROS_PADRAO { busca: "", periodicidade: "todas", situacao: "todas" } e ATRASO_BUSCA_MS = 500', () => {
    expect(FILTROS_PADRAO).toEqual({ busca: '', periodicidade: 'todas', situacao: 'todas' })
    expect(ATRASO_EXPORTADO).toBe(500)
  })

  it('ao montar consulta GET /api/ped/fechamentos sem query e devolve os fechamentos convertidos', async () => {
    const { result, chamadas } = await montar()

    expect(gets(chamadas)).toHaveLength(1)
    expect(gets(chamadas)[0].url.search).toBe('')
    expect(result.current.erro).toBeNull()
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.filtros).toEqual({ busca: '', periodicidade: 'todas', situacao: 'todas' })
    expect(nomes(result.current.fechamentos)).toEqual(['PED Gerentes', 'PED Comercial', 'PED Vendedores'])

    const gerentes = result.current.fechamentos[0]
    expect(gerentes).toMatchObject({
      id: 2,
      tipoVinculo: 'cargos',
      itensVinculados: ['Gerente de Loja'],
      periodicidade: 'mensal',
      periodoAtual: '11/2026',
      situacaoDoPeriodo: 'aberto',
      unidadesDeImagem: 2,
      unidadesComPendencias: 2,
      progresso: { preenchidos: 1, total: 4 },
      indicadoresComProblema: ['Custo de frete por entrega'],
      unidadesSemTabelaDeFaixas: ['102'],
    })
  })

  it('carregando é true durante a primeira consulta', async () => {
    simularApi(fetchFalso, criarApiFechamentosFalsa().rotas)
    const { result } = renderHook(() => useFechamentos())

    expect(result.current.carregando).toBe(true)
    expect(result.current.carregouUmaVez).toBe(false)
    expect(result.current.fechamentos).toEqual([])
    await waitFor(() => expect(result.current.carregando).toBe(false))
  })

  it('ordena por periodicidade (mensal → anual) e nome, mesmo que a API devolva fora de ordem', async () => {
    const fora = [
      copiarFechamento(FECHAMENTO_VENDEDORES_API),
      copiarFechamento(FECHAMENTO_COMERCIAL_API),
      { ...copiarFechamento(FECHAMENTO_GERENTES_API), id: 7, nome: 'PED Supervisores', 'periodo atual': '11/2026' },
      { ...copiarFechamento(FECHAMENTO_COMERCIAL_API), id: 8, nome: 'PED Atacado', periodicidade: 'semestral' as const, 'periodo atual': '2º sem/2026' },
      copiarFechamento(FECHAMENTO_GERENTES_API),
      { ...copiarFechamento(FECHAMENTO_GERENTES_API), id: 9, nome: 'PED Áreas', periodicidade: 'bimestral' as const, 'periodo atual': '6º bim/2026' },
    ]
    const { result } = await montar(() => respostaJson(fora))

    expect(nomes(result.current.fechamentos)).toEqual([
      'PED Gerentes',
      'PED Supervisores',
      'PED Áreas',
      'PED Comercial',
      'PED Atacado',
      'PED Vendedores',
    ])
  })

  it('setPeriodicidade consulta na hora com periodicidade na query', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setPeriodicidade('mensal')
    })

    expect(result.current.filtros.periodicidade).toBe('mensal')
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('periodicidade')).toBe('mensal')
    await waitFor(() => expect(nomes(result.current.fechamentos)).toEqual(['PED Gerentes']))
  })

  it('setSituacao consulta na hora com situacao na query (encerrado e aberto)', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('encerrado')
    })
    expect(result.current.filtros.situacao).toBe('encerrado')
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('encerrado'))
    await waitFor(() => expect(nomes(result.current.fechamentos)).toEqual(['PED Vendedores']))

    act(() => {
      result.current.setSituacao('aberto')
    })
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('aberto'))
    await waitFor(() => expect(nomes(result.current.fechamentos)).toEqual(['PED Gerentes', 'PED Comercial']))
  })

  it('"todas" é omitida da query', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setPeriodicidade('anual')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setPeriodicidade('todas')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))

    expect(ultimoGet(chamadas).url.searchParams.has('periodicidade')).toBe(false)
    await waitFor(() => expect(result.current.fechamentos).toHaveLength(3))
  })

  it('setBusca atualiza filtros.busca na hora e consulta só após 500 ms, com busca na query', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('gerente de loja')
    })
    expect(result.current.filtros.busca).toBe('gerente de loja')
    await avancar(ATRASO_BUSCA_MS - 100)
    expect(gets(chamadas)).toHaveLength(1)

    await avancar(100)
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('gerente de loja')
    await waitFor(() => expect(nomes(result.current.fechamentos)).toEqual(['PED Gerentes']))
  })

  it('a busca alcança grupo vinculado e período (resolvida pela API)', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('101')
    })
    await avancar()
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('101'))
    await waitFor(() => expect(nomes(result.current.fechamentos)).toEqual(['PED Comercial']))

    act(() => {
      result.current.setBusca('4º tri/2026')
    })
    await avancar()
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('4º tri/2026'))
    expect(nomes(result.current.fechamentos)).toEqual(['PED Comercial'])
  })

  it('periodicidade, situação e busca vão juntas na mesma consulta', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setBusca('ped')
    })
    act(() => {
      result.current.setPeriodicidade('trimestral')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setSituacao('aberto')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))

    const query = ultimoGet(chamadas).url.searchParams
    expect(query.get('busca')).toBe('ped')
    expect(query.get('periodicidade')).toBe('trimestral')
    expect(query.get('situacao')).toBe('aberto')
    await waitFor(() => expect(nomes(result.current.fechamentos)).toEqual(['PED Comercial']))
  })

  it('limparFiltros volta ao padrão e consulta na hora sem query', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setPeriodicidade('anual')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    act(() => {
      result.current.setSituacao('encerrado')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))

    act(() => {
      result.current.limparFiltros()
    })

    expect(result.current.filtros).toEqual(FILTROS_PADRAO)
    await waitFor(() => expect(gets(chamadas)).toHaveLength(4))
    expect(ultimoGet(chamadas).url.search).toBe('')
    await waitFor(() => expect(result.current.fechamentos).toHaveLength(3))
  })

  it('falha na consulta preenche erro com a mensagem da API; recarregar repete e limpa o erro', async () => {
    let falhar = true
    const api = criarApiFechamentosFalsa()
    const { result, chamadas } = await montar((init, url) =>
      falhar ? respostaErro(500, 'Falha ao consultar os fechamentos.') : api.rotas[`GET ${ROTA}`](init, url),
    )

    expect(result.current.erro).toBe('Falha ao consultar os fechamentos.')
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.fechamentos).toEqual([])

    falhar = false
    await act(async () => {
      await result.current.recarregar()
    })

    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.erro).toBeNull()
    expect(result.current.fechamentos).toHaveLength(3)
  })

  it('recarregar repete a consulta com os filtros atuais', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('aberto')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))

    await act(async () => {
      await result.current.recarregar()
    })

    expect(gets(chamadas)).toHaveLength(3)
    expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('aberto')
  })
})
