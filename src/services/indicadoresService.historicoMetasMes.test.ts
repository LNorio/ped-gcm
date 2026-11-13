import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { historicoMetasApi } from '../test/indicadoresFalsos'
import { listarHistoricoMetas } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/indicadores-cadastro/12/metas-historico'

/**
 * F9.1 (RF-74): o histórico de ajustes de meta aberto na janela "Editar metas" do preenchimento usa a
 * mesma função da aba Indicadores (`listarHistoricoMetas`, F6.8), com o filtro novo `mesDeReferencia`
 * (`GET .../{id}/metas-historico?filial=&mes_de_referencia=AAAA-MM`). Sem o mês, a query continua como
 * na F6.8.
 */
describe('F9.1 — Histórico de metas por filial e mês (RF-74)', () => {
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

  it('envia filial e mes_de_referencia como "AAAA-MM" (a partir de "AAAA-MM" ou "AAAA-MM-DD")', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(historicoMetasApi()) })

    await listarHistoricoMetas(12, { filial: '101', mesDeReferencia: '2026-10' })
    await listarHistoricoMetas(12, { filial: '101', mesDeReferencia: '2026-10-01' })

    for (const chamada of chamadas) {
      expect(chamada.caminho).toBe(ROTA)
      expect(chamada.url.searchParams.get('filial')).toBe('101')
      expect(chamada.url.searchParams.get('mes_de_referencia')).toBe('2026-10')
      expect([...chamada.url.searchParams.keys()].sort()).toEqual(['filial', 'mes_de_referencia'])
    }
  })

  it('com filial "todas" só o mês entra na query', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(historicoMetasApi()) })

    await listarHistoricoMetas(12, { filial: 'todas', mesDeReferencia: '2026-10' })

    expect([...chamadas[0].url.searchParams.keys()]).toEqual(['mes_de_referencia'])
  })

  it('sem mesDeReferencia (ou vazio) a query não muda', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(historicoMetasApi()) })

    await listarHistoricoMetas(12, { filial: '101' })
    await listarHistoricoMetas(12, { filial: '101', mesDeReferencia: '' })

    for (const chamada of chamadas) expect([...chamada.url.searchParams.keys()]).toEqual(['filial'])
  })

  it('devolve as linhas convertidas como na F6.8', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(historicoMetasApi()) })

    const historico = await listarHistoricoMetas(12, { filial: '101', mesDeReferencia: '2026-10' })

    expect(historico[0]).toMatchObject({ filial: '101', mesDeReferencia: '2026-10-01', para: 1600000, usuario: 'Ana Costa' })
  })
})
