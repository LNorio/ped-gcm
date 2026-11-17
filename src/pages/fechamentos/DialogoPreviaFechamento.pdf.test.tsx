import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { adiado } from '../../test/consultaImagensFalsos'
import {
  FECHAMENTO_COMERCIAL_API,
  FECHAMENTO_GERENTES_API,
  FECHAMENTO_VENDEDORES_API,
  MENSAGEM_DASHBOARD_NAO_ATIVO,
  previaComercialApi,
  type PreviaFechamentoApiFalsa,
} from '../../test/fechamentosFalsos'
import {
  ITEM_PDF_DESTA_IMAGEM,
  ITEM_ZIP_TODAS,
  MENSAGEM_PREVIA_SEM_IMAGENS,
  ROTULO_EXPORTAR,
  TEXTO_GERANDO_PDF,
  TIPO_PDF,
  TEXTO_DEMORA_IMAGENS,
  TIPO_ZIP,
  avisoQuantidadeImagens,
  conteudoPdfPrevia,
  nomePdfPrevia,
  nomeZipPrevia,
  respostaArquivo,
  simularDownloads,
  simularUrlsDeObjeto,
  textoMontandoZip,
  textoQuantidadeImagens,
  tituloPdf,
  urlDoPdf,
} from '../../test/pdfFalsos'
import { carregarFechamentoDominio, previaGerentesComEquipeApi } from '../../test/previaFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoPreviaFechamento } from './DialogoPreviaFechamento'

const COMERCIAL = carregarFechamentoDominio(FECHAMENTO_COMERCIAL_API)
const GERENTES = carregarFechamentoDominio(FECHAMENTO_GERENTES_API)
const VENDEDORES = carregarFechamentoDominio(FECHAMENTO_VENDEDORES_API)

const TITULO_COMERCIAL = 'Pré-visualização — PED Comercial · 4º tri/2026'
const TITULO_GERENTES = 'Pré-visualização — PED Gerentes · 11/2026'

/**
 * F10.10 — PDF e exportação na pré-visualização do fechamento (`DialogoPreviaFechamento`, F10.4 — RF-80),
 * contrato proposto em `docs/backend/PROPOSTA-pdf-imagens.md`. O back-end gera os PDFs; o front só mostra
 * o PDF embutido (visualizador do navegador) e baixa os arquivos.
 *
 * - O painel da imagem exibida deixa de mostrar os valores na tela (`VisualizacaoImagem`) e passa a ser o
 *   **PDF da imagem atual embutido**: `iframe` (ou `object`) com a URL de objeto do Blob
 *   (`URL.createObjectURL`) e título acessível "PDF da imagem — Filial {código} · {colaborador}" (imagem
 *   de filial: "PDF da imagem — Filial {código}"), pedido por `obterPdfPrevia(id, chave)`
 *   (`GET /api/ped/fechamentos/{id}/previa/pdf?chave=`).
 * - Enquanto carrega: "Gerando PDF…". Em erro: alerta com a `mensagem` e "Tentar novamente".
 * - Navegar ("Próxima imagem"/"Imagem anterior"), trocar a filial ou escolher a imagem na lista pesquisável
 *   "Imagem" (F1.20; no lugar do antigo "Visualizar" da tabela, alteração de 17/11/2026) pede o PDF da nova
 *   imagem; a URL de objeto anterior é liberada (`URL.revokeObjectURL`), e também ao fechar o diálogo.
 *   Resposta atrasada de uma imagem anterior é descartada (sem URL vazada).
 * - Botão "Exportar" (menu `role="menu"`): "PDF desta imagem" baixa o PDF da imagem atual e "Todas as
 *   imagens (ZIP)" baixa `obterZipPrevia(id)` (`GET .../previa/zip`); o download (`<a download>`) usa o
 *   nome do arquivo; durante a exportação o botão "Exportar" fica desabilitado; erro em alerta.
 * - Sem imagens a gerar (ou com erro na prévia), não há PDF nem "Exportar". Nada é gravado (só GET).
 * Filial, colaborador, lista, navegação "Imagem X de N · Filial F" e "Encerrar" continuam (F10.4).
 */
