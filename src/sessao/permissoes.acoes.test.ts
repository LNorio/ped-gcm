import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar, type AcaoPermissao } from './permissoes'

/** Matriz de ações (seção 2 do documento de requisitos; Validador com acesso total a Tipos). */
const MATRIZ: ReadonlyArray<[Perfil, AcaoPermissao, boolean]> = [
  ['admin', 'excluir-tipo', true],
  ['admin', 'alterar-situacao-apontamento', true],
  ['admin', 'excluir-apontamento', true],
  ['validador', 'excluir-tipo', true],
  ['validador', 'alterar-situacao-apontamento', true],
  ['validador', 'excluir-apontamento', false],
  ['preenchedor', 'excluir-tipo', false],
  ['preenchedor', 'alterar-situacao-apontamento', false],
  ['preenchedor', 'excluir-apontamento', false],
]

const ACOES: AcaoPermissao[] = ['excluir-tipo', 'alterar-situacao-apontamento', 'excluir-apontamento']

describe('F1.13 — Permissões de ação por perfil (podeExecutar)', () => {
  it.each(MATRIZ)('%s → %s: %s', (perfil, acao, esperado) => {
    expect(podeExecutar(perfil, acao)).toBe(esperado)
  })

  it.each(ACOES)('sem perfil (null) nunca pode executar %s', (acao) => {
    expect(podeExecutar(null, acao)).toBe(false)
  })

  it('só o Admin exclui apontamentos', () => {
    const perfis: Perfil[] = ['admin', 'validador', 'preenchedor']
    expect(perfis.filter((perfil) => podeExecutar(perfil, 'excluir-apontamento'))).toEqual(['admin'])
  })

  it('Admin e Validador alteram a situação de apontamentos e excluem tipos; o Preenchedor não', () => {
    const perfis: Perfil[] = ['admin', 'validador', 'preenchedor']
    expect(perfis.filter((perfil) => podeExecutar(perfil, 'alterar-situacao-apontamento'))).toEqual(['admin', 'validador'])
    expect(perfis.filter((perfil) => podeExecutar(perfil, 'excluir-tipo'))).toEqual(['admin', 'validador'])
  })
})
