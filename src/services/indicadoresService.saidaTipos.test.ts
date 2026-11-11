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
import type { IntegracaoDadoExterno } from '../types/dominio'
import { atualizarIntegracaoIndicador, listarIndicadores } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.11 — Saída da integração da meta por "chave: tipo" no serviço de indicadores
 * (docs/propostas-backend/FRONT-saida-chave-tipo.md, 11/11/2026 — opção B do back-end).
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): os parâmetros
 * de saída só mostram ao back-end a saída esperada do web service; não há amarração.
 * - `atualizarIntegracaoIndicador(id, integracao)`: `PUT .../{id}/integracao` com **só** `identificador`,
 *   `url`, `"parametros de saida"` (texto, como digitado) e `"parametros de entrada"`. Nunca vão
 *   `"campo da filial"`, `"campo da meta"`, `"campo do valor"` nem `"campo da competencia"`;
 * - listagem (Admin, fonte `integracao`): `"parametros de saida"` objeto (novo) ou lista (antigo), como veio;
 *   o `"mapeamento da saida"` que o back-end ainda pode devolver é ignorado (sem `mapeamentoSaida`), sem
 *   rejeitar a lista.
 */
const ROTA = '/api/ped/indicadores-cadastro'
const SAIDA = JSON.stringify(SAIDA_META_VIA_API, null, 2)
const ENTRADA = JSON.stringify(ENTRADA_META_VIA_API, null, 2)
const RESPOSTA_OK = { mensagem: 'integracao atualizada', 'variaveis usadas': ['competencia', 'empresas'] }

function integracao(sobrescrever: Partial<IntegracaoDadoExterno> = {}): IntegracaoDadoExterno {
  return { identificador: 'META_MARGEM', url: URL_META_VIA_API, parametrosSaida: SAIDA, parametrosEntrada: ENTRADA, ...sobrescrever }
}

describe('F6.11 — Saída "chave: tipo": serviço de indicadores (sem mapeamento)', () => {
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

  describe('atualizarIntegracaoIndicador — corpo só com os quatro campos', () => {
    async function enviar(dados: IntegracaoDadoExterno) {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: () => respostaJson(RESPOSTA_OK) })
      await atualizarIntegracaoIndicador(11, dados)
      expect(chamadas).toHaveLength(1)
      return corpoDaChamada(chamadas[0]) as Record<string, unknown>
    }

    it('envia identificador, url e os dois JSONs, e nada mais', async () => {
      const corpo = await enviar(integracao())

      expect(corpo).toStrictEqual({
        identificador: 'META_MARGEM',
        url: URL_META_VIA_API,
        'parametros de saida': SAIDA,
        'parametros de entrada': ENTRADA,
      })
    })

    it('saída com o campo de competência: vai só o texto da saída, sem "campo da competencia"', async () => {
      const saida = JSON.stringify(SAIDA_META_COM_COMPETENCIA, null, 2)

      const corpo = await enviar(integracao({ parametrosSaida: saida }))

      expect(corpo).toStrictEqual({
        identificador: 'META_MARGEM',
        url: URL_META_VIA_API,
        'parametros de saida': saida,
        'parametros de entrada': ENTRADA,
      })
    })

    it('mapeamento informado por um chamador antigo não vai no corpo', async () => {
      const comMapeamento = {
        ...integracao(),
        mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoValor: 'metVlr', campoCompetencia: 'data' },
      } as IntegracaoDadoExterno

      const corpo = await enviar(comMapeamento)

      for (const chave of ['campo da filial', 'campo da meta', 'campo do valor', 'campo da competencia', 'mapeamento']) {
        expect(corpo).not.toHaveProperty([chave])
      }
    })

    it('"parametros de saida" vai como o texto digitado (não como objeto)', async () => {
      const digitado = '{ "codfil": "string", "metVlr": "number" }'

      const corpo = await enviar(integracao({ parametrosSaida: digitado }))

      expect(corpo['parametros de saida']).toBe(digitado)
    })
  })

  describe('listarIndicadores — "parametros de saida" como veio e "mapeamento da saida" ignorado', () => {
    function listar(lista: IndicadorApiFalso[]) {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ indicadores: lista, alertas: alertasApi(lista) }) })
      return listarIndicadores()
    }

    it('formato novo e antigo na mesma lista: saída objeto ou lista, sem mapeamentoSaida', async () => {
      const { indicadores } = await listar([INDICADOR_META_API_CONFIGURADO_API, INDICADOR_META_SAIDA_ANTIGA_API, INDICADOR_META_COM_COMPETENCIA_API])

      expect(indicadores.map((i) => i.integracao?.parametrosSaida)).toEqual([
        SAIDA_META_VIA_API,
        SAIDA_META_VIA_API_ANTIGA,
        SAIDA_META_COM_COMPETENCIA,
      ])
      for (const indicador of indicadores) expect(indicador.integracao).not.toHaveProperty('mapeamentoSaida')
    })

    it.each<[string, unknown]>([
      ['null', null],
      ['texto', 'codfil'],
      ['lista', ['codfil', 'metVlr']],
      ['sem "campo da filial"', { 'campo da meta': 'metVlr' }],
      ['"campo da filial" não textual', { ...MAPEAMENTO_META_VIA_API, 'campo da filial': 10 }],
    ])('"mapeamento da saida" %s não rejeita a lista', async (_nome, mapeamento) => {
      const { indicadores } = await listar([
        { ...INDICADOR_META_API_CONFIGURADO_API, 'mapeamento da saida': mapeamento as IndicadorApiFalso['mapeamento da saida'] },
      ])

      expect(indicadores).toHaveLength(1)
      expect(indicadores[0].integracao?.parametrosSaida).toEqual(SAIDA_META_VIA_API)
      expect(indicadores[0].integracao).not.toHaveProperty('mapeamentoSaida')
    })
  })
})
