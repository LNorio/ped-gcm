import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { respostaDadosExternosApi } from '../../test/dadosExternosFalsos'
import {
  dadosExternosParaDashboardApi,
  dashboardsApi,
  indicadoresParaDashboardApi,
  previaTarefaApi,
  rotaListarDashboards,
  rotaVinculos,
} from '../../test/dashboardsFalsos'
import {
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_CONSULTADO_API,
  INDICADOR_META_DADO_EXTERNO_API,
  respostaIndicadoresApi,
} from '../../test/indicadoresFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

/**
 * F7.6 — Indicadores com meta via API no cadastro de dashboard (integração: /dashboards; só a rede é
 * simulada). Contrato final: RESPOSTA-FINAL-meta-via-api.md, seção 2.6 (10/11/2026).
 * - No dropdown, a fonte `integracao` sem integração salva ou sem a primeira consulta aparece
 *   indisponível com o motivo; a fonte `dado_externo` entra normalmente.
 * - Se o back-end recusar (400) com o motivo ("integracao da meta pendente" ou "aguardando a primeira
 *   consulta"), a mensagem aparece no alerta do diálogo, que continua aberto.
 * - Executor (fase 2, 11/11/2026): a fonte `integracao` já consultada (situação `ok`) fica disponível
 *   mesmo com filiais sem meta (sem regra local); se o back-end recusar com "...ainda nao tem meta no
 *   mes aberto (a consulta nao trouxe meta)...", a mensagem aparece no alerta do diálogo.
 */
const ROTA = '/api/ped/dashboards'

describe('F7.6 — Dashboard com indicadores de meta via API (integração: /dashboards)', () => {
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

  function simular(aoCriar?: () => Response) {
    const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })
    const indicadores = [
      ...indicadoresParaDashboardApi(),
      { ...INDICADOR_META_API_PENDENTE_API },
      { ...INDICADOR_META_DADO_EXTERNO_API },
      { ...INDICADOR_META_AGUARDANDO_API },
      { ...INDICADOR_META_CONSULTADO_API },
    ]
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(() => dashboardsApi().filter((d) => d.id !== 3)),
      'GET /api/ped/indicadores-cadastro': () => respostaJson(respostaIndicadoresApi(indicadores)),
      'GET /api/ped/dados-externos-cadastro': () => respostaJson(respostaDadosExternosApi(dadosExternosParaDashboardApi())),
      'GET /api/ped/vinculos': rotaVinculos(),
      [`POST ${ROTA}/previa-tarefa`]: (init) => {
        const { nome } = JSON.parse(String(init?.body)) as { nome: string }
        return respostaJson(previaTarefaApi(nome))
      },
      [`POST ${ROTA}`]: () => (aoCriar ? aoCriar() : respostaErro(500)),
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

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

  const opcaoIndicador = (dialogo: HTMLElement, nome: string) =>
    within(within(dialogo).getByRole('listbox', { name: 'Indicadores' })).getByRole('option', { name: (n) => n.startsWith(nome) })

  it('dropdown: fonte integracao pendente ou aguardando consulta indisponível com o motivo; fonte dado_externo disponível', async () => {
    const user = usuarioRapido()
    simular()
    const dialogo = await abrirCadastro(user)

    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    await user.click(within(indicadores).getByRole('button', { name: 'Selecionar indicador' }))

    expect(opcaoIndicador(dialogo, 'Faturamento com meta da TI')).toBeDisabled()
    expect(opcaoIndicador(dialogo, 'Faturamento com meta da TI')).toHaveTextContent('Indisponível: Integração da meta pendente')
    expect(opcaoIndicador(dialogo, 'Novos clientes com meta da TI')).toBeDisabled()
    expect(opcaoIndicador(dialogo, 'Novos clientes com meta da TI')).toHaveTextContent(
      'Indisponível: Aguardando a primeira consulta da meta',
    )
    expect(opcaoIndicador(dialogo, 'Faturamento com meta do ERP')).toBeEnabled()
  })

  async function preencherESalvar(user: Usuario, dialogo: HTMLElement, indicador: string) {
    const d = within(dialogo)
    await colar(user, d.getByRole('textbox', { name: 'Nome do dashboard' }), 'PED Supervisores')
    await user.selectOptions(d.getByRole('combobox', { name: 'Periodicidade de lançamento' }), 'Semestral')
    await user.type(d.getByRole('textbox', { name: 'Pontuação base máxima' }), '100')
    await user.click(d.getByRole('button', { name: 'Tipo de vínculo do dashboard' }))
    await user.click(
      within(d.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).getByRole('option', {
        name: (n) => n.startsWith('Colaboradores específicos'),
      }),
    )
    await abrirEEscolher(user, dialogo, 'Selecionar colaborador', 'Colaboradores vinculados', 'Ana Souza')
    const indicadores = d.getByRole('group', { name: 'Indicadores vinculados' })
    await abrirEEscolher(user, indicadores, 'Selecionar indicador', 'Indicadores', indicador)
    await user.type(d.getByRole('textbox', { name: `Pontos base de ${indicador} neste dashboard` }), '100')
    await user.selectOptions(d.getByRole('combobox', { name: 'Indicador base da faixa' }), indicador)
    await colar(user, d.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Pontos base × atingimento.')

    await user.click(d.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))
  }

  it('400 do back-end com o motivo ("integracao da meta pendente"): a mensagem aparece no alerta do diálogo, que continua aberto', async () => {
    const user = usuarioRapido()
    const chamadas = simular(() => respostaErro(400, 'integracao da meta pendente'))
    const dialogo = await abrirCadastro(user)

    await preencherESalvar(user, dialogo, 'Faturamento com meta do ERP')

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('integracao da meta pendente')
    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ indicadores: [{ 'id indicador': 12, 'pontos base': 100 }] })
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
  })

  it('executor: fonte integracao consultada (ok) com filiais sem meta fica disponível no dropdown', async () => {
    const user = usuarioRapido()
    simular()
    const dialogo = await abrirCadastro(user)

    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    await user.click(within(indicadores).getByRole('button', { name: 'Selecionar indicador' }))

    expect(opcaoIndicador(dialogo, 'Ticket com meta da TI')).toBeEnabled()
    expect(opcaoIndicador(dialogo, 'Ticket com meta da TI')).not.toHaveTextContent('Indisponível')
  })

  it('executor: 400 "ainda nao tem meta no mes aberto (a consulta nao trouxe meta)" aparece no alerta do diálogo, que continua aberto', async () => {
    const user = usuarioRapido()
    const mensagem = 'o indicador Ticket com meta da TI ainda nao tem meta no mes aberto (a consulta nao trouxe meta)'
    const chamadas = simular(() => respostaErro(400, mensagem))
    const dialogo = await abrirCadastro(user)

    await preencherESalvar(user, dialogo, 'Ticket com meta da TI')

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem)
    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ indicadores: [{ 'id indicador': 16, 'pontos base': 100 }] })
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
  })
})
