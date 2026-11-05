import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { MENSAGEM_RESPOSTA_INVALIDA } from '../../services/api'
import {
  NOMES_DASHBOARDS,
  RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API,
  dashboardsApi,
  rotaListarDashboards,
} from '../../test/dashboardsFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dashboards'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F7.2 — Listagem de dashboards (integração: /dashboards com Admin, Validador e Preenchedor)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', listar?: () => Response) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: listar ?? rotaListarDashboards(dashboardsApi),
    })
  }

  it('Admin abre /dashboards: GET da listagem com o Bearer, sem query, e todas as linhas com as colunas do RF-47', async () => {
    const chamadas = simularSessao('admin')
    renderizarApp('/dashboards')

    const tabela = await screen.findByRole('table', { name: 'Dashboards' })

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboards' })).toBeInTheDocument()
    for (const nome of NOMES_DASHBOARDS) expect(within(tabela).getByText(nome)).toBeInTheDocument()
    const get = chamadas.find((c) => c.metodo === 'GET' && c.caminho === ROTA)!
    expect(cabecalhoDaChamada(get, 'Authorization')).toBe('Bearer token-salvo')
    expect(get.url.search).toBe('')
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Dashboard',
      'Periodicidade',
      'Vínculo',
      'Indicadores',
      'Período atual',
      'Ações',
    ])

    const gerentes = within(tabela).getByText('PED Gerentes').closest('tr')!
    expect(within(gerentes).getByText('Mensal')).toBeInTheDocument()
    expect(within(gerentes).getByText('50 de 50 pts')).toBeInTheDocument()
    expect(within(gerentes).getByText('11/2026')).toBeInTheDocument()
    expect(within(gerentes).getByText('1 indicador com problema')).toBeInTheDocument()
    expect(screen.getByText('1 dashboard com indicador com problema. Corrija na aba Indicadores antes do encerramento.')).toBeInTheDocument()
  })

  it('resposta real da API com "tarefa bitrix" sem número (id null): a tabela carrega, sem "Resposta inválida do servidor." e sem "Tarefa nº"', async () => {
    simularSessao('admin', () => respostaJson(RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API))
    renderizarApp('/dashboards')

    const tabela = await screen.findByRole('table', { name: 'Dashboards' })

    const teste = within(tabela).getByText('teste').closest('tr')!
    expect(within(teste).getByText('Em construção (TI)')).toBeInTheDocument()
    expect(within(teste).getByText('Mensal')).toBeInTheDocument()
    expect(within(teste).getByText('100 de 100 pts')).toBeInTheDocument()
    expect(within(teste).queryByText(/Tarefa nº/)).not.toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_RESPOSTA_INVALIDA)).not.toBeInTheDocument()
  })

  it('Validador vê a aba "Dashboards" ativa e a mesma listagem', async () => {
    simularSessao('validador')
    renderizarApp('/dashboards')

    const tabela = await screen.findByRole('table', { name: 'Dashboards' })

    expect(screen.getByText('Validador')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Dashboards/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const nome of NOMES_DASHBOARDS) expect(within(tabela).getByText(nome)).toBeInTheDocument()
  })

  it('Preenchedor não vê a aba Dashboards e, ao abrir /dashboards, volta ao Início sem consultar a listagem', async () => {
    const chamadas = simularSessao('preenchedor')
    renderizarApp('/dashboards')

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    const abas = screen.getByRole('navigation', { name: 'Abas' })
    expect(within(abas).queryByRole('link', { name: /Dashboards/ })).not.toBeInTheDocument()
    expect(chamadas.filter((c) => c.caminho === ROTA)).toHaveLength(0)
  })

  it('500 na listagem: Aviso de erro com a mensagem da API e "Tentar novamente", sem a tabela', async () => {
    simularSessao('admin', () => respostaErro(500, 'Falha ao consultar os dashboards.'))
    renderizarApp('/dashboards')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar os dashboards.')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Dashboards' })).not.toBeInTheDocument()
  })

  it('401 na listagem encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    simularSessao('admin', () => respostaErro(401))
    renderizarApp('/dashboards')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
