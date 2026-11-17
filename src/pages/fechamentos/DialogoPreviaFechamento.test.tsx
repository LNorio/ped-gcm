import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, definirToken } from '../../services/sessao'
import type { PreviaFechamento } from '../../types/dominio'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import {
  FECHAMENTO_COMERCIAL_API,
  FECHAMENTO_GERENTES_API,
  FECHAMENTO_VENDEDORES_API,
  MENSAGEM_DASHBOARD_NAO_ATIVO,
  previaComercialApi,
  type PreviaFechamentoApiFalsa,
} from '../../test/fechamentosFalsos'
import {
  TIPO_PDF,
  conteudoPdfPrevia,
  nomePdfPrevia,
  respostaArquivo,
  simularUrlsDeObjeto,
  tituloPdf,
} from '../../test/pdfFalsos'
import { carregarFechamentoDominio, previaGerentesComEquipeApi } from '../../test/previaFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoPreviaFechamento, type DialogoPreviaFechamentoProps } from './DialogoPreviaFechamento'

const COMERCIAL = carregarFechamentoDominio(FECHAMENTO_COMERCIAL_API)
const GERENTES = carregarFechamentoDominio(FECHAMENTO_GERENTES_API)
const VENDEDORES = carregarFechamentoDominio(FECHAMENTO_VENDEDORES_API)

const AVISO_PENDENCIAS = (filiais: string) =>
  `Filiais com lançamentos pendentes: ${filiais}. Se o período for encerrado agora, eles serão congelados sem valor.`
const AVISO_SEM_FAIXAS = (filiais: string) =>
  `Filiais sem tabela de faixas: ${filiais}. As imagens dessas filiais ficarão sem pontuação.`

/**
 * Pré-visualização das imagens de um dashboard (F10.4 — RF-80). O diálogo consulta sozinho
 * `obterPreviaFechamento(fechamento.id)` (`GET /api/ped/fechamentos/{id}/previa`) ao abrir e **não grava
 * nada** (nenhum POST/PUT/DELETE).
 *
 * Interface:
 * - props `{ fechamento: Fechamento; onFechar: () => void; onEncerrar: (previa: PreviaFechamento) => void }`;
 * - diálogo "Pré-visualização — {nome} · {período atual}"; enquanto carrega, "Calculando as imagens...";
 *   erro da API em `role="alert"` dentro do diálogo;
 * - "Nada é gravado na pré-visualização." e "Progresso de lançamentos: {preenchidos} de {total}";
 * - combobox "Filial": uma opção por filial com imagens na prévia, em ordem de código, com o texto
 *   "Filial {código} - {nome} · {N} imagem(ns) · lançamentos completos|lançamentos pendentes[ · sem tabela
 *   de faixas]"; no vínculo por filiais, as filiais vinculadas sem imagem na prévia aparecem como
 *   "Filial {código} · já encerrada" (desabilitadas). Começa na primeira filial com imagens;
 * - "{N} nesta filial · {T} no total";
 * - lista pesquisável "Imagem" (`SelectPesquisavel`, F1.20 — alteração de 17/11/2026, no lugar da tabela
 *   "Imagens da filial {código}" e do campo "Buscar colaborador ou cargo", que deixaram de existir): uma
 *   opção por imagem da filial escolhida, na ordem da navegação; rótulo = colaborador (imagem de filial:
 *   "Imagem da filial"); descrição = "{cargo} · {PED} · {pontuação}" (imagem de filial, sem o cargo:
 *   "{PED} · {pontuação}"); PED "99,99%"; pontuação "8.839,12" ou "Sem pontuação"; o gatilho (botão
 *   combobox não editável — alteração de 17/11/2026) mostra a imagem exibida e acompanha a navegação e a
 *   troca de filial; escolher uma opção exibe aquela imagem; a busca fica dentro do dropdown aberto, no
 *   searchbox "Buscar colaborador ou cargo" (rotuloBusca), e encontra por colaborador ou cargo, sem
 *   diferenciar acentos e maiúsculas; sem resultado, "Nenhum colaborador encontrado."; Esc com a lista
 *   aberta fecha só a lista;
 * - a imagem exibida é o PDF embutido da imagem (F10.10, alteração de 17/11/2026, no lugar da
 *   `VisualizacaoImagem`), identificado aqui pelo título "PDF da imagem — Filial {código}[ · {colaborador}]";
 *   carregamento, erros e exportação do PDF ficam em `DialogoPreviaFechamento.pdf.test.tsx`;
 * - navegação "Imagem X de N · Filial F" com "Imagem anterior" e "Próxima imagem" (desabilitados nas
 *   pontas), passando de uma filial para a outra;
 * - avisos de pendências e de falta de faixas (textos acima), a partir do `resumo`;
 * - "Encerrar e gerar {N} imagem(ns)" chama `onEncerrar(previa)`; sem imagens a gerar, o botão não
 *   aparece e o diálogo mostra "Nenhuma imagem a gerar: todas as unidades deste dashboard já foram
 *   encerradas no período atual.";
 * - "Fechar pré-visualização" (e Esc) chama `onFechar`.
 */
