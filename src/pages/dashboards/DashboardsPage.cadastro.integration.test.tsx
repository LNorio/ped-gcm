import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
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
  tarefaGravacaoApi,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import { respostaIndicadoresApi } from '../../test/indicadoresFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'
const ATRASO_PREVIA_MS = 500
const MENSAGEM_CADASTRO_AGUARDANDO = 'Dashboard cadastrado. A tarefa para a TI será criada no Bitrix em instantes.'
const BLOCO = 'Tarefa de construção que será criada no Bitrix24'

const CORPO_ESPERADO = {
  nome: 'PED Supervisores',
  periodicidade: 'semestral',
  'pontuacao base maxima': 120,
  'tipo de vinculo': 'colaboradores',
  'itens vinculados': [16, 11],
  indicadores: [
    { 'id indicador': 1, 'pontos base': 70 },
    { 'id indicador': 8, 'pontos base': 50 },
  ],
  'indicador base da faixa': 1,
  'formula de pontuacao': 'Pontos base × atingimento, sem limite.',
  'observacao para ti': 'Prioridade alta.',
}

describe('F7.7 — Cadastro de dashboard com a tarefa de construção sempre visível (integração: /dashboards)', () => {
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

  interface Opcoes {
    perfil?: 'admin' | 'validador'
    /** Número da tarefa no Bitrix24 ("id bitrix"); `null` (padrão) = tarefa na fila, `aguardando_envio`. */
    idTarefa?: number | string | null
    aoCriar?: () => Response
    aoListarVinculos?: () => Response
    aoPrevia?: () => Response
  }

  function simularSessao({ perfil = 'admin', idTarefa = null, aoCriar, aoListarVinculos, aoPrevia }: Opcoes = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista: DashboardApiFalso[] = dashboardsApi().filter((d) => d.id !== 3)
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      'GET /api/ped/indicadores-cadastro': () => respostaJson(respostaIndicadoresApi(indicadoresParaDashboardApi())),
      'GET /api/ped/dados-externos-cadastro': () => respostaJson(respostaDadosExternosApi(dadosExternosParaDashboardApi())),
      'GET /api/ped/vinculos': aoListarVinculos ?? rotaVinculos(),
      [`POST ${ROTA}/previa-tarefa`]: (init) => {
        if (aoPrevia) return aoPrevia()
        const { nome } = JSON.parse(String(init?.body)) as { nome: string }
        return respostaJson(previaTarefaApi(nome))
      },
      [`POST ${ROTA}`]: () => {
        if (aoCriar) return aoCriar()
        lista = [...lista, { ...DASHBOARD_SUPERVISORES_API }]
        return respostaJson(
          respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaBitrixGravacaoApi('[PED] Construir dashboard: PED Supervisores', idTarefa)),
          201,
        )
      },
    })
  }

  async function avancar(ms = ATRASO_PREVIA_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  const posts = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === caminho)

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
    expect(d.getByText('No encerramento serão geradas 2 imagens (uma por colaborador) na filial 100.')).toBeInTheDocument()
    const indicadores = d.getByRole('group', { name: 'Indicadores vinculados' })
    await abrirEEscolher(user, indicadores, 'Selecionar indicador', 'Indicadores', 'Cobertura de visitas')
    await abrirEEscolher(user, indicadores, 'Selecionar indicador', 'Indicadores', 'Vendas por zona')
    await user.type(d.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' }), '70')
    await user.type(d.getByRole('textbox', { name: 'Pontos base de Vendas por zona neste dashboard' }), '50')
    expect(d.getByText('Total correto: 120 pts')).toBeInTheDocument()
    const base = d.getByRole('combobox', { name: 'Indicador base da faixa' })
    expect(within(base).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Selecione', 'Cobertura de visitas', 'Vendas por zona'])
    await user.selectOptions(base, 'Cobertura de visitas')
    await colar(user, d.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Pontos base × atingimento, sem limite.')
    const bloco = d.getByRole('region', { name: BLOCO })
    await colar(user, within(bloco).getByRole('textbox', { name: 'Observação para a TI (opcional)' }), 'Prioridade alta.')
  }

  it('Admin abre "Novo dashboard": diálogo largo e carga das listas (indicadores, dados externos e as três listas de vínculo)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirCadastro(user)

    expect(dialogo).toHaveClass('dialogo--largo')
    expect(chamadas.some((c) => c.metodo === 'GET' && c.caminho === '/api/ped/indicadores-cadastro')).toBe(true)
    expect(chamadas.some((c) => c.metodo === 'GET' && c.caminho === '/api/ped/dados-externos-cadastro')).toBe(true)
    const tipos = chamadas.filter((c) => c.caminho === '/api/ped/vinculos').map((c) => c.url.searchParams.get('tipo'))
    expect([...tipos].sort()).toEqual(['cargos', 'colaboradores', 'filiais'])
    const vinculo = chamadas.find((c) => c.caminho === '/api/ped/vinculos')!
    expect(cabecalhoDaChamada(vinculo, 'Authorization')).toBe('Bearer token-salvo')
  })

  it('o diálogo já abre com o bloco da tarefa de construção (responsável, aviso e orientação), sem consultar a prévia', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirCadastro(user)

    const bloco = within(within(dialogo).getByRole('region', { name: BLOCO }))
    expect(bloco.getByText('Responsável: Equipe de TI')).toBeInTheDocument()
    expect(bloco.getByText('O dashboard nasce inativo (em construção) e só fica ativo quando a TI concluir a tarefa.')).toBeInTheDocument()
    expect(bloco.getByText('Preencha os dados do dashboard para ver o título e a descrição da tarefa.')).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Ver prévia da tarefa' })).not.toBeInTheDocument()
    await avancar(ATRASO_PREVIA_MS + 100)
    expect(posts(chamadas, `${ROTA}/previa-tarefa`)).toHaveLength(0)
  })

  it('fluxo completo: preencher → prévia no bloco (POST previa-tarefa 500 ms depois) → salvar (POST) → diálogo fecha, notificação e o novo dashboard "Em construção (TI)" na lista', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirCadastro(user)

    await preencher(user, dialogo)
    await avancar()

    const bloco = within(within(dialogo).getByRole('region', { name: BLOCO }))
    expect(await bloco.findByText('[PED] Construir dashboard: PED Supervisores')).toBeInTheDocument()
    expect(bloco.getByText(/^Construir o dashboard “PED Supervisores” no PED\./)).toBeInTheDocument()
    expect(posts(chamadas, `${ROTA}/previa-tarefa`)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas, `${ROTA}/previa-tarefa`)[0])).toEqual(CORPO_ESPERADO)
    expect(posts(chamadas, ROTA)).toHaveLength(0)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    const notificacao = await screen.findByText(MENSAGEM_CADASTRO_AGUARDANDO)
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas, ROTA)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas, ROTA)[0])).toEqual(CORPO_ESPERADO)
    const tabela = screen.getByRole('table', { name: 'Dashboards' })
    await waitFor(() => expect(within(tabela).getByText('PED Supervisores')).toBeInTheDocument())
    expect(within(within(tabela).getByText('PED Supervisores').closest('tr')!).getByText('Em construção (TI)')).toBeInTheDocument()
  })

  it('tarefa já criada no Bitrix (status "enviada", "id bitrix" "328169"): "Dashboard cadastrado. Tarefa #328169 criada no Bitrix para a equipe de TI." (INT-04)', async () => {
    const user = usuarioRapido()
    simularSessao({ perfil: 'validador', idTarefa: '328169' })
    const dialogo = await abrirCadastro(user)

    await preencher(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    const notificacao = await screen.findByText('Dashboard cadastrado. Tarefa #328169 criada no Bitrix para a equipe de TI.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByText(/em instantes/)).not.toBeInTheDocument()
  })

  it('tarefa na fila (status "aguardando_envio", "id bitrix" null): "Dashboard cadastrado. A tarefa para a TI será criada no Bitrix em instantes.", sem número', async () => {
    const user = usuarioRapido()
    simularSessao({ idTarefa: null })
    const dialogo = await abrirCadastro(user)

    await preencher(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    expect(await screen.findByText(MENSAGEM_CADASTRO_AGUARDANDO)).toBeInTheDocument()
    expect(screen.queryByText(/Tarefa #\d/)).not.toBeInTheDocument()
  })

  it.each<[string, () => Response]>([
    ['sem "tarefa" na resposta', () => respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, null), 201)],
    ['com status "enviada" mas sem número', () => respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, { ...tarefaBitrixGravacaoApi('T', null), status: 'enviada' }), 201)],
    ['só { mensagem } (2xx = gravado)', () => respostaJson({ mensagem: 'dashboard cadastrado' }, 201)],
  ])('resposta %s: a notificação usa a frase sem número ("em instantes")', async (_caso, resposta) => {
    const user = usuarioRapido()
    simularSessao({ aoCriar: resposta })
    const dialogo = await abrirCadastro(user)

    await preencher(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    expect(await screen.findByText(MENSAGEM_CADASTRO_AGUARDANDO)).toBeInTheDocument()
  })

  it('formato anterior da tarefa ("id" sem "id bitrix") com status "enviada" continua mostrando o número', async () => {
    const user = usuarioRapido()
    simularSessao({
      aoCriar: () =>
        respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, { ...tarefaGravacaoApi('[PED] Construir dashboard: PED Supervisores', 50), status: 'enviada' }), 201),
    })
    const dialogo = await abrirCadastro(user)

    await preencher(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    expect(await screen.findByText('Dashboard cadastrado. Tarefa #50 criada no Bitrix para a equipe de TI.')).toBeInTheDocument()
  })

  it('erro no POST: alerta com a mensagem da API dentro do diálogo, que continua aberto; a lista não muda', async () => {
    const user = usuarioRapido()
    simularSessao({ aoCriar: () => respostaErro(400, 'O indicador Vendas por zona está inativo.') })
    const dialogo = await abrirCadastro(user)

    await preencher(user, dialogo)
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('O indicador Vendas por zona está inativo.')
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Dashboards' })).queryByText('PED Supervisores')).not.toBeInTheDocument()
  })

  it('erro na prévia (POST previa-tarefa): alerta dentro do bloco da tarefa; o cadastro ainda pode ser salvo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ aoPrevia: () => respostaErro(400, 'O indicador Vendas por zona não pode entrar neste dashboard.') })
    const dialogo = await abrirCadastro(user)

    await preencher(user, dialogo)
    await avancar()

    const bloco = within(within(dialogo).getByRole('region', { name: BLOCO }))
    expect(await bloco.findByRole('alert')).toHaveTextContent('O indicador Vendas por zona não pode entrar neste dashboard.')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

    expect(await screen.findByText(MENSAGEM_CADASTRO_AGUARDANDO)).toBeInTheDocument()
    expect(posts(chamadas, ROTA)).toHaveLength(1)
  })

  it('erro ao carregar as listas de vínculo: alerta com a mensagem dentro do diálogo', async () => {
    const user = usuarioRapido()
    simularSessao({ aoListarVinculos: () => respostaErro(500, 'Falha ao consultar os vínculos.') })
    renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })

    await user.click(screen.getByRole('button', { name: 'Novo dashboard' }))

    const dialogo = screen.getByRole('dialog', { name: 'Novo dashboard' })
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Falha ao consultar os vínculos.')
  })

  it('"Cancelar" fecha o diálogo sem gravar', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    const dialogo = await abrirCadastro(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas, ROTA)).toHaveLength(0)
    expect(posts(chamadas, `${ROTA}/previa-tarefa`)).toHaveLength(0)
  })
})
