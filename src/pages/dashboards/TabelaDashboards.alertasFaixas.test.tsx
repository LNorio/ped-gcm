import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { dashboardsApi, dashboardsComAlertasDeFaixasApi } from '../../test/dashboardsFalsos'
import type { Dashboard } from '../../types/dominio'
import { TabelaDashboards } from './TabelaDashboards'

const COM_ALERTAS: Dashboard[] = dashboardsComAlertasDeFaixasApi().map(paraDashboard)

function renderizar(dashboards: Dashboard[] = COM_ALERTAS) {
  render(
    <TabelaDashboards
      dashboards={dashboards}
      podeEditar={false}
      podeAlterarSituacao={false}
      podeConcluir={false}
      podeExcluir={false}
      onEditar={vi.fn()}
      onVerHistorico={vi.fn()}
      onPreencher={vi.fn()}
      onAlterarSituacao={vi.fn()}
      onConcluir={vi.fn()}
      onExcluir={vi.fn()}
    />,
  )
}

const linha = (nome: string) => within(screen.getByRole('table', { name: 'Dashboards' })).getByText(nome).closest('tr')!
const listaAlertas = (nome: string) => screen.queryByRole('list', { name: `Alertas de faixas em ${nome}` })

/**
 * Proposta "faixa geral e situação" (12/11/2026), seção 6: na linha do dashboard, etiqueta
 * "{N} alerta(s) de faixas" e a lista "Alertas de faixas em {nome}" com a `mensagem` de cada alerta
 * (conflito de faixas ativas, filial ou dashboard sem faixa ativa). Como os alertas de indicadores
 * (RF-47), só em dashboard ativo. São separados dos "indicadores com problema".
 */
describe('F7.14 — TabelaDashboards: alertas de faixas na linha do dashboard', () => {
  it('dashboard ativo com 2 alertas: etiqueta "2 alertas de faixas" e a lista com as mensagens, na ordem da API', () => {
    renderizar()

    const comercial = linha('PED Comercial')
    expect(within(comercial).getByText('2 alertas de faixas')).toBeInTheDocument()
    const lista = listaAlertas('PED Comercial')!
    expect(within(lista).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'faixa geral e faixa da filial 101 ativas ao mesmo tempo',
      'filial 102 sem faixa ativa',
    ])
  })

  it('dashboard ativo com 1 alerta (dashboard sem faixa ativa) fica no singular e mantém, à parte, o alerta de indicador', () => {
    renderizar()

    const gerentes = linha('PED Gerentes')
    expect(within(gerentes).getByText('1 alerta de faixas')).toBeInTheDocument()
    expect(within(listaAlertas('PED Gerentes')!).getByText('dashboard sem faixa ativa')).toBeInTheDocument()
    expect(within(gerentes).getByText('1 indicador com problema')).toBeInTheDocument()
    const indicadores = screen.getByRole('list', { name: 'Indicadores com problema em PED Gerentes' })
    expect(within(indicadores).queryByText('dashboard sem faixa ativa')).not.toBeInTheDocument()
  })

  it('dashboard em construção ou inativo não mostra os alertas de faixas', () => {
    renderizar()

    for (const nome of ['PED Supervisores', 'PED Financeiro']) {
      expect(within(linha(nome)).queryByText(/alertas? de faixas/)).not.toBeInTheDocument()
      expect(listaAlertas(nome)).not.toBeInTheDocument()
    }
  })

  it('sem alertas de faixas (formato atual), nada sobre faixas na linha', () => {
    renderizar(dashboardsApi().map(paraDashboard))

    expect(screen.queryByText(/alertas? de faixas/)).not.toBeInTheDocument()
    expect(listaAlertas('PED Comercial')).not.toBeInTheDocument()
  })
})
