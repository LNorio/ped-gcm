import { describe, expect, it } from 'vitest'
import { variaveisIntegracao } from '../../test/dadosExternosFalsos'
import { validarEntrada } from './entrada'
import { valoresDeExemplo } from './exemplos'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA, MODELO_JSON_SAIDA_META } from './modelos'
import { validarSaida } from './saida'

/**
 * Modelos do atalho "Inserir modelo" (F5.14): precisam ser válidos pelo próprio motor.
 *
 * Alteração de 11/11/2026 (saída por "chave: tipo" — `docs/propostas-backend/FRONT-saida-chave-tipo.md`,
 * seção 6): "Inserir modelo" da saída gera o **objeto** `{ "campo": "tipo" }` do documento, com 2 espaços:
 * `MODELO_JSON_SAIDA` (dado externo) = `{ "codfil": "string", "vlrLiq": "number" }` e
 * `MODELO_JSON_SAIDA_META` (indicador) = `{ "codfil": "string", "metVlr": "number" }`. A lista de exemplo
 * com um item por filial (10/11/2026) deixa de valer.
 */
describe('F5.14 — Modelos de JSON da integração (Inserir modelo)', () => {
  describe('MODELO_JSON_SAIDA (dado externo)', () => {
    it('é { "codfil": "string", "vlrLiq": "number" }, formatado com 2 espaços', () => {
      expect(MODELO_JSON_SAIDA).toBe(JSON.stringify({ codfil: 'string', vlrLiq: 'number' }, null, 2))
    })

    it('é válido, com "2 campos: codfil (string), vlrLiq (number)"', () => {
      expect(validarSaida(MODELO_JSON_SAIDA, 'valor')).toEqual({
        estado: 'valido',
        campos: [
          { nome: 'codfil', tipo: 'string' },
          { nome: 'vlrLiq', tipo: 'number' },
        ],
        resumo: '2 campos: codfil (string), vlrLiq (number)',
      })
    })

    it('não é mais uma lista', () => {
      expect(Array.isArray(JSON.parse(MODELO_JSON_SAIDA))).toBe(false)
    })
  })

  describe('MODELO_JSON_SAIDA_META (indicador)', () => {
    it('é { "codfil": "string", "metVlr": "number" }, formatado com 2 espaços', () => {
      expect(MODELO_JSON_SAIDA_META).toBe(JSON.stringify({ codfil: 'string', metVlr: 'number' }, null, 2))
    })

    it('é válido, com "2 campos: codfil (string), metVlr (number)"', () => {
      expect(validarSaida(MODELO_JSON_SAIDA_META, 'meta')).toMatchObject({
        estado: 'valido',
        resumo: '2 campos: codfil (string), metVlr (number)',
      })
    })
  })

  /**
   * Alteração de 11/11/2026 (executor — `FRONT-meta-via-api-fase2.md`, seção 2.1): "Inserir modelo" da
   * entrada gera o formato SOAP `{ operacao, parametros }` do documento, com 2 espaços.
   */
  it('MODELO_JSON_ENTRADA é o modelo SOAP do documento ({ operacao, parametros }), com 2 espaços de indentação', () => {
    const exemplo = {
      operacao: 'NomeDaOperacao',
      parametros: { EDatIni: '%dataInicial%', EDatFim: '%dataFinal%', ECodEmp: '%empresas%' },
    }

    expect(MODELO_JSON_ENTRADA).toBe(JSON.stringify(exemplo, null, 2))
  })

  it('MODELO_JSON_ENTRADA é válido com as variáveis da API, sem avisos (não usa %filial%)', () => {
    const contexto = {
      variaveis: variaveisIntegracao(),
      valores: valoresDeExemplo({ hoje: new Date(2026, 9, 15), mesesRetro: 3, diaColeta: null }),
    }

    expect(validarEntrada(MODELO_JSON_ENTRADA, contexto)).toEqual({
      estado: 'valido',
      variaveisUsadas: ['dataInicial', 'dataFinal', 'empresas'],
      calculos: [],
      previa: JSON.stringify(
        { operacao: 'NomeDaOperacao', parametros: { EDatIni: '01/10/2026', EDatFim: '31/10/2026', ECodEmp: '1,6,7,8,9' } },
        null,
        2,
      ),
      avisos: [],
    })
  })
})
