import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_GERENTES_API,
  detalheDashboardApi,
  previaTarefaApi,
  respostaGravacaoApi,
} from '../test/dashboardsFalsos'
import type { DadosDashboard } from '../types/dominio'
import { MENSAGEM_RESPOSTA_INVALIDA } from './api'
import { atualizarDashboard, criarDashboard, obterDashboard, obterPreviaTarefa } from './dashboardsService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dashboards'

/**
 * Contrato proposto em `docs/propostas-backend/PROPOSTA-calculo-no-periodo-dashboard.md` (25/11/2026):
 * em cada item de `indicadores`, junto de "pontos base", vai `"calculo do periodo": "soma" | "media" | "ultimo"`
 * quando a periodicidade não é mensal; na leitura do detalhe, o mesmo campo vira `calculoNoPeriodo`
 * (ausente ou `null` → `null`; fora do enum → resposta inválida, como os demais enums do detalhe).
 */
const TRIMESTRAL: DadosDashboard = {
  nome: 'PED Trimestral',
  periodicidade: 'trimestral',
  pontuacaoBaseMaxima: 100,
  tipoVinculo: 'filiais',
  itensVinculados: ['100'],
  indicadores: [
    { idIndicador: 7, pontosBase: 40, calculoNoPeriodo: 'soma' },
    { idIndicador: 9, pontosBase: 60, calculoNoPeriodo: 'media' },
  ],
  indicadorBaseDaFaixa: 7,
  formulaDePontuacao: 'Soma simples.',
  observacaoParaTi: null,
}

const INDICADORES_TRIMESTRAL = [
  { 'id indicador': 7, 'pontos base': 40, 'calculo do periodo': 'soma' },
  { 'id indicador': 9, 'pontos base': 60, 'calculo do periodo': 'media' },
]

describe('F7.15 — Serviço de dashboards: cálculo no período dos indicadores em dashboard não mensal', () => {
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

  describe('gravação: "calculo do periodo" em cada indicador do corpo', () => {
    it('criarDashboard (POST) envia "calculo do periodo" de cada indicador, junto de "pontos base"', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoApi(DASHBOARD_COMERCIAL_API), 201),
      })

      await criarDashboard(TRIMESTRAL)

      expect(corpoDaChamada(chamadas[0])).toMatchObject({ periodicidade: 'trimestral', indicadores: INDICADORES_TRIMESTRAL })
    })

    it('atualizarDashboard (PUT) envia "calculo do periodo" de cada indicador', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/1`]: () => respostaJson(respostaGravacaoApi(DASHBOARD_COMERCIAL_API)),
      })

      await atualizarDashboard(1, { ...TRIMESTRAL, indicadores: [{ idIndicador: 7, pontosBase: 100, calculoNoPeriodo: 'ultimo' }], enviarTarefaTi: false })

      expect(corpoDaChamada(chamadas[0])).toMatchObject({
        indicadores: [{ 'id indicador': 7, 'pontos base': 100, 'calculo do periodo': 'ultimo' }],
        'enviar tarefa ti': false,
      })
    })

    it('obterPreviaTarefa (POST previa-tarefa) envia o mesmo corpo, com "calculo do periodo" (a TI precisa dele)', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}/previa-tarefa`]: () => respostaJson(previaTarefaApi('PED Trimestral')),
      })

      await obterPreviaTarefa(TRIMESTRAL)

      expect(corpoDaChamada(chamadas[0])).toMatchObject({ indicadores: INDICADORES_TRIMESTRAL })
    })

    it('dashboard mensal: "calculo do periodo" não é enviado, mesmo que o dado traga o valor', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoApi(DASHBOARD_GERENTES_API), 201),
      })

      await criarDashboard({ ...TRIMESTRAL, periodicidade: 'mensal' })

      const corpo = corpoDaChamada(chamadas[0]) as { indicadores: Array<Record<string, unknown>> }
      expect(corpo.indicadores).toEqual([
        { 'id indicador': 7, 'pontos base': 40 },
        { 'id indicador': 9, 'pontos base': 60 },
      ])
      for (const item of corpo.indicadores) expect(item).not.toHaveProperty('calculo do periodo')
    })
  })

  describe('detalhe (GET /api/ped/dashboards/{id}): "calculo do periodo" vira calculoNoPeriodo', () => {
    it.each(['soma', 'media', 'ultimo'] as const)('"%s" é lido em cada indicador', async (valor) => {
      const detalhe = detalheDashboardApi(DASHBOARD_COMERCIAL_API)
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1`]: () =>
          respostaJson({ ...detalhe, indicadores: detalhe.indicadores.map((item) => ({ ...item, 'calculo do periodo': valor })) }),
      })

      const convertido = await obterDashboard(1)

      expect(convertido.indicadores.map((item) => item.calculoNoPeriodo)).toEqual([valor, valor])
    })

    it('valores diferentes por indicador, na ordem da API (PED Comercial: Cobertura "media", Faturamento "soma")', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(detalheDashboardApi(DASHBOARD_COMERCIAL_API)) })

      const convertido = await obterDashboard(1)

      expect(convertido.indicadores.map((item) => [item.id, item.calculoNoPeriodo])).toEqual([
        [1, 'media'],
        [3, 'soma'],
      ])
    })

    it.each<[string, unknown]>([
      ['ausente', undefined],
      ['null', null],
    ])('"calculo do periodo" %s vira calculoNoPeriodo null (dashboard mensal ou cadastrado antes da mudança)', async (_caso, valor) => {
      const detalhe = detalheDashboardApi(DASHBOARD_COMERCIAL_API)
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1`]: () =>
          respostaJson({
            ...detalhe,
            indicadores: detalhe.indicadores.map(({ 'calculo do periodo': _calculo, ...item }) =>
              valor === undefined ? item : { ...item, 'calculo do periodo': valor },
            ),
          }),
      })

      const convertido = await obterDashboard(1)

      expect(convertido.indicadores.map((item) => item.calculoNoPeriodo)).toEqual([null, null])
    })

    it('dashboard mensal sem o campo (PED Gerentes): calculoNoPeriodo null em todos os indicadores', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/2`]: () => respostaJson(detalheDashboardApi(DASHBOARD_GERENTES_API)) })

      const convertido = await obterDashboard(2)

      expect(convertido.indicadores.map((item) => item.calculoNoPeriodo)).toEqual([null, null])
    })

    it.each<[string, unknown]>([
      ['fora do enum ("quinzenal")', 'quinzenal'],
      ['com o rótulo da tela ("Somar")', 'Somar'],
      ['texto vazio', ''],
      ['número', 1],
      ['objeto', { valor: 'soma' }],
    ])('"calculo do periodo" %s vira ApiError "resposta inválida" (como os demais enums do detalhe)', async (_caso, valor) => {
      const detalhe = detalheDashboardApi(DASHBOARD_COMERCIAL_API)
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1`]: () =>
          respostaJson({ ...detalhe, indicadores: [{ ...detalhe.indicadores[0], 'calculo do periodo': valor }, detalhe.indicadores[1]] }),
      })

      await expect(obterDashboard(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })
})
