import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Ação nova da aba Faixas (12/11/2026 — proposta "faixa geral e situação", seções 3 e 4):
 * `alterar-situacao-faixas` ("Inativar tabela"/"Reativar tabela") — Admin e Validador, como as demais
 * ações da aba (P-04). Decisão do negócio de 12/11/2026: Admin e Validador mexem também na faixa
 * geral, com as mesmas regras (o Validador tem acesso a todas as filiais); não há ação exclusiva do
 * Admin para a faixa geral.
 */
describe('F8.7 — Permissões da situação das tabelas de faixas (inclusive da faixa geral)', () => {
  it('alterar-situacao-faixas é permitida somente para Admin e Validador', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'alterar-situacao-faixas'))).toEqual(['admin', 'validador'])
  })

  it('sem perfil (null) nunca pode executar alterar-situacao-faixas', () => {
    expect(podeExecutar(null, 'alterar-situacao-faixas')).toBe(false)
  })

  it('as ações já existentes da aba Faixas continuam para Admin e Validador', () => {
    for (const acao of ['cadastrar-faixas', 'alterar-faixas', 'ver-historico-faixas', 'excluir-faixas'] as const) {
      expect(PERFIS.filter((perfil) => podeExecutar(perfil, acao))).toEqual(['admin', 'validador'])
    }
  })
})
