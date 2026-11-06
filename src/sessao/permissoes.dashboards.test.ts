import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar, type AcaoPermissao } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Ações da aba Dashboards (matriz da seção 2 do documento; RF-48, RF-49, RF-56, RF-58, RF-59; API
 * fase 6: "Admin e Validador consultam, cadastram e editam. Só o Admin ativa/desativa, conclui a
 * construção e exclui. O Preenchedor não acessa"):
 * - cadastrar e editar — Admin e Validador;
 * - ativar/desativar, concluir construção/modificação (TI) e excluir — só Admin.
 * Consultar, ver pesos e histórico seguem o acesso à aba (sem ação própria).
 */
const ESPERADO: ReadonlyArray<[AcaoPermissao, Perfil[]]> = [
  ['cadastrar-dashboard', ['admin', 'validador']],
  ['editar-dashboard', ['admin', 'validador']],
  ['alterar-situacao-dashboard', ['admin']],
  ['concluir-dashboard', ['admin']],
  ['excluir-dashboard', ['admin']],
]

describe('F7.3 — Permissões de ação dos dashboards (podeExecutar)', () => {
  it.each(ESPERADO)('%s é permitida somente para %j', (acao, perfis) => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, acao))).toEqual(perfis)
  })

  it.each(ESPERADO.map(([acao]) => acao))('sem perfil (null) nunca pode executar %s', (acao) => {
    expect(podeExecutar(null, acao)).toBe(false)
  })

  it('as ações já existentes continuam com a mesma matriz', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-tipo'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-apontamento'))).toEqual(['admin'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'concluir-dado-externo'))).toEqual(['admin'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'cadastrar-indicador'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-indicador'))).toEqual(['admin'])
  })
})
