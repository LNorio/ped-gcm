import { describe, expect, it } from 'vitest'
import { rotuloEncerrar, textoImagens } from './previaFechamento'

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — `textoImagens` e `rotuloEncerrar`
 * (`previaFechamento.ts`) usam `formatarInteiro`: separador de milhar nas contagens, singular só para 1.
 */
describe('F12.2 — previaFechamento: contagens de imagens com separador de milhar', () => {
  it.each([
    [1, '1 imagem'],
    [2, '2 imagens'],
    [0, '0 imagens'],
    [1000, '1.000 imagens'],
    [1500, '1.500 imagens'],
  ])('textoImagens(%d) é "%s"', (quantidade, esperado) => {
    expect(textoImagens(quantidade)).toBe(esperado)
  })

  it.each([
    [1, 'Encerrar e gerar 1 imagem'],
    [3, 'Encerrar e gerar 3 imagens'],
    [1500, 'Encerrar e gerar 1.500 imagens'],
    [12345, 'Encerrar e gerar 12.345 imagens'],
  ])('rotuloEncerrar(%d) é "%s"', (quantidade, esperado) => {
    expect(rotuloEncerrar(quantidade)).toBe(esperado)
  })
})
