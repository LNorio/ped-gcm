import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_DEVOLUCOES_API,
  NOMES_INDICADORES,
  respostaIndicadoresApi,
} from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

const ROTA_LISTA = 'GET /api/ped/indicadores-cadastro'

describe('F6.2 — useIndicadores (hook da listagem de indicadores)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/indicadores-cadastro')

  it('começa carregando, sem indicadores, alertas zerados, sem erro, carregouUmaVez false e filtros padrão (busca vazia, todas)', () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaIndicadoresApi()) })

    const { result } = renderHook(() => useIndicadores())

    expect(result.current.carregando).toBe(true)
    expect(result.current.carregouUmaVez).toBe(false)
    expect(result.current.indicadores).toEqual([])
    expect(result.current.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 0, metaPendentePorFilial: 0 })
    expect(result.current.erro).toBeNull()
    expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas' })
  })

  it('carrega uma única vez ao montar, sem busca nem situação na query, e expõe a lista convertida e os alertas', async () => {
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: () => respostaJson(respostaIndicadoresApi([INDICADOR_COBERTURA_VISITAS_API, INDICADOR_DEVOLUCOES_API])),
    })

    const { result } = renderHook(() => useIndicadores())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.indicadores).toEqual([
      expect.objectContaining({ id: 1, nome: 'Cobertura de visitas', calculo: 'media', vinculadoADashboard: true }),
      expect.objectContaining({ id: 4, nome: 'Devoluções de venda', criadoAutomaticamente: true, metaADefinir: true }),
    ])
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 0, metaPendentePorFilial: 0 })
    expect(gets(chamadas)).toHaveLength(1)
    expect(gets(chamadas)[0].url.search).toBe('')
  })

  it('lista padrão: expõe os 7 indicadores na ordem da API e os alertas (1 aguardando meta, 3 com componente desativado)', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(respostaIndicadoresApi()) })

    const { result } = renderHook(() => useIndicadores())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.indicadores.map((i) => i.nome)).toEqual([...NOMES_INDICADORES])
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3, metaPendentePorFilial: 0 })
  })

  it('erro da API: expõe a mensagem em erro, encerra o carregamento e mantém lista vazia e alertas zerados', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaErro(500, 'Falha ao consultar os indicadores.') })

    const { result } = renderHook(() => useIndicadores())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe('Falha ao consultar os indicadores.')
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.indicadores).toEqual([])
    expect(result.current.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 0, metaPendentePorFilial: 0 })
  })

  it('falha de rede: erro "Não foi possível conectar ao servidor."', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useIndicadores())

    await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
  })

  it('recarregar() repete a consulta, limpa o erro e expõe a nova lista e os novos alertas (nunca rejeita)', async () => {
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: () => (falhar ? respostaErro(500, 'Falhou.') : respostaJson(respostaIndicadoresApi([INDICADOR_DEVOLUCOES_API]))),
    })
    const { result } = renderHook(() => useIndicadores())
    await waitFor(() => expect(result.current.erro).toBe('Falhou.'))

    falhar = false
    await act(async () => {
      await result.current.recarregar()
    })

    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.erro).toBeNull()
    expect(result.current.indicadores.map((i) => i.nome)).toEqual(['Devoluções de venda'])
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 0, metaPendentePorFilial: 0 })
  })
})
