import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaJson, simularApi } from '../test/apiFalsa'
import {
  ENTRADA_META_VIA_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_COM_COMPETENCIA_API,
  INDICADOR_META_SAIDA_ANTIGA_API,
  MAPEAMENTO_META_VIA_API,
  SAIDA_META_COM_COMPETENCIA,
  SAIDA_META_VIA_API,
  SAIDA_META_VIA_API_ANTIGA,
  URL_META_VIA_API,
  alertasApi,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import type { IntegracaoDadoExterno, MapeamentoSaida } from '../types/dominio'
import { atualizarIntegracaoIndicador, listarIndicadores } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.11 — Saída da integração da meta por "chave: tipo" no serviço de indicadores
 * (docs/propostas-backend/FRONT-saida-chave-tipo.md, 11/11/2026 — opção B do back-end):
 * - `atualizarIntegracaoIndicador(id, integracao)`: `PUT .../{id}/integracao` com `identificador`, `url`,
 *   `"parametros de saida"` (texto, como digitado), `"parametros de entrada"` e o mapeamento da saída do
 *   indicador: `"campo da filial"` (`mapeamento.campoFilial`), `"campo da meta"` (`mapeamento.campoMeta`) e
 *   `"campo da competencia"` (`mapeamento.campoCompetencia`, OMITIDO quando `null`, ausente ou vazio).
 *   `"campo do valor"` é só do dado externo e nunca vai no corpo do indicador;
 * - listagem (Admin, fonte `integracao`): `"mapeamento da saida"` objeto ou `null`; `"parametros de saida"`
 *   objeto (novo) ou lista (antigo). Mapeamento fora do formato (não objeto, sem `"campo da filial"` em
 *   texto não vazio) vira `mapeamentoSaida: null` SEM rejeitar a lista (mesma regra do dado externo, F1.3).
 */
const ROTA = '/api/ped/indicadores-cadastro'
const SAIDA = JSON.stringify(SAIDA_META_VIA_API, null, 2)
const ENTRADA = JSON.stringify(ENTRADA_META_VIA_API, null, 2)
const RESPOSTA_OK = { mensagem: 'integracao atualizada', 'variaveis usadas': ['competencia', 'empresas'] }

function integracao(mapeamento: MapeamentoSaida, sobrescrever: Partial<IntegracaoDadoExterno> = {}): IntegracaoDadoExterno {
  return { identificador: 'META_MARGEM', url: URL_META_VIA_API, parametrosSaida: SAIDA, parametrosEntrada: ENTRADA, mapeamento, ...sobrescrever }
}

describe('F6.11 — Saída "chave: tipo": serviço de indicadores', () => {
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

  describe('atualizarIntegracaoIndicador — mapeamento da saída no corpo', () => {
    async function enviar(dados: IntegracaoDadoExterno) {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: () => respostaJson(RESPOSTA_OK) })
      await atualizarIntegracaoIndicador(11, dados)
      expect(chamadas).toHaveLength(1)
      return corpoDaChamada(chamadas[0]) as Record<string, unknown>
    }

    it('sem competência: envia "campo da filial" e "campo da meta", sem "campo da competencia" nem "campo do valor"', async () => {
      const corpo = await enviar(integracao({ campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null }))

      expect(corpo).toEqual({
        identificador: 'META_MARGEM',
        url: URL_META_VIA_API,
        'parametros de saida': SAIDA,
        'parametros de entrada': ENTRADA,
        'campo da filial': 'codfil',
        'campo da meta': 'metVlr',
      })
      expect(corpo).not.toHaveProperty('campo da competencia')
      expect(corpo).not.toHaveProperty('campo do valor')
    })

    it('com competência: envia também "campo da competencia"', async () => {
      const saida = JSON.stringify(SAIDA_META_COM_COMPETENCIA, null, 2)

      const corpo = await enviar(
        integracao({ campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: 'data' }, { parametrosSaida: saida }),
      )

      expect(corpo).toEqual({
        identificador: 'META_MARGEM',
        url: URL_META_VIA_API,
        'parametros de saida': saida,
        'parametros de entrada': ENTRADA,
        'campo da filial': 'codfil',
        'campo da meta': 'metVlr',
        'campo da competencia': 'data',
      })
    })

    it.each<[string, MapeamentoSaida]>([
      ['ausente (undefined)', { campoFilial: 'codfil', campoMeta: 'metVlr' }],
      ['texto vazio', { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: '' }],
    ])('"campo da competencia" %s é omitido do corpo', async (_nome, mapeamento) => {
      const corpo = await enviar(integracao(mapeamento))

      expect(corpo).not.toHaveProperty('campo da competencia')
      expect(corpo).toMatchObject({ 'campo da filial': 'codfil', 'campo da meta': 'metVlr' })
    })

    it('"parametros de saida" vai como o texto digitado (não como objeto)', async () => {
      const digitado = '{ "codfil": "string", "metVlr": "number" }'

      const corpo = await enviar(integracao({ campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null }, { parametrosSaida: digitado }))

      expect(corpo['parametros de saida']).toBe(digitado)
    })

    it('campoValor informado por engano não vira "campo do valor" no corpo do indicador', async () => {
      const corpo = await enviar(integracao({ campoFilial: 'codfil', campoMeta: 'metVlr', campoValor: 'metVlr', campoCompetencia: null }))

      expect(corpo).not.toHaveProperty('campo do valor')
      expect(corpo['campo da meta']).toBe('metVlr')
    })
  })

  describe('listarIndicadores — "mapeamento da saida" e "parametros de saida"', () => {
    function listar(lista: IndicadorApiFalso[]) {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ indicadores: lista, alertas: alertasApi(lista) }) })
      return listarIndicadores()
    }

    it('formato novo e antigo na mesma lista: saída objeto com mapeamento; saída lista com mapeamento null', async () => {
      const { indicadores } = await listar([INDICADOR_META_API_CONFIGURADO_API, INDICADOR_META_SAIDA_ANTIGA_API, INDICADOR_META_COM_COMPETENCIA_API])

      expect(indicadores[0].integracao).toMatchObject({
        parametrosSaida: SAIDA_META_VIA_API,
        mapeamentoSaida: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null },
      })
      expect(indicadores[1].integracao).toMatchObject({ parametrosSaida: SAIDA_META_VIA_API_ANTIGA, mapeamentoSaida: null })
      expect(indicadores[2].integracao?.mapeamentoSaida).toEqual({ campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: 'data' })
    })

    it('"mapeamento da saida" null ou ausente não rejeita a lista', async () => {
      const semMapeamento: IndicadorApiFalso = { ...INDICADOR_META_API_CONFIGURADO_API }
      delete semMapeamento['mapeamento da saida']

      const { indicadores } = await listar([{ ...INDICADOR_META_API_CONFIGURADO_API, id: 20, 'mapeamento da saida': null }, semMapeamento])

      expect(indicadores.map((i) => i.integracao?.mapeamentoSaida)).toEqual([null, null])
    })

    it.each<[string, unknown]>([
      ['texto', 'codfil'],
      ['lista', ['codfil', 'metVlr']],
      ['sem "campo da filial"', { 'campo da meta': 'metVlr' }],
      ['"campo da filial" não textual', { ...MAPEAMENTO_META_VIA_API, 'campo da filial': 10 }],
      ['"campo da filial" vazio', { ...MAPEAMENTO_META_VIA_API, 'campo da filial': '' }],
    ])('"mapeamento da saida" fora do formato (%s) vira mapeamentoSaida null sem rejeitar a lista', async (_nome, mapeamento) => {
      const { indicadores } = await listar([
        { ...INDICADOR_META_API_CONFIGURADO_API, 'mapeamento da saida': mapeamento as IndicadorApiFalso['mapeamento da saida'] },
      ])

      expect(indicadores).toHaveLength(1)
      expect(indicadores[0].integracao?.mapeamentoSaida).toBeNull()
    })
  })
})
