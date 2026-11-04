import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  DADO_DEVOLUCOES_API,
  DADO_FATURAMENTO_API,
  NOMES_DADOS_EXTERNOS,
  respostaDadosExternosApi,
} from '../../test/dadosExternosFalsos'
import { useDadosExternos } from './useDadosExternos'

const ROTA_LISTA = 'GET /api/ped/dados-externos-cadastro'

describe('F5.2 — useDadosExternos (hook da listagem de dados externos)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/dados-externos-cadastro')

  it('começa carregando, sem dados, sem erro, carregouUmaVez false e filtros padrão (busca vazia, todas)', () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaDadosExternosApi()) })

    const { result } = renderHook(() => useDadosExternos())

    expect(result.current.carregando).toBe(true)
    expect(result.current.carregouUmaVez).toBe(false)
    expect(result.current.dadosExternos).toEqual([])
    expect(result.current.erro).toBeNull()
    expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas' })
  })

  it('carrega uma única vez ao montar, sem busca nem situação na query, e expõe a lista convertida', async () => {
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: () => respostaJson(respostaDadosExternosApi([DADO_FATURAMENTO_API, DADO_DEVOLUCOES_API])),
    })

    const { result } = renderHook(() => useDadosExternos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.dadosExternos).toEqual([
      expect.objectContaining({ id: 1, nome: 'Faturamento líquido', situacao: 'ativo', identificador: 'FATURAMENTO' }),
      expect.objectContaining({ id: 3, nome: 'Devoluções de venda', situacao: 'em_construcao', identificador: null }),
    ])
    expect(gets(chamadas)).toHaveLength(1)
    expect(gets(chamadas)[0].url.search).toBe('')
  })

  it('lista padrão: expõe os 6 dados na ordem da API', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaDadosExternosApi()) })

    const { result } = renderHook(() => useDadosExternos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.dadosExternos.map((d) => d.nome)).toEqual([...NOMES_DADOS_EXTERNOS])
  })

  it('erro da API: expõe a mensagem em erro, encerra o carregamento e mantém a lista vazia', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaErro(500, 'Falha ao consultar os dados externos.') })

    const { result } = renderHook(() => useDadosExternos())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe('Falha ao consultar os dados externos.')
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.dadosExternos).toEqual([])
  })

  it('falha de rede: erro "Não foi possível conectar ao servidor."', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useDadosExternos())

    await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
  })

  it('recarregar() repete a consulta, limpa o erro e expõe a nova lista (nunca rejeita)', async () => {
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: () => (falhar ? respostaErro(500, 'Falhou.') : respostaJson(respostaDadosExternosApi([DADO_FATURAMENTO_API]))),
    })
    const { result } = renderHook(() => useDadosExternos())
    await waitFor(() => expect(result.current.erro).toBe('Falhou.'))

    falhar = false
    await act(async () => {
      await result.current.recarregar()
    })

    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.erro).toBeNull()
    expect(result.current.dadosExternos.map((d) => d.nome)).toEqual(['Faturamento líquido'])
  })
})
