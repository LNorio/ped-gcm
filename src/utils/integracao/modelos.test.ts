import { describe, expect, it } from 'vitest'
import { variaveisIntegracao } from '../../test/dadosExternosFalsos'
import { validarEntrada } from './entrada'
import { valoresDeExemplo } from './exemplos'
import * as modelos from './modelos'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA } from './modelos'
import { validarSaida } from './saida'

/**
 * Modelos do atalho "Inserir modelo" (F5.14): precisam ser válidos pelo próprio motor.
 *
 * Alteração de 11/11/2026 (saída por "chave: tipo" — `docs/propostas-backend/FRONT-saida-chave-tipo.md`,
 * seção 6): "Inserir modelo" da saída gera o **objeto** `{ "campo": "tipo" }`, com 2 espaços. A lista de
 * exemplo com um item por filial (10/11/2026) deixa de valer.
 *
 * Alteração de 11/11/2026 (contrato final — `docs/backend/RESPOSTA-saida-sem-mapeamento (1).md`, seção 4, e
 * `docs/backend/FRONT-saida-chave-tipo (1).md`, seção 5): a saída é só documentação para o dev back-end e os
 * nomes são livres; o modelo passa a ser **um só, genérico**, para dado externo e indicador:
 * `MODELO_JSON_SAIDA` = `{ "codigo_filial": "string", "quantidade": "number", "data": "date" }`.
 * `MODELO_JSON_SAIDA_META` (`codfil`/`metVlr`) foi removido do módulo.
 */
describe('F5.14 — Modelos de JSON da integração (Inserir modelo)', () => {
  describe('MODELO_JSON_SAIDA (único, para dado externo e indicador)', () => {
    it('é { "codigo_filial": "string", "quantidade": "number", "data": "date" }, formatado com 2 espaços', () => {
      expect(MODELO_JSON_SAIDA).toBe(JSON.stringify({ codigo_filial: 'string', quantidade: 'number', data: 'date' }, null, 2))
    })

    it('é válido, com "3 campos: codigo_filial (string), quantidade (number), data (date)"', () => {
      const esperado = {
        estado: 'valido',
        campos: [
          { nome: 'codigo_filial', tipo: 'string' },
          { nome: 'quantidade', tipo: 'number' },
          { nome: 'data', tipo: 'date' },
        ],
        resumo: '3 campos: codigo_filial (string), quantidade (number), data (date)',
      }

      expect(validarSaida(MODELO_JSON_SAIDA, 'valor')).toEqual(esperado)
      expect(validarSaida(MODELO_JSON_SAIDA, 'meta')).toEqual(esperado)
    })

    it('não é uma lista', () => {
      expect(Array.isArray(JSON.parse(MODELO_JSON_SAIDA))).toBe(false)
    })

    it('não existe mais um modelo separado para o indicador (MODELO_JSON_SAIDA_META)', () => {
      expect(modelos).not.toHaveProperty('MODELO_JSON_SAIDA_META')
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
