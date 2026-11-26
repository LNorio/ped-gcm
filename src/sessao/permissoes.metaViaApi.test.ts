import { describe, expect, it } from 'vitest'
import type { Perfil } from '../types/dominio'
import { podeExecutar } from './permissoes'

const PERFIS: Perfil[] = ['admin', 'validador', 'preenchedor']

/**
 * F6.11 — Meta buscada via API: o botão "Configurações" / "Preencher integração" do indicador e a modal
 * da integração valem só para o Admin (pedido do usuário de 10/11/2026). O checkbox "Buscar metas via
 * API" do cadastro e do "Definir meta" segue as permissões já existentes (Admin e Validador).
 *
 * Alteração de 19/11/2026 (CONTRAPROPOSTA-alertas-menu.md, ajuste 2): ação de leitura
 * `ver-integracao-pendente-indicador` (Admin e Validador) — o alerta "integração pendente" no menu e o
 * filtro "Integração pendente (TI)" —, separada de `configurar-integracao-indicador` (só Admin).
 */
describe('F6.11 — Permissão de configurar a integração da meta do indicador (podeExecutar)', () => {
  it('configurar-integracao-indicador é permitida somente para o Admin', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'configurar-integracao-indicador'))).toEqual(['admin'])
  })

  it('sem perfil (null) não pode configurar a integração do indicador', () => {
    expect(podeExecutar(null, 'configurar-integracao-indicador')).toBe(false)
  })

  it('ver-integracao-pendente-indicador (alerta e filtro "Integração pendente (TI)") é permitida para Admin e Validador', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'ver-integracao-pendente-indicador'))).toEqual(['admin', 'validador'])
  })

  it('sem perfil (null) não vê a integração pendente do indicador', () => {
    expect(podeExecutar(null, 'ver-integracao-pendente-indicador')).toBe(false)
  })

  it('cadastrar-indicador e definir-meta-indicador continuam liberadas para Admin e Validador', () => {
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'cadastrar-indicador'))).toEqual(['admin', 'validador'])
    expect(PERFIS.filter((perfil) => podeExecutar(perfil, 'definir-meta-indicador'))).toEqual(['admin', 'validador'])
  })
})
