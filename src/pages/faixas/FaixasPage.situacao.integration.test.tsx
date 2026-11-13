import { screen, waitFor, within } from '@testing-library/react'
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
  type RotaFalsa,
} from '../../test/apiFalsa'
import { dashboardsApi, rotaListarDashboards } from '../../test/dashboardsFalsos'
import {
  NOME_COMERCIAL_100_INATIVA,
  NOME_GERAL_GERENTES_INATIVA,
  NOME_GERAL_SUPERVISORES,
  MENSAGEM_CONFLITO_CORRIDA,
  MENSAGEM_CONFLITO_FAIXAS_ATIVAS,
  MENSAGEM_CONFLITO_GERAL_ATIVA,
  criarApiFaixasFalsa,
  tabelasFaixasComSituacaoApi,
} from '../../test/faixasFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido, type Usuario } from '../../test/usuario'

const ROTA = '/api/ped/faixas'
const COMERCIAL_101 = 'PED Comercial · Filial 101'
const NOMES_ATIVAS = [
  'PED Comercial · Filial 101',
  'PED Comercial · Filial 102',
  'PED Gerentes · Filial 100',
  'PED Antigo · Filial 101',
  NOME_GERAL_SUPERVISORES,
]
const NOMES_INATIVAS = [NOME_COMERCIAL_100_INATIVA, NOME_GERAL_GERENTES_INATIVA]
const ROTULO_GERAL = 'Faixa geral (vale para todas as filiais)'
const ANTIGO_101 = 'PED Antigo · Filial 101'

/**
 * Proposta "faixa geral e situação" (12/11/2026 — pedido do usuário: "colocar uma faixa geral e não
 * somente por filial"). Num dashboard vale a faixa geral OU as faixas por filial; a faixa vinculada a
 * um dashboard não é excluída, é inativada (com motivo), e pode ser reativada (com motivo) se não gerar
 * duas ativas. O `400` de conflito mostra a mensagem da API.
 *
 * Contrato final (F8.12*; `docs/backend/FRONT-faixa-geral-e-situacao.md`): a mensagem de conflito não
 * cita o dashboard; o alerta acrescenta "Dashboard: {nome}" e a lista "Tabelas em conflito" com os
 * itens de `conflitos` ("Geral (todas as filiais)" ou "Filial {código} – {nome}"); `400` sem
 * `conflitos` mostra só a mensagem. `POST`, `PUT` e `PUT .../situacao` respondem sem a tabela (a tela
 * recarrega a lista). Faixa de dashboard excluído não muda de situação: o menu não oferece
 * Inativar/Reativar.
 *
 * API falsa: `criarApiFaixasFalsa(tabelasFaixasComSituacaoApi())` — tabelas 1–4 (formato atual,
 * ativas), 5 (geral ativa do PED Supervisores), 6 (PED Comercial · Filial 100, inativa) e 7 (geral
 * inativa do PED Gerentes, que conflita com a filial 100 ativa).
 */
