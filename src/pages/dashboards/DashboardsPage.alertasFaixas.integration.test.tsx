import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  DASHBOARD_GERENTES_API,
  dashboardsApi,
  dashboardsComAlertasDeFaixasApi,
  rotaListarDashboards,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'
const AVISO_INDICADORES = '1 dashboard com indicador com problema. Corrija na aba Indicadores antes do encerramento.'
const COMPLEMENTO_FAIXAS = 'Corrija na aba Faixas antes do encerramento.'

/**
 * Proposta "faixa geral e situação" (12/11/2026), seção 6: os "alertas de faixas" aparecem na linha
 * do dashboard e são contados num aviso geral próprio da aba ("{N} dashboard(s) com alerta(s) de
 * faixas. Corrija na aba Faixas antes do encerramento."), separado do aviso de indicadores com
 * problema. Só dashboards ativos contam.
 *
 * Contrato final (F8.12*, `API (28).md`): o filtro de situação ganha "Com problemas de faixa", que
 * envia `situacao=problemas_faixa` (só os dashboards ativos com "alertas de faixas"); "Com problemas"
 * (`situacao=problemas`) continua só com os alertas de indicadores.
 */
describe('F7.14 — Alertas de faixas na aba Dashboards (integração: /dashboards)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador', lista: () => DashboardApiFalso[]) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(lista),
    })
  }

  it('Admin: alertas na linha de cada dashboard ativo e aviso geral "2 dashboards com alertas de faixas", além do aviso de indicadores', async () => {
    simularSessao('admin', dashboardsComAlertasDeFaixasApi)
    renderizarApp('/dashboards')

    const tabela = await screen.findByRole('table', { name: 'Dashboards' })

    const comercial = within(tabela).getByText('PED Comercial').closest('tr')!
    expect(within(comercial).getByText('2 alertas de faixas')).toBeInTheDocument()
    expect(within(comercial).getByText('faixa geral e faixa da filial 101 ativas ao mesmo tempo')).toBeInTheDocument()
    expect(within(comercial).getByText('filial 102 sem faixa ativa')).toBeInTheDocument()
    const gerentes = within(tabela).getByText('PED Gerentes').closest('tr')!
    expect(within(gerentes).getByText('dashboard sem faixa ativa')).toBeInTheDocument()

    expect(screen.getByText(`2 dashboards com alertas de faixas. ${COMPLEMENTO_FAIXAS}`)).toBeInTheDocument()
    expect(screen.getByText(AVISO_INDICADORES)).toBeInTheDocument()
  })

  it('um único dashboard ativo com alerta de faixas: aviso no singular', async () => {
    simularSessao('validador', () => [{ ...DASHBOARD_GERENTES_API, 'alertas de faixas': [{ tipo: 'conflito', mensagem: 'duas faixas gerais ativas', filial: null }] }])
    renderizarApp('/dashboards')

    await screen.findByRole('table', { name: 'Dashboards' })

    expect(screen.getByText(`1 dashboard com alerta de faixas. ${COMPLEMENTO_FAIXAS}`)).toBeInTheDocument()
    expect(screen.getByText('duas faixas gerais ativas')).toBeInTheDocument()
  })

  describe('filtro "Com problemas de faixa" (situacao=problemas_faixa)', () => {
    const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
    const opcaoSituacao = (rotulo: string) =>
      within(screen.getByRole('listbox', { name: 'Situação' }))
        .getAllByRole('option')
        .find((opcao) => opcao.textContent === rotulo)!

    it('envia situacao=problemas_faixa e lista só os dashboards ativos com alertas de faixas', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('admin', dashboardsComAlertasDeFaixasApi)
      renderizarApp('/dashboards')
      const tabela = await screen.findByRole('table', { name: 'Dashboards' })

      await user.click(opcaoSituacao('Com problemas de faixa'))

      await waitFor(() => expect(gets(chamadas).at(-1)!.url.searchParams.get('situacao')).toBe('problemas_faixa'))
      await waitFor(() => expect(within(tabela).queryByText('PED Logística')).not.toBeInTheDocument())
      expect(within(tabela).getByText('PED Comercial')).toBeInTheDocument()
      expect(within(tabela).getByText('PED Gerentes')).toBeInTheDocument()
      expect(within(tabela).queryByText('PED Supervisores')).not.toBeInTheDocument()
      expect(within(tabela).queryByText('PED Financeiro')).not.toBeInTheDocument()
      expect(opcaoSituacao('Com problemas de faixa')).toHaveAttribute('aria-selected', 'true')
    })

    it('"Com problemas" (situacao=problemas) não inclui os dashboards que só têm alertas de faixas', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao('validador', dashboardsComAlertasDeFaixasApi)
      renderizarApp('/dashboards')
      const tabela = await screen.findByRole('table', { name: 'Dashboards' })

      await user.click(opcaoSituacao('Com problemas'))

      await waitFor(() => expect(gets(chamadas).at(-1)!.url.searchParams.get('situacao')).toBe('problemas'))
      await waitFor(() => expect(within(tabela).queryByText('PED Comercial')).not.toBeInTheDocument())
      expect(within(tabela).getByText('PED Gerentes')).toBeInTheDocument()
    })
  })

  it('sem "alertas de faixas" (formato atual da API): sem aviso de faixas; o aviso de indicadores continua', async () => {
    simularSessao('admin', dashboardsApi)
    renderizarApp('/dashboards')

    await screen.findByRole('table', { name: 'Dashboards' })

    expect(screen.queryByText(/alertas? de faixas/)).not.toBeInTheDocument()
    expect(screen.getByText(AVISO_INDICADORES)).toBeInTheDocument()
  })
})
