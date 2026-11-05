import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { DASHBOARD_GERENTES_API, DASHBOARD_SUPERVISORES_API, NOMES_DASHBOARDS, dashboardsApi } from '../../test/dashboardsFalsos'
import { useDashboards } from './useDashboards'

const ROTA_LISTA = 'GET /api/ped/dashboards'

describe('F7.2 — useDashboards (hook da listagem de dashboards)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/dashboards')

  it('começa carregando, sem dashboards, sem erro, carregouUmaVez false e filtros padrão (busca vazia, todas)', () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(dashboardsApi()) })

    const { result } = renderHook(() => useDashboards())

    expect(result.current.carregando).toBe(true)
    expect(result.current.carregouUmaVez).toBe(false)
    expect(result.current.dashboards).toEqual([])
    expect(result.current.erro).toBeNull()
    expect(result.current.filtros).toEqual({ busca: '', situacao: 'todas' })
  })

  it('carrega uma única vez ao montar, sem query, e expõe a lista convertida na ordem da API', async () => {
    const chamadas = simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson([DASHBOARD_GERENTES_API, DASHBOARD_SUPERVISORES_API]) })

    const { result } = renderHook(() => useDashboards())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.dashboards).toEqual([
      expect.objectContaining({ id: 2, nome: 'PED Gerentes', tipoVinculo: 'cargos', alertas: [expect.objectContaining({ pontosAfetados: 20 })] }),
      expect.objectContaining({ id: 3, nome: 'PED Supervisores', situacao: 'em_construcao', itensVinculados: ['16', '11'] }),
    ])
    expect(gets(chamadas)).toHaveLength(1)
    expect(gets(chamadas)[0].url.search).toBe('')
  })

  it('lista padrão: expõe os 5 dashboards na ordem da API', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(dashboardsApi()) })

    const { result } = renderHook(() => useDashboards())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.dashboards.map((d) => d.nome)).toEqual([...NOMES_DASHBOARDS])
  })

  it('erro da API: expõe a mensagem em erro, encerra o carregamento e mantém a lista vazia', async () => {
    simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaErro(500, 'Falha ao consultar os dashboards.') })

    const { result } = renderHook(() => useDashboards())

    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(result.current.erro).toBe('Falha ao consultar os dashboards.')
    expect(result.current.carregouUmaVez).toBe(true)
    expect(result.current.dashboards).toEqual([])
  })

  it('falha de rede: erro "Não foi possível conectar ao servidor."', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useDashboards())

    await waitFor(() => expect(result.current.erro).toBe(MENSAGEM_SEM_CONEXAO))
  })

  it('recarregar() repete a consulta, limpa o erro e expõe a nova lista (nunca rejeita)', async () => {
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [ROTA_LISTA]: () => (falhar ? respostaErro(500, 'Falhou.') : respostaJson([DASHBOARD_GERENTES_API])),
    })
    const { result } = renderHook(() => useDashboards())
    await waitFor(() => expect(result.current.erro).toBe('Falhou.'))

    falhar = false
    await act(async () => {
      await result.current.recarregar()
    })

    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.erro).toBeNull()
    expect(result.current.dashboards.map((d) => d.nome)).toEqual(['PED Gerentes'])
  })
})
