import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import {
  ALERTA_FAIXAS_CONFLITO_101,
  ALERTA_FAIXAS_DASHBOARD_SEM_FAIXA,
  ALERTA_FAIXAS_SEM_FAIXA_102,
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_GERENTES_API,
  dashboardsComAlertasDeFaixasApi,
  detalheDashboardApi,
} from '../test/dashboardsFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA } from './api'
import { listarDashboards, obterDashboard } from './dashboardsService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dashboards'

/**
 * Proposta "faixa geral e situação" (12/11/2026), seção 6: `GET /api/ped/dashboards` e
 * `GET /api/ped/dashboards/{id}` ganham "alertas de faixas" (`tipo` `conflito` | `sem_faixa`,
 * `mensagem`, `filial` ou `null`). No domínio, `alertasDeFaixas`; ausente ou `null` = `[]`. Não se
 * confunde com `alertas` (indicadores com problema).
 *
 * Contrato final (F8.12*, `API (28).md`): filtro `situacao=problemas_faixa` (só os dashboards com
 * "alertas de faixas"); o filtro `problemas` não inclui os alertas de faixas.
 */
describe('F7.14 — Serviço de dashboards: "alertas de faixas"', () => {
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

  it('listagem: converte cada alerta (tipo, mensagem, filial ou null), separado dos alertas de indicadores', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(dashboardsComAlertasDeFaixasApi()) })

    const [comercial, gerentes, , logistica] = await listarDashboards()

    expect(comercial.alertasDeFaixas).toEqual([
      { tipo: 'conflito', mensagem: ALERTA_FAIXAS_CONFLITO_101.mensagem, filial: '101' },
      { tipo: 'sem_faixa', mensagem: ALERTA_FAIXAS_SEM_FAIXA_102.mensagem, filial: '102' },
    ])
    expect(comercial.alertas).toEqual([])
    expect(gerentes.alertasDeFaixas).toEqual([{ tipo: 'sem_faixa', mensagem: ALERTA_FAIXAS_DASHBOARD_SEM_FAIXA.mensagem, filial: null }])
    expect(gerentes.alertas).toHaveLength(1)
    expect(logistica.alertasDeFaixas).toEqual([])
  })

  it.each([
    ['ausente (formato atual)', undefined],
    ['null', null],
    ['lista vazia', []],
  ])('"alertas de faixas" %s vira []', async (_caso, alertas) => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([{ ...DASHBOARD_COMERCIAL_API, 'alertas de faixas': alertas }]) })

    const [dashboard] = await listarDashboards()

    expect(dashboard.alertasDeFaixas).toEqual([])
  })

  it('listarDashboards({ situacao: "problemas_faixa" }) envia situacao=problemas_faixa', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

    await listarDashboards({ situacao: 'problemas_faixa' })

    expect([...chamadas[0].url.searchParams.entries()]).toEqual([['situacao', 'problemas_faixa']])
  })

  it('filial numérica no alerta vira texto', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson([{ ...DASHBOARD_COMERCIAL_API, 'alertas de faixas': [{ tipo: 'sem_faixa', mensagem: 'filial 104 sem faixa ativa', filial: 104 }] }]),
    })

    const [dashboard] = await listarDashboards()

    expect(dashboard.alertasDeFaixas).toEqual([{ tipo: 'sem_faixa', mensagem: 'filial 104 sem faixa ativa', filial: '104' }])
  })

  it('detalhe: GET /api/ped/dashboards/{id} também traz alertasDeFaixas', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/2`]: () =>
        respostaJson({ ...detalheDashboardApi(DASHBOARD_GERENTES_API), 'alertas de faixas': [ALERTA_FAIXAS_DASHBOARD_SEM_FAIXA] }),
    })

    const detalhe = await obterDashboard(2)

    expect(detalhe.alertasDeFaixas).toEqual([{ tipo: 'sem_faixa', mensagem: 'dashboard sem faixa ativa', filial: null }])
  })

  it.each<[string, unknown]>([
    ['tipo desconhecido ("aviso")', { tipo: 'aviso', mensagem: 'faixa vencida', filial: '101' }],
    ['tipo ausente', { mensagem: 'faixa vencida', filial: '101' }],
    ['tipo null', { tipo: null, mensagem: 'faixa vencida', filial: null }],
  ])('listagem: alerta de faixas com %s rejeita a resposta inteira com ApiError "resposta inválida"', async (_caso, alerta) => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson([
          { ...DASHBOARD_GERENTES_API, 'alertas de faixas': [ALERTA_FAIXAS_DASHBOARD_SEM_FAIXA] },
          { ...DASHBOARD_COMERCIAL_API, 'alertas de faixas': [ALERTA_FAIXAS_CONFLITO_101, alerta] },
        ]),
    })

    const erro = await listarDashboards().catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
  })

  it('detalhe: alerta de faixas com tipo desconhecido vira ApiError "resposta inválida"', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/2`]: () =>
        respostaJson({
          ...detalheDashboardApi(DASHBOARD_GERENTES_API),
          'alertas de faixas': [{ tipo: 'aviso', mensagem: 'faixa vencida', filial: null }],
        }),
    })

    await expect(obterDashboard(2)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
  })
})
