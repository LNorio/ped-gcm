import { describe, expect, it } from 'vitest'
import type { ConflitoFaixas } from '../../services/faixasService'
import { textoConflitoFaixas } from './regrasFaixas'

/**
 * F8.12* — `400` de conflito no cadastro e na reativação (contrato final): cada item de `conflitos`
 * é `{ id, geral, filial, "nome filial" }` (no domínio, `ConflitoFaixas`). A tela mostra cada tabela
 * em conflito como "Geral (todas as filiais)" ou "Filial {código} – {nome}" (travessão “–”).
 */
describe('F8.7 — textoConflitoFaixas (tabelas em conflito do 400)', () => {
  it.each<[string, ConflitoFaixas, string]>([
    ['faixa geral', { id: 7, geral: true, filial: null, nomeFilial: null }, 'Geral (todas as filiais)'],
    ['faixa por filial', { id: 3, geral: false, filial: '100', nomeFilial: 'MATRIZ' }, 'Filial 100 – MATRIZ'],
    ['faixa por filial sem o nome', { id: 3, geral: false, filial: '100', nomeFilial: null }, 'Filial 100'],
    ['filial null sem "geral" (tratada como geral)', { id: 9, geral: false, filial: null, nomeFilial: null }, 'Geral (todas as filiais)'],
  ])('%s', (_caso, conflito, texto) => {
    expect(textoConflitoFaixas(conflito)).toBe(texto)
  })
})
