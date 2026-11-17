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
import { adicionarRotasPdf, simularUrlsDeObjeto, tituloPdf } from '../../test/pdfFalsos'
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
 * `MenuAcoes` da linha + `DialogoPreviaFechamento` + serviço (`obterPreviaFechamento` e, desde a alteração
 * de 17/11/2026 — F10.10 —, `obterPdfPrevia`), só a rede simulada (`criarApiFechamentosFalsa` com as rotas de
 * PDF de `adicionarRotasPdf`).
 *
 * - Cada linha da tabela de fechamentos tem o menu "Ações do fechamento {nome}" com "Pré-visualizar
 *   imagens"; o item abre o diálogo "Pré-visualização — {nome} · {período atual}", que consulta
 *   `GET /api/ped/fechamentos/{id}/previa` e não grava nada.
 * - A prévia permite escolher a filial (combobox "Filial"), a imagem/colaborador pela lista pesquisável
 *   "Imagem" (`SelectPesquisavel`, F1.20 — alteração de 17/11/2026, no lugar da busca "Buscar colaborador ou
 *   cargo" e da tabela "Imagens da filial {código}"; o gatilho é um botão não editável e a busca "Buscar
 *   colaborador ou cargo" fica dentro do dropdown aberto) e navegar por todas as imagens
 *   ("Imagem X de N · Filial F"), com os avisos de pendências e de falta de faixas.
 * - "Encerrar e gerar {N} imagens" abre a confirmação do encerramento (F10.5) com o resumo da própria
 *   prévia, sem nova consulta.
 *
 * A imagem exibida é o PDF embutido gerado pelo back-end (F10.10, no lugar da `VisualizacaoImagem`): aqui só
 * se verifica que o PDF exibido (título "PDF da imagem — Filial {código}[ · {colaborador}]") é o da filial ou
 * do colaborador escolhido. Sessão: Admin (ou Validador) com todas as filiais.
 */
describe('F10.4 — Pré-visualização das imagens (integração: /fechamentos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularUrlsDeObjeto()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function simularSessao(perfil: 'admin' | 'validador' = 'admin', rotasExtras: Record<string, RotaFalsa> = {}) {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    const api = adicionarRotasPdf(criarApiFechamentosFalsa())
    // As rotas extras entram no próprio back-end falso: o PDF da prévia lê a prévia substituída.
    Object.assign(api.rotas, rotasExtras)
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      ...api.rotas,
    })
    return { chamadas, api }
  }

  const getsPrevia = (chamadas: ChamadaRegistrada[], id: number) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `/api/ped/fechamentos/${id}/previa`)
  const gravacoes = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo !== 'GET' && c.caminho.startsWith('/api/ped/'))

  /** PDF embutido da imagem exibida (F10.10), pelo título acessível. */
  const pdfExibido = (dialogo: HTMLElement, filial: string, colaborador?: string) =>
    within(dialogo).findByTitle(tituloPdf(filial, colaborador))

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
    expect(await pdfExibido(dialogo, '102')).toBeInTheDocument()
    expect(within(dialogo).getByRole('combobox', { name: 'Filial' })).toHaveValue('102')
    expect(within(dialogo).getByRole('combobox', { name: 'Imagem' })).toHaveTextContent('Imagem da filial')

    await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Filial' }), '101')

    expect(within(dialogo).getByText('Imagem 1 de 2 · Filial 101')).toBeInTheDocument()
    expect(gravacoes(chamadas)).toHaveLength(0)
  })

  it('escolhe o colaborador da filial buscando na barra de pesquisa do dropdown "Imagem" (vínculo por cargos)', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      'GET /api/ped/fechamentos/2/previa': () => respostaJson(previaGerentesComEquipeApi()),
    })
    await abrirTela()
    const dialogo = await abrirPrevia(user, 'PED Gerentes', TITULO_GERENTES)
    const imagem = () => within(dialogo).getByRole('combobox', { name: 'Imagem' })
    const opcoes = () => within(within(dialogo).getByRole('listbox')).getAllByRole('option')
    const busca = () => within(dialogo).getByRole('searchbox', { name: 'Buscar colaborador ou cargo' })

    expect(within(dialogo).getByText('3 nesta filial · 4 no total')).toBeInTheDocument()
    expect(imagem().tagName).toBe('BUTTON')
    expect(imagem()).toHaveTextContent('Ana Souza')
    expect(within(dialogo).queryByRole('table', { name: /^Imagens da filial/ })).not.toBeInTheDocument()
    expect(within(dialogo).queryByRole('searchbox', { name: 'Buscar colaborador ou cargo' })).not.toBeInTheDocument()

    await user.click(imagem())
    expect(opcoes()).toHaveLength(3)
    expect(busca()).toHaveFocus()
    await user.type(busca(), 'subgerente')
    expect(opcoes()).toHaveLength(1)
    expect(opcoes()[0]).toHaveTextContent('Bruno Lima')
    expect(opcoes()[0]).toHaveTextContent('Subgerente')

    await user.click(opcoes()[0])

    expect(within(dialogo).getByText('Imagem 2 de 4 · Filial 100')).toBeInTheDocument()
    expect(imagem()).toHaveTextContent('Bruno Lima')
    expect(imagem()).not.toHaveTextContent('Ana Souza')
    expect(within(dialogo).queryByRole('listbox')).not.toBeInTheDocument()
    expect(within(dialogo).queryByRole('searchbox', { name: 'Buscar colaborador ou cargo' })).not.toBeInTheDocument()
    expect(await pdfExibido(dialogo, '100', 'Bruno Lima')).toBeInTheDocument()
  })

  it('Esc com a lista "Imagem" aberta fecha só a lista; a pré-visualização continua aberta', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      'GET /api/ped/fechamentos/2/previa': () => respostaJson(previaGerentesComEquipeApi()),
    })
    await abrirTela()
    const dialogo = await abrirPrevia(user, 'PED Gerentes', TITULO_GERENTES)

    await user.click(within(dialogo).getByRole('combobox', { name: 'Imagem' }))
    expect(within(dialogo).getByRole('listbox')).toBeInTheDocument()
    await user.type(within(dialogo).getByRole('searchbox', { name: 'Buscar colaborador ou cargo' }), 'bruno')
    await user.keyboard('{Escape}')

    expect(within(dialogo).queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: TITULO_GERENTES })).toBeInTheDocument()
    expect(within(dialogo).getByRole('combobox', { name: 'Imagem' })).toHaveTextContent('Ana Souza')
    expect(within(dialogo).getByRole('combobox', { name: 'Imagem' })).toHaveFocus()
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
