import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { respostaDadosExternosApi } from '../../test/dadosExternosFalsos'
import {
  DASHBOARD_SUPERVISORES_API,
  dadosExternosParaDashboardApi,
  dashboardsApi,
  indicadoresParaDashboardApi,
  previaTarefaApi,
  respostaGravacaoApi,
  rotaListarDashboards,
  rotaVinculos,
  tarefaBitrixGravacaoApi,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import { respostaIndicadoresApi } from '../../test/indicadoresFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'

/**
 * F1.18 — defeito do Enter (revisão de qualidade de 06/11/2026): no diálogo "Novo dashboard", Enter
 * nas buscas dos dropdowns (SeletorBusca: "Buscar indicador" e "Buscar colaborador") enviava o
 * formulário e gravava o dashboard sem o usuário pedir. Com o formulário completo e válido, Enter na
 * busca não faz o POST; só "Salvar e criar tarefa no Bitrix" grava. Correção já existente em Tipos.
 */
describe('F7.5 / F7.6 — Enter nas buscas do formulário de dashboard não grava (integração: /dashboards, F1.18)', () => {
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

  function simularSessao() {
    const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })
    let lista: DashboardApiFalso[] = dashboardsApi().filter((d) => d.id !== 3)
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      'GET /api/ped/indicadores-cadastro': () => respostaJson(respostaIndicadoresApi(indicadoresParaDashboardApi())),
      'GET /api/ped/dados-externos-cadastro': () => respostaJson(respostaDadosExternosApi(dadosExternosParaDashboardApi())),
      'GET /api/ped/vinculos': rotaVinculos(),
      [`POST ${ROTA}/previa-tarefa`]: (init) => {
        const { nome } = JSON.parse(String(init?.body)) as { nome: string }
        return respostaJson(previaTarefaApi(nome))
      },
      [`POST ${ROTA}`]: () => {
        lista = [...lista, { ...DASHBOARD_SUPERVISORES_API }]
        return respostaJson(
          respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaBitrixGravacaoApi('[PED] Construir dashboard: PED Supervisores', null)),
          201,
        )
      },
    })
  }

  const postsCadastro = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  async function abrirCadastro(user: Usuario) {
    renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })
    await user.click(screen.getByRole('button', { name: 'Novo dashboard' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo dashboard' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando dados do formulário...')).not.toBeInTheDocument())
    return dialogo
  }

  async function abrirEEscolher(user: Usuario, escopo: HTMLElement, botao: string, lista: string, item: string) {
    const gatilho = within(escopo).getByRole('button', { name: botao })
    if (gatilho.getAttribute('aria-expanded') !== 'true') await user.click(gatilho)
    await user.click(within(within(escopo).getByRole('listbox', { name: lista })).getByRole('option', { name: (n) => n.startsWith(item) }))
  }

  /** Preenche o formulário completo e válido (vínculo por colaboradores, dois indicadores somando 120 pts). */
  async function preencher(user: Usuario, dialogo: HTMLElement) {
    const d = within(dialogo)
    await colar(user, d.getByRole('textbox', { name: 'Nome do dashboard' }), 'PED Supervisores')
    await user.selectOptions(d.getByRole('combobox', { name: 'Periodicidade de lançamento' }), 'Semestral')
    await user.type(d.getByRole('textbox', { name: 'Pontuação base máxima' }), '120')
    await user.click(d.getByRole('button', { name: 'Tipo de vínculo do dashboard' }))
    await user.click(
      within(d.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).getByRole('option', {
        name: (n) => n.startsWith('Colaboradores específicos'),
      }),
    )
    await abrirEEscolher(user, dialogo, 'Selecionar colaborador', 'Colaboradores vinculados', 'Fábio Nunes')
    await abrirEEscolher(user, dialogo, 'Selecionar colaborador', 'Colaboradores vinculados', 'Ana Souza')
    const indicadores = d.getByRole('group', { name: 'Indicadores vinculados' })
    await abrirEEscolher(user, indicadores, 'Selecionar indicador', 'Indicadores', 'Cobertura de visitas')
    await abrirEEscolher(user, indicadores, 'Selecionar indicador', 'Indicadores', 'Vendas por zona')
    await user.type(d.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' }), '70')
    await user.type(d.getByRole('textbox', { name: 'Pontos base de Vendas por zona neste dashboard' }), '50')
    // F7.15: semestral exige o cálculo no período de cada indicador.
    await user.selectOptions(d.getByRole('combobox', { name: 'Cálculo no período de Cobertura de visitas' }), 'Somar')
    await user.selectOptions(d.getByRole('combobox', { name: 'Cálculo no período de Vendas por zona' }), 'Somar')
    await user.selectOptions(d.getByRole('combobox', { name: 'Indicador base da faixa' }), 'Cobertura de visitas')
    await colar(user, d.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Pontos base × atingimento, sem limite.')
  }

  it('formulário válido: Enter na busca "Buscar indicador" não faz o POST e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)
    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    const botao = within(indicadores).getByRole('button', { name: 'Selecionar indicador' })
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao)

    await user.type(within(indicadores).getByRole('searchbox', { name: 'Buscar indicador' }), 'fat{Enter}')

    expect(postsCadastro(chamadas)).toHaveLength(0)
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(screen.queryByText(/^Dashboard cadastrado\./)).not.toBeInTheDocument()
  })

  it('formulário válido: Enter na busca "Buscar colaborador" não faz o POST e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)
    const botao = within(dialogo).getByRole('button', { name: 'Selecionar colaborador' })
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao)

    await user.type(within(dialogo).getByRole('searchbox', { name: 'Buscar colaborador' }), 'ana{Enter}')

    expect(postsCadastro(chamadas)).toHaveLength(0)
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(screen.queryByText(/^Dashboard cadastrado\./)).not.toBeInTheDocument()
  })

  it('depois do Enter na busca, "Salvar e criar tarefa no Bitrix" grava uma vez (POST) e fecha o diálogo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo)
    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    const botao = within(indicadores).getByRole('button', { name: 'Selecionar indicador' })
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao)
    await user.type(within(indicadores).getByRole('searchbox', { name: 'Buscar indicador' }), 'fat{Enter}')
    expect(postsCadastro(chamadas)).toHaveLength(0)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Novo dashboard' })).not.toBeInTheDocument())
    expect(postsCadastro(chamadas)).toHaveLength(1)
  })
})
