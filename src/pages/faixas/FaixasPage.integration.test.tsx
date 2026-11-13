import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
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
import { NOMES_TABELAS_FAIXAS, criarApiFaixasFalsa } from '../../test/faixasFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'
import { formatarMoeda, formatarPercentual } from '../../utils/formato'

const ROTA = '/api/ped/faixas'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
/** Menu de uma tabela ativa com todas as permissões (F8.7: "Inativar tabela" antes de "Excluir tabela"). */
const MENU_COMPLETO = ['Ver faixas', 'Alterar faixas', 'Histórico de versões', 'Inativar tabela', 'Excluir tabela']

describe('F8.2 — Aba Faixas (integração: /faixas com Admin, Validador e Preenchedor — RF-41, RNF-03)', () => {
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

  /** Admin e Validador com "Todas as filiais" (premissa do plano; A-04 para o Validador na API). */
  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    const api = criarApiFaixasFalsa()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      ...rotasExtras,
    })
  }

  const getsFaixas = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const seletorFilial = () => within(screen.getByRole('banner')).getByRole('combobox', { name: 'Filial' })

  async function abrirTela() {
    renderizarApp('/faixas')
    return await screen.findByRole('table', { name: 'Tabelas de faixas' })
  }

  const nomesNaTabela = (tabela: HTMLElement) =>
    within(tabela)
      .getAllByRole('button', { name: /^Ações da tabela de faixas / })
      .map((botao) => botao.getAttribute('aria-label')?.replace('Ações da tabela de faixas ', ''))

  it('Admin com "Todas as filiais": título "Faixas", GET /api/ped/faixas sem filial, só com situacao=ativas (filtro padrão — F8.7), com o Bearer, e todas as tabelas', async () => {
    const chamadas = simularSessao('admin')

    const tabela = await abrirTela()

    expect(screen.getByRole('heading', { level: 1, name: 'Faixas' })).toBeInTheDocument()
    expect(getsFaixas(chamadas)).toHaveLength(1)
    expect([...getsFaixas(chamadas)[0].url.searchParams.entries()]).toEqual([['situacao', 'ativas']])
    expect(cabecalhoDaChamada(getsFaixas(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(nomesNaTabela(tabela)).toEqual([...NOMES_TABELAS_FAIXAS])
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Dashboard', 'Filial', 'Versão vigente', 'Faixas', 'Ações'])
    const comercial = within(tabela).getByRole('button', { name: rotuloAcoesTabelaFaixas('PED Comercial · Filial 101') }).closest('tr')!
    expect(within(comercial).getByText('v2')).toBeInTheDocument()
    expect(within(comercial).getByText('20/10/2026 15:30 por Ana Costa')).toBeInTheDocument()
  })

  it('escolher uma filial no cabeçalho consulta GET ?filial={código} e mostra só as tabelas dela; voltar a "Todas" consulta sem filial (mantendo situacao=ativas)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await user.selectOptions(seletorFilial(), '101')

    await waitFor(() => expect(getsFaixas(chamadas)).toHaveLength(2))
    expect(getsFaixas(chamadas)[1].url.searchParams.get('filial')).toBe('101')
    await waitFor(() =>
      expect(nomesNaTabela(screen.getByRole('table', { name: 'Tabelas de faixas' }))).toEqual(['PED Comercial · Filial 101', 'PED Antigo · Filial 101']),
    )

    await user.selectOptions(seletorFilial(), 'todas')

    await waitFor(() => expect(getsFaixas(chamadas)).toHaveLength(3))
    expect([...getsFaixas(chamadas)[2].url.searchParams.entries()]).toEqual([['situacao', 'ativas']])
    await waitFor(() => expect(nomesNaTabela(screen.getByRole('table', { name: 'Tabelas de faixas' }))).toHaveLength(4))
  })

  it('"Ver faixas" mostra as linhas De/Até em reais e a Alíquota em %, no padrão pt-BR', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()

    await escolherAcao(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'), 'Ver faixas')

    const faixas = screen.getByRole('table', { name: 'Faixas vigentes de PED Comercial · Filial 101' })
    expect(within(faixas).getAllByRole('row').slice(1).map((l) => within(l).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      [formatarMoeda(0), formatarMoeda(1000), formatarPercentual(0)],
      [formatarMoeda(1000.01), formatarMoeda(2000), formatarPercentual(1.5)],
      [formatarMoeda(2000.01), formatarMoeda(5000), formatarPercentual(3)],
    ])
  })

  it('Admin vê "Nova tabela de faixas" e o menu completo em cada tabela', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()

    expect(screen.getByRole('button', { name: 'Nova tabela de faixas' })).toBeInTheDocument()
    expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Gerentes · Filial 100'))).toEqual(MENU_COMPLETO)
  })

  it('Validador vê a aba "Faixas" ativa, todas as filiais, "Nova tabela de faixas" e o mesmo menu (documento prevalece — P-04)', async () => {
    const user = usuarioRapido()
    simularSessao('validador')

    const tabela = await abrirTela()

    expect(screen.getByText('Validador')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Faixas/ })).toHaveAttribute('aria-current', 'page')
    expect(nomesNaTabela(tabela)).toEqual([...NOMES_TABELAS_FAIXAS])
    expect(screen.getByRole('button', { name: 'Nova tabela de faixas' })).toBeInTheDocument()
    expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 102'))).toEqual(MENU_COMPLETO)
  })

  it('Validador em outra filial: a consulta envia ?filial e, se a API recusar (403 — A-04), a tela mostra a mensagem da API', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador', {
      [`GET ${ROTA}`]: (_init, url) =>
        url.searchParams.get('filial') === '102'
          ? respostaErro(403, 'Acesso negado às faixas desta filial.')
          : respostaJson([]),
    })
    await abrirTela()

    await user.selectOptions(seletorFilial(), '102')

    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso negado às faixas desta filial.')
    expect(getsFaixas(chamadas).at(-1)!.url.searchParams.get('filial')).toBe('102')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

  it('sem tabelas: "Nenhuma tabela de faixas cadastrada." com "Todas as filiais" e "Nenhuma tabela de faixas para a filial {código}." com uma filial', async () => {
    const user = usuarioRapido()
    simularSessao('admin', { [`GET ${ROTA}`]: () => respostaJson([]) })
    renderizarApp('/faixas')

    expect(await screen.findByText('Nenhuma tabela de faixas cadastrada.')).toBeInTheDocument()

    await user.selectOptions(seletorFilial(), '102')

    expect(await screen.findByText('Nenhuma tabela de faixas para a filial 102.')).toBeInTheDocument()
  })

  it('Preenchedor não vê a aba Faixas e, ao abrir /faixas, volta ao Início sem consultar as faixas', async () => {
    const chamadas = simularSessao('preenchedor')
    renderizarApp('/faixas')

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Abas' })).queryByRole('link', { name: /Faixas/ })).not.toBeInTheDocument()
    expect(chamadas.filter((c) => c.caminho.startsWith(ROTA))).toHaveLength(0)
  })

  it('500 na listagem: Aviso de erro com a mensagem da API e "Tentar novamente", sem a tabela; tentar de novo consulta outra vez', async () => {
    const user = usuarioRapido()
    let falhar = true
    const chamadas = simularSessao('admin', {
      [`GET ${ROTA}`]: () => (falhar ? respostaErro(500, 'Falha ao consultar as faixas.') : respostaJson([])),
    })
    renderizarApp('/faixas')

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar as faixas.')
    expect(screen.queryByRole('table', { name: 'Tabelas de faixas' })).not.toBeInTheDocument()

    falhar = false
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Nenhuma tabela de faixas cadastrada.')).toBeInTheDocument()
    expect(getsFaixas(chamadas)).toHaveLength(2)
  })

  it('401 na listagem encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    simularSessao('admin', { [`GET ${ROTA}`]: () => respostaErro(401) })
    renderizarApp('/faixas')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
