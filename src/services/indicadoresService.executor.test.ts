import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaJson, simularApi } from '../test/apiFalsa'
import {
  ERRO_ULTIMA_CONSULTA_META,
  INDICADOR_META_CONSULTADO_API,
  INDICADOR_META_ERRO_CONSULTA_API,
  META_VIA_API_COMPLETA,
  SAIDA_META_VIA_API,
  ENTRADA_META_VIA_API,
  ULTIMA_CONSULTA_META_EM,
  URL_META_VIA_API,
  alertasComFonteDaMetaApi,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA } from './api'
import { atualizarIntegracaoIndicador, listarIndicadores } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.11 — Meta via API, executor das integrações no serviço de indicadores (fase 2:
 * `docs/backend/FRONT-meta-via-api-fase2.md` e `docs/backend/API (27).md` — 11/11/2026).
 *
 * - Listagem (Admin, fonte `integracao`): `"ultima consulta em"` e `"erro da ultima consulta"` (texto ou
 *   `null`, opcionais) viram `integracao.ultimaConsultaEm` / `integracao.erroUltimaConsulta`; fora do
 *   formato (não textuais) rejeitam a resposta com `ApiError(200, resposta inválida)`, como os demais
 *   campos da integração.
 * - `"tipo de servico"`: `"soap"`, `"rest"`, `null` ou ausente são aceitos sem rejeitar a lista; o campo
 *   não é enviado em `PUT .../{id}/integracao`.
 * - Topo `"meta via api": { "dado externo": true, integracao: true }` (executor ligado) →
 *   `metaViaApi { dadoExterno: true, integracao: true }`.
 * - `filiais sem meta` da fonte `integracao` preenchida depois da primeira consulta.
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.11 — Meta via API, executor: serviço de indicadores', () => {
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

  function listar(lista: IndicadorApiFalso[] | Record<string, unknown>[], extras: Record<string, unknown> = {}) {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson({ indicadores: lista, alertas: alertasComFonteDaMetaApi(lista as IndicadorApiFalso[]), ...extras }),
    })
    return listarIndicadores()
  }

  describe('listarIndicadores — última consulta e erro', () => {
    it('converte "ultima consulta em" e "erro da ultima consulta" (consultado e com erro)', async () => {
      const { indicadores } = await listar([INDICADOR_META_CONSULTADO_API, INDICADOR_META_ERRO_CONSULTA_API])

      expect(indicadores[0]).toMatchObject({
        id: 16,
        situacaoDaMetaViaApi: 'ok',
        filiaisSemMeta: ['101', '102'],
        integracao: { ultimaConsultaEm: ULTIMA_CONSULTA_META_EM, erroUltimaConsulta: null },
      })
      expect(indicadores[1]).toMatchObject({
        id: 17,
        situacaoDaMetaViaApi: 'erro',
        integracao: { erroUltimaConsulta: ERRO_ULTIMA_CONSULTA_META },
      })
    })

    it.each<[string, Record<string, unknown>]>([
      ['"ultima consulta em" não textual', { 'ultima consulta em': 20261111 }],
      ['"erro da ultima consulta" não textual', { 'erro da ultima consulta': { mensagem: 'falhou' } }],
    ])('%s rejeita a lista com ApiError(200, resposta inválida)', async (_nome, campos) => {
      const erro = await listar([{ ...INDICADOR_META_ERRO_CONSULTA_API, ...campos }]).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('listarIndicadores — "tipo de servico"', () => {
    it.each<[string, Record<string, unknown>]>([
      ['soap', { 'tipo de servico': 'soap' }],
      ['rest', { 'tipo de servico': 'rest' }],
      ['null', { 'tipo de servico': null }],
    ])('"tipo de servico" %s não rejeita a lista', async (_nome, campos) => {
      const { indicadores } = await listar([{ ...INDICADOR_META_CONSULTADO_API, ...campos }])

      expect(indicadores).toHaveLength(1)
      expect(indicadores[0].id).toBe(16)
    })

    it('"tipo de servico" ausente não rejeita a lista', async () => {
      const semTipo: IndicadorApiFalso = { ...INDICADOR_META_CONSULTADO_API }
      delete semTipo['tipo de servico']

      const { indicadores } = await listar([semTipo])

      expect(indicadores).toHaveLength(1)
    })
  })

  it('topo "meta via api" com o executor ligado: metaViaApi { dadoExterno: true, integracao: true }', async () => {
    const resultado = await listar([INDICADOR_META_CONSULTADO_API], { 'meta via api': { ...META_VIA_API_COMPLETA } })

    expect(resultado.metaViaApi).toEqual({ dadoExterno: true, integracao: true })
  })

  it('atualizarIntegracaoIndicador não envia "tipo de servico" (só os quatro campos da integração e o mapeamento da saída)', async () => {
    const chamadas = simularApi(fetchFalso, {
      [`PUT ${ROTA}/16/integracao`]: () => respostaJson({ mensagem: 'integracao atualizada', 'variaveis usadas': [] }),
    })

    await atualizarIntegracaoIndicador(16, {
      identificador: 'META_TICKET',
      url: URL_META_VIA_API,
      parametrosSaida: JSON.stringify(SAIDA_META_VIA_API),
      parametrosEntrada: JSON.stringify(ENTRADA_META_VIA_API),
      mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null },
    })

    const corpo = corpoDaChamada(chamadas[0]) as Record<string, unknown>
    expect(corpo).not.toHaveProperty('tipo de servico')
    expect(Object.keys(corpo).sort()).toEqual([
      'campo da filial',
      'campo da meta',
      'identificador',
      'parametros de entrada',
      'parametros de saida',
      'url',
    ])
  })
})
