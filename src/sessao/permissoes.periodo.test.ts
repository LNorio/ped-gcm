import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Ação nova da aba Preenchimento (F9.11 — RF-76; F9.12): `abrir-periodo` ("Abrir outro mês" e a
 * reabertura de um mês passado já fechado) — só o Admin (documento de requisitos, seção 5.3; a rota
 * `POST /api/ped/periodo/abrir` é exclusiva do Admin). A mesma ação vale para abrir um mês novo e para
 * reabrir um mês passado.
 */
describe('F9.11 — Permissão de abrir outro mês (abrir-periodo)', () => {
  it('abrir-periodo é permitida somente para o Admin', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'abrir-periodo'))).toEqual(['admin'])
  })

  it('sem perfil (null) nunca pode abrir período', () => {
    expect(podeExecutar(null, 'abrir-periodo')).toBe(false)
  })
})
