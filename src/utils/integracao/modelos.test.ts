import { describe, expect, it } from 'vitest'
import { variaveisIntegracao } from '../../test/dadosExternosFalsos'
import { validarEntrada } from './entrada'
import { valoresDeExemplo } from './exemplos'
import { MODELO_JSON_ENTRADA, MODELO_JSON_SAIDA, MODELO_JSON_SAIDA_META } from './modelos'
import { validarSaida } from './saida'

/**
 * Modelos do atalho "Inserir modelo" (F5.14): precisam ser válidos pelo próprio motor.
 *
 * Alteração de 10/11/2026 (seção 2.3 de `RESPOSTA-FINAL-meta-via-api.md`): "Inserir modelo" da saída
 * gera uma **lista de exemplo** com um item por filial — `MODELO_JSON_SAIDA` (dado externo: `filial`,
 * `valor`, `competencia`) e `MODELO_JSON_SAIDA_META` (indicador: `filial`, `meta`, `competencia`),
 * nessa ordem de campos, com 2 espaços de indentação.
 */
describe('F5.14 — Modelos de JSON da integração (Inserir modelo)', () => {
  /** Itens do modelo, verificando que é uma lista JSON de objetos. */
  function itensDe(modelo: string): Record<string, unknown>[] {
    const valor: unknown = JSON.parse(modelo)
    expect(Array.isArray(valor)).toBe(true)
    return valor as Record<string, unknown>[]
  }

  describe('MODELO_JSON_SAIDA (dado externo)', () => {
    it('é uma lista de exemplo, com ao menos um item, formatada com 2 espaços', () => {
      const itens = itensDe(MODELO_JSON_SAIDA)

      expect(itens.length).toBeGreaterThanOrEqual(1)
      expect(MODELO_JSON_SAIDA).toBe(JSON.stringify(itens, null, 2))
    })

    it('cada item tem filial, valor e competencia (MM/AAAA), nessa ordem', () => {
      for (const item of itensDe(MODELO_JSON_SAIDA)) {
        expect(Object.keys(item)).toEqual(['filial', 'valor', 'competencia'])
        expect(item.competencia).toMatch(/^\d{2}\/\d{4}$/)
      }
    })

    it('é válido para a integração do dado externo, com "3 campos: filial (texto), valor (texto), competencia (texto)"', () => {
      expect(validarSaida(MODELO_JSON_SAIDA, 'valor')).toMatchObject({
        estado: 'valido',
        resumo: '3 campos: filial (texto), valor (texto), competencia (texto)',
      })
    })

    it('não serve para o indicador (falta o campo meta)', () => {
      expect(validarSaida(MODELO_JSON_SAIDA, 'meta')).toEqual({ estado: 'invalido', mensagem: 'Item 1: falta o campo meta' })
    })
  })

  describe('MODELO_JSON_SAIDA_META (indicador)', () => {
    it('é uma lista de exemplo, com ao menos um item, formatada com 2 espaços', () => {
      const itens = itensDe(MODELO_JSON_SAIDA_META)

      expect(itens.length).toBeGreaterThanOrEqual(1)
      expect(MODELO_JSON_SAIDA_META).toBe(JSON.stringify(itens, null, 2))
    })

    it('cada item tem filial, meta e competencia (MM/AAAA), nessa ordem', () => {
      for (const item of itensDe(MODELO_JSON_SAIDA_META)) {
        expect(Object.keys(item)).toEqual(['filial', 'meta', 'competencia'])
        expect(item.competencia).toMatch(/^\d{2}\/\d{4}$/)
      }
    })

    it('é válido para a integração do indicador, com "3 campos: filial (texto), meta (texto), competencia (texto)"', () => {
      expect(validarSaida(MODELO_JSON_SAIDA_META, 'meta')).toMatchObject({
        estado: 'valido',
        resumo: '3 campos: filial (texto), meta (texto), competencia (texto)',
      })
    })

    it('não serve para o dado externo (falta o campo valor)', () => {
      expect(validarSaida(MODELO_JSON_SAIDA_META, 'valor')).toEqual({ estado: 'invalido', mensagem: 'Item 1: falta o campo valor' })
    })
  })

  it('MODELO_JSON_ENTRADA é o exemplo do documento, com 2 espaços de indentação', () => {
    const exemplo = {
      filial: '%filial%',
      competencia: '%competencia%',
      inicio: '%dataInicial% - 3m',
      fim: '%dataFinal%',
      dias: '%dataFinal% - %dataInicial% + 1',
    }

    expect(MODELO_JSON_ENTRADA).toBe(JSON.stringify(exemplo, null, 2))
  })

  it('MODELO_JSON_ENTRADA é válido com as variáveis da API', () => {
    const contexto = {
      variaveis: variaveisIntegracao(),
      valores: valoresDeExemplo({ hoje: new Date(2026, 9, 15), mesesRetro: 3, diaColeta: null }),
    }

    expect(validarEntrada(MODELO_JSON_ENTRADA, contexto)).toMatchObject({ estado: 'valido' })
  })
})
