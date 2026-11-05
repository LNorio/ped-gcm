import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { dashboardsApi, rotaListarDashboards } from '../../test/dashboardsFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dashboards'
const ATRASO_BUSCA_MS = 500

describe('F7.2 — Filtros da listagem de dashboards (integração: /dashboards)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const configurarUsuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  async function avancar(ms = ATRASO_BUSCA_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  function simularSessao(perfil: 'admin' | 'validador' = 'admin') {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(dashboardsApi),
    })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const ultimoGet = (chamadas: ChamadaRegistrada[]) => gets(chamadas)[gets(chamadas).length - 1]

  async function abrirTela() {
    renderizarApp('/dashboards')
    return await screen.findByRole('table', { name: 'Dashboards' })
  }

  function opcaoSituacao(rotulo: string) {
    return within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText(rotulo) !== null)!
  }

  it('"Todas" começa selecionada', async () => {
    simularSessao()
    await abrirTela()

    expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'true')
  })

  it('digitar o nome de um indicador consulta a API 500 ms após a última tecla e mostra só os dashboards devolvidos', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'custo de frete')
    expect(gets(chamadas)).toHaveLength(1)
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('custo de frete')
    await waitFor(() => expect(within(tabela).queryByText('PED Comercial')).not.toBeInTheDocument())
    expect(within(tabela).getByText('PED Gerentes')).toBeInTheDocument()
    expect(within(tabela).getByText('PED Logística')).toBeInTheDocument()
  })

  it('"Em construção/modificação (TI)" consulta na hora com situacao=construcao', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Em construção/modificação (TI)'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('construcao'))
    await waitFor(() => expect(within(tabela).queryByText('PED Comercial')).not.toBeInTheDocument())
    expect(within(tabela).getByText('PED Supervisores')).toBeInTheDocument()
    expect(within(tabela).getByText('PED Logística')).toBeInTheDocument()
    expect(opcaoSituacao('Em construção/modificação (TI)')).toHaveAttribute('aria-selected', 'true')
  })

  it('"Com problemas" envia situacao=problemas e lista só os ativos com alerta', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Com problemas'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('problemas'))
    await waitFor(() => expect(within(tabela).queryByText('PED Comercial')).not.toBeInTheDocument())
    expect(within(tabela).getByText('PED Gerentes')).toBeInTheDocument()
    expect(within(tabela).queryByText('PED Financeiro')).not.toBeInTheDocument()
  })

  it('"Ativos" e "Inativos" enviam a situação correspondente', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('validador')
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Inativos'))
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos'))
    await waitFor(() => expect(within(tabela).queryByText('PED Comercial')).not.toBeInTheDocument())
    expect(within(tabela).getByText('PED Financeiro')).toBeInTheDocument()

    await user.click(opcaoSituacao('Ativos'))
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('ativos'))
    await waitFor(() => expect(within(tabela).getByText('PED Comercial')).toBeInTheDocument())
    expect(within(tabela).queryByText('PED Financeiro')).not.toBeInTheDocument()
  })

  it('sem resultados para os filtros mostra "Nenhum dashboard encontrado para os filtros."; "Limpar filtros" volta à lista completa', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'inexistente')
    await avancar()

    expect(await within(tabela).findByText('Nenhum dashboard encontrado para os filtros.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => expect(within(tabela).getByText('PED Comercial')).toBeInTheDocument())
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('')
    expect(ultimoGet(chamadas).url.search).toBe('')
  })
})
