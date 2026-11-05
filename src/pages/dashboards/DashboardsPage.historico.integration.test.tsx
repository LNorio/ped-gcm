import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaJson, simularApi } from '../../test/apiFalsa'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_GERENTES_API,
  dashboardsApi,
  detalheDashboardApi,
  historicoDashboardApi,
  rotaListarDashboards,
} from '../../test/dashboardsFalsos'
import { abrirMenuAcoes, escolherAcao, itensDoMenuAcoes, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'

describe('F7.9 — Ver pesos dos indicadores e histórico de modificações (integração: /dashboards)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao(perfil: 'admin' | 'validador' = 'validador') {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(dashboardsApi),
      [`GET ${ROTA}/1`]: () => respostaJson(detalheDashboardApi(DASHBOARD_COMERCIAL_API)),
      [`GET ${ROTA}/2`]: () => respostaJson(detalheDashboardApi(DASHBOARD_GERENTES_API)),
      [`GET ${ROTA}/1/historico`]: () => respostaJson(historicoDashboardApi()),
    })
  }

  async function abrirTela() {
    renderizarApp('/dashboards')
    return await screen.findByRole('table', { name: 'Dashboards' })
  }

  const linha = (tabela: HTMLElement, nome: string) => within(tabela).getByText(nome).closest('tr')!

  it('"Ver pesos dos indicadores" abre os pesos abaixo da linha (detalhe da API) e o item passa a "Ocultar pesos"; ocultar fecha', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Comercial'), 'Ver pesos dos indicadores')

    const pesos = await screen.findByRole('list', { name: 'Pesos dos indicadores de PED Comercial' })
    expect(linha(tabela, 'PED Comercial').nextElementSibling).toContainElement(pesos)
    expect(within(pesos).getByText('Cobertura de visitas')).toBeInTheDocument()
    expect(within(pesos).getByText('60 pts')).toBeInTheDocument()
    const detalhe = chamadas.find((c) => c.caminho === `${ROTA}/1`)!
    expect(cabecalhoDaChamada(detalhe, 'Authorization')).toBe('Bearer token-salvo')

    const menu = await abrirMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'))
    expect(within(menu).getByRole('menuitem', { name: 'Ocultar pesos' })).toBeInTheDocument()
    await user.click(within(menu).getByRole('menuitem', { name: 'Ocultar pesos' }))

    await waitFor(() => expect(screen.queryByRole('list', { name: 'Pesos dos indicadores de PED Comercial' })).not.toBeInTheDocument())
    expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'))).toContain('Ver pesos dos indicadores')
  })

  it('várias linhas podem ficar com os pesos abertos ao mesmo tempo', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Comercial'), 'Ver pesos dos indicadores')
    await escolherAcao(user, rotuloAcoesDashboard('PED Gerentes'), 'Ver pesos dos indicadores')

    const pesosGerentes = await screen.findByRole('list', { name: 'Pesos dos indicadores de PED Gerentes' })
    expect(screen.getByRole('list', { name: 'Pesos dos indicadores de PED Comercial' })).toBeInTheDocument()
    expect(within(pesosGerentes).getByText('Todos os apontamentos estão desativados')).toBeInTheDocument()
  })

  it('"Histórico de modificações" abre o diálogo com os registros da API (ação, data, usuário, alterações, tarefa e observação)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Comercial'), 'Histórico de modificações')

    const dialogo = screen.getByRole('dialog', { name: 'Histórico de modificações' })
    const lista = await within(dialogo).findByRole('list', { name: 'Modificações de PED Comercial' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
    expect(within(lista).getByText('Indicador incluído: Faturamento líquido mensal (60 pts)')).toBeInTheDocument()
    expect(within(lista).getByText('Observação: Usar a régua de faixas do ano passado.')).toBeInTheDocument()
    expect(chamadas.filter((c) => c.caminho === `${ROTA}/1/historico`)).toHaveLength(1)

    await user.click(within(dialogo).getAllByRole('button', { name: 'Fechar' })[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