describe('F10.10 — DialogoPreviaFechamento: PDF da imagem e exportação', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let urls: ReturnType<typeof simularUrlsDeObjeto>
  let downloads: ReturnType<typeof simularDownloads>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    urls = simularUrlsDeObjeto()
    downloads = simularDownloads()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  const rotaPdf =
    (id: number): RotaFalsa =>
    (_init, url) => {
      const chave = url.searchParams.get('chave') ?? ''
      return respostaArquivo(conteudoPdfPrevia(id, chave), TIPO_PDF, nomePdfPrevia(id, chave))
    }
  const rotaZip = (id: number): RotaFalsa => () => respostaArquivo(`PK zip ${id}`, TIPO_ZIP, nomeZipPrevia(id))

  function renderizar(
    fechamento = COMERCIAL,
    previas: Record<number, PreviaFechamentoApiFalsa> = { 1: previaComercialApi() },
    rotas: Record<string, RotaFalsa> = {},
  ) {
    const padrao: Record<string, RotaFalsa> = {}
    for (const [texto, previa] of Object.entries(previas)) {
      const id = Number(texto)
      padrao[`GET /api/ped/fechamentos/${id}/previa`] = () => respostaJson(previa)
      padrao[`GET /api/ped/fechamentos/${id}/previa/pdf`] = rotaPdf(id)
      padrao[`GET /api/ped/fechamentos/${id}/previa/zip`] = rotaZip(id)
    }
    const chamadas = simularApi(fetchFalso, { ...padrao, ...rotas })
    const resultado = render(<DialogoPreviaFechamento fechamento={fechamento} onFechar={vi.fn()} onEncerrar={vi.fn()} />)
    return { chamadas, ...resultado }
  }

  const pedidosPdf = (chamadas: ChamadaRegistrada[], id = 1) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `/api/ped/fechamentos/${id}/previa/pdf`)
  const chavesPedidas = (chamadas: ChamadaRegistrada[], id = 1) => pedidosPdf(chamadas, id).map((c) => c.url.searchParams.get('chave'))

  async function abrir(titulo = TITULO_COMERCIAL) {
    const dialogo = await screen.findByRole('dialog', { name: titulo })
    await within(dialogo).findByRole('combobox', { name: 'Filial' })
    return dialogo
  }

  /** Espera o PDF embutido com o título e devolve o elemento. */
  async function pdfExibido(dialogo: HTMLElement, titulo: string) {
    return within(dialogo).findByTitle(titulo)
  }

  /** Todas as URLs criadas, exceto a exibida, foram liberadas. */
  function semUrlsVazadas(exibida: string | null) {
    const outras = urls.criadas.map((c) => c.url).filter((url) => url !== exibida)
    for (const url of outras) expect(urls.revogadas).toContain(url)
  }

  describe('PDF embutido no lugar do painel da imagem', () => {
    it('mostra o PDF da imagem atual (filial 101) com título acessível e a URL de objeto, sem os valores na tela', async () => {
      const { chamadas } = renderizar()
      const dialogo = await abrir()

      const pdf = await pdfExibido(dialogo, tituloPdf('101'))

      expect(['IFRAME', 'OBJECT']).toContain(pdf.tagName)
      expect(urls.criadas.length).toBeGreaterThan(0)
      expect(urlDoPdf(pdf)).toBe(urls.criadas.at(-1)!.url)
      expect(urls.revogadas).not.toContain(urlDoPdf(pdf))
      expect(chavesPedidas(chamadas)).toEqual(['filial:101'])
      // O painel com os valores (VisualizacaoImagem, F10.3) não aparece mais na prévia.
      expect(within(dialogo).queryByRole('region', { name: 'Imagem (prévia)' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('table', { name: 'Indicadores' })).not.toBeInTheDocument()
    })

    it('imagem de colaborador (vínculo por cargos): título com a filial e o colaborador e a chave do colaborador', async () => {
      const { chamadas } = renderizar(GERENTES, { 2: previaGerentesComEquipeApi() })
      const dialogo = await abrir(TITULO_GERENTES)

      expect(await pdfExibido(dialogo, tituloPdf('100', 'Ana Souza'))).toBeInTheDocument()
      expect(chavesPedidas(chamadas, 2)).toEqual(['colaborador:11'])
    })

    it('enquanto o PDF carrega, mostra "Gerando PDF…"; ao chegar, o texto some e o PDF aparece', async () => {
      const lento = adiado<void>()
      renderizar(COMERCIAL, { 1: previaComercialApi() }, {
        'GET /api/ped/fechamentos/1/previa/pdf': (init, url) => lento.promessa.then(() => rotaPdf(1)(init, url)),
      })
      const dialogo = await abrir()

      expect(await within(dialogo).findByText(TEXTO_GERANDO_PDF)).toBeInTheDocument()
      expect(within(dialogo).queryByTitle(tituloPdf('101'))).not.toBeInTheDocument()

      lento.resolver()

      expect(await pdfExibido(dialogo, tituloPdf('101'))).toBeInTheDocument()
      expect(within(dialogo).queryByText(TEXTO_GERANDO_PDF)).not.toBeInTheDocument()
    })

    it('erro ao gerar o PDF: alerta com a mensagem e "Tentar novamente" pede de novo e mostra o PDF', async () => {
      const user = usuarioRapido()
      let falhar = true
      const { chamadas } = renderizar(COMERCIAL, { 1: previaComercialApi() }, {
        'GET /api/ped/fechamentos/1/previa/pdf': (init, url) =>
          falhar ? respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO) : rotaPdf(1)(init, url),
      })
      const dialogo = await abrir()

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_DASHBOARD_NAO_ATIVO)
      expect(within(dialogo).queryByTitle(tituloPdf('101'))).not.toBeInTheDocument()
      // O resto da prévia continua disponível.
      expect(within(dialogo).getByText('Imagem 1 de 2 · Filial 101')).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Encerrar e gerar 2 imagens' })).toBeInTheDocument()

      falhar = false
      await user.click(within(dialogo).getByRole('button', { name: 'Tentar novamente' }))

      expect(await pdfExibido(dialogo, tituloPdf('101'))).toBeInTheDocument()
      expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument()
      expect(chavesPedidas(chamadas)).toEqual(['filial:101', 'filial:101'])
    })

    it('"Próxima imagem" pede o PDF da nova imagem, troca o título e libera a URL anterior; voltar pede de novo', async () => {
      const user = usuarioRapido()
      const { chamadas } = renderizar()
      const dialogo = await abrir()
      const primeiro = urlDoPdf(await pdfExibido(dialogo, tituloPdf('101')))

      await user.click(within(dialogo).getByRole('button', { name: 'Próxima imagem' }))

      const segundo = await pdfExibido(dialogo, tituloPdf('102'))
      expect(within(dialogo).queryByTitle(tituloPdf('101'))).not.toBeInTheDocument()
      expect(urlDoPdf(segundo)).not.toBe(primeiro)
      expect(chavesPedidas(chamadas)).toEqual(['filial:101', 'filial:102'])
      await waitFor(() => expect(urls.revogadas).toContain(primeiro))
      expect(urls.revogadas).not.toContain(urlDoPdf(segundo))

      await user.click(within(dialogo).getByRole('button', { name: 'Imagem anterior' }))

      expect(await pdfExibido(dialogo, tituloPdf('101'))).toBeInTheDocument()
      expect(chavesPedidas(chamadas).at(-1)).toBe('filial:101')
    })

    it('trocar a filial pede o PDF da primeira imagem da filial escolhida', async () => {
      const user = usuarioRapido()
      const { chamadas } = renderizar()
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Filial' }), '102')

      expect(await pdfExibido(dialogo, tituloPdf('102'))).toBeInTheDocument()
      expect(chavesPedidas(chamadas).at(-1)).toBe('filial:102')
    })

    it('escolher o colaborador na lista "Imagem" pede o PDF do colaborador escolhido', async () => {
      const user = usuarioRapido()
      const { chamadas } = renderizar(GERENTES, { 2: previaGerentesComEquipeApi() })
      const dialogo = await abrir(TITULO_GERENTES)
      const primeiro = urlDoPdf(await pdfExibido(dialogo, tituloPdf('100', 'Ana Souza')))

      await user.click(within(dialogo).getByRole('combobox', { name: 'Imagem' }))
      const opcaoMarcia = within(within(dialogo).getByRole('listbox'))
        .getAllByRole('option')
        .find((opcao) => (opcao.textContent ?? '').includes('Márcia Lopes'))!
      await user.click(opcaoMarcia)

      expect(await pdfExibido(dialogo, tituloPdf('100', 'Márcia Lopes'))).toBeInTheDocument()
      expect(chavesPedidas(chamadas, 2).at(-1)).toBe('colaborador:16')
      await waitFor(() => expect(urls.revogadas).toContain(primeiro))
    })

    it('resposta atrasada do PDF de uma imagem anterior é descartada, sem deixar URL de objeto vazada', async () => {
      const user = usuarioRapido()
      const lento = adiado<void>()
      renderizar(COMERCIAL, { 1: previaComercialApi() }, {
        'GET /api/ped/fechamentos/1/previa/pdf': (init, url) =>
          url.searchParams.get('chave') === 'filial:101' ? lento.promessa.then(() => rotaPdf(1)(init, url)) : rotaPdf(1)(init, url),
      })
      const dialogo = await abrir()

      await user.click(within(dialogo).getByRole('button', { name: 'Próxima imagem' }))
      const pdf = await pdfExibido(dialogo, tituloPdf('102'))

      lento.resolver()
      await new Promise((r) => setTimeout(r, 20))

      expect(within(dialogo).getByTitle(tituloPdf('102'))).toBe(pdf)
      expect(within(dialogo).queryByTitle(tituloPdf('101'))).not.toBeInTheDocument()
      expect(urls.revogadas).not.toContain(urlDoPdf(pdf))
      semUrlsVazadas(urlDoPdf(pdf))
    })

    it('A → B → A antes de o PDF de B chegar: mostra "Gerando PDF…" (sem a URL revogada de A) e depois o PDF novo de A', async () => {
      const user = usuarioRapido()
      const lentoB = adiado<void>()
      const lentoA = adiado<void>()
      let pedidosA = 0
      renderizar(COMERCIAL, { 1: previaComercialApi() }, {
        'GET /api/ped/fechamentos/1/previa/pdf': (init, url) => {
          if (url.searchParams.get('chave') === 'filial:102') return lentoB.promessa.then(() => rotaPdf(1)(init, url))
          pedidosA += 1
          return pedidosA === 1 ? rotaPdf(1)(init, url) : lentoA.promessa.then(() => rotaPdf(1)(init, url))
        },
      })
      const dialogo = await abrir()
      const urlAntiga = urlDoPdf(await pdfExibido(dialogo, tituloPdf('101')))

      await user.click(within(dialogo).getByRole('button', { name: 'Próxima imagem' }))
      await waitFor(() => expect(urls.revogadas).toContain(urlAntiga))
      await user.click(within(dialogo).getByRole('button', { name: 'Imagem anterior' }))

      expect(await within(dialogo).findByText(TEXTO_GERANDO_PDF)).toBeInTheDocument()
      expect(within(dialogo).queryByTitle(tituloPdf('101'))).not.toBeInTheDocument()
      for (const elemento of dialogo.querySelectorAll('iframe, object')) expect(urlDoPdf(elemento as HTMLElement)).not.toBe(urlAntiga)

      lentoA.resolver()

      const novo = await pdfExibido(dialogo, tituloPdf('101'))
      expect(urlDoPdf(novo)).not.toBe(urlAntiga)
      expect(urls.revogadas).not.toContain(urlDoPdf(novo))
      expect(within(dialogo).queryByText(TEXTO_GERANDO_PDF)).not.toBeInTheDocument()
      expect(pedidosA).toBe(2)

      lentoB.resolver()
      await new Promise((r) => setTimeout(r, 20))
      expect(within(dialogo).getByTitle(tituloPdf('101'))).toBe(novo)
      semUrlsVazadas(urlDoPdf(novo))
    })

    it('ao fechar (desmontar) o diálogo, libera a URL de objeto do PDF exibido', async () => {
      const { unmount } = renderizar()
      const dialogo = await abrir()
      const url = urlDoPdf(await pdfExibido(dialogo, tituloPdf('101')))

      unmount()

      expect(urls.revogadas).toContain(url)
      semUrlsVazadas(null)
    })

    it('sem imagens a gerar, não pede PDF nem mostra "Exportar"', async () => {
      const vazia: PreviaFechamentoApiFalsa = {
        ...previaComercialApi(),
        resumo: { ...previaComercialApi().resumo, 'imagens a gerar': 0 },
        imagens: [],
      }
      const { chamadas } = renderizar(VENDEDORES, { 6: vazia })
      const dialogo = await screen.findByRole('dialog', { name: 'Pré-visualização — PED Vendedores · 2026' })
      await within(dialogo).findByText(/^Nenhuma imagem a gerar/)
      await new Promise((r) => setTimeout(r, 20))

      expect(pedidosPdf(chamadas, 6)).toHaveLength(0)
      expect(within(dialogo).queryByRole('button', { name: ROTULO_EXPORTAR })).not.toBeInTheDocument()
    })

    it('com erro na prévia, não pede PDF nem mostra "Exportar"', async () => {
      const { chamadas } = renderizar(COMERCIAL, {}, {
        'GET /api/ped/fechamentos/1/previa': () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO),
      })
      const dialogo = await screen.findByRole('dialog', { name: TITULO_COMERCIAL })
      await within(dialogo).findByRole('alert')

      expect(pedidosPdf(chamadas)).toHaveLength(0)
      expect(within(dialogo).queryByRole('button', { name: ROTULO_EXPORTAR })).not.toBeInTheDocument()
    })
  })

  describe('Exportar', () => {
    async function abrirMenuExportar(user: ReturnType<typeof usuarioRapido>, dialogo: HTMLElement) {
      await user.click(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR }))
      return screen.getByRole('menu')
    }

    it('"Exportar" abre o menu com "PDF desta imagem" e "Todas as imagens (ZIP)"', async () => {
      const user = usuarioRapido()
      renderizar()
      const dialogo = await abrir()

      const menu = await abrirMenuExportar(user, dialogo)

      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual([
        ITEM_PDF_DESTA_IMAGEM,
        ITEM_ZIP_TODAS,
      ])
    })

    it('"PDF desta imagem" baixa o PDF da imagem exibida com o nome do arquivo', async () => {
      const user = usuarioRapido()
      renderizar()
      const dialogo = await abrir()
      await user.click(within(dialogo).getByRole('button', { name: 'Próxima imagem' }))
      await pdfExibido(dialogo, tituloPdf('102'))

      const menu = await abrirMenuExportar(user, dialogo)
      await user.click(within(menu).getByRole('menuitem', { name: ITEM_PDF_DESTA_IMAGEM }))

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomePdfPrevia(1, 'filial:102')]))
      expect(urls.criadas.map((c) => c.url)).toContain(downloads[0].href)
    })

    it('"Todas as imagens (ZIP)" baixa o ZIP da prévia (GET .../previa/zip) com o nome do arquivo', async () => {
      const user = usuarioRapido()
      const { chamadas } = renderizar()
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      const menu = await abrirMenuExportar(user, dialogo)
      await user.click(within(menu).getByRole('menuitem', { name: ITEM_ZIP_TODAS }))

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomeZipPrevia(1)]))
      const zips = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/fechamentos/1/previa/zip')
      expect(zips).toHaveLength(1)
      expect(urls.criadas.map((c) => c.url)).toContain(downloads[0].href)
    })

    it('durante a exportação o botão "Exportar" fica desabilitado; ao terminar, volta a ficar disponível', async () => {
      const user = usuarioRapido()
      const lento = adiado<void>()
      renderizar(COMERCIAL, { 1: previaComercialApi() }, {
        'GET /api/ped/fechamentos/1/previa/zip': () => lento.promessa.then(() => rotaZip(1)(undefined, new URL('http://localhost'))),
      })
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      const menu = await abrirMenuExportar(user, dialogo)
      await user.click(within(menu).getByRole('menuitem', { name: ITEM_ZIP_TODAS }))

      await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeDisabled())
      expect(downloads).toHaveLength(0)

      lento.resolver()

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomeZipPrevia(1)]))
      await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled())
    })

    it('erro na exportação: alerta com a mensagem, sem download; o PDF exibido continua', async () => {
      const user = usuarioRapido()
      renderizar(COMERCIAL, { 1: previaComercialApi() }, {
        'GET /api/ped/fechamentos/1/previa/zip': () => respostaErro(400, MENSAGEM_PREVIA_SEM_IMAGENS),
      })
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      const menu = await abrirMenuExportar(user, dialogo)
      await user.click(within(menu).getByRole('menuitem', { name: ITEM_ZIP_TODAS }))

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_PREVIA_SEM_IMAGENS)
      expect(downloads).toHaveLength(0)
      expect(within(dialogo).getByTitle(tituloPdf('101'))).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled()
    })

    /**
     * Alteração de 17/11/2026 (docs/backend/FRONT-pdf-zip (1).md): ZIP grande pode exceder o tempo limite do
     * servidor; em falha de rede (0), 502, 503 ou 504 no ZIP, a prévia sugere tentar de novo ou exportar os
     * PDFs individualmente (`dicaFalhaZip`).
     */
    it.each([
      ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch')), 'Não foi possível conectar ao servidor.'],
      ['504', () => respostaErro(504, 'Gateway Timeout'), null],
    ] as const)('ZIP com %s: alerta com a mensagem, o tempo limite e a dica da prévia', async (_caso, rota, mensagem) => {
      const TEMPO = 'A montagem do ZIP pode ter excedido o tempo limite do servidor.'
      const DICA_PREVIA = 'Tente novamente ou exporte os PDFs das imagens individualmente.'
      const user = usuarioRapido()
      renderizar(COMERCIAL, { 1: previaComercialApi() }, { 'GET /api/ped/fechamentos/1/previa/zip': rota })
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      const menu = await abrirMenuExportar(user, dialogo)
      await user.click(within(menu).getByRole('menuitem', { name: ITEM_ZIP_TODAS }))

      const alerta = await within(dialogo).findByRole('alert')
      if (mensagem) expect(alerta).toHaveTextContent(mensagem)
      expect(alerta).toHaveTextContent(TEMPO)
      expect(alerta).toHaveTextContent(DICA_PREVIA)
      const texto = alerta.textContent ?? ''
      expect(texto.indexOf(TEMPO)).toBeLessThan(texto.indexOf(DICA_PREVIA))
      expect(alerta).not.toHaveTextContent('Use os filtros da consulta')
      expect(downloads).toHaveLength(0)
      expect(within(dialogo).getByTitle(tituloPdf('101'))).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled()
    })

    it('ZIP com 400: só a mensagem, sem o tempo limite nem a dica da prévia', async () => {
      const user = usuarioRapido()
      renderizar(COMERCIAL, { 1: previaComercialApi() }, {
        'GET /api/ped/fechamentos/1/previa/zip': () => respostaErro(400, MENSAGEM_PREVIA_SEM_IMAGENS),
      })
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      const menu = await abrirMenuExportar(user, dialogo)
      await user.click(within(menu).getByRole('menuitem', { name: ITEM_ZIP_TODAS }))

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent(MENSAGEM_PREVIA_SEM_IMAGENS)
      expect(alerta).not.toHaveTextContent('A montagem do ZIP pode ter excedido o tempo limite do servidor.')
      expect(alerta).not.toHaveTextContent('Tente novamente ou exporte os PDFs das imagens individualmente.')
    })

    it('nada é gravado: o PDF e a exportação só fazem GET', async () => {
      const user = usuarioRapido()
      const { chamadas } = renderizar()
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      await user.click(within(await abrirMenuExportar(user, dialogo)).getByRole('menuitem', { name: ITEM_PDF_DESTA_IMAGEM }))
      await waitFor(() => expect(downloads).toHaveLength(1))
      await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled())
      await user.click(within(await abrirMenuExportar(user, dialogo)).getByRole('menuitem', { name: ITEM_ZIP_TODAS }))
      await waitFor(() => expect(downloads).toHaveLength(2))

      expect(chamadas.every((c) => c.metodo === 'GET')).toBe(true)
    })
  })

  /**
   * Alteração de 17/11/2026: o back-end deixou de limitar o número de imagens por ZIP. Junto ao "Exportar",
   * o `AvisoQuantidadeImagens` (`Aviso tipo="info"`) informa quantas imagens serão geradas — o total da
   * prévia (`previa.imagens.length`, o mesmo "N no total"), não só as da filial exibida — e que a exibição dos
   * PDFs e a montagem do ZIP podem demorar. Enquanto o ZIP é montado: "Montando o ZIP com {N} imagens…".
   */
  describe('aviso da quantidade de imagens (ZIP sem limite)', () => {
    it('mostra "Serão geradas 2 imagens em PDF." e o aviso de demora junto ao "Exportar"', async () => {
      renderizar()
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      const aviso = avisoQuantidadeImagens(dialogo)
      expect(aviso).not.toBeNull()
      expect(aviso).toHaveTextContent(textoQuantidadeImagens(2))
      expect(aviso).toHaveTextContent(TEXTO_DEMORA_IMAGENS)
      expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeInTheDocument()
    })

    it('a quantidade é o total da prévia (4), não só a da filial exibida, mesmo ao trocar de filial', async () => {
      const user = usuarioRapido()
      renderizar(GERENTES, { 2: previaGerentesComEquipeApi() })
      const dialogo = await abrir(TITULO_GERENTES)
      expect(within(dialogo).getByText('3 nesta filial · 4 no total')).toBeInTheDocument()

      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(4))

      await user.selectOptions(within(dialogo).getByRole('combobox', { name: 'Filial' }), '102')
      await waitFor(() => expect(within(dialogo).getByText('1 nesta filial · 4 no total')).toBeInTheDocument())

      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(4))
    })

    it('com uma única imagem na prévia, usa o singular "Será gerada 1 imagem em PDF."', async () => {
      const base = previaComercialApi()
      const uma: PreviaFechamentoApiFalsa = {
        ...base,
        resumo: { ...base.resumo, 'imagens a gerar': 1 },
        imagens: [base.imagens[0]],
      }
      renderizar(COMERCIAL, { 1: uma })
      const dialogo = await abrir()
      await pdfExibido(dialogo, tituloPdf('101'))

      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(1))
    })

    it('sem imagens a gerar, não mostra o aviso', async () => {
      const vazia: PreviaFechamentoApiFalsa = {
        ...previaComercialApi(),
        resumo: { ...previaComercialApi().resumo, 'imagens a gerar': 0 },
        imagens: [],
      }
      renderizar(VENDEDORES, { 6: vazia })
      const dialogo = await screen.findByRole('dialog', { name: 'Pré-visualização — PED Vendedores · 2026' })
      await within(dialogo).findByText(/^Nenhuma imagem a gerar/)

      expect(avisoQuantidadeImagens(dialogo)).toBeNull()
      expect(within(dialogo).queryByText(/imagens? em PDF\./)).not.toBeInTheDocument()
    })

    it('com erro na prévia, não mostra o aviso', async () => {
      renderizar(COMERCIAL, {}, {
        'GET /api/ped/fechamentos/1/previa': () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO),
      })
      const dialogo = await screen.findByRole('dialog', { name: TITULO_COMERCIAL })
      await within(dialogo).findByRole('alert')

      expect(avisoQuantidadeImagens(dialogo)).toBeNull()
    })

    it('enquanto o ZIP é montado, mostra "Montando o ZIP com 4 imagens…"; some ao baixar', async () => {
      const user = usuarioRapido()
      const lento = adiado<void>()
      renderizar(GERENTES, { 2: previaGerentesComEquipeApi() }, {
        'GET /api/ped/fechamentos/2/previa/zip': () => lento.promessa.then(() => rotaZip(2)(undefined, new URL('http://x'))),
      })
      const dialogo = await abrir(TITULO_GERENTES)

      await user.click(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR }))
      await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: ITEM_ZIP_TODAS }))

      const status = await within(dialogo).findByText(textoMontandoZip(4))
      expect(status.closest('[role="status"]')).not.toBeNull()

      lento.resolver()

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([nomeZipPrevia(2)]))
      await waitFor(() => expect(within(dialogo).queryByText(/Montando o ZIP/)).not.toBeInTheDocument())
    })
  })

  /**
   * Alteração de 17/11/2026: com muitas imagens o cálculo da prévia demora, e o aviso da quantidade e da demora
   * precisa aparecer desde a abertura. Enquanto `obterPreviaFechamento` não respondeu ("Calculando as
   * imagens..."), o aviso usa a estimativa da linha do fechamento (`unidadesDeImagem - unidadesEncerradas`);
   * com a estimativa ≤ 0, nada. Quando a prévia chega, passa a valer `previa.imagens.length` (mesmo que
   * diferente da estimativa); com erro na prévia ou sem imagens a gerar, o aviso some.
   */
  describe('aviso da quantidade enquanto a prévia é calculada', () => {
    const GERENTES_10_3 = { ...GERENTES, unidadesDeImagem: 10, unidadesEncerradas: 3 }

    /** Renderiza com a prévia do dashboard 2 respondendo só quando o teste mandar. */
    function renderizarComPreviaLenta(fechamento: typeof GERENTES, resposta: () => Response) {
      const lenta = adiado<void>()
      const resultado = renderizar(fechamento, { 2: previaGerentesComEquipeApi() }, {
        'GET /api/ped/fechamentos/2/previa': () => lenta.promessa.then(resposta),
      })
      return { ...resultado, liberar: lenta.resolver }
    }

    it('enquanto calcula, mostra a estimativa da linha (10 unidades - 3 encerradas = 7) e o aviso de demora', async () => {
      renderizarComPreviaLenta(GERENTES_10_3, () => respostaJson(previaGerentesComEquipeApi()))
      const dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })

      expect(within(dialogo).getByText('Calculando as imagens...')).toBeInTheDocument()
      const aviso = avisoQuantidadeImagens(dialogo)
      expect(aviso).not.toBeNull()
      expect(aviso).toHaveTextContent(textoQuantidadeImagens(7))
      expect(aviso).toHaveTextContent(TEXTO_DEMORA_IMAGENS)
    })

    it('quando a prévia chega, o aviso passa ao total da prévia (4), mesmo diferente da estimativa (7)', async () => {
      const { liberar } = renderizarComPreviaLenta(GERENTES_10_3, () => respostaJson(previaGerentesComEquipeApi()))
      const dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(7))

      liberar()
      await within(dialogo).findByRole('combobox', { name: 'Filial' })

      const aviso = avisoQuantidadeImagens(dialogo)
      expect(aviso).toHaveTextContent(textoQuantidadeImagens(4))
      expect(aviso).not.toHaveTextContent(textoQuantidadeImagens(7))
      expect(within(dialogo).queryByText('Calculando as imagens...')).not.toBeInTheDocument()
    })

    it('estimativa de 1 imagem usa o singular e a de 1.234 usa o ponto de milhar', async () => {
      const primeiro = renderizarComPreviaLenta({ ...GERENTES, unidadesDeImagem: 4, unidadesEncerradas: 3 }, () =>
        respostaJson(previaGerentesComEquipeApi()),
      )
      let dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(1))
      primeiro.unmount()

      renderizarComPreviaLenta({ ...GERENTES, unidadesDeImagem: 1300, unidadesEncerradas: 66 }, () =>
        respostaJson(previaGerentesComEquipeApi()),
      )
      dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent('Serão geradas 1.234 imagens em PDF.')
    })

    it.each([
      ['todas encerradas (3 - 3 = 0)', 3, 3],
      ['estimativa negativa (2 - 5)', 2, 5],
      ['sem unidades (0 - 0)', 0, 0],
    ])('com a estimativa ≤ 0 (%s), nada enquanto calcula', async (_caso, unidades, encerradas) => {
      renderizarComPreviaLenta({ ...GERENTES, unidadesDeImagem: unidades, unidadesEncerradas: encerradas }, () =>
        respostaJson(previaGerentesComEquipeApi()),
      )
      const dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })

      expect(within(dialogo).getByText('Calculando as imagens...')).toBeInTheDocument()
      expect(avisoQuantidadeImagens(dialogo)).toBeNull()
      expect(within(dialogo).queryByText(/imagens? em PDF\./)).not.toBeInTheDocument()
    })

    it('com a estimativa ≤ 0, o aviso aparece quando a prévia chega com imagens (4)', async () => {
      const { liberar } = renderizarComPreviaLenta({ ...GERENTES, unidadesDeImagem: 3, unidadesEncerradas: 3 }, () =>
        respostaJson(previaGerentesComEquipeApi()),
      )
      const dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })
      expect(avisoQuantidadeImagens(dialogo)).toBeNull()

      liberar()
      await within(dialogo).findByRole('combobox', { name: 'Filial' })

      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(4))
    })

    it('erro na prévia: o aviso da estimativa some', async () => {
      const { liberar } = renderizarComPreviaLenta(GERENTES_10_3, () => respostaErro(400, MENSAGEM_DASHBOARD_NAO_ATIVO))
      const dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(7))

      liberar()

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_DASHBOARD_NAO_ATIVO)
      expect(avisoQuantidadeImagens(dialogo)).toBeNull()
    })

    it('prévia sem imagens a gerar: o aviso da estimativa some', async () => {
      const vazia: PreviaFechamentoApiFalsa = {
        ...previaGerentesComEquipeApi(),
        resumo: { ...previaGerentesComEquipeApi().resumo, 'imagens a gerar': 0 },
        imagens: [],
      }
      const { liberar } = renderizarComPreviaLenta(GERENTES_10_3, () => respostaJson(vazia))
      const dialogo = await screen.findByRole('dialog', { name: TITULO_GERENTES })
      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent(textoQuantidadeImagens(7))

      liberar()
      await within(dialogo).findByText(/^Nenhuma imagem a gerar/)

      expect(avisoQuantidadeImagens(dialogo)).toBeNull()
    })
  })
})
