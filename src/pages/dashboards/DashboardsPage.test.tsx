import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_FINANCEIRO_API,
  DASHBOARD_GERENTES_API,
  NOMES_DASHBOARDS,
  dashboardsApi,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Perfil } from '../../types/dominio'
import { DashboardsPage } from './DashboardsPage'

const ROTA_LISTA = 'GET /api/ped/dashboards'
const COMPLEMENTO_ALERTA = 'Corrija na aba Indicadores antes do encerramento.'

describe('F7.2 — Listagem de dashboards (DashboardsPage)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function simularLista(lista: DashboardApiFalso[] = dashboardsApi()) {
    return simularApi(fetchFalso, { [ROTA_LISTA]: () => respostaJson(lista) })
  }

  function renderizar(perfil: Perfil = 'admin') {
    const acesso = acessoFalso({ perfil, todasAsFiliais: true, filiais: FILIAIS })
    return render(
      <MemoryRouter initialEntries={['/dashboards']}>
        <ProvedorSessaoFalso sessao={{ acesso }}>
          <DashboardsPage />
        </ProvedorSessaoFalso>
      </MemoryRouter>,
    )
  }

  const aguardarTabela = () => screen.findByRole('table', { name: 'Dashboards' })

  it('exibe o título "Dashboards"', async () => {
    simularLista()
    renderizar()

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboards' })).toBeInTheDocument()
    await aguardarTabela()
  })

  it('anuncia "Carregando dashboards..." em região de status e só mostra a tabela após a primeira carga', async () => {
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(dashboardsApi()))
        }),
    })
    renderizar()

    const carregando = screen.getByText('Carregando dashboards...')
    expect(carregando.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    liberar()
    await aguardarTabela()
    expect(screen.queryByText('Carregando dashboards...')).not.toBeInTheDocument()
  })

  it('lista os dashboards devolvidos pela API dentro de um Card sem padding', async () => {
    simularLista()
    renderizar()

    const tabela = await aguardarTabela()

    for (const nome of NOMES_DASHBOARDS) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    expect(tabela.closest('.card__corpo')).toHaveClass('card__corpo--sem-padding')
  })

  it('a barra de filtros tem "Buscar" com o placeholder "Dashboard, item vinculado ou indicador" e as situações do RF-47', async () => {
    simularLista()
    renderizar()
    await aguardarTabela()

    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveAttribute('placeholder', 'Dashboard, item vinculado ou indicador')
    const opcoes = within(screen.getByRole('listbox', { name: 'Situação' })).getAllByRole('option')
    // "Com problemas de faixa" (situacao=problemas_faixa): contrato final das faixas (F8.12*).
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
      'Todas',
      'Ativos',
      'Inativos',
      'Em construção/modificação (TI)',
      'Com problemas',
      'Com problemas de faixa',
    ])
  })

  it('erro de carga: Aviso de erro com a mensagem e "Tentar novamente", sem a tabela; tentar de novo recarrega', async () => {
    const user = usuarioRapido()
    let falhar = true
    simularApi(fetchFalso, {
      [ROTA_LISTA]: () => (falhar ? respostaErro(500, 'Falha ao consultar.') : respostaJson(dashboardsApi())),
    })
    renderizar()

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await aguardarTabela()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lista vazia sem filtro mostra "Nenhum dashboard cadastrado."', async () => {
    simularLista([])
    renderizar()

    const tabela = await aguardarTabela()
    expect(within(tabela).getByText('Nenhum dashboard cadastrado.')).toBeInTheDocument()
  })

  it('com um dashboard ativo com indicador problemático, a página mostra o alerta geral (RF-47)', async () => {
    simularLista()
    renderizar()
    await aguardarTabela()

    expect(screen.getByText(`1 dashboard com indicador com problema. ${COMPLEMENTO_ALERTA}`)).toBeInTheDocument()
  })

  it('com dois dashboards ativos com problema, o alerta geral fica no plural', async () => {
    const outroComProblema: DashboardApiFalso = {
      ...DASHBOARD_COMERCIAL_API,
      alertas: [{ indicador: 'Cobertura de visitas', motivo: 'Indicador inativo', 'pontos afetados': 40 }],
    }
    simularLista([outroComProblema, DASHBOARD_GERENTES_API])
    renderizar()
    await aguardarTabela()

    expect(screen.getByText(`2 dashboards com indicadores com problema. ${COMPLEMENTO_ALERTA}`)).toBeInTheDocument()
  })

  it('sem dashboard ativo com problema (alertas só de inativo), não há alerta geral', async () => {
    simularLista([DASHBOARD_COMERCIAL_API, DASHBOARD_FINANCEIRO_API])
    renderizar()
    await aguardarTabela()

    expect(screen.queryByText(/com problema\./)).not.toBeInTheDocument()
  })

  it.each<Perfil>(['admin', 'validador'])('%s vê o menu de ações em cada linha', async (perfil) => {
    simularLista()
    renderizar(perfil)

    const tabela = await aguardarTabela()
    for (const nome of NOMES_DASHBOARDS) {
      expect(within(tabela).getByRole('button', { name: `Ações do dashboard ${nome}` })).toBeInTheDocument()
    }
  })
})
