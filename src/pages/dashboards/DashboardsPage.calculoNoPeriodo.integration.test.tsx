import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { respostaDadosExternosApi } from '../../test/dadosExternosFalsos'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_SUPERVISORES_API,
  dadosExternosParaDashboardApi,
  dashboardsApi,
  detalheDashboardApi,
  indicadoresParaDashboardApi,
  previaTarefaApi,
  respostaGravacaoApi,
  rotaListarDashboards,
  rotaVinculos,
  tarefaBitrixGravacaoApi,
  type DashboardApiFalso,
} from '../../test/dashboardsFalsos'
import { respostaIndicadoresApi } from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'
const ATRASO_PREVIA_MS = 500
const AVISO =
  'Como o dashboard não é mensal, o sistema vai usar o resultado mensal de cada mês do período e fazer o cálculo escolhido em cada indicador.'
const ERRO_CALCULO = 'Selecione o cálculo no período.'

/**
 * F7.15 — contrato proposto em `docs/propostas-backend/PROPOSTA-calculo-no-periodo-dashboard.md`:
 * `"calculo do periodo"` em cada item de `indicadores` do POST/PUT (e da prévia) quando a periodicidade
 * não é mensal; o detalhe traz o mesmo campo para a edição vir preenchida.
 */
describe('F7.15 — Cálculo no período dos indicadores em dashboard não mensal (integração: /dashboards)', () => {
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
    aoCriar?: () => Response
    aoEditar?: () => Response
    aoDetalhar?: () => Response
  }

  function simularSessao({ aoCriar, aoEditar, aoDetalhar }: Opcoes = {}) {
    const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })
    let lista: DashboardApiFalso[] = dashboardsApi().filter((d) => d.id !== 3)
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      [`GET ${ROTA}/1`]: aoDetalhar ?? (() => respostaJson(detalheDashboardApi(DASHBOARD_COMERCIAL_API))),
      [`GET ${ROTA}/1/tarefas`]: () => respostaJson([]),
      'GET /api/ped/indicadores-cadastro': () => respostaJson(respostaIndicadoresApi(indicadoresParaDashboardApi())),
      'GET /api/ped/dados-externos-cadastro': () => respostaJson(respostaDadosExternosApi(dadosExternosParaDashboardApi())),
      'GET /api/ped/vinculos': rotaVinculos(),
      [`POST ${ROTA}/previa-tarefa`]: (init) => {
        const { nome } = JSON.parse(String(init?.body)) as { nome: string }
        return respostaJson(previaTarefaApi(nome))
      },
      [`POST ${ROTA}`]: () => {
        if (aoCriar) return aoCriar()
        lista = [...lista, { ...DASHBOARD_SUPERVISORES_API }]
        return respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaBitrixGravacaoApi('[PED] Construir dashboard: PED Supervisores')), 201)
      },
      [`PUT ${ROTA}/1`]: () => (aoEditar ? aoEditar() : respostaJson(respostaGravacaoApi(DASHBOARD_COMERCIAL_API, null))),
    })
  }

  const posts = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === caminho)
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function avancar(ms = ATRASO_PREVIA_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  async function abrirEEscolher(user: Usuario, escopo: HTMLElement, botao: string, lista: string, item: string) {
    const gatilho = within(escopo).getByRole('button', { name: botao })
    if (gatilho.getAttribute('aria-expanded') !== 'true') await user.click(gatilho)
    await user.click(within(within(escopo).getByRole('listbox', { name: lista })).getByRole('option', { name: (n) => n.startsWith(item) }))
  }

  async function abrirCadastro(user: Usuario) {
    renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })
    await user.click(screen.getByRole('button', { name: 'Novo dashboard' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo dashboard' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando dados do formulário...')).not.toBeInTheDocument())
    return dialogo
  }

  async function abrirEdicaoComercial(user: Usuario) {
    renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })
    await escolherAcao(user, rotuloAcoesDashboard('PED Comercial'), 'Editar')
    const dialogo = screen.getByRole('dialog', { name: 'Editar dashboard' })
    await waitFor(() => expect(within(dialogo).getByRole('textbox', { name: 'Nome do dashboard' })).toHaveValue('PED Comercial'))
    await waitFor(() => expect(within(dialogo).queryByText('Carregando dados do formulário...')).not.toBeInTheDocument())
    return dialogo
  }

  const calculo = (dialogo: HTMLElement, nome: string) =>
    within(within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })).getByRole('combobox', { name: `Cálculo no período de ${nome}` })

  /** Cadastro semestral, por colaboradores (Fábio Nunes e Ana Souza), sem o cálculo no período. */
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
    await user.selectOptions(d.getByRole('combobox', { name: 'Indicador base da faixa' }), 'Cobertura de visitas')
    await colar(user, d.getByRole('textbox', { name: 'Fórmula de pontuação' }), 'Pontos base × atingimento, sem limite.')
  }

  describe('cadastro', () => {
    it('semestral: aviso na seção de indicadores; salvar sem o cálculo mostra o erro em cada indicador e não faz o POST nem a prévia', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      const dialogo = await abrirCadastro(user)

      await preencher(user, dialogo)
      const grupo = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
      expect(within(grupo).getByText(AVISO)).toBeInTheDocument()
      await avancar(ATRASO_PREVIA_MS + 100)
      expect(posts(chamadas, `${ROTA}/previa-tarefa`)).toHaveLength(0)

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

      expect(calculo(dialogo, 'Cobertura de visitas')).toHaveAccessibleDescription(expect.stringContaining(ERRO_CALCULO))
      expect(calculo(dialogo, 'Vendas por zona')).toHaveAccessibleDescription(expect.stringContaining(ERRO_CALCULO))
      expect(posts(chamadas, ROTA)).toHaveLength(0)
      expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
    })

    it('fluxo completo: escolher o cálculo de cada indicador → prévia e POST com "calculo do periodo" em cada indicador → diálogo fecha', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      const dialogo = await abrirCadastro(user)

      await preencher(user, dialogo)
      await user.selectOptions(calculo(dialogo, 'Cobertura de visitas'), 'Fazer a média')
      await user.selectOptions(calculo(dialogo, 'Vendas por zona'), 'Somar')
      await avancar()

      await waitFor(() => expect(posts(chamadas, `${ROTA}/previa-tarefa`)).toHaveLength(1))
      const indicadoresEsperados = [
        { 'id indicador': 1, 'pontos base': 70, 'calculo do periodo': 'media' },
        { 'id indicador': 8, 'pontos base': 50, 'calculo do periodo': 'soma' },
      ]
      expect(corpoDaChamada(posts(chamadas, `${ROTA}/previa-tarefa`)[0])).toMatchObject({
        periodicidade: 'semestral',
        indicadores: indicadoresEsperados,
      })

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(posts(chamadas, ROTA)).toHaveLength(1)
      expect(corpoDaChamada(posts(chamadas, ROTA)[0])).toMatchObject({ periodicidade: 'semestral', indicadores: indicadoresEsperados })
    })

    it('voltar para Mensal antes de salvar: o POST vai sem "calculo do periodo"', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      const dialogo = await abrirCadastro(user)

      await preencher(user, dialogo)
      await user.selectOptions(calculo(dialogo, 'Cobertura de visitas'), 'Fazer a média')
      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Periodicidade de lançamento' }), 'Mensal')
      expect(within(dialogo).queryByText(AVISO)).not.toBeInTheDocument()

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

      await waitFor(() => expect(posts(chamadas, ROTA)).toHaveLength(1))
      const corpo = corpoDaChamada(posts(chamadas, ROTA)[0]) as { periodicidade: string; indicadores: Array<Record<string, unknown>> }
      expect(corpo.periodicidade).toBe('mensal')
      expect(corpo.indicadores).toEqual([
        { 'id indicador': 1, 'pontos base': 70 },
        { 'id indicador': 8, 'pontos base': 50 },
      ])
    })

    it('erro 400 do back-end sobre o cálculo: a mensagem aparece no alerta do diálogo, que continua aberto', async () => {
      const user = usuarioRapido()
      simularSessao({ aoCriar: () => respostaErro(400, 'informe o calculo do periodo do indicador Vendas por zona') })
      const dialogo = await abrirCadastro(user)

      await preencher(user, dialogo)
      await user.selectOptions(calculo(dialogo, 'Cobertura de visitas'), 'Somar')
      await user.selectOptions(calculo(dialogo, 'Vendas por zona'), 'Usar só o último valor')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' }))

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('informe o calculo do periodo do indicador Vendas por zona')
      expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
      expect(calculo(dialogo, 'Vendas por zona')).toHaveValue('ultimo')
    })
  })

  describe('edição', () => {
    it('PED Comercial (trimestral): os selects vêm preenchidos pelo "calculo do periodo" do detalhe e o PUT os devolve', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      const dialogo = await abrirEdicaoComercial(user)

      await waitFor(() => expect(calculo(dialogo, 'Cobertura de visitas')).toHaveValue('media'))
      expect(calculo(dialogo, 'Faturamento líquido mensal')).toHaveValue('soma')
      expect(within(dialogo).getByText(AVISO)).toBeInTheDocument()

      await user.selectOptions(calculo(dialogo, 'Faturamento líquido mensal'), 'Usar só o último valor')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

      expect(await screen.findByText('Dashboard atualizado.')).toBeInTheDocument()
      expect(puts(chamadas)).toHaveLength(1)
      expect(corpoDaChamada(puts(chamadas)[0])).toMatchObject({
        periodicidade: 'trimestral',
        indicadores: [
          { 'id indicador': 1, 'pontos base': 40, 'calculo do periodo': 'media' },
          { 'id indicador': 3, 'pontos base': 60, 'calculo do periodo': 'ultimo' },
        ],
      })
    })

    it('detalhe sem "calculo do periodo" (dashboard não mensal antigo): selects vazios; salvar exige o cálculo e não faz o PUT', async () => {
      const user = usuarioRapido()
      const detalhe = detalheDashboardApi(DASHBOARD_COMERCIAL_API)
      const chamadas = simularSessao({
        aoDetalhar: () =>
          respostaJson({ ...detalhe, indicadores: detalhe.indicadores.map((item) => ({ ...item, 'calculo do periodo': null })) }),
      })
      const dialogo = await abrirEdicaoComercial(user)

      await waitFor(() => expect(calculo(dialogo, 'Cobertura de visitas')).toHaveValue(''))
      expect(calculo(dialogo, 'Faturamento líquido mensal')).toHaveValue('')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

      expect(within(dialogo).getAllByText(ERRO_CALCULO)).toHaveLength(2)
      expect(puts(chamadas)).toHaveLength(0)

      await user.selectOptions(calculo(dialogo, 'Cobertura de visitas'), 'Somar')
      await user.selectOptions(calculo(dialogo, 'Faturamento líquido mensal'), 'Somar')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

      expect(await screen.findByText('Dashboard atualizado.')).toBeInTheDocument()
      expect(corpoDaChamada(puts(chamadas)[0])).toMatchObject({
        indicadores: [
          { 'id indicador': 1, 'pontos base': 40, 'calculo do periodo': 'soma' },
          { 'id indicador': 3, 'pontos base': 60, 'calculo do periodo': 'soma' },
        ],
      })
    })

    it('detalhe com "calculo do periodo" fora do enum: o diálogo mostra o erro de resposta inválida, sem o formulário', async () => {
      const user = usuarioRapido()
      const detalhe = detalheDashboardApi(DASHBOARD_COMERCIAL_API)
      simularSessao({
        aoDetalhar: () => respostaJson({ ...detalhe, indicadores: detalhe.indicadores.map((item) => ({ ...item, 'calculo do periodo': 'quinzenal' })) }),
      })
      renderizarApp('/dashboards')
      await screen.findByRole('table', { name: 'Dashboards' })

      await escolherAcao(user, rotuloAcoesDashboard('PED Comercial'), 'Editar')

      const dialogo = screen.getByRole('dialog', { name: 'Editar dashboard' })
      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Resposta inválida do servidor.')
      expect(within(dialogo).queryByRole('textbox', { name: 'Nome do dashboard' })).not.toBeInTheDocument()
    })

    it('mudar para Mensal na edição: o PUT vai sem "calculo do periodo"', async () => {
      const user = usuarioRapido()
      const chamadas = simularSessao()
      const dialogo = await abrirEdicaoComercial(user)

      await waitFor(() => expect(calculo(dialogo, 'Cobertura de visitas')).toHaveValue('media'))
      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Periodicidade de lançamento' }), 'Mensal')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }))

      expect(await screen.findByText('Dashboard atualizado.')).toBeInTheDocument()
      const corpo = corpoDaChamada(puts(chamadas)[0]) as { periodicidade: string; indicadores: Array<Record<string, unknown>> }
      expect(corpo.periodicidade).toBe('mensal')
      expect(corpo.indicadores).toEqual([
        { 'id indicador': 1, 'pontos base': 40 },
        { 'id indicador': 3, 'pontos base': 60 },
      ])
    })
  })
})
