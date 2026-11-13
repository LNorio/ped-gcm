import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { criarApiFechamentosFalsa, type FechamentoApiFalso } from '../../test/fechamentosFalsos'
import { itensDoMenuAcoes, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/fechamentos'
const ATRASO_BUSCA_MS = 500
const SECAO = 'Encerrar período por dashboard'
const LEGENDA = 'Fechamentos por dashboard'
const TODOS = ['PED Gerentes', 'PED Comercial', 'PED Vendedores']

describe('F10.2 — Aba Fechamentos: lista de dashboards ativos com filtros (integração: /fechamentos)', () => {
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

  type Perfil = 'admin' | 'validador' | 'preenchedor'

  /**
   * Sessão do perfil e back-end falso dos fechamentos. O Validador entra com **uma** filial (101), para
   * mostrar que a aba lista os dashboards de todas as filiais mesmo assim (A-05).
   */
  function simularSessao(perfil: Perfil = 'admin', opcoes: { listar?: RotaFalsa; fechamentos?: FechamentoApiFalso[] } = {}) {
    const acesso =
      perfil === 'admin'
        ? acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
        : acessoApi({ perfil, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
    const api = criarApiFechamentosFalsa(opcoes.fechamentos ? { fechamentos: opcoes.fechamentos } : {})
    const rotas: Record<string, RotaFalsa> = { ...api.rotas, 'GET /api/ped/acesso': () => respostaJson(acesso) }
    if (opcoes.listar) rotas[`GET ${ROTA}`] = opcoes.listar
    return { chamadas: simularApi(fetchFalso, rotas), api }
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const ultimoGet = (chamadas: ChamadaRegistrada[]) => gets(chamadas)[gets(chamadas).length - 1]

  const secao = () => screen.getByRole('region', { name: SECAO })

  async function abrirTela() {
    const app = renderizarApp('/fechamentos')
    const tabela = await screen.findByRole('table', { name: LEGENDA })
    return { ...app, tabela }
  }

  /** Nomes dos dashboards nas linhas da tabela, na ordem exibida. */
  function nomesNaTabela(tabela: HTMLElement): string[] {
    return within(tabela)
      .getAllByRole('row')
      .slice(1)
      .map((tr) => TODOS.find((nome) => within(tr).queryByText(nome) !== null) ?? tr.textContent ?? '')
  }

  function linha(tabela: HTMLElement, nome: string): HTMLElement {
    const tr = within(tabela).getByText(nome).closest('tr')
    if (!tr) throw new Error(`Linha de ${nome} não encontrada`)
    return tr
  }

  function opcaoSituacao(rotulo: string) {
    return within(within(secao()).getByRole('listbox', { name: 'Situação do período' }))
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText(rotulo) !== null)!
  }

  const seletorPeriodicidade = () => within(secao()).getByRole('combobox', { name: 'Periodicidade' })
  const campoBusca = () => within(secao()).getByRole('searchbox', { name: 'Buscar' })
  const botaoLimpar = () => within(secao()).queryByRole('button', { name: 'Limpar filtros' })

  describe('acesso (Admin e Validador, todas as filiais — A-05)', () => {
    it('Admin abre /fechamentos: título, seção, GET com o Bearer e sem query, linhas por periodicidade e nome', async () => {
      const { chamadas } = simularSessao('admin')
      const { tabela } = await abrirTela()

      expect(screen.getByRole('heading', { level: 1, name: 'Fechamentos' })).toBeInTheDocument()
      expect(secao()).toContainElement(tabela)
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(TODOS))

      expect(gets(chamadas)).toHaveLength(1)
      expect(cabecalhoDaChamada(gets(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
      expect(gets(chamadas)[0].url.search).toBe('')
    })

    it('Validador com uma filial vê os dashboards de todas as filiais (sem filtro de filial na consulta)', async () => {
      const { chamadas } = simularSessao('validador')
      const { tabela } = await abrirTela()

      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(TODOS))
      for (const chamada of gets(chamadas)) expect(chamada.url.searchParams.has('filial')).toBe(false)
      expect(within(linha(tabela, 'PED Comercial')).getByText('Filiais: 100, 101, 102')).toBeInTheDocument()
    })

    it('Preenchedor não acessa: volta ao Início, sem a aba no menu e sem consultar os fechamentos', async () => {
      const { chamadas } = simularSessao('preenchedor')
      const { roteador } = renderizarApp('/fechamentos')

      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/')
      expect(screen.queryByRole('link', { name: /Fechamentos/ })).not.toBeInTheDocument()
      expect(gets(chamadas)).toHaveLength(0)
    })
  })

  describe('conteúdo das linhas (RF-78)', () => {
    it('PED Gerentes: vínculo, unidades e pendências, periodicidade, período, progresso e etiquetas', async () => {
      simularSessao()
      const { tabela } = await abrirTela()
      const tr = linha(tabela, 'PED Gerentes')

      expect(within(tr).getByText('Cargos: Gerente de Loja')).toBeInTheDocument()
      expect(within(tr).getByText('2 colaboradores')).toBeInTheDocument()
      expect(within(tr).getByText('2 com pendências')).toBeInTheDocument()
      expect(within(tr).getByText('Mensal')).toBeInTheDocument()
      expect(within(tr).getByText('11/2026')).toBeInTheDocument()
      expect(within(tr).getByText('Em aberto')).toBeInTheDocument()
      expect(within(tr).getByText('1 de 4 lançamentos')).toBeInTheDocument()
      expect(within(tr).getByRole('progressbar', { name: 'Progresso de lançamentos de PED Gerentes' })).toHaveAttribute(
        'aria-valuenow',
        '25',
      )
      expect(within(tr).getByText('1 indicador com problema')).toBeInTheDocument()
      expect(within(tr).getByText('Sem tabela de faixas: filial 102')).toBeInTheDocument()
    })

    it('PED Comercial (por filiais) e PED Vendedores (encerrado, sem pendências)', async () => {
      simularSessao()
      const { tabela } = await abrirTela()

      const comercial = linha(tabela, 'PED Comercial')
      expect(within(comercial).getByText('3 filiais')).toBeInTheDocument()
      expect(within(comercial).getByText('1 com pendências')).toBeInTheDocument()
      expect(within(comercial).getByText('Trimestral')).toBeInTheDocument()
      expect(within(comercial).getByText('4º tri/2026')).toBeInTheDocument()
      expect(within(comercial).getByText('5 de 6 lançamentos')).toBeInTheDocument()
      expect(within(comercial).queryByText(/com problema/)).not.toBeInTheDocument()

      const vendedores = linha(tabela, 'PED Vendedores')
      expect(within(vendedores).getByText('2 colaboradores vinculados')).toBeInTheDocument()
      expect(within(vendedores).getByText('Sem pendências')).toBeInTheDocument()
      expect(within(vendedores).getByText('Anual')).toBeInTheDocument()
      expect(within(vendedores).getByText('Encerrado')).toBeInTheDocument()
      expect(within(vendedores).queryByText(/Sem tabela de faixas/)).not.toBeInTheDocument()
    })

    it('menu de ações da linha em aberto tem "Pré-visualizar imagens" e "Encerrar período"', async () => {
      const user = configurarUsuario()
      simularSessao('validador')
      const { tabela } = await abrirTela()

      const itens = await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'), tabela)
      expect(itens).toEqual(expect.arrayContaining(['Pré-visualizar imagens', 'Encerrar período']))
    })

    it('sem dashboards ativos e sem filtro: "Nenhum dashboard ativo."', async () => {
      simularSessao('admin', { fechamentos: [] })
      const { tabela } = await abrirTela()

      expect(await within(tabela).findByText('Nenhum dashboard ativo.')).toBeInTheDocument()
    })
  })

  describe('filtros (RF-79)', () => {
    it('padrão: "Todas as periodicidades", situação "Todas", busca vazia e sem "Limpar filtros"', async () => {
      simularSessao()
      await abrirTela()

      expect(seletorPeriodicidade()).toHaveDisplayValue('Todas as periodicidades')
      expect(
        within(seletorPeriodicidade())
          .getAllByRole('option')
          .map((opcao) => opcao.textContent),
      ).toEqual(['Todas as periodicidades', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'])
      expect(
        within(within(secao()).getByRole('listbox', { name: 'Situação do período' }))
          .getAllByRole('option')
          .map((opcao) => opcao.textContent?.trim()),
      ).toEqual(['Todas', 'Em aberto', 'Encerrado'])
      expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'true')
      expect(campoBusca()).toHaveValue('')
      expect(botaoLimpar()).not.toBeInTheDocument()
    })

    it('periodicidade consulta na hora com periodicidade na query e mostra só os dashboards devolvidos', async () => {
      const user = configurarUsuario()
      const { chamadas } = simularSessao()
      const { tabela } = await abrirTela()

      await user.selectOptions(seletorPeriodicidade(), 'Trimestral')

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('periodicidade')).toBe('trimestral'))
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Comercial']))
      expect(seletorPeriodicidade()).toHaveDisplayValue('Trimestral')
      expect(botaoLimpar()).toBeInTheDocument()
    })

    it('situação "Encerrado" envia situacao=encerrado; "Em aberto" envia situacao=aberto', async () => {
      const user = configurarUsuario()
      const { chamadas } = simularSessao()
      const { tabela } = await abrirTela()

      await user.click(opcaoSituacao('Encerrado'))
      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('encerrado'))
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Vendedores']))
      expect(opcaoSituacao('Encerrado')).toHaveAttribute('aria-selected', 'true')

      await user.click(opcaoSituacao('Em aberto'))
      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('aberto'))
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Gerentes', 'PED Comercial']))
    })

    it('busca pelo dashboard consulta 500 ms após a última tecla', async () => {
      const user = configurarUsuario()
      const { chamadas } = simularSessao()
      const { tabela } = await abrirTela()

      await user.type(campoBusca(), 'vendedores')
      expect(gets(chamadas)).toHaveLength(1)
      await avancar()

      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('vendedores')
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Vendedores']))
    })

    it('busca pelo grupo vinculado e pelo período', async () => {
      const user = configurarUsuario()
      const { chamadas } = simularSessao()
      const { tabela } = await abrirTela()

      await user.type(campoBusca(), 'gerente de loja')
      await avancar()
      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('gerente de loja'))
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Gerentes']))

      await user.clear(campoBusca())
      await user.type(campoBusca(), '4º tri/2026')
      await avancar()
      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('4º tri/2026'))
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Comercial']))
    })

    it('periodicidade, situação e busca combinadas vão na mesma consulta', async () => {
      const user = configurarUsuario()
      const { chamadas } = simularSessao()
      const { tabela } = await abrirTela()

      await user.selectOptions(seletorPeriodicidade(), 'Mensal')
      await user.click(opcaoSituacao('Em aberto'))
      await user.type(campoBusca(), 'gerentes')
      await avancar()

      await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('gerentes'))
      const query = ultimoGet(chamadas).url.searchParams
      expect(query.get('periodicidade')).toBe('mensal')
      expect(query.get('situacao')).toBe('aberto')
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Gerentes']))
    })

    it('sem resultados mostra "Nenhum dashboard encontrado para os filtros."; "Limpar filtros" volta à lista completa', async () => {
      const user = configurarUsuario()
      const { chamadas } = simularSessao()
      const { tabela } = await abrirTela()

      await user.selectOptions(seletorPeriodicidade(), 'Anual')
      await user.click(opcaoSituacao('Em aberto'))
      expect(await within(tabela).findByText('Nenhum dashboard encontrado para os filtros.')).toBeInTheDocument()

      await user.click(botaoLimpar()!)

      await waitFor(() => expect(ultimoGet(chamadas).url.search).toBe(''))
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(TODOS))
      expect(seletorPeriodicidade()).toHaveDisplayValue('Todas as periodicidades')
      expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'true')
      expect(campoBusca()).toHaveValue('')
      expect(botaoLimpar()).not.toBeInTheDocument()
    })

    it('"Limpar filtros" também limpa a busca digitada', async () => {
      const user = configurarUsuario()
      const { chamadas } = simularSessao()
      const { tabela } = await abrirTela()

      await user.type(campoBusca(), 'comercial')
      await avancar()
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(['PED Comercial']))

      await user.click(botaoLimpar()!)

      expect(campoBusca()).toHaveValue('')
      await waitFor(() => expect(ultimoGet(chamadas).url.search).toBe(''))
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(TODOS))
    })
  })

  describe('erros de carga', () => {
    it('500 na listagem: alerta com a mensagem da API e "Tentar novamente", sem a tabela', async () => {
      simularSessao('admin', { listar: () => respostaErro(500, 'Falha ao consultar os fechamentos.') })
      renderizarApp('/fechamentos')

      expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar os fechamentos.')
      expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      expect(screen.queryByRole('table', { name: LEGENDA })).not.toBeInTheDocument()
    })

    it('"Tentar novamente" repete a consulta e mostra a lista quando a API volta', async () => {
      const user = configurarUsuario()
      let falhar = true
      const api = criarApiFechamentosFalsa()
      const { chamadas } = simularSessao('admin', {
        listar: (init, url) => (falhar ? respostaErro(500, 'Falha ao consultar os fechamentos.') : api.rotas[`GET ${ROTA}`](init, url)),
      })
      renderizarApp('/fechamentos')
      await screen.findByRole('alert')

      falhar = false
      await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

      const tabela = await screen.findByRole('table', { name: LEGENDA })
      await waitFor(() => expect(nomesNaTabela(tabela)).toEqual(TODOS))
      expect(gets(chamadas)).toHaveLength(2)
      expect(screen.queryByText('Falha ao consultar os fechamentos.')).not.toBeInTheDocument()
    })
  })
})
