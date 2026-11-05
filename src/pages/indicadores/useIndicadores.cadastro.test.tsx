import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  indicadoresApi,
  respostaIndicadorApi,
  rotaListarIndicadores,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import type { NovoIndicador } from '../../types/dominio'
import { useIndicadores } from './useIndicadores'

const ROTA = '/api/ped/indicadores-cadastro'

const NOVO: NovoIndicador = {
  nome: 'Positivação da carteira',
  descricao: null,
  meta: 1500.5,
  sentido: 'maior_melhor',
  calculo: 'media',
  metaEditavel: true,
  apontamentos: [1, 3],
}

describe('F6.4 — useIndicadores.criar (cadastro de indicador)', () => {
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
  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  const CRIADO: IndicadorApiFalso = {
    ...INDICADOR_COBERTURA_VISITAS_API,
    id: 20,
    nome: 'Positivação da carteira',
    dashboards: [],
    'vinculado a dashboard': false,
    'meta editavel no preenchimento': true,
  }

  /** POST que grava o novo indicador na lista da API falsa e responde com `resposta()`. */
  function simular(resposta: () => Response = () => respostaJson(respostaIndicadorApi(CRIADO), 201), gravar = true) {
    let lista = indicadoresApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      [`POST ${ROTA}`]: () => {
        if (gravar) lista = [...lista, CRIADO]
        return resposta()
      },
    })
  }

  it('criar faz o POST com o corpo da API, recarrega a lista e resolve com o indicador criado', async () => {
    const chamadas = simular()
    const { result } = renderHook(() => useIndicadores())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let criado: Awaited<ReturnType<typeof result.current.criar>> | undefined
    await act(async () => {
      criado = await result.current.criar(NOVO)
    })

    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
      nome: 'Positivação da carteira',
      descricao: null,
      'origem da meta': 'manual',
      meta: 1500.5,
      sentido: 'maior_melhor',
      'meta editavel': true,
      calculo: 'media',
      apontamentos: [1, 3],
    })
    expect(criado).toMatchObject({ id: 20, nome: 'Positivação da carteira', metaEditavel: true })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    await waitFor(() => expect(result.current.indicadores.map((i) => i.nome)).toContain('Positivação da carteira'))
  })

  it.each<[string, () => Response]>([
    ['só { mensagem }', () => respostaJson({ mensagem: 'indicador cadastrado' }, 201)],
    ['201 com corpo vazio', () => new Response('', { status: 201 })],
    ['indicador incompleto ({ id, nome })', () => respostaJson({ id: 20, nome: 'Positivação da carteira' }, 201)],
  ])('POST 2xx com %s: resolve null, recarrega a lista e não define erro', async (_caso, resposta) => {
    const chamadas = simular(resposta)
    const { result } = renderHook(() => useIndicadores())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let criado: unknown = 'nao-resolvido'
    await act(async () => {
      criado = await result.current.criar(NOVO)
    })

    expect(posts(chamadas)).toHaveLength(1)
    expect(criado).toBeNull()
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    await waitFor(() => expect(result.current.indicadores.map((i) => i.nome)).toContain('Positivação da carteira'))
    expect(result.current.erro).toBeNull()
  })

  it('a recarga após criar respeita os filtros atuais (situação na query)', async () => {
    const chamadas = simular()
    const { result } = renderHook(() => useIndicadores())
    await waitFor(() => expect(result.current.carregando).toBe(false))
    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))

    await act(async () => {
      await result.current.criar(NOVO)
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(3))
    expect(gets(chamadas)[2].url.searchParams.get('situacao')).toBe('ativos')
  })

  it('falha no POST rejeita com a ApiError original, sem recarregar nem alterar a lista ou o erro de carga', async () => {
    const chamadas = simular(() => respostaErro(400, 'Informe apontamentos ou um dado externo, nunca os dois.'), false)
    const { result } = renderHook(() => useIndicadores())
    await waitFor(() => expect(result.current.carregando).toBe(false))
    const antes = result.current.indicadores

    let erro: unknown
    await act(async () => {
      erro = await result.current.criar({ ...NOVO, dadoExterno: 1 }).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'Informe apontamentos ou um dado externo, nunca os dois.' })
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.indicadores).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})
