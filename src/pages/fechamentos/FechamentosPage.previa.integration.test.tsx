import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { MENSAGEM_DASHBOARD_NAO_ATIVO, criarApiFechamentosFalsa } from '../../test/fechamentosFalsos'
import { escolherAcao } from '../../test/menuAcoes'
import {
  ITEM_ENCERRAR,
  ITEM_PRE_VISUALIZAR,
  previaGerentesComEquipeApi,
  rotuloAcoesFechamento,
} from '../../test/previaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido, type Usuario } from '../../test/usuario'

const TITULO_COMERCIAL = 'Pré-visualização — PED Comercial · 4º tri/2026'
const TITULO_GERENTES = 'Pré-visualização — PED Gerentes · 11/2026'

/**
 * Pré-visualização das imagens na aba Fechamentos (F10.4 — RF-80). Fluxo completo: página (F10.2) +
 * `MenuAcoes` da linha + `DialogoPreviaFechamento` + `VisualizacaoImagem` (F10.3) + serviço
 * (`obterPreviaFechamento`), só a rede simulada (`criarApiFechamentosFalsa`).
 *
 * - Cada linha da tabela de fechamentos tem o menu "Ações do fechamento {nome}" com "Pré-visualizar
 *   imagens"; o item abre o diálogo "Pré-visualização — {nome} · {período atual}", que consulta
 *   `GET /api/ped/fechamentos/{id}/previa` e não grava nada.
 * - A prévia permite escolher a filial (combobox "Filial"), o colaborador (busca "Buscar colaborador ou
 *   cargo" e a tabela "Imagens da filial {código}") e navegar por todas as imagens ("Imagem X de N ·
 *   Filial F"), com os avisos de pendências e de falta de faixas.
 * - "Encerrar e gerar {N} imagens" abre a confirmação do encerramento (F10.5) com o resumo da própria
 *   prévia, sem nova consulta.
 *
 * O conteúdo da imagem (F10.3) não é verificado aqui: só que a região "Imagem (prévia)" mostra a filial
 * ou o colaborador da imagem escolhida. Sessão: Admin (ou Validador) com todas as filiais.
 */
