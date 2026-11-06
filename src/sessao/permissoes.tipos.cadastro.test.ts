import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeAcessar, podeExecutar } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Cadastro de tipo personalizado (RF-13, RF-16; A-02 resolvida em 06/11/2026: a API passou a aceitar
 * POST /api/ped/tipos-apontamento do Admin e do Validador). A aba Tipos é de Admin e Validador.
 */
describe('F3.4 — Permissão de cadastrar tipo (podeExecutar "cadastrar-tipo")', () => {
  it('a aba Tipos é acessível para Admin e Validador, e não para o Preenchedor', () => {
    expect(PERFIS.filter((perfil) => podeAcessar(perfil, 'tipos'))).toEqual(['admin', 'validador'])
  })

  it('"cadastrar-tipo" é permitida somente para Admin e Validador', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'cadastrar-tipo'))).toEqual(['admin', 'validador'])
  })

  it('sem perfil (null) nunca pode cadastrar tipo', () => {
    expect(podeExecutar(null, 'cadastrar-tipo')).toBe(false)
  })

  it('a exclusão de tipo continua com Admin e Validador', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'excluir-tipo'))).toEqual(['admin', 'validador'])
  })
})
