import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar, type AcaoPermissao } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Ações da aba Dados Externos (RF-26, RF-27, RF-28, RF-30, RF-31; API fase 3):
 * - cadastrar já ativo (variante Admin do formulário) — só Admin;
 * - concluir construção — só Admin;
 * - ativar/desativar — Admin e Validador;
 * - excluir — só Admin.
 */
const ESPERADO: ReadonlyArray<[AcaoPermissao, Perfil[]]> = [
  ['cadastrar-dado-externo-ativo', ['admin']],
  ['concluir-dado-externo', ['admin']],
  ['alterar-situacao-dado-externo', ['admin', 'validador']],
  ['excluir-dado-externo', ['admin']],
]

describe('F5.8 — Permissões de ação dos dados externos (podeExecutar)', () => {
  it.each(ESPERADO)('%s é permitida somente para %j', (acao, perfis) => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, acao))).toEqual(perfis)
  })

  it.each(ESPERADO.map(([acao]) => acao))('sem perfil (null) nunca pode executar %s', (acao) => {
    expect(podeExecutar(null, acao)).toBe(false)
  })

  it('as ações já existentes continuam com a mesma matriz', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-tipo'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'alterar-situacao-apontamento'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-apontamento'))).toEqual(['admin'])
  })
})