describe('F10.4 — Pré-visualização das imagens (integração: /fechamentos)', () => {
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
    const api = criarApiFechamentosFalsa()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
      ...rotasExtras,
    })
    return { chamadas, api }
  }

  const getsPrevia = (chamadas: ChamadaRegistrada[], id: number) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `/api/ped/fechamentos/${id}/previa`)
  const gravacoes = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo !== 'GET' && c.caminho.startsWith('/api/ped/'))

  /** Região da `VisualizacaoImagem` (F10.3) para a imagem da prévia, que ainda não tem código. */
  const imagemExibida = (dialogo: HTMLElement) => within(dialogo).getByRole('region', { name: 'Imagem (prévia)' })

  async function abrirTela() {
    renderizarApp('/fechamentos')
    await screen.findByRole('button', { name: rotuloAcoesFechamento('PED Comercial') })
  }

  async function abrirPrevia(user: Usuario, nome: string, titulo: string) {
    await escolherAcao(user, rotuloAcoesFechamento(nome), ITEM_PRE_VISUALIZAR)
    const dialogo = await screen.findByRole('dialog', { name: titulo })
    await within(dialogo).findByRole('combobox', { name: 'Filial' })
    return dialogo
  }

  it('o menu da linha oferece "Pré-visualizar imagens" e "Encerrar período"', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirTela()

    await user.click(screen.getByRole('button', { name: rotuloAcoesFechamento('PED Comercial') }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: ITEM_PRE_VISUALIZAR })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: ITEM_ENCERRAR })).toBeInTheDocument()
  })

  it.each(['admin', 'validador'] as const)('o %s abre a prévia do PED Comercial, que consulta a API uma vez', async (perfil) => {
    const user = usuarioRapido()
    const { chamadas } = simularSessao(perfil)
    await abrirTela()

    const dialogo = await abrirPrevia(user, 'PED Comercial', TITULO_COMERCIAL)

    expect(getsPrevia(chamadas, 1)).toHaveLength(1)
    expect(within(dialogo).getByRole('combobox', { name: 'Filial' })).toHaveValue('101')
    expect(within(dialogo).getByText('Imagem 1 de 2 · Filial 101')).toBeInTheDocument()
    expect(within(dialogo).getByText('1 nesta filial · 2 no total')).toBeInTheDocument()
    expect(within(dialogo).getByText('Nada é gravado na pré-visualização.')).toBeInTheDocument()
  })

  it('mostra as filiais com imagens, progresso, faixas e a já encerrada', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirTela()

    const dialogo = await abrirPrevia(user, 'PED Comercial', TITULO_COMERCIAL)

    const opcoes = within(within(dialogo).getByRole('combobox', { name: 'Filial' }))
      .getAllByRole('option')
      .map((opcao) => opcao.textContent)
    expect(opcoes).toEqual([
      'Filial 100 · já encerrada',
      'Filial 101 - CAMPO GRANDE · 1 imagem · lançamentos completos',
      'Filial 102 - DOURADOS · 1 imagem · lançamentos pendentes · sem tabela de faixas',
    ])
    expect(within(dialogo).getByText('Progresso de lançamentos: 5 de 6')).toBeInTheDocument()
  })

  it('mostra os avisos de lançamentos pendentes (congelados sem valor) e de falta de faixas', async () => {
    const user = usuarioRapido()
    simularSessao()
    await abrirTela()

    const dialogo = await abrirPrevia(user, 'PED Comercial', TITULO_COMERCIAL)

    expect(
      within(dialogo).getByText(
        'Filiais com lançamentos pendentes: 102. Se o período for encerrado agora, eles serão congelados sem valor.',
      ),
    ).toBeInTheDocument()
    expect(
      within(dialogo).getByText('Filiais sem tabela de faixas: 102. As imagens dessas filiais ficarão sem pontuação.'),
    ).toBeInTheDocument()
  })

  it('navega por todas as imagens e troca a filial, sem gravar nada', async () => {
    const user = usuarioRapido()
    const { chamadas } = simularSessao()
    await abrirTela()
    const dialogo = await abrirPrevia(user, 'PED Comercial', TITULO_COMERCIAL)

    await user.click(within(dialogo).getByRole('button', { name: 'Próxima imagem' }))

    expect(within(dialogo).getByText('Imagem 2 de 2 · Filial 102')).toBeInTheDocument()
    expect(within(imagemExibida(dialogo)).getByText('102 - DOURADOS')).toBeInTheDocument()
    expect(within(dialogo).getByRole('combobox', { name: 'Filial' })).toHaveValue('102')
    expect(within(dialogo).getByRole('table', { name: 'Imagens da filial 102' })).toBeInTheDocument()

    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Filial' }), '101')

    expect(within(dialogo).getByText('Imagem 1 de 2 · Filial 101')).toBeInTheDocument()
    expect(gravacoes(chamadas)).toHaveLength(0)
  })

  it('escolhe o colaborador da filial pela busca e pela lista (vínculo por cargos)', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      'GET /api/ped/fechamentos/2/previa': () => respostaJson(previaGerentesComEquipeApi()),
    })
    await abrirTela()
    const dialogo = await abrirPrevia(user, 'PED Gerentes', TITULO_GERENTES)
    const tabela = () => within(dialogo).getByRole('table', { name: 'Imagens da filial 100' })
    const nomes = () =>
      within(tabela())
        .getAllByRole('row')
        .slice(1)
        .map((linha) => within(linha).getAllByRole('cell')[0].textContent?.trim())

    expect(within(dialogo).getByText('3 nesta filial · 4 no total')).toBeInTheDocument()

    await user.type(within(dialogo).getByRole('searchbox', { name: 'Buscar colaborador ou cargo' }), 'subgerente')
    expect(nomes()).toEqual(['Bruno Lima'])

    const linhaBruno = within(tabela()).getAllByRole('row')[1]
    await user.click(within(linhaBruno).getByRole('button', { name: 'Visualizar' }))

    expect(within(dialogo).getByText('Imagem 2 de 4 · Filial 100')).toBeInTheDocument()
    expect(within(within(tabela()).getAllByRole('row')[1]).getByText('Exibindo')).toBeInTheDocument()
    expect(within(imagemExibida(dialogo)).getByText('Bruno Lima')).toBeInTheDocument()
  })

  it('"Fechar pré-visualização" fecha o diálogo sem gravar nada', async () => {
    const user = usuarioRapido()
    const { chamadas } = simularSessao()
    await abrirTela()
    const dialogo = await abrirPrevia(user, 'PED Comercial', TITULO_COMERCIAL)

    await user.click(within(dialogo).getByRole('button', { name: 'Fechar pré-visualização' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: TITULO_COMERCIAL })).not.toBeInTheDocument())
    expect(gravacoes(chamadas)).toHaveLength(0)
  })

  it('erro 400 da prévia (dashboard não ativo) aparece dentro do diálogo', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      'GET /api/ped/fechamentos/1/previa': () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO),
    })
    await abrirTela()

    await escolherAcao(user, rotuloAcoesFechamento('PED Comercial'), ITEM_PRE_VISUALIZAR)
    const dialogo = await screen.findByRole('dialog', { name: TITULO_COMERCIAL })

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_DASHBOARD_NAO_ATIVO)
    expect(within(dialogo).queryByRole('button', { name: /^Encerrar e gerar/ })).not.toBeInTheDocument()
  })

  it('"Encerrar e gerar 2 imagens" abre a confirmação com o resumo da prévia, sem nova consulta nem gravação', async () => {
    const user = usuarioRapido()
    const { chamadas } = simularSessao()
    await abrirTela()
    const dialogo = await abrirPrevia(user, 'PED Comercial', TITULO_COMERCIAL)

    await user.click(within(dialogo).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

    const confirmacao = await screen.findByRole('dialog', { name: 'Encerrar PED Comercial — 4º tri/2026' })
    expect(within(confirmacao).getByText('Total de imagens a gerar: 2 (uma por filial)')).toBeInTheDocument()
    expect(getsPrevia(chamadas, 1)).toHaveLength(1)
    expect(gravacoes(chamadas)).toHaveLength(0)
  })
})