describe('F8.7 — Faixa geral e situação das tabelas de faixas (integração: /faixas)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' = 'admin', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    const api = criarApiFaixasFalsa(tabelasFaixasComSituacaoApi())
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      'GET /api/ped/dashboards': rotaListarDashboards(dashboardsApi),
      ...api.rotas,
      ...rotasExtras,
    })
    return { chamadas, api }
  }

  const getsFaixas = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const putsSituacao = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'PUT' && /^\/api\/ped\/faixas\/\d+\/situacao$/.test(c.caminho))
  const tabelaFaixas = () => screen.getByRole('table', { name: 'Tabelas de faixas' })
  const itensConflito = (alerta: HTMLElement) =>
    within(within(alerta).getByRole('list', { name: 'Tabelas em conflito' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent)
  const filtroSituacao = () => screen.getByRole('combobox', { name: 'Situação' })
  const gatilho = (nome: string) => screen.queryByRole('button', { name: rotuloAcoesTabelaFaixas(nome) })
  const linha = (nome: string) => screen.getByRole('button', { name: rotuloAcoesTabelaFaixas(nome) }).closest('tr')!
  const nomesNaTabela = () =>
    within(tabelaFaixas())
      .getAllByRole('button', { name: /^Ações da tabela de faixas / })
      .map((botao) => botao.getAttribute('aria-label')?.replace('Ações da tabela de faixas ', ''))

  async function abrirTela() {
    renderizarApp('/faixas')
    return await screen.findByRole('table', { name: 'Tabelas de faixas' })
  }

  async function filtrar(user: Usuario, chamadas: ChamadaRegistrada[], rotulo: 'Ativas' | 'Inativas' | 'Todas') {
    const antes = getsFaixas(chamadas).length
    await user.selectOptions(filtroSituacao(), screen.getByRole('option', { name: rotulo }))
    await waitFor(() => expect(getsFaixas(chamadas).length).toBeGreaterThan(antes))
  }

  describe('filtro de situação (padrão "Ativas")', () => {
    it('abre com "Ativas": GET com situacao=ativas e só as tabelas ativas, inclusive a faixa geral', async () => {
      const { chamadas } = simularSessao()
      await abrirTela()

      expect(within(filtroSituacao()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Ativas', 'Inativas', 'Todas'])
      expect(within(filtroSituacao()).getByRole('option', { name: 'Ativas', selected: true })).toBeInTheDocument()
      expect(getsFaixas(chamadas)).toHaveLength(1)
      expect(getsFaixas(chamadas)[0].url.searchParams.get('situacao')).toBe('ativas')
      expect(nomesNaTabela()).toEqual(NOMES_ATIVAS)
      expect(within(linha(NOME_GERAL_SUPERVISORES)).getByText('Todas as filiais (geral)')).toBeInTheDocument()
    })

    it('"Inativas" consulta situacao=inativas e mostra as inativas com a etiqueta "Inativa"; "Todas" consulta situacao=todas', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()

      await filtrar(user, chamadas, 'Inativas')

      expect(getsFaixas(chamadas).at(-1)!.url.searchParams.get('situacao')).toBe('inativas')
      await waitFor(() => expect(nomesNaTabela()).toEqual(NOMES_INATIVAS))
      for (const nome of NOMES_INATIVAS) expect(within(linha(nome)).getByText('Inativa')).toBeInTheDocument()

      await filtrar(user, chamadas, 'Todas')

      expect(getsFaixas(chamadas).at(-1)!.url.searchParams.get('situacao')).toBe('todas')
      await waitFor(() => expect(nomesNaTabela()).toHaveLength(7))
    })

    it('com uma filial no cabeçalho, a consulta leva filial e situacao, e a faixa geral do dashboard também aparece', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()

      await user.selectOptions(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' }), '101')

      await waitFor(() => expect(getsFaixas(chamadas)).toHaveLength(2))
      const parametros = getsFaixas(chamadas)[1].url.searchParams
      expect(parametros.get('filial')).toBe('101')
      expect(parametros.get('situacao')).toBe('ativas')
      await waitFor(() => expect(nomesNaTabela()).toEqual(['PED Comercial · Filial 101', 'PED Antigo · Filial 101', NOME_GERAL_SUPERVISORES]))
    })
  })

  describe('inativar', () => {
    it('Admin inativa com motivo: PUT .../{id}/situacao { ativa: false, motivo } → "Tabela de faixas inativada.", recarrega e a linha sai das ativas', async () => {
      const user = usuarioRapido()
      const { chamadas, api } = simularSessao()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesTabelaFaixas(COMERCIAL_101), 'Inativar tabela')
      const dialogo = screen.getByRole('dialog', { name: 'Inativar tabela de faixas' })
      await colar(user, within(dialogo).getByRole('textbox', { name: 'Motivo da inativação' }), 'passou a valer a faixa geral')
      await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }))

      const notificacao = await screen.findByText('Tabela de faixas inativada.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(putsSituacao(chamadas)).toHaveLength(1)
      expect(putsSituacao(chamadas)[0].caminho).toBe(`${ROTA}/1/situacao`)
      expect(cabecalhoDaChamada(putsSituacao(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(corpoDaChamada(putsSituacao(chamadas)[0])).toEqual({ ativa: false, motivo: 'passou a valer a faixa geral' })
      await waitFor(() => expect(gatilho(COMERCIAL_101)).not.toBeInTheDocument())
      expect(getsFaixas(chamadas).length).toBeGreaterThanOrEqual(2)
      expect(api.tabelas().find((t) => t.id === 1)?.situacao).toBe('inativa')
    })

    it('tabela de dashboard excluído: o menu não oferece "Inativar tabela" (a API não muda a situação); "Excluir tabela" continua', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(ANTIGO_101))).toEqual([
        'Ver faixas',
        'Alterar faixas',
        'Histórico de versões',
        'Excluir tabela',
      ])
      expect(putsSituacao(chamadas)).toHaveLength(0)
    })

    it('sem motivo, "Inativar" mostra "Informe o motivo da inativação." e não chama a API', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesTabelaFaixas(COMERCIAL_101), 'Inativar tabela')
      const dialogo = screen.getByRole('dialog', { name: 'Inativar tabela de faixas' })
      await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }))

      expect(within(dialogo).getByText('Informe o motivo da inativação.')).toBeInTheDocument()
      expect(putsSituacao(chamadas)).toHaveLength(0)
    })

    it('"Cancelar" fecha sem chamar a API e a linha continua', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesTabelaFaixas(COMERCIAL_101), 'Inativar tabela')
      await user.click(within(screen.getByRole('dialog', { name: 'Inativar tabela de faixas' })).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(putsSituacao(chamadas)).toHaveLength(0)
      expect(gatilho(COMERCIAL_101)).toBeInTheDocument()
    })
  })

  describe('reativar', () => {
    it('reativa a inativa sem conflito: PUT { ativa: true, motivo } → "Tabela de faixas reativada." e a linha sai das inativas', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()
      await filtrar(user, chamadas, 'Inativas')
      await waitFor(() => expect(gatilho(NOME_COMERCIAL_100_INATIVA)).toBeInTheDocument())

      await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_COMERCIAL_100_INATIVA), 'Reativar tabela')
      const dialogo = screen.getByRole('dialog', { name: 'Reativar tabela de faixas' })
      await colar(user, within(dialogo).getByRole('textbox', { name: 'Motivo da reativação' }), 'Filial voltou à régua própria')
      await user.click(within(dialogo).getByRole('button', { name: 'Reativar' }))

      await screen.findByText('Tabela de faixas reativada.')
      expect(putsSituacao(chamadas)[0].caminho).toBe(`${ROTA}/6/situacao`)
      expect(corpoDaChamada(putsSituacao(chamadas)[0])).toEqual({ ativa: true, motivo: 'Filial voltou à régua própria' })
      await waitFor(() => expect(gatilho(NOME_COMERCIAL_100_INATIVA)).not.toBeInTheDocument())
      expect(gatilho(NOME_GERAL_GERENTES_INATIVA)).toBeInTheDocument()
    })

    it('tentativa bloqueada (400 de conflito): o diálogo continua aberto com a mensagem da API, o dashboard e a tabela em conflito; sem notificação', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()
      await filtrar(user, chamadas, 'Inativas')
      await waitFor(() => expect(gatilho(NOME_GERAL_GERENTES_INATIVA)).toBeInTheDocument())

      await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_GERAL_GERENTES_INATIVA), 'Reativar tabela')
      const dialogo = screen.getByRole('dialog', { name: 'Reativar tabela de faixas' })
      await colar(user, within(dialogo).getByRole('textbox', { name: 'Motivo da reativação' }), 'voltar à régua geral')
      await user.click(within(dialogo).getByRole('button', { name: 'Reativar' }))

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent(MENSAGEM_CONFLITO_FAIXAS_ATIVAS)
      expect(within(alerta).getByText('Dashboard: PED Gerentes')).toBeInTheDocument()
      expect(itensConflito(alerta)).toEqual(['Filial 100 – MATRIZ'])
      expect(screen.getByRole('dialog', { name: 'Reativar tabela de faixas' })).toBeInTheDocument()
      expect(within(dialogo).getByRole('textbox', { name: 'Motivo da reativação' })).toHaveValue('voltar à régua geral')
      expect(screen.queryByText('Tabela de faixas reativada.')).not.toBeInTheDocument()
      expect(putsSituacao(chamadas)).toHaveLength(1)
    })

    it('400 sem "conflitos" (corrida entre gravações): só a mensagem da API, sem a lista; o diálogo continua aberto', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao('admin', {
        [`PUT ${ROTA}/6/situacao`]: () => respostaErro(400, MENSAGEM_CONFLITO_CORRIDA),
      })
      await abrirTela()
      await filtrar(user, chamadas, 'Inativas')
      await waitFor(() => expect(gatilho(NOME_COMERCIAL_100_INATIVA)).toBeInTheDocument())

      await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_COMERCIAL_100_INATIVA), 'Reativar tabela')
      const dialogo = screen.getByRole('dialog', { name: 'Reativar tabela de faixas' })
      await colar(user, within(dialogo).getByRole('textbox', { name: 'Motivo da reativação' }), 'voltar à régua própria')
      await user.click(within(dialogo).getByRole('button', { name: 'Reativar' }))

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent(MENSAGEM_CONFLITO_CORRIDA)
      expect(within(alerta).queryByRole('list')).not.toBeInTheDocument()
      expect(screen.queryByText('Tabela de faixas reativada.')).not.toBeInTheDocument()
    })

    it('na tabela inativa, o menu não oferece "Alterar faixas"', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      await abrirTela()
      await filtrar(user, chamadas, 'Inativas')
      await waitFor(() => expect(gatilho(NOME_COMERCIAL_100_INATIVA)).toBeInTheDocument())

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_COMERCIAL_100_INATIVA))).toEqual([
        'Ver faixas',
        'Histórico de versões',
        'Reativar tabela',
        'Excluir tabela',
      ])
    })
  })

  describe('cadastro da faixa geral', () => {
    async function abrirCadastro(user: Usuario) {
      await abrirTela()
      await user.click(screen.getByRole('button', { name: 'Nova tabela de faixas' }))
      const dialogo = screen.getByRole('dialog', { name: 'Nova tabela de faixas' })
      const combo = await within(dialogo).findByRole('combobox', { name: 'Dashboard' })
      await waitFor(() => expect(within(combo).getByRole('option', { name: 'PED Logística' })).toBeInTheDocument())
      return dialogo
    }

    async function preencher(user: Usuario, dialogo: HTMLElement, dashboard: string) {
      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Dashboard' }), dashboard)
      await user.type(within(dialogo).getByRole('textbox', { name: 'De, faixa 1' }), '0')
      await user.type(within(dialogo).getByRole('textbox', { name: 'Até, faixa 1' }), '2.000')
      await user.type(within(dialogo).getByRole('textbox', { name: 'Alíquota, faixa 1' }), '1')
    }

    it('marca "Faixa geral", POST com "filial": "todas" → "Tabela de faixas cadastrada." e a linha "PED Logística · Geral" com "Todas as filiais (geral)"', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      const dialogo = await abrirCadastro(user)

      await user.click(within(dialogo).getByRole('checkbox', { name: ROTULO_GERAL }))
      const filial = within(dialogo).queryByRole('combobox', { name: 'Filial' })
      expect(filial === null || (filial as HTMLSelectElement).disabled).toBe(true)
      await preencher(user, dialogo, 'PED Logística')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tabela de faixas' }))

      await screen.findByText('Tabela de faixas cadastrada.')
      const post = chamadas.find((c) => c.metodo === 'POST' && c.caminho === ROTA)!
      expect(corpoDaChamada(post)).toEqual({ dashboard: 4, filial: 'todas', descricao: null, faixas: [{ de: 0, ate: 2000, aliquota: 1 }] })
      await waitFor(() => expect(gatilho('PED Logística · Geral')).toBeInTheDocument())
      expect(within(linha('PED Logística · Geral')).getByText('Todas as filiais (geral)')).toBeInTheDocument()
    })

    it('faixa geral num dashboard com faixas por filial ativas: o 400 mostra a mensagem, o dashboard e as filiais em conflito no formulário, que continua aberto', async () => {
      const user = usuarioRapido()
      simularSessao()
      const dialogo = await abrirCadastro(user)

      await user.click(within(dialogo).getByRole('checkbox', { name: ROTULO_GERAL }))
      await preencher(user, dialogo, 'PED Comercial')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tabela de faixas' }))

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent(MENSAGEM_CONFLITO_FAIXAS_ATIVAS)
      expect(within(alerta).getByText('Dashboard: PED Comercial')).toBeInTheDocument()
      expect(itensConflito(alerta)).toEqual(['Filial 101 – CAMPO GRANDE', 'Filial 102 – DOURADOS'])
      expect(screen.getByRole('dialog', { name: 'Nova tabela de faixas' })).toBeInTheDocument()
      expect(screen.queryByText('Tabela de faixas cadastrada.')).not.toBeInTheDocument()
    })

    it('faixa por filial num dashboard com faixa geral ativa: o 400 mostra a mensagem, o dashboard e "Geral (todas as filiais)" no formulário', async () => {
      const user = usuarioRapido()
      simularSessao()
      const dialogo = await abrirCadastro(user)

      await preencher(user, dialogo, 'PED Supervisores')
      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Filial' }), '101')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tabela de faixas' }))

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent(MENSAGEM_CONFLITO_GERAL_ATIVA)
      expect(within(alerta).getByText('Dashboard: PED Supervisores')).toBeInTheDocument()
      expect(itensConflito(alerta)).toEqual(['Geral (todas as filiais)'])
    })

    it('cadastro gravado com a resposta final (sem a tabela): fecha, notifica e recarrega a lista, que passa a mostrar a nova tabela', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao()
      const dialogo = await abrirCadastro(user)
      const getsAntes = getsFaixas(chamadas).length

      await user.click(within(dialogo).getByRole('checkbox', { name: ROTULO_GERAL }))
      await preencher(user, dialogo, 'PED Logística')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tabela de faixas' }))

      await screen.findByText('Tabela de faixas cadastrada.')
      expect(screen.queryByRole('dialog', { name: 'Nova tabela de faixas' })).not.toBeInTheDocument()
      await waitFor(() => expect(getsFaixas(chamadas).length).toBeGreaterThan(getsAntes))
      expect(getsFaixas(chamadas).at(-1)!.url.searchParams.get('situacao')).toBe('ativas')
      await waitFor(() => expect(gatilho('PED Logística · Geral')).toBeInTheDocument())
    })
  })

  describe('Validador (mesmas regras do Admin, também na faixa geral — decisão de 12/11/2026)', () => {
    it('vê a opção "Faixa geral" no cadastro e cadastra a faixa geral com "filial": "todas"', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao('validador')
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Nova tabela de faixas' }))
      const dialogo = screen.getByRole('dialog', { name: 'Nova tabela de faixas' })
      const combo = await within(dialogo).findByRole('combobox', { name: 'Dashboard' })
      await waitFor(() => expect(within(combo).getByRole('option', { name: 'PED Logística' })).toBeInTheDocument())

      await user.click(within(dialogo).getByRole('checkbox', { name: ROTULO_GERAL }))
      await user.selectOptions(combo, 'PED Logística')
      await user.type(within(dialogo).getByRole('textbox', { name: 'De, faixa 1' }), '0')
      await user.type(within(dialogo).getByRole('textbox', { name: 'Até, faixa 1' }), '2.000')
      await user.type(within(dialogo).getByRole('textbox', { name: 'Alíquota, faixa 1' }), '1')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tabela de faixas' }))

      await screen.findByText('Tabela de faixas cadastrada.')
      const post = chamadas.find((c) => c.metodo === 'POST' && c.caminho === ROTA)!
      expect(corpoDaChamada(post)).toMatchObject({ dashboard: 4, filial: 'todas' })
    })

    it('tem na faixa geral o mesmo menu das faixas por filial e a inativa com motivo', async () => {
      const user = usuarioRapido()
      const { chamadas } = simularSessao('validador')
      await abrirTela()

      const menuAtiva = ['Ver faixas', 'Alterar faixas', 'Histórico de versões', 'Inativar tabela', 'Excluir tabela']
      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_GERAL_SUPERVISORES))).toEqual(menuAtiva)
      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(COMERCIAL_101))).toEqual(menuAtiva)

      await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_GERAL_SUPERVISORES), 'Inativar tabela')
      const dialogo = screen.getByRole('dialog', { name: 'Inativar tabela de faixas' })
      await colar(user, within(dialogo).getByRole('textbox', { name: 'Motivo da inativação' }), 'passou a valer faixa por filial')
      await user.click(within(dialogo).getByRole('button', { name: 'Inativar' }))

      await screen.findByText('Tabela de faixas inativada.')
      expect(putsSituacao(chamadas)[0].caminho).toBe(`${ROTA}/5/situacao`)
      expect(corpoDaChamada(putsSituacao(chamadas)[0])).toEqual({ ativa: false, motivo: 'passou a valer faixa por filial' })
    })
  })
})
