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
} from '../test/indicadoresFalsos'
import { type IndicadorApi, paraIndicador } from './adaptadores'

/**
 * F6.11 — Saída da integração da meta por "chave: tipo" (docs/propostas-backend/FRONT-saida-chave-tipo.md,
 * 11/11/2026, opção B do back-end) no adaptador do indicador (fonte `integracao`, só o Admin):
 * - `"parametros de saida"` vem como objeto `{ chave: tipo }` (formato novo) ou lista (formato antigo) e
 *   entra no domínio como veio (`IntegracaoDoIndicador.parametrosSaida`).
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `RESPOSTA-FRONT-saida-sem-mapeamento.md`): o
 * `"mapeamento da saida"` que o back-end ainda pode devolver é **ignorado** — `IntegracaoDoIndicador` não tem
 * mais `mapeamentoSaida` — e nenhum valor do campo rejeita o indicador.
 */
describe('F6.11 — Saída "chave: tipo": adaptador do indicador (sem mapeamento da saída)', () => {
  it('formato novo: parametrosSaida é o objeto { chave: tipo }, sem mapeamentoSaida', () => {
    const indicador = paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi)

    expect(indicador.integracao?.parametrosSaida).toEqual(SAIDA_META_VIA_API)
    expect(indicador.integracao).not.toHaveProperty('mapeamentoSaida')
  })

  it('formato novo com o campo de competência na saída: parametrosSaida como veio, sem mapeamentoSaida', () => {
    const indicador = paraIndicador(INDICADOR_META_COM_COMPETENCIA_API as IndicadorApi)

    expect(indicador.integracao?.parametrosSaida).toEqual(SAIDA_META_COM_COMPETENCIA)
    expect(indicador.integracao).not.toHaveProperty('mapeamentoSaida')
  })

  it('formato antigo (saída em lista): parametrosSaida é a lista, sem mapeamentoSaida', () => {
    const indicador = paraIndicador(INDICADOR_META_SAIDA_ANTIGA_API as IndicadorApi)

    expect(indicador.integracao?.parametrosSaida).toEqual(SAIDA_META_VIA_API_ANTIGA)
    expect(indicador.integracao).not.toHaveProperty('mapeamentoSaida')
  })

  it.each<[string, unknown]>([
    ['objeto do formato anterior', { ...MAPEAMENTO_META_VIA_API }],
    ['null', null],
    ['texto', 'codfil'],
    ['"campo da filial" não textual', { ...MAPEAMENTO_META_VIA_API, 'campo da filial': 10 }],
  ])('"mapeamento da saida" %s é ignorado, sem rejeitar o indicador', (_nome, mapeamento) => {
    const indicador = paraIndicador({ ...INDICADOR_META_API_CONFIGURADO_API, 'mapeamento da saida': mapeamento } as IndicadorApi)

    expect(indicador.integracao?.parametrosSaida).toEqual(SAIDA_META_VIA_API)
    expect(indicador.integracao).not.toHaveProperty('mapeamentoSaida')
  })

  it('integração pendente e Validador (sem os campos do Admin): sem mapeamentoSaida', () => {
    expect(paraIndicador(INDICADOR_META_API_PENDENTE_API as IndicadorApi).integracao).not.toHaveProperty('mapeamentoSaida')
    expect(paraIndicador(comoValidadorRecebe(INDICADOR_META_API_CONFIGURADO_API) as IndicadorApi).integracao).not.toHaveProperty(
      'mapeamentoSaida',
    )
  })
})
