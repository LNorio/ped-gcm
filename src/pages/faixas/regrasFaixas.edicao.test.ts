import { describe, expect, it } from 'vitest'
import { paraLinhasEditaveis, validarLinhasFaixas } from './regrasFaixas'

/**
 * "Alterar faixas" parte das faixas vigentes: os números da API viram texto pt-BR com 2 casas
 * (vírgula decimal e ponto de milhar — RNF-03) para edição, e voltam aos mesmos números na validação.
 */
describe('F8.4 — paraLinhasEditaveis (faixas vigentes → linhas editáveis — RF-44, RNF-03)', () => {
  it('formata De, Até e Alíquota no padrão pt-BR com 2 casas', () => {
    expect(
      paraLinhasEditaveis([
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
        { de: 2000.01, ate: 1250000, aliquota: 12.25 },
      ]),
    ).toEqual([
      { de: '0,00', ate: '1.000,00', aliquota: '0,00' },
      { de: '1.000,01', ate: '2.000,00', aliquota: '1,50' },
      { de: '2.000,01', ate: '1.250.000,00', aliquota: '12,25' },
    ])
  })

  it('lista vazia devolve []', () => {
    expect(paraLinhasEditaveis([])).toEqual([])
  })

  it('ida e volta: validarLinhasFaixas(paraLinhasEditaveis(faixas)) devolve as mesmas faixas', () => {
    const faixas = [
      { de: 0, ate: 5000, aliquota: 1 },
      { de: 5000.01, ate: 10000, aliquota: 2 },
    ]

    expect(validarLinhasFaixas(paraLinhasEditaveis(faixas))).toEqual({ erro: null, faixas })
  })
})
