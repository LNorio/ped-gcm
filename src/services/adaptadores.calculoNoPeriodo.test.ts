import { describe, expect, it } from 'vitest'
import { PERIODICIDADES, type DadosDashboard, type Periodicidade } from '../types/dominio'
import { paraCorpoDashboard } from './adaptadores'

/**
 * F7.15 — contrato proposto (`docs/propostas-backend/PROPOSTA-calculo-no-periodo-dashboard.md`):
 * `IndicadorDoDashboard.calculoNoPeriodo?: SentidoCalculo` vira `"calculo do periodo"` em cada item de
 * `indicadores`, só quando a periodicidade não é mensal.
 */
const BASE: DadosDashboard = {
  nome: 'PED Trimestral',
  periodicidade: 'trimestral',
  pontuacaoBaseMaxima: 100,
  tipoVinculo: 'filiais',
  itensVinculados: ['100'],
  indicadores: [
    { idIndicador: 7, pontosBase: 40, calculoNoPeriodo: 'soma' },
    { idIndicador: 9, pontosBase: 30, calculoNoPeriodo: 'media' },
    { idIndicador: 11, pontosBase: 30, calculoNoPeriodo: 'ultimo' },
  ],
  indicadorBaseDaFaixa: 7,
  formulaDePontuacao: 'Soma simples.',
  observacaoParaTi: null,
}

const NAO_MENSAIS = PERIODICIDADES.filter((periodicidade): periodicidade is Exclude<Periodicidade, 'mensal'> => periodicidade !== 'mensal')

describe('F7.15 — paraCorpoDashboard: "calculo do periodo" dos indicadores em dashboard não mensal', () => {
  it.each(NAO_MENSAIS)('periodicidade "%s": cada indicador leva "calculo do periodo", junto de "id indicador" e "pontos base"', (periodicidade) => {
    expect(paraCorpoDashboard({ ...BASE, periodicidade }).indicadores).toEqual([
      { 'id indicador': 7, 'pontos base': 40, 'calculo do periodo': 'soma' },
      { 'id indicador': 9, 'pontos base': 30, 'calculo do periodo': 'media' },
      { 'id indicador': 11, 'pontos base': 30, 'calculo do periodo': 'ultimo' },
    ])
  })

  it('periodicidade "mensal": "calculo do periodo" é omitido em todos os indicadores, mesmo com o valor informado', () => {
    const corpo = paraCorpoDashboard({ ...BASE, periodicidade: 'mensal' })

    expect(corpo.indicadores).toEqual([
      { 'id indicador': 7, 'pontos base': 40 },
      { 'id indicador': 9, 'pontos base': 30 },
      { 'id indicador': 11, 'pontos base': 30 },
    ])
    for (const item of corpo.indicadores) expect(item).not.toHaveProperty('calculo do periodo')
  })

  it('indicador sem calculoNoPeriodo não leva a chave (o formulário só envia com o cálculo escolhido)', () => {
    const corpo = paraCorpoDashboard({ ...BASE, indicadores: [{ idIndicador: 7, pontosBase: 100 }] })

    expect(corpo.indicadores).toEqual([{ 'id indicador': 7, 'pontos base': 100 }])
    expect(corpo.indicadores[0]).not.toHaveProperty('calculo do periodo')
  })

  it('o restante do corpo não muda', () => {
    expect(paraCorpoDashboard(BASE)).toMatchObject({
      nome: 'PED Trimestral',
      periodicidade: 'trimestral',
      'pontuacao base maxima': 100,
      'tipo de vinculo': 'filiais',
      'itens vinculados': ['100'],
      'indicador base da faixa': 7,
      'formula de pontuacao': 'Soma simples.',
      'observacao para ti': null,
    })
  })
})
