import { describe, expect, it } from 'vitest'
import {
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_COM_COMPETENCIA_API,
  INDICADOR_META_SAIDA_ANTIGA_API,
  MAPEAMENTO_META_VIA_API,
  SAIDA_META_COM_COMPETENCIA,
  SAIDA_META_VIA_API,
  SAIDA_META_VIA_API_ANTIGA,
  comoValidadorRecebe,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import { type IndicadorApi, paraIndicador } from './adaptadores'

/**
 * F6.11 — Saída da integração da meta por "chave: tipo" (docs/propostas-backend/FRONT-saida-chave-tipo.md,
 * 11/11/2026, opção B do back-end) no adaptador do indicador (fonte `integracao`, só o Admin):
 * - `"parametros de saida"` vem como objeto `{ chave: tipo }` (formato novo) ou lista (formato antigo) e
 *   entra no domínio como veio (`IntegracaoDoIndicador.parametrosSaida`);
 * - `"mapeamento da saida"` → `IntegracaoDoIndicador.mapeamentoSaida: MapeamentoSaida | null`:
 *   `{ campoFilial, campoMeta, campoCompetencia }` (de `"campo da filial"`, `"campo da meta"`,
 *   `"campo da competencia"`; competência ausente, `null` ou vazia → `null`);
 *   ausente/`null` → `null`; formato antigo (saída em lista) → `null`, mesmo que o mapeamento venha.
 */
describe('F6.11 — Saída "chave: tipo": adaptador do indicador (mapeamento da saída)', () => {
  it('formato novo: parametrosSaida é o objeto { chave: tipo } e mapeamentoSaida traz filial e meta (competência null)', () => {
    const indicador = paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi)

    expect(indicador.integracao?.parametrosSaida).toEqual(SAIDA_META_VIA_API)
    expect(indicador.integracao?.mapeamentoSaida).toEqual({ campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null })
  })

  it('formato novo com "campo da competencia": mapeamentoSaida com campoCompetencia', () => {
    const indicador = paraIndicador(INDICADOR_META_COM_COMPETENCIA_API as IndicadorApi)

    expect(indicador.integracao?.parametrosSaida).toEqual(SAIDA_META_COM_COMPETENCIA)
    expect(indicador.integracao?.mapeamentoSaida).toEqual({ campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: 'data' })
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['texto vazio', ''],
  ])('"campo da competencia" %s vira campoCompetencia null', (_nome, valor) => {
    const indicador = paraIndicador({
      ...INDICADOR_META_API_CONFIGURADO_API,
      'mapeamento da saida': { ...MAPEAMENTO_META_VIA_API, 'campo da competencia': valor },
    } as IndicadorApi)

    expect(indicador.integracao?.mapeamentoSaida).toEqual({ campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null })
  })

  it('formato antigo (saída em lista, "mapeamento da saida" null): parametrosSaida é a lista e mapeamentoSaida null', () => {
    const indicador = paraIndicador(INDICADOR_META_SAIDA_ANTIGA_API as IndicadorApi)

    expect(indicador.integracao?.parametrosSaida).toEqual(SAIDA_META_VIA_API_ANTIGA)
    expect(indicador.integracao?.mapeamentoSaida).toBeNull()
  })

  it('saída em lista com mapeamento informado (incoerente): o formato decide e mapeamentoSaida fica null', () => {
    const indicador = paraIndicador({
      ...INDICADOR_META_SAIDA_ANTIGA_API,
      'mapeamento da saida': { ...MAPEAMENTO_META_VIA_API },
    } as IndicadorApi)

    expect(indicador.integracao?.mapeamentoSaida).toBeNull()
  })

  it('"mapeamento da saida" ausente (API anterior) → mapeamentoSaida null', () => {
    const semMapeamento: IndicadorApiFalso = { ...INDICADOR_META_API_CONFIGURADO_API }
    delete semMapeamento['mapeamento da saida']

    expect(paraIndicador(semMapeamento as IndicadorApi).integracao?.mapeamentoSaida).toBeNull()
  })

  it('integração pendente (sem saída salva) → mapeamentoSaida null', () => {
    expect(paraIndicador(INDICADOR_META_API_PENDENTE_API as IndicadorApi).integracao?.mapeamentoSaida).toBeNull()
  })

  it('Validador (sem os campos do Admin) → mapeamentoSaida null', () => {
    const indicador = paraIndicador(comoValidadorRecebe(INDICADOR_META_API_CONFIGURADO_API) as IndicadorApi)

    expect(indicador.integracao?.mapeamentoSaida).toBeNull()
  })
})
