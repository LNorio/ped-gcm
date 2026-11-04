import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { apontamentosApi, rotaListarApontamentos, type ApontamentoApiFalso } from '../../test/apontamentosFalsos'
import { useApontamentos } from './useApontamentos'

const ROTA = '/api/ped/apontamentos'

const NOVO = {
  nome: 'Visitas a clientes novos',
  idTipo: 1,
  tipoValor: 'numeral' as const,
  descricao: 'Clientes novos visitados no mês.',
}

const CRIADO_API: ApontamentoApiFalso = {
  id: 10,
  nome: NOVO.nome,
  descricao: NOVO.descricao,
  ativo: true,
  'id tipo': 1,
  tipo: 'Comercial',
  'tipo de valor': 'Numeral',
  indicadores: [],
  'vinculado a dashboard': false,
  'desativado mas usado em indicador ativo': false,
  'cadastrado em': '2026-11-03 10:00:00',
  'cadastrado por': 'Fulano',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

describe('F4.4 — useApontamentos.criar (cadastro de apontamento)', () => {
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
   * API com estado: o POST acrescenta o apontamento à lista devolvida pelo GET.
   * `aoCriar` substitui a resposta sem gravar (erros); `respostaGravado` grava e responde com
   * outro corpo 2xx (envelope, só mensagem, vazio).
   */
  function simularApiComEstado(
    aoCriar?: () => Response | Promise<Response> | undefined,
    respostaGravado: () => Response = () => respostaJson(CRIADO_API, 201),
  ) {
    let lista = apontamentosApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`POST ${ROTA}`]: () => {
        const personalizada = aoCriar?.()
        if (personalizada) return personalizada
        lista = [...lista, CRIADO_API]
        return respostaGravado()
      },
    })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  it('criar(dados) faz POST /api/ped/apontamentos com o corpo da API e resolve com o apontamento criado', async () => {
    const chamadas = simularApiComEstado()
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let criado: unknown
    await act(async () => {
      criado = await result.current.criar(NOVO)
    })

    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
      nome: 'Visitas a clientes novos',
      'id tipo': 1,
      'tipo de valor': 'numeral',
      descricao: 'Clientes novos visitados no mês.',
    })
    expect(criado).toMatchObject({ id: 10, nome: 'Visitas a clientes novos', ativo: true, tipoValor: 'numeral' })
  })

  it('após criar, a lista é recarregada da API e o novo apontamento aparece (ativo); a contagem por tipo acompanha', async () => {
    const chamadas = simularApiComEstado()
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.apontamentos).toHaveLength(5)

    await act(async () => {
      await result.current.criar(NOVO)
    })

    await waitFor(() => expect(result.current.apontamentos).toHaveLength(6))
    expect(result.current.apontamentos.find((a) => a.id === 10)).toMatchObject({ nome: 'Visitas a clientes novos', ativo: true })
    expect(gets(chamadas)).toHaveLength(2)
    await waitFor(() => expect(result.current.contagemPorTipo.find((c) => c.id === 1)?.quantidade).toBe(3))
    expect(result.current.erro).toBeNull()
  })

  it('POST 2xx com envelope { mensagem, apontamento } resolve com o apontamento convertido e recarrega a lista', async () => {
    const chamadas = simularApiComEstado(undefined, () =>
      respostaJson({ mensagem: 'Apontamento cadastrado.', apontamento: CRIADO_API }, 201),
    )
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let criado: unknown
    await act(async () => {
      criado = await result.current.criar(NOVO)
    })

    expect(criado).toMatchObject({ id: 10, nome: 'Visitas a clientes novos', ativo: true })
    expect(gets(chamadas)).toHaveLength(2)
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(6))
    expect(result.current.erro).toBeNull()
  })

  it('POST 2xx só com { mensagem } resolve null, sem erro, e recarrega a lista com o novo apontamento', async () => {
    const chamadas = simularApiComEstado(undefined, () => respostaJson({ mensagem: 'apontamento cadastrado' }, 201))
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let criado: unknown = 'não resolvido'
    await act(async () => {
      criado = await result.current.criar(NOVO)
    })

    expect(criado).toBeNull()
    expect(posts(chamadas)).toHaveLength(1)
    expect(gets(chamadas)).toHaveLength(2)
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(6))
    expect(result.current.apontamentos.find((a) => a.id === 10)).toMatchObject({ nome: 'Visitas a clientes novos', ativo: true })
    expect(result.current.erro).toBeNull()
  })

  it('POST 201 com corpo vazio resolve null, sem erro, e recarrega a lista', async () => {
    const chamadas = simularApiComEstado(undefined, () => new Response('', { status: 201 }))
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let criado: unknown = 'não resolvido'
    await act(async () => {
      criado = await result.current.criar(NOVO)
    })

    expect(criado).toBeNull()
    expect(gets(chamadas)).toHaveLength(2)
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(6))
    expect(result.current.erro).toBeNull()
  })

  it('POST 2xx com apontamento incompleto resolve null, sem erro, e recarrega a lista', async () => {
    const chamadas = simularApiComEstado(undefined, () => respostaJson({ id: 10, nome: NOVO.nome }, 201))
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let criado: unknown = 'não resolvido'
    await act(async () => {
      criado = await result.current.criar(NOVO)
    })

    expect(criado).toBeNull()
    expect(gets(chamadas)).toHaveLength(2)
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(6))
  })

  it('a recarga após criar respeita os filtros atuais (mesma query)', async () => {
    const chamadas = simularApiComEstado()
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    act(() => {
      result.current.setTipo(1)
    })
    await waitFor(() => expect(result.current.apontamentos).toHaveLength(2))

    await act(async () => {
      await result.current.criar(NOVO)
    })

    const ultimoGet = gets(chamadas)[gets(chamadas).length - 1]
    expect(ultimoGet.url.searchParams.get('tipo')).toBe('1')
    await waitFor(() => expect(result.current.apontamentos.map((a) => a.id)).toEqual([1, 5, 10]))
  })

  it('erro da API (403) rejeita com a ApiError original, não refaz o GET e não altera a lista nem o erro de carga', async () => {
    const chamadas = simularApiComEstado(() => respostaErro(403, 'Você só pode cadastrar apontamentos nos seus tipos.'))
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let erro: unknown
    await act(async () => {
      erro = await result.current.criar({ ...NOVO, idTipo: 2 }).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 403, mensagem: 'Você só pode cadastrar apontamentos nos seus tipos.' })
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.apontamentos).toHaveLength(5)
    expect(result.current.erro).toBeNull()
  })

  it('erro 400 rejeita com a mensagem da API', async () => {
    simularApiComEstado(() => respostaErro(400, 'Já existe um apontamento com este nome.'))
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await expect(result.current.criar(NOVO)).rejects.toMatchObject({ status: 400, mensagem: 'Já existe um apontamento com este nome.' })
  })

  it('falha de rede rejeita com ApiError status 0', async () => {
    simularApiComEstado(() => Promise.reject(new TypeError('Failed to fetch')))
    const { result } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await expect(result.current.criar(NOVO)).rejects.toMatchObject({ status: 0 })
  })

  it('desmontar durante criar não gera erro no console e a promessa resolve', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    let liberar: () => void = () => {}
    simularApiComEstado(
      () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(CRIADO_API, 201))
        }),
    )
    const { result, unmount } = renderHook(() => useApontamentos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    const promessa = result.current.criar(NOVO)
    unmount()
    liberar()
    await promessa

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(consoleErro).not.toHaveBeenCalled()
  })
})
