import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar, type AcaoPermissao } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Ações da aba Indicadores (RF-34 a RF-39; API fase 4: "Admin e Validador fazem tudo na aba
 * Indicadores; o Preenchedor não acessa a aba"):
 * - cadastrar, definir meta do automático, inativar/reativar e ver o histórico de metas — Admin e
 *   Validador; Preenchedor nunca;
 * - excluir — só Admin (decisão de 06/11/2026, alinhada à rota DELETE /api/ped/indicadores-cadastro/{id},
 *   que é "só Admin" em FRONT-PED-mudancas.md, item 5).
 */
const ESPERADO: ReadonlyArray<[AcaoPermissao, Perfil[]]> = [
  ['cadastrar-indicador', ['admin', 'validador']],
  ['definir-meta-indicador', ['admin', 'validador']],
  ['alterar-situacao-indicador', ['admin', 'validador']],
  ['excluir-indicador', ['admin']],
  ['ver-historico-metas-indicador', ['admin', 'validador']],
]

describe('F6.6 — Permissões de ação dos indicadores (podeExecutar)', () => {
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
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'alterar-situacao-dado-externo'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-dado-externo'))).toEqual(['admin'])
  })
})
