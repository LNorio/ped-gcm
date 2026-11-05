import { describe, expect, it } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { TABELA_COMERCIAL_101_API, TABELA_EXCLUIDO_101_API, TABELA_GERENTES_100_API } from '../../test/faixasFalsos'
import { nomeTabelaFaixas } from './regrasFaixas'

describe('F8.2 — nomeTabelaFaixas (nome da tabela exibido na aba — RF-41)', () => {
  it('é "{dashboard} · Filial {código}", sem a descrição (única por dashboard e filial — RN-14)', () => {
    expect(nomeTabelaFaixas(paraTabelaFaixas(TABELA_COMERCIAL_101_API))).toBe('PED Comercial · Filial 101')
    expect(nomeTabelaFaixas(paraTabelaFaixas(TABELA_GERENTES_100_API))).toBe('PED Gerentes · Filial 100')
  })

  it('tabela de dashboard excluído usa o nome guardado pela API', () => {
    expect(nomeTabelaFaixas(paraTabelaFaixas(TABELA_EXCLUIDO_101_API))).toBe('PED Antigo · Filial 101')
  })
})
