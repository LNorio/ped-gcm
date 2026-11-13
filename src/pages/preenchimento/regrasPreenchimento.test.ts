import { describe, expect, it } from 'vitest'
import { formatarValorLancamento, lerValorDigitado, mensagemSucessoPreenchimento } from './regrasPreenchimento'

const INVALIDO = 'Informe um número válido, com vírgula decimal (ex.: 1.234,56).'
const NEGATIVO = 'O valor não pode ser negativo.'

/**
 * Regras puras do lançamento (F9.6 — RF-66, RNF-03):
 * - `lerValorDigitado(tipoValor, texto)` converte o que o usuário digitou no valor a enviar à API
 *   (número já convertido, ou `true`/`false` no booleano, que chega como `'sim'`/`'nao'`). Vazio não é
 *   erro (o apontamento simplesmente não entra no lote).
 * - `formatarValorLancamento` mostra o valor lançado no padrão pt-BR (2 casas — RN-10; "%" na
 *   porcentagem; Sim/Não no booleano; "—" sem lançamento).
 * - `mensagemSucessoPreenchimento` monta a notificação a partir de `lancados`/`corrigidos` da resposta.
 */
describe('F9.6 — regrasPreenchimento (leitura e formatação dos valores do lançamento)', () => {
  describe('lerValorDigitado — Numeral e Porcentagem (decimal com vírgula, não negativo)', () => {
    it.each([
      ['numeral', '1.234,56', 1234.56],
      ['numeral', '1234,56', 1234.56],
      ['numeral', '2.000', 2000],
      ['numeral', '0', 0],
      ['numeral', '0,5', 0.5],
      ['numeral', '  12,5  ', 12.5],
      ['porcentagem', '80,5', 80.5],
      ['porcentagem', '100', 100],
      ['porcentagem', '0', 0],
    ] as const)('%s "%s" → %d', (tipoValor, texto, esperado) => {
      expect(lerValorDigitado(tipoValor, texto)).toEqual({ valor: esperado, erro: null })
    })

    it.each([
      ['numeral', '-1'],
      ['numeral', '-0,5'],
      ['porcentagem', '-3'],
    ] as const)('%s "%s" (negativo) → erro "O valor não pode ser negativo."', (tipoValor, texto) => {
      expect(lerValorDigitado(tipoValor, texto)).toEqual({ valor: null, erro: NEGATIVO })
    })

    it.each([
      ['numeral', 'abc'],
      ['numeral', '12.5'],
      ['numeral', '1,2,3'],
      ['numeral', '12a'],
      ['porcentagem', 'oitenta'],
      ['porcentagem', '80.5'],
    ] as const)('%s "%s" (fora do padrão pt-BR) → erro de número inválido', (tipoValor, texto) => {
      expect(lerValorDigitado(tipoValor, texto)).toEqual({ valor: null, erro: INVALIDO })
    })

    it.each(['', '   '])('texto vazio ("%s") não é erro: valor null e erro null', (texto) => {
      expect(lerValorDigitado('numeral', texto)).toEqual({ valor: null, erro: null })
      expect(lerValorDigitado('porcentagem', texto)).toEqual({ valor: null, erro: null })
    })
  })

  describe('lerValorDigitado — Booleano (botões Sim/Não)', () => {
    it('"sim" → true e "nao" → false', () => {
      expect(lerValorDigitado('booleano', 'sim')).toEqual({ valor: true, erro: null })
      expect(lerValorDigitado('booleano', 'nao')).toEqual({ valor: false, erro: null })
    })

    it('sem escolha ("") → valor null, sem erro', () => {
      expect(lerValorDigitado('booleano', '')).toEqual({ valor: null, erro: null })
    })
  })

  describe('formatarValorLancamento (RNF-03, RN-10)', () => {
    it.each([
      ['numeral', 1234.56, '1.234,56'],
      ['numeral', 75, '75,00'],
      ['numeral', 0, '0,00'],
      ['porcentagem', 80, '80,00%'],
      ['porcentagem', 12.346, '12,35%'],
      ['booleano', true, 'Sim'],
      ['booleano', false, 'Não'],
    ] as const)('%s %s → "%s"', (tipoValor, valor, esperado) => {
      expect(formatarValorLancamento(tipoValor, valor)).toBe(esperado)
    })

    it.each(['numeral', 'porcentagem', 'booleano'] as const)('%s sem lançamento (null) → "—"', (tipoValor) => {
      expect(formatarValorLancamento(tipoValor, null)).toBe('—')
    })
  })

  describe('mensagemSucessoPreenchimento (notificação do PUT)', () => {
    it.each([
      [{ lancados: 1, corrigidos: 0 }, '1 lançamento salvo.'],
      [{ lancados: 2, corrigidos: 0 }, '2 lançamentos salvos.'],
      [{ lancados: 0, corrigidos: 1 }, '1 correção salva.'],
      [{ lancados: 0, corrigidos: 3 }, '3 correções salvas.'],
      [{ lancados: 1, corrigidos: 1 }, '1 lançamento e 1 correção salvos.'],
      [{ lancados: 2, corrigidos: 2 }, '2 lançamentos e 2 correções salvos.'],
      [{ lancados: 0, corrigidos: 0 }, 'Preenchimento salvo.'],
    ])('%o → "%s"', (resultado, esperado) => {
      expect(mensagemSucessoPreenchimento(resultado)).toBe(esperado)
    })
  })
})
