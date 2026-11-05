import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_FINANCEIRO_API,
  DASHBOARD_GERENTES_API,
  detalheDashboardApi,
} from '../../test/dashboardsFalsos'
import { usuarioRapido } from '../../test/usuario'
import { PesosDashboard } from './PesosDashboard'

const ROTA = '/api/ped/dashboards'

describe('F7.9 — PesosDashboard: pesos dos indicadores de um dashboard (RF-48 "Ver pesos dos indicadores")', () => {
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

  const itens = (nome: string) => within(screen.getByRole('list', { name: `Pesos dos indicadores de ${nome}` })).getAllByRole('listitem')

  it('consulta o detalhe (GET /api/ped/dashboards/{id}) e lista cada indicador com os pontos base, o total e o período atual', async () => {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(detalheDashboardApi(DASHBOARD_COMERCIAL_API)) })
    render(<PesosDashboard dashboard={paraDashboard(DASHBOARD_COMERCIAL_API)} />)

    await screen.findByRole('list', { name: 'Pesos dos indicadores de PED Comercial' })

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].caminho).toBe(`${ROTA}/1`)
    const linhas = itens('PED Comercial')
    expect(linhas).toHaveLength(2)
    expect(within(linhas[0]).getByText('Cobertura de visitas')).toBeInTheDocument()
    expect(within(linhas[0]).getByText('40 pts')).toBeInTheDocument()
    expect(within(linhas[1]).getByText('Faturamento líquido mensal')).toBeInTheDocument()
    expect(within(linhas[1]).getByText('60 pts')).toBeInTheDocument()
    expect(screen.getByText('Total: 100 de 100 pts')).toBeInTheDocument()
    expect(screen.getByText('Período atual: 4º tri/2026 (01/10/2026 a 31/12/2026)')).toBeInTheDocument()
  })

  it('pontos com decimais em pt-BR e indicador inativo ou com problema destacado com o motivo', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/5`]: () => respostaJson(detalheDashboardApi(DASHBOARD_FINANCEIRO_API)),
      [`GET ${ROTA}/2`]: () => respostaJson(detalheDashboardApi(DASHBOARD_GERENTES_API)),
    })
    const { unmount } = render(<PesosDashboard dashboard={paraDashboard(DASHBOARD_FINANCEIRO_API)} />)

    await screen.findByRole('list', { name: 'Pesos dos indicadores de PED Financeiro' })
    const [rotinas, capacitacao] = itens('PED Financeiro')
    expect(within(rotinas).getByText('50,50 pts')).toBeInTheDocument()
    expect(within(capacitacao).getByText('Indicador inativo')).toBeInTheDocument()
    expect(screen.getByText('Total: 90,50 de 90,50 pts')).toBeInTheDocument()
    unmount()

    render(<PesosDashboard dashboard={paraDashboard(DASHBOARD_GERENTES_API)} />)
    await screen.findByRole('list', { name: 'Pesos dos indicadores de PED Gerentes' })
    const [faturamento, custo] = itens('PED Gerentes')
    expect(within(custo).getByText('Todos os apontamentos estão desativados')).toBeInTheDocument()
    expect(within(faturamento).queryByText(/desativad|inativo/)).not.toBeInTheDocument()
  })

  it('anuncia "Carregando pesos dos indicadores..." em região de status enquanto consulta', async () => {
    let liberar: () => void = () => {}
    simularApi(fetchFalso, {
      [`GET ${ROTA}/1`]: () =>
        new Promise<Response>((resolve) => {
          liberar = () => resolve(respostaJson(detalheDashboardApi(DASHBOARD_COMERCIAL_API)))
        }),
    })
    render(<PesosDashboard dashboard={paraDashboard(DASHBOARD_COMERCIAL_API)} />)

    expect(screen.getByText('Carregando pesos dos indicadores...').closest('[role="status"]')).not.toBeNull()

    liberar()
    await screen.findByRole('list', { name: 'Pesos dos indicadores de PED Comercial' })
    expect(screen.queryByText('Carregando pesos dos indicadores...')).not.toBeInTheDocument()
  })

  it('erro: alerta com a mensagem e "Tentar novamente", que repete a consulta', async () => {
    const user = usuarioRapido()
    let falhar = true
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}/1`]: () => (falhar ? respostaErro(500, 'Falha ao consultar o dashboard.') : respostaJson(detalheDashboardApi(DASHBOARD_COMERCIAL_API))),
    })
    render(<PesosDashboard dashboard={paraDashboard(DASHBOARD_COMERCIAL_API)} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar o dashboard.')

    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await screen.findByRole('list', { name: 'Pesos dos indicadores de PED Comercial' })
    expect(chamadas).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dashboard sem indicadores mostra "Nenhum indicador vinculado."', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}/1`]: () => respostaJson({ ...detalheDashboardApi(DASHBOARD_COMERCIAL_API), indicadores: [] }),
    })
    render(<PesosDashboard dashboard={paraDashboard(DASHBOARD_COMERCIAL_API)} />)

    expect(await screen.findByText('Nenhum indicador vinculado.')).toBeInTheDocument()
  })
})