describe('F10.4 — DialogoPreviaFechamento (pré-visualização das imagens — RF-80)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularUrlsDeObjeto()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function renderizar(
    props: Partial<DialogoPreviaFechamentoProps> = {},
    previas: Record<number, PreviaFechamentoApiFalsa> = { 1: previaComercialApi() },
    rotas: Record<string, RotaFalsa> = {},
  ) {
    const rotasPrevia: Record<string, RotaFalsa> = {}
    for (const [id, previa] of Object.entries(previas)) {
      rotasPrevia[`GET /api/ped/fechamentos/${id}/previa`] = () => respostaJson(previa)
      rotasPrevia[`GET /api/ped/fechamentos/${id}/previa/pdf`] = (_init, url) => {
        const chave = url.searchParams.get('chave') ?? ''
        return respostaArquivo(conteudoPdfPrevia(Number(id), chave), TIPO_PDF, nomePdfPrevia(Number(id), chave))
      }
    }
    const chamadas = simularApi(fetchFalso, { ...rotasPrevia, ...rotas })
    const onFechar = props.onFechar ?? vi.fn()
    const onEncerrar = props.onEncerrar ?? vi.fn()
    const fechamento = props.fechamento ?? COMERCIAL
    render(<DialogoPreviaFechamento fechamento={fechamento} onFechar={onFechar} onEncerrar={onEncerrar} />)
    return { chamadas, onFechar, onEncerrar }
  }

  const dialogo = (nome = 'Pré-visualização — PED Comercial · 4º tri/2026') => screen.getByRole('dialog', { name: nome })
  const filial = () => within(dialogo()).getByRole('combobox', { name: 'Filial' })
  const opcoesFilial = () =>
    within(filial())
      .getAllByRole('option')
      .map((opcao) => opcao.textContent)
  /** Diálogo de prévia aberto, qualquer que seja o dashboard (o título exato é conferido em `esperarPrevia`). */
  const dialogoAberto = () => screen.getByRole('dialog', { name: /^Pré-visualização — / })
  /** Gatilho (botão combobox, não editável) da lista pesquisável "Imagem" (SelectPesquisavel, F1.20). */
  const imagem = () => within(dialogoAberto()).getByRole('combobox', { name: 'Imagem' })
  /** Barra de pesquisa dentro do dropdown "Imagem" aberto. */
  const buscaImagem = () => within(dialogoAberto()).getByRole('searchbox', { name: 'Buscar colaborador ou cargo' })
  /** Abre a lista "Imagem" (clique no gatilho) e devolve o listbox. */
  async function abrirImagens(user: ReturnType<typeof usuarioRapido>) {
    await user.click(imagem())
    return within(dialogoAberto()).getByRole('listbox')
  }
  const opcoesImagem = () => within(within(dialogoAberto()).getByRole('listbox')).queryAllByRole('option')
  const opcaoImagem = (rotulo: string) => opcoesImagem().find((opcao) => (opcao.textContent ?? '').includes(rotulo))!
  /** Nomes (dentre os informados) que aparecem nas opções da lista aberta, na ordem das opções. */
  const nomesNasOpcoes = (nomes: string[]) =>
    opcoesImagem()
      .map((opcao) => nomes.find((nome) => (opcao.textContent ?? '').includes(nome)))
      .filter((nome): nome is string => nome !== undefined)
  /** A tabela e a busca de colaborador deixaram de existir (alteração de 17/11/2026). */
  const semTabelaNemBusca = () => {
    expect(within(dialogoAberto()).queryByRole('table', { name: /^Imagens da filial/ })).not.toBeInTheDocument()
    expect(within(dialogoAberto()).queryByRole('searchbox', { name: 'Buscar colaborador ou cargo' })).not.toBeInTheDocument()
    expect(within(dialogoAberto()).queryByRole('button', { name: 'Visualizar' })).not.toBeInTheDocument()
  }
  /** PDF embutido da imagem exibida (F10.10), pelo título acessível. */
  const pdfExibido = (titulo: string, escopo: HTMLElement = dialogoAberto()) => within(escopo).findByTitle(titulo)
  const naoGets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo !== 'GET')

  async function esperarPrevia(nome?: string) {
    const elemento = await screen.findByRole('dialog', { name: nome ?? 'Pré-visualização — PED Comercial · 4º tri/2026' })
    await within(elemento).findByRole('combobox', { name: 'Filial' })
    return elemento
  }

  describe('carregamento', () => {
    it('consulta a prévia do dashboard uma vez ao abrir e mostra "Calculando as imagens..." enquanto espera', async () => {
      const { chamadas } = renderizar()

      expect(within(dialogo()).getByText('Calculando as imagens...')).toBeInTheDocument()
      await esperarPrevia()

      const previas = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/fechamentos/1/previa')
      expect(previas).toHaveLength(1)
      expect(within(dialogo()).queryByText('Calculando as imagens...')).not.toBeInTheDocument()
    })

    it('nada é gravado: só há o GET da prévia e o diálogo diz "Nada é gravado na pré-visualização."', async () => {
      const user = usuarioRapido()
      const { chamadas } = renderizar()
      await esperarPrevia()

      await user.click(within(dialogo()).getByRole('button', { name: 'Próxima imagem' }))

      expect(within(dialogo()).getByText('Nada é gravado na pré-visualização.')).toBeInTheDocument()
      expect(naoGets(chamadas)).toHaveLength(0)
    })

    it('erro da API aparece dentro do diálogo, sem a lista de imagens e sem o botão de encerrar', async () => {
      renderizar({}, {}, { 'GET /api/ped/fechamentos/1/previa': () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO) })

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(MENSAGEM_DASHBOARD_NAO_ATIVO)
      expect(within(dialogo()).queryByRole('combobox', { name: 'Filial' })).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: /^Encerrar e gerar/ })).not.toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Fechar pré-visualização' })).toBeInTheDocument()
    })

    it('mostra o progresso de lançamentos do dashboard', async () => {
      renderizar()
      await esperarPrevia()

      expect(within(dialogo()).getByText('Progresso de lançamentos: 5 de 6')).toBeInTheDocument()
    })
  })

  describe('escolha da filial', () => {
    it('lista as filiais com quantidade de imagens, lançamentos, falta de faixas e a já encerrada (vínculo por filiais)', async () => {
      renderizar()
      await esperarPrevia()

      expect(opcoesFilial()).toEqual([
        'Filial 100 · já encerrada',
        'Filial 101 - CAMPO GRANDE · 1 imagem · lançamentos completos',
        'Filial 102 - DOURADOS · 1 imagem · lançamentos pendentes · sem tabela de faixas',
      ])
      expect(within(filial()).getByRole('option', { name: 'Filial 100 · já encerrada' })).toBeDisabled()
    })

    it('começa na primeira filial com imagens e mostra a quantidade nesta filial e no total', async () => {
      renderizar()
      await esperarPrevia()

      expect(filial()).toHaveValue('101')
      expect(within(dialogo()).getByText('1 nesta filial · 2 no total')).toBeInTheDocument()
      expect(imagem()).toHaveTextContent('Imagem da filial')
    })

    it('ao trocar a filial, mostra a lista e a primeira imagem da filial escolhida', async () => {
      const user = usuarioRapido()
      renderizar()
      await esperarPrevia()

      await user.selectOptions(filial(), '102')

      expect(await pdfExibido(tituloPdf('102'))).toBeInTheDocument()
      await abrirImagens(user)
      expect(opcoesImagem()).toHaveLength(1)
      expect(opcaoImagem('Imagem da filial')).toHaveTextContent('0,00% · Sem pontuação')
      expect(within(dialogo()).getByText('Imagem 2 de 2 · Filial 102')).toBeInTheDocument()
    })

    it('vínculo por cargos: várias imagens na mesma filial, contadas na opção e no total', async () => {
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')

      const dialogoGerentes = dialogo('Pré-visualização — PED Gerentes · 11/2026')
      const opcoes = within(within(dialogoGerentes).getByRole('combobox', { name: 'Filial' }))
        .getAllByRole('option')
        .map((opcao) => opcao.textContent)
      expect(opcoes).toEqual([
        'Filial 100 - MATRIZ · 3 imagens · lançamentos pendentes',
        'Filial 102 - DOURADOS · 1 imagem · lançamentos pendentes · sem tabela de faixas',
      ])
      expect(within(dialogoGerentes).getByText('3 nesta filial · 4 no total')).toBeInTheDocument()
    })
  })

  describe('lista pesquisável "Imagem" (no lugar da tabela e da busca — alteração de 17/11/2026)', () => {
    it('não há mais a tabela "Imagens da filial", o botão "Visualizar" nem o campo "Buscar colaborador ou cargo"', async () => {
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')

      expect(imagem()).toBeInTheDocument()
      semTabelaNemBusca()
    })

    it('o campo "Imagem" não é editável: é um botão que mostra a imagem exibida; a busca só existe com o dropdown aberto', async () => {
      const user = usuarioRapido()
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')

      expect(imagem().tagName).toBe('BUTTON')
      expect(imagem()).toHaveAttribute('aria-expanded', 'false')
      expect(imagem()).toHaveTextContent('Ana Souza')
      expect(within(dialogoAberto()).queryByRole('textbox')).not.toBeInTheDocument()
      expect(within(dialogoAberto()).queryByRole('searchbox')).not.toBeInTheDocument()

      await abrirImagens(user)

      expect(imagem()).toHaveAttribute('aria-expanded', 'true')
      expect(buscaImagem()).toHaveFocus()
      expect(buscaImagem()).toHaveValue('')
      expect(buscaImagem()).toHaveAttribute('placeholder', 'Buscar colaborador ou cargo')

      await user.keyboard('{Escape}')
      expect(within(dialogoAberto()).queryByRole('searchbox')).not.toBeInTheDocument()
      expect(imagem()).toHaveFocus()
    })

    it('imagem de filial: rótulo "Imagem da filial" e descrição com PED e pontuação (ou "Sem pontuação")', async () => {
      const user = usuarioRapido()
      renderizar()
      await esperarPrevia()
      semTabelaNemBusca()

      expect(imagem()).toHaveTextContent('Imagem da filial')
      await abrirImagens(user)
      expect(opcoesImagem()).toHaveLength(1)
      expect(opcaoImagem('Imagem da filial')).toHaveTextContent('99,99% · 8.839,12')
      await user.keyboard('{Escape}')

      await user.selectOptions(filial(), '102')
      await abrirImagens(user)
      expect(opcoesImagem()).toHaveLength(1)
      expect(opcaoImagem('Imagem da filial')).toHaveTextContent('0,00% · Sem pontuação')
    })

    it('vínculo por cargos: uma opção por colaborador da filial, na ordem da navegação, com cargo, PED e pontuação', async () => {
      const user = usuarioRapido()
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')

      expect(imagem()).toHaveTextContent('Ana Souza')
      await abrirImagens(user)

      expect(opcoesImagem()).toHaveLength(3)
      expect(nomesNasOpcoes(['Ana Souza', 'Bruno Lima', 'Márcia Lopes'])).toEqual(['Ana Souza', 'Bruno Lima', 'Márcia Lopes'])
      expect(opcaoImagem('Ana Souza')).toHaveTextContent('Gerente de Loja · 20,00% · 150,00')
      expect(opcaoImagem('Bruno Lima')).toHaveTextContent('Subgerente · 35,50% · 266,25')
      expect(opcaoImagem('Márcia Lopes')).toHaveTextContent('Gerente de Loja · 12,00% · 90,00')
      // A imagem exibida é a opção selecionada.
      expect(opcaoImagem('Ana Souza')).toHaveAttribute('aria-selected', 'true')
      expect(opcaoImagem('Bruno Lima')).not.toHaveAttribute('aria-selected', 'true')
    })

    it('escolher uma opção (clique) exibe aquela imagem, atualiza a posição e o valor da lista', async () => {
      const user = usuarioRapido()
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')
      const atual = dialogo('Pré-visualização — PED Gerentes · 11/2026')

      expect(await pdfExibido(tituloPdf('100', 'Ana Souza'), atual)).toBeInTheDocument()

      await abrirImagens(user)
      await user.click(opcaoImagem('Márcia Lopes'))

      expect(await pdfExibido(tituloPdf('100', 'Márcia Lopes'), atual)).toBeInTheDocument()
      expect(within(atual).getByText('Imagem 3 de 4 · Filial 100')).toBeInTheDocument()
      expect(imagem()).toHaveTextContent('Márcia Lopes')
      expect(within(atual).queryByRole('listbox')).not.toBeInTheDocument()

      await abrirImagens(user)
      expect(opcaoImagem('Márcia Lopes')).toHaveAttribute('aria-selected', 'true')
      expect(opcaoImagem('Ana Souza')).not.toHaveAttribute('aria-selected', 'true')
    })

    it('a escolha também funciona pelo teclado (↓ e Enter)', async () => {
      const user = usuarioRapido()
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')
      const atual = dialogo('Pré-visualização — PED Gerentes · 11/2026')

      await abrirImagens(user)
      await user.keyboard('{ArrowDown}{Enter}')

      expect(await pdfExibido(tituloPdf('100', 'Bruno Lima'), atual)).toBeInTheDocument()
      expect(within(atual).getByText('Imagem 2 de 4 · Filial 100')).toBeInTheDocument()
      expect(imagem()).toHaveTextContent('Bruno Lima')
    })

    it('Esc com a lista aberta fecha só a lista, sem fechar a pré-visualização', async () => {
      const user = usuarioRapido()
      const { onFechar } = renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')

      await abrirImagens(user)
      await user.keyboard('{Escape}')

      expect(within(dialogoAberto()).queryByRole('listbox')).not.toBeInTheDocument()
      expect(onFechar).not.toHaveBeenCalled()
      expect(imagem()).toHaveTextContent('Ana Souza')
    })
  })

  describe('busca de colaborador (nome ou cargo) na barra de pesquisa do dropdown "Imagem"', () => {
    const NOMES = ['Ana Souza', 'Bruno Lima', 'Márcia Lopes']

    async function abrirGerentes() {
      const user = usuarioRapido()
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')
      await abrirImagens(user)
      return { user }
    }

    it('filtra pelo nome, sem diferenciar acentos e maiúsculas', async () => {
      const { user } = await abrirGerentes()

      await user.type(buscaImagem(), 'MARCIA')

      expect(opcoesImagem()).toHaveLength(1)
      expect(nomesNasOpcoes(NOMES)).toEqual(['Márcia Lopes'])
    })

    it('filtra pelo cargo', async () => {
      const { user } = await abrirGerentes()

      await user.type(buscaImagem(), 'subgerente')

      expect(opcoesImagem()).toHaveLength(1)
      expect(nomesNasOpcoes(NOMES)).toEqual(['Bruno Lima'])
    })

    it('sem resultado, mostra "Nenhum colaborador encontrado."; limpar a busca devolve a lista inteira', async () => {
      const { user } = await abrirGerentes()

      await user.type(buscaImagem(), 'zzz')
      expect(within(dialogo('Pré-visualização — PED Gerentes · 11/2026')).getByText('Nenhum colaborador encontrado.')).toBeInTheDocument()

      await user.clear(buscaImagem())
      expect(nomesNasOpcoes(NOMES)).toEqual(NOMES)
    })

    it('buscar sem escolher (e sair com Esc) não troca a imagem exibida', async () => {
      const { user } = await abrirGerentes()
      const atual = dialogo('Pré-visualização — PED Gerentes · 11/2026')

      await user.type(buscaImagem(), 'bruno')
      await user.keyboard('{Escape}')

      expect(imagem()).toHaveTextContent('Ana Souza')
      expect(imagem()).not.toHaveTextContent('Bruno Lima')
      expect(within(atual).getByText('Imagem 1 de 4 · Filial 100')).toBeInTheDocument()
      expect(await pdfExibido(tituloPdf('100', 'Ana Souza'), atual)).toBeInTheDocument()
    })

    it('buscar e escolher com Enter exibe a imagem encontrada', async () => {
      const { user } = await abrirGerentes()
      const atual = dialogo('Pré-visualização — PED Gerentes · 11/2026')

      await user.type(buscaImagem(), 'marcia{Enter}')

      expect(await pdfExibido(tituloPdf('100', 'Márcia Lopes'), atual)).toBeInTheDocument()
      expect(within(atual).getByText('Imagem 3 de 4 · Filial 100')).toBeInTheDocument()
      expect(imagem()).toHaveTextContent('Márcia Lopes')
      expect(imagem()).toHaveFocus()
    })

    it('a barra de pesquisa começa vazia a cada abertura do dropdown', async () => {
      const { user } = await abrirGerentes()

      await user.type(buscaImagem(), 'bruno')
      await user.keyboard('{Escape}')
      await abrirImagens(user)

      expect(buscaImagem()).toHaveValue('')
      expect(nomesNasOpcoes(NOMES)).toEqual(NOMES)
    })

    it('com só imagens de filial, a lista "Imagem" existe, sem o campo de busca fora do dropdown', async () => {
      renderizar()
      await esperarPrevia()

      expect(imagem()).toBeInTheDocument()
      expect(within(dialogo()).queryByRole('searchbox', { name: 'Buscar colaborador ou cargo' })).not.toBeInTheDocument()
    })
  })

  describe('navegação entre todas as imagens do dashboard', () => {
    it('mostra "Imagem 1 de 2 · Filial 101" e passa para a imagem da filial 102 em "Próxima imagem"', async () => {
      const user = usuarioRapido()
      renderizar()
      await esperarPrevia()

      expect(within(dialogo()).getByText('Imagem 1 de 2 · Filial 101')).toBeInTheDocument()
      expect(await pdfExibido(tituloPdf('101'))).toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Imagem anterior' })).toBeDisabled()

      await user.click(within(dialogo()).getByRole('button', { name: 'Próxima imagem' }))

      expect(within(dialogo()).getByText('Imagem 2 de 2 · Filial 102')).toBeInTheDocument()
      expect(await pdfExibido(tituloPdf('102'))).toBeInTheDocument()
      expect(filial()).toHaveValue('102')
      expect(imagem()).toHaveTextContent('Imagem da filial')
      expect(within(dialogo()).getByRole('button', { name: 'Próxima imagem' })).toBeDisabled()

      await user.click(within(dialogo()).getByRole('button', { name: 'Imagem anterior' }))

      expect(within(dialogo()).getByText('Imagem 1 de 2 · Filial 101')).toBeInTheDocument()
      expect(filial()).toHaveValue('101')
    })

    it('vínculo por cargos: percorre os colaboradores da filial 100 e segue para a 102', async () => {
      const user = usuarioRapido()
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')
      const atual = dialogo('Pré-visualização — PED Gerentes · 11/2026')
      const proxima = () => within(atual).getByRole('button', { name: 'Próxima imagem' })

      await user.click(proxima())
      expect(within(atual).getByText('Imagem 2 de 4 · Filial 100')).toBeInTheDocument()
      expect(imagem()).toHaveTextContent('Bruno Lima')
      expect(imagem()).not.toHaveTextContent('Ana Souza')
      await user.click(proxima())
      expect(imagem()).toHaveTextContent('Márcia Lopes')
      expect(imagem()).not.toHaveTextContent('Bruno Lima')
      await user.click(proxima())

      expect(within(atual).getByText('Imagem 4 de 4 · Filial 102')).toBeInTheDocument()
      expect(within(atual).getByRole('combobox', { name: 'Filial' })).toHaveValue('102')
      expect(await pdfExibido(tituloPdf('102', 'Diego Rocha'), atual)).toBeInTheDocument()
      // A lista "Imagem" acompanha a troca de filial pela navegação.
      expect(imagem()).toHaveTextContent('Diego Rocha')
      expect(proxima()).toBeDisabled()
    })
  })

  describe('avisos', () => {
    it('avisa das filiais com lançamentos pendentes (congelados sem valor) e das filiais sem tabela de faixas', async () => {
      renderizar()
      await esperarPrevia()

      expect(within(dialogo()).getByText(AVISO_PENDENCIAS('102'))).toBeInTheDocument()
      expect(within(dialogo()).getByText(AVISO_SEM_FAIXAS('102'))).toBeInTheDocument()
    })

    it('lista todas as filiais com pendências (vínculo por cargos: 100 e 102)', async () => {
      renderizar({ fechamento: GERENTES }, { 2: previaGerentesComEquipeApi() })
      await esperarPrevia('Pré-visualização — PED Gerentes · 11/2026')

      const atual = dialogo('Pré-visualização — PED Gerentes · 11/2026')
      expect(within(atual).getByText(AVISO_PENDENCIAS('100, 102'))).toBeInTheDocument()
      expect(within(atual).getByText(AVISO_SEM_FAIXAS('102'))).toBeInTheDocument()
    })

    it('sem pendências e com faixas, não mostra os avisos', async () => {
      const previa = previaComercialApi()
      previa.resumo['unidades com pendencias'] = []
      previa.resumo['unidades sem tabela de faixas'] = []
      renderizar({}, { 1: previa })
      await esperarPrevia()

      expect(within(dialogo()).queryByText(/^Filiais com lançamentos pendentes/)).not.toBeInTheDocument()
      expect(within(dialogo()).queryByText(/^Filiais sem tabela de faixas/)).not.toBeInTheDocument()
    })
  })

  describe('encerrar a partir da prévia e fechar', () => {
    it('"Encerrar e gerar 2 imagens" chama onEncerrar com a prévia carregada, sem gravar nada no diálogo', async () => {
      const user = usuarioRapido()
      const { chamadas, onEncerrar } = renderizar()
      await esperarPrevia()

      await user.click(within(dialogo()).getByRole('button', { name: 'Encerrar e gerar 2 imagens' }))

      expect(onEncerrar).toHaveBeenCalledTimes(1)
      const previa = (onEncerrar as ReturnType<typeof vi.fn>).mock.calls[0][0] as PreviaFechamento
      expect(previa.resumo.imagensAGerar).toBe(2)
      expect(previa.imagens.map((imagem) => imagem.chave)).toEqual(['filial:101', 'filial:102'])
      expect(naoGets(chamadas)).toHaveLength(0)
    })

    it('com uma imagem a gerar, o botão fica no singular', async () => {
      const previa = previaComercialApi()
      previa.imagens = previa.imagens.slice(0, 1)
      previa.resumo['imagens a gerar'] = 1
      renderizar({}, { 1: previa })
      await esperarPrevia()

      expect(within(dialogo()).getByRole('button', { name: 'Encerrar e gerar 1 imagem' })).toBeInTheDocument()
    })

    it('sem imagens a gerar, explica que todas as unidades já foram encerradas e não oferece encerrar', async () => {
      const vazia: PreviaFechamentoApiFalsa = {
        ...previaComercialApi(),
        resumo: { ...previaComercialApi().resumo, 'imagens a gerar': 0, 'unidades ja encerradas': 2 },
        imagens: [],
      }
      renderizar({ fechamento: VENDEDORES }, { 6: vazia })

      const atual = await screen.findByRole('dialog', { name: 'Pré-visualização — PED Vendedores · 2026' })
      expect(
        await within(atual).findByText(
          'Nenhuma imagem a gerar: todas as unidades deste dashboard já foram encerradas no período atual.',
        ),
      ).toBeInTheDocument()
      expect(within(atual).queryByRole('button', { name: /^Encerrar e gerar/ })).not.toBeInTheDocument()
    })

    it('"Fechar pré-visualização" e Esc chamam onFechar', async () => {
      const user = usuarioRapido()
      const { onFechar } = renderizar()
      await esperarPrevia()

      await user.click(within(dialogo()).getByRole('button', { name: 'Fechar pré-visualização' }))
      expect(onFechar).toHaveBeenCalledTimes(1)

      await user.keyboard('{Escape}')
      await waitFor(() => expect(onFechar).toHaveBeenCalledTimes(2))
    })
  })
})
