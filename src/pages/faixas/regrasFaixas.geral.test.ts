import { describe, expect, it } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import {
  TABELA_COMERCIAL_100_INATIVA_API,
  TABELA_GERAL_GERENTES_INATIVA_API,
  TABELA_GERAL_SUPERVISORES_API,
} from '../../test/faixasFalsos'
import { nomeTabelaFaixas, textoFilialTabelaFaixas } from './regrasFaixas'

describe('F8.7 — nome e filial exibidos da faixa geral (regrasFaixas)', () => {
  it('nomeTabelaFaixas da faixa geral é "{dashboard} · Geral"', () => {
    expect(nomeTabelaFaixas(paraTabelaFaixas(TABELA_GERAL_SUPERVISORES_API))).toBe('PED Supervisores · Geral')
    expect(nomeTabelaFaixas(paraTabelaFaixas(TABELA_GERAL_GERENTES_INATIVA_API))).toBe('PED Gerentes · Geral')
  })

  it('nomeTabelaFaixas da faixa por filial continua "{dashboard} · Filial {código}", também inativa', () => {
    expect(nomeTabelaFaixas(paraTabelaFaixas(TABELA_COMERCIAL_100_INATIVA_API))).toBe('PED Comercial · Filial 100')
  })

  it('textoFilialTabelaFaixas: "Todas as filiais (geral)" na faixa geral e "{código} - {nome}" na faixa por filial', () => {
    expect(textoFilialTabelaFaixas(paraTabelaFaixas(TABELA_GERAL_SUPERVISORES_API))).toBe('Todas as filiais (geral)')
    expect(textoFilialTabelaFaixas(paraTabelaFaixas(TABELA_COMERCIAL_100_INATIVA_API))).toBe('100 - MATRIZ')
  })
})
