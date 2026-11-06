import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Edição dos grupos e usuários vinculados a um tipo, fixo ou personalizado (RF-14, RF-16; A-02
 * resolvida em 06/11/2026: PUT /api/ped/tipos-apontamento/{id} aceito para Admin e Validador).
 */
describe('F3.5 — Permissão de editar os vínculos de um tipo (podeExecutar "editar-tipo")', () => {
  it('"editar-tipo" é permitida somente para Admin e Validador', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'editar-tipo'))).toEqual(['admin', 'validador'])
  })

  it('sem perfil (null) nunca pode editar tipo', () => {
    expect(podeExecutar(null, 'editar-tipo')).toBe(false)
  })
})
