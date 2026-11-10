import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * Integração do dado externo (mudança de 09/11/2026): o botão "Configurações" / "Preencher integração",
 * a modal de configuração, o alerta de integração pendente e a opção "Integração pendente (TI)" do
 * filtro valem só para o Admin (equipe de TI). Validador e Preenchedor não veem nada disso.
 */
describe('F5.16 — Permissão de configurar a integração do dado externo (podeExecutar)', () => {
  it('configurar-integracao-dado-externo é permitida somente para o Admin', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'configurar-integracao-dado-externo'))).toEqual(['admin'])
  })

  it('sem perfil (null) não pode configurar a integração', () => {
    expect(podeExecutar(null, 'configurar-integracao-dado-externo')).toBe(false)
  })

  it('concluir-dado-externo continua só do Admin', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'concluir-dado-externo'))).toEqual(['admin'])
  })
})
