import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_FINANCEIRO_API,
  DASHBOARD_GERENTES_API,
  DASHBOARD_LOGISTICA_API,
  DASHBOARD_SUPERVISORES_API,
  RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API,
  dashboardsApi,
} from '../../test/dashboardsFalsos'
import type { Dashboard } from '../../types/dominio'
import { TabelaDashboards, type TabelaDashboardsProps } from './TabelaDashboards'

const DASHBOARDS: Dashboard[] = dashboardsApi().map(paraDashboard)

describe('F7.2 — TabelaDashboards: listagem de dashboards (RF-47, RN-16)', () => {
  function renderizar(props: Partial<TabelaDashboardsProps> = {}) {
    return render(
      <TabelaDashboards
        dashboards={props.dashboards ?? DASHBOARDS}
        podeEditar={props.podeEditar ?? false}
        podeAlterarSituacao={props.podeAlterarSituacao ?? false}
        podeConcluir={props.podeConcluir ?? false}
        podeExcluir={props.podeExcluir ?? false}
        onEditar={props.onEditar ?? vi.fn()}
        onVerHistorico={props.onVerHistorico ?? vi.fn()}
        onPreencher={props.onPreencher ?? vi.fn()}
        onAlterarSituacao={props.onAlterarSituacao ?? vi.fn()}
        onConcluir={props.onConcluir ?? vi.fn()}
        onExcluir={props.onExcluir ?? vi.fn()}
        textoVazio={props.textoVazio}
      />,
    )
  }

  const tabela = () => screen.getByRole('table', { name: 'Dashboards' })
  const linha = (nome: string) => within(tabela()).getByText(nome).closest('tr')!

  it('tabela "Dashboards" com as colunas Dashboard, Periodicidade, Vínculo, Indicadores, Período atual e Ações', () => {
    renderizar()

    expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Dashboard',
      'Periodicidade',
      'Vínculo',
      'Indicadores',
      'Período atual',
      'Ações',
    ])
  })

  it('uma linha por dashboard, na ordem recebida', () => {
    renderizar()

    const nomes = ['PED Comercial', 'PED Gerentes', 'PED Supervisores', 'PED Logística', 'PED Financeiro']
    const linhas = nomes.map((nome) => linha(nome))
    for (let i = 1; i < linhas.length; i++) {
      expect(linhas[i - 1].compareDocumentPosition(linhas[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('PED Comercial: "Por filial", "Ativo", "Tarefa nº 31", data da última alteração, Trimestral, "Filiais: 100, 101, 102", "2 indicadores", "100 de 100 pts" e "4º tri/2026"', () => {
    renderizar()

    const comercial = linha('PED Comercial')
    for (const texto of [
      'Por filial',
      'Ativo',
      'Tarefa nº 31',
      'Alterado em 20/10/2026 15:30',
      'Trimestral',
      'Filiais: 100, 101, 102',
      '2 indicadores',
      '100 de 100 pts',
      '4º tri/2026',
    ]) {
      expect(within(comercial).getByText(texto)).toBeInTheDocument()
    }
    expect(within(comercial).queryByText(/^Cadastrado em/)).not.toBeInTheDocument()
  })

  it('dashboard nunca alterado mostra a data de cadastro; em construção mostra "Em construção (TI)" e a tarefa; vínculo por colaboradores mostra a quantidade', () => {
    renderizar()

    const supervisores = linha('PED Supervisores')
    for (const texto of [
      'Por colaborador',
      'Em construção (TI)',
      'Tarefa nº 40',
      'Cadastrado em 04/11/2026 17:10',
      'Semestral',
      '2 colaboradores',
      '120 de 120 pts',
      '2º sem/2026',
    ]) {
      expect(within(supervisores).getByText(texto)).toBeInTheDocument()
    }
  })

  it('em modificação: "Em modificação (TI)", um indicador no singular e vínculo por uma filial', () => {
    renderizar()

    const logistica = linha('PED Logística')
    for (const texto of ['Por filial', 'Em modificação (TI)', 'Tarefa nº 41', 'Bimestral', 'Filiais: 102', '1 indicador', '80 de 80 pts', '6º bim/2026']) {
      expect(within(logistica).getByText(texto)).toBeInTheDocument()
    }
  })

  it('inativo sem tarefa: "Inativo", "Por cargo", cargos separados por vírgula, pontos com duas casas decimais e nenhum número de tarefa', () => {
    renderizar()

    const financeiro = linha('PED Financeiro')
    for (const texto of ['Inativo', 'Por cargo', 'Anual', 'Cargos: Vendedor, Supervisor Comercial', '2 indicadores', '90,50 de 90,50 pts', '2026']) {
      expect(within(financeiro).getByText(texto)).toBeInTheDocument()
    }
    expect(within(financeiro).queryByText(/Tarefa nº/)).not.toBeInTheDocument()
  })

  it('tarefa sem número (id null): mostra "Em construção (TI)" e o restante da linha, sem "Tarefa nº"', () => {
    renderizar({ dashboards: RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API.map(paraDashboard) })

    const teste = linha('teste')
    for (const texto of ['Por filial', 'Em construção (TI)', 'Mensal', '2 indicadores', '100 de 100 pts', '11/2026']) {
      expect(within(teste).getByText(texto)).toBeInTheDocument()
    }
    expect(within(teste).queryByText(/Tarefa nº/)).not.toBeInTheDocument()
    expect(within(teste).queryByText(/null/)).not.toBeInTheDocument()
  })

  it('vínculo com um único colaborador fica no singular', () => {
    renderizar({ dashboards: [paraDashboard({ ...DASHBOARD_SUPERVISORES_API, 'itens vinculados': [16] })] })

    expect(within(linha('PED Supervisores')).getByText('1 colaborador')).toBeInTheDocument()
  })

  it('dashboard ativo com alerta: etiqueta "1 indicador com problema" e a lista com o indicador, o motivo e os pontos afetados', () => {
    renderizar()

    const gerentes = linha('PED Gerentes')
    expect(within(gerentes).getByText('Por cargo')).toBeInTheDocument()
    expect(within(gerentes).getByText('Cargos: Gerente de Loja')).toBeInTheDocument()
    expect(within(gerentes).getByText('1 indicador com problema')).toBeInTheDocument()
    const problemas = within(gerentes).getByRole('list', { name: 'Indicadores com problema em PED Gerentes' })
    expect(within(problemas).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Custo de frete por entrega — Todos os apontamentos estão desativados · 20 pts',
    ])
  })

  it('vários alertas: etiqueta no plural e um item por indicador, na ordem da API', () => {
    const comDoisAlertas = paraDashboard({
      ...DASHBOARD_COMERCIAL_API,
      alertas: [
        { indicador: 'Cobertura de visitas', motivo: 'Indicador inativo', 'pontos afetados': 40 },
        { indicador: 'Faturamento líquido mensal', motivo: 'Dado externo desativado', 'pontos afetados': 60.5 },
      ],
    })
    renderizar({ dashboards: [comDoisAlertas] })

    const comercial = linha('PED Comercial')
    expect(within(comercial).getByText('2 indicadores com problema')).toBeInTheDocument()
    const problemas = within(comercial).getByRole('list', { name: 'Indicadores com problema em PED Comercial' })
    expect(within(problemas).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Cobertura de visitas — Indicador inativo · 40 pts',
      'Faturamento líquido mensal — Dado externo desativado · 60,50 pts',
    ])
  })

  it('alertas só aparecem em dashboard ativo (inativo, em construção ou em modificação não mostram — RF-47)', () => {
    const emConstrucaoComAlerta = paraDashboard({
      ...DASHBOARD_SUPERVISORES_API,
      alertas: [{ indicador: 'Cobertura de visitas', motivo: 'Indicador inativo', 'pontos afetados': 70 }],
    })
    renderizar({ dashboards: [paraDashboard(DASHBOARD_FINANCEIRO_API), emConstrucaoComAlerta, paraDashboard(DASHBOARD_LOGISTICA_API)] })

    expect(screen.queryByText(/indicadores? com problema/)).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /Indicadores com problema/ })).not.toBeInTheDocument()
  })

  it('dashboard ativo sem alertas não mostra etiqueta nem lista de problemas', () => {
    renderizar({ dashboards: [paraDashboard(DASHBOARD_COMERCIAL_API), paraDashboard(DASHBOARD_GERENTES_API)] })

    expect(within(linha('PED Comercial')).queryByText(/com problema/)).not.toBeInTheDocument()
    expect(within(linha('PED Comercial')).queryByRole('list')).not.toBeInTheDocument()
  })

  it('lista vazia mostra o textoVazio recebido', () => {
    renderizar({ dashboards: [], textoVazio: 'Nenhum dashboard cadastrado.' })

    expect(within(tabela()).getByText('Nenhum dashboard cadastrado.')).toBeInTheDocument()
  })

  it('não há botão de expandir separado: a linha não tem "Ver detalhes" fora do menu de ações', () => {
    renderizar()

    expect(screen.queryByRole('button', { name: /Ver detalhes|Expandir/ })).not.toBeInTheDocument()
  })
})
