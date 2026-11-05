import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { dashboardsApi } from '../../test/dashboardsFalsos'
import { abrirMenuAcoes, escolherAcao, itensDoMenuAcoes, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import type { Dashboard } from '../../types/dominio'
import { TabelaDashboards, type TabelaDashboardsProps } from './TabelaDashboards'

const DASHBOARDS: Dashboard[] = dashboardsApi().map(paraDashboard)
const porNome = (nome: string) => DASHBOARDS.find((d) => d.nome === nome)!

const COMUNS = ['Ver pesos dos indicadores', 'Histórico de modificações']

describe('F7.3 — TabelaDashboards: menu de ações por dashboard conforme perfil e situação (RF-48)', () => {
  function renderizar(props: Partial<TabelaDashboardsProps> = {}) {
    const callbacks = {
      onEditar: props.onEditar ?? vi.fn(),
      onVerHistorico: props.onVerHistorico ?? vi.fn(),
      onPreencher: props.onPreencher ?? vi.fn(),
      onAlterarSituacao: props.onAlterarSituacao ?? vi.fn(),
      onConcluir: props.onConcluir ?? vi.fn(),
      onExcluir: props.onExcluir ?? vi.fn(),
    }
    render(
      <TabelaDashboards
        dashboards={props.dashboards ?? DASHBOARDS}
        podeEditar={props.podeEditar ?? false}
        podeAlterarSituacao={props.podeAlterarSituacao ?? false}
        podeConcluir={props.podeConcluir ?? false}
        podeExcluir={props.podeExcluir ?? false}
        {...callbacks}
      />,
    )
    return callbacks
  }

  /** Permissões do Admin (todas) e do Validador (só editar). */
  const ADMIN = { podeEditar: true, podeAlterarSituacao: true, podeConcluir: true, podeExcluir: true }
  const VALIDADOR = { podeEditar: true, podeAlterarSituacao: false, podeConcluir: false, podeExcluir: false }

  it('cada linha tem o gatilho "Ações do dashboard {nome}"', () => {
    renderizar(ADMIN)

    for (const dashboard of DASHBOARDS) {
      expect(screen.getByRole('button', { name: rotuloAcoesDashboard(dashboard.nome) })).toBeInTheDocument()
    }
  })

  it('Admin, dashboard ativo: Editar, Ver pesos, Histórico, Preencher apontamentos, Desativar e Excluir', async () => {
    const user = usuarioRapido()
    renderizar(ADMIN)

    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'))).toEqual([
      'Editar',
      ...COMUNS,
      'Preencher apontamentos',
      'Desativar',
      'Excluir',
    ])
  })

  it('Admin, dashboard inativo: "Ativar" no lugar de "Desativar" e sem "Preencher apontamentos"', async () => {
    const user = usuarioRapido()
    renderizar(ADMIN)

    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Financeiro'))).toEqual(['Editar', ...COMUNS, 'Ativar', 'Excluir'])
  })

  it('Admin, em construção (TI): "Concluir construção (TI)" no lugar de Ativar/Desativar', async () => {
    const user = usuarioRapido()
    renderizar(ADMIN)

    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Supervisores'))).toEqual([
      'Editar',
      ...COMUNS,
      'Concluir construção (TI)',
      'Excluir',
    ])
  })

  it('Admin, em modificação (TI): "Concluir modificação (TI)"', async () => {
    const user = usuarioRapido()
    renderizar(ADMIN)

    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Logística'))).toEqual([
      'Editar',
      ...COMUNS,
      'Concluir modificação (TI)',
      'Excluir',
    ])
  })

  it('Validador: só Editar, Ver pesos, Histórico e (no ativo) Preencher apontamentos — sem ativar/desativar, concluir nem excluir', async () => {
    const user = usuarioRapido()
    renderizar(VALIDADOR)

    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'))).toEqual(['Editar', ...COMUNS, 'Preencher apontamentos'])
    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Supervisores'))).toEqual(['Editar', ...COMUNS])
    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Logística'))).toEqual(['Editar', ...COMUNS])
    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Financeiro'))).toEqual(['Editar', ...COMUNS])
  })

  it('sem permissão de editar, "Editar" não aparece', async () => {
    const user = usuarioRapido()
    renderizar({ ...VALIDADOR, podeEditar: false })

    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Gerentes'))).toEqual([...COMUNS, 'Preencher apontamentos'])
  })

  it('"Excluir" tem o destaque de perigo; os demais itens não', async () => {
    const user = usuarioRapido()
    renderizar(ADMIN)

    const menu = await abrirMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'))
    expect(within(menu).getByRole('menuitem', { name: 'Excluir' })).toHaveClass('menu-acoes__item--perigo')
    expect(within(menu).getByRole('menuitem', { name: 'Desativar' })).not.toHaveClass('menu-acoes__item--perigo')
  })

  it.each([
    ['Editar', 'onEditar', 'PED Comercial'],
    ['Histórico de modificações', 'onVerHistorico', 'PED Comercial'],
    ['Preencher apontamentos', 'onPreencher', 'PED Comercial'],
    ['Desativar', 'onAlterarSituacao', 'PED Comercial'],
    ['Ativar', 'onAlterarSituacao', 'PED Financeiro'],
    ['Concluir construção (TI)', 'onConcluir', 'PED Supervisores'],
    ['Concluir modificação (TI)', 'onConcluir', 'PED Logística'],
    ['Excluir', 'onExcluir', 'PED Financeiro'],
  ] as const)('"%s" chama %s com o dashboard da linha', async (item, callback, nome) => {
    const user = usuarioRapido()
    const callbacks = renderizar(ADMIN)

    await escolherAcao(user, rotuloAcoesDashboard(nome), item)

    expect(callbacks[callback]).toHaveBeenCalledTimes(1)
    expect(callbacks[callback]).toHaveBeenCalledWith(porNome(nome))
    for (const [chave, funcao] of Object.entries(callbacks)) {
      if (chave !== callback) expect(funcao).not.toHaveBeenCalled()
    }
  })
})
