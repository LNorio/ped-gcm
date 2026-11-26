import { describe, expect, it } from 'vitest'
import { formatarInteiro } from './formato'

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — `formatarInteiro(valor: number | null |
 * undefined): string` em `src/utils/formato.ts`: contagens com separador de milhar pt-BR ("1.500"), sem
 * casas decimais. `null`, `undefined` e `NaN` devolvem texto vazio, como `formatarNumero` (F1.4).
 */
describe('F12.2 — formatarInteiro (contagens com separador de milhar)', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [999, '999'],
    [1000, '1.000'],
    [1500, '1.500'],
    [12345, '12.345'],
    [1234567, '1.234.567'],
  ])('%d vira "%s"', (valor, esperado) => {
    expect(formatarInteiro(valor)).toBe(esperado)
  })

  it('número negativo mantém o sinal e o separador ("-1.500")', () => {
    expect(formatarInteiro(-1500)).toBe('-1.500')
  })

  it('não mostra casas decimais nem vírgula para inteiros', () => {
    expect(formatarInteiro(2000)).not.toContain(',')
  })

  it('devolve texto vazio para null, undefined e NaN', () => {
    expect(formatarInteiro(null)).toBe('')
    expect(formatarInteiro(undefined)).toBe('')
    expect(formatarInteiro(Number.NaN)).toBe('')
  })
})
