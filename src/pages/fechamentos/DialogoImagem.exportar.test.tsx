import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import type { FiltrosImagens } from '../../services/imagensService'
import { respostaErro, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { adiado, tituloDialogoImagem } from '../../test/consultaImagensFalsos'
import {
  ITEM_PDF_DESTA_IMAGEM,
  ITEM_ZIP_TODAS,
  LINHA_IMAGEM_ANA,
  MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR,
  NOME_ZIP_IMAGENS,
  ROTULO_EXPORTAR,
  TIPO_PDF,
  TEXTO_DEMORA_IMAGENS,
  TIPO_ZIP,
  avisoQuantidadeImagens,
  conteudoPdfImagem,
  respostaArquivo,
  simularDownloads,
  simularUrlsDeObjeto,
  textoMontandoZip,
  textoQuantidadeImagens,
  tituloPdf,
} from '../../test/pdfFalsos'
import { usuarioRapido, type Usuario } from '../../test/usuario'
import { DialogoImagem } from './DialogoImagem'

const TITULO_PDF_ANA = tituloPdf('100', 'Ana Souza')
const NOME_PDF_ANA = 'IMG-000003_PED-Gerentes_10-2026_F100_Ana-Souza.pdf'
const ERRO_GERAR_ZIP = 'erro ao gerar o zip'

/**
 * F10.10 — Exportação na visualização da imagem congelada (`DialogoImagem`, F10.6 — RF-84), contrato
 * proposto em `docs/backend/PROPOSTA-pdf-imagens.md`.
 *
 * Botão "Exportar" no diálogo (menu `role="menu"`):
 * - "PDF desta imagem": baixa `obterPdfImagem(imagem.id)` (`GET /api/ped/imagens/{id}/pdf`) com o nome do
 *   `Content-Disposition`; sem nome no cabeçalho, "{código}.pdf";
 * - "Todas as imagens (ZIP)": baixa `obterZipImagens(filtros)` (`GET /api/ped/imagens/zip`) com os
 *   **filtros da consulta** recebidos na prop `filtros` (sem a prop: sem filtros);
 * - o download é um `<a download>` com o nome do arquivo; durante a exportação o botão "Exportar" fica
 *   desabilitado; erro em alerta, sem download; só GET (RN-18).
 */
describe('F10.10 — DialogoImagem: exportar o PDF da imagem e o ZIP das imagens da consulta', () => {
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

  const rotaZip: RotaFalsa = () => respostaArquivo('PK zip', TIPO_ZIP, NOME_ZIP_IMAGENS)

  function simular(rotas: Record<string, RotaFalsa> = {}) {
    return simularApi(fetchFalso, {
      'GET /api/ped/imagens/3/pdf': () => respostaArquivo(conteudoPdfImagem('IMG-000003'), TIPO_PDF, NOME_PDF_ANA),
      'GET /api/ped/imagens/zip': rotaZip,
      ...rotas,
    })
  }

  const getsZip = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/imagens/zip')

  async function abrir(filtros?: FiltrosImagens) {
    render(<DialogoImagem imagem={LINHA_IMAGEM_ANA} onFechar={vi.fn()} filtros={filtros} />)
    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    await within(dialogo).findByTitle(TITULO_PDF_ANA)
    return dialogo
  }

  async function exportar(user: Usuario, dialogo: HTMLElement, item: string) {
    await user.click(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }))
  }

  it('"Exportar" abre o menu com "PDF desta imagem" e "Todas as imagens (ZIP)"', async () => {
    const user = usuarioRapido()
    simular()
    const dialogo = await abrir()

    await user.click(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR }))

    expect(
      within(screen.getByRole('menu'))
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual([ITEM_PDF_DESTA_IMAGEM, ITEM_ZIP_TODAS])
  })

  it('o texto "Exportar" aparece uma única vez, dentro do próprio botão, e clicar nele abre o menu', async () => {
    const user = usuarioRapido()
    simular()
    const dialogo = await abrir()

    const textos = within(dialogo).getAllByText(ROTULO_EXPORTAR)
    expect(textos).toHaveLength(1)
    expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toContainElement(textos[0])

    await user.click(textos[0])

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('"PDF desta imagem" baixa o PDF da imagem com o nome do Content-Disposition', async () => {
    const user = usuarioRapido()
    simular()
    const dialogo = await abrir()

    await exportar(user, dialogo, ITEM_PDF_DESTA_IMAGEM)

    await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([NOME_PDF_ANA]))
    expect(urls.criadas.map((c) => c.url)).toContain(downloads[0].href)
  })

  it('sem nome no Content-Disposition, o PDF é baixado como "{código}.pdf"', async () => {
    const user = usuarioRapido()
    simular({ 'GET /api/ped/imagens/3/pdf': () => respostaArquivo(conteudoPdfImagem('IMG-000003'), TIPO_PDF) })
    const dialogo = await abrir()

    await exportar(user, dialogo, ITEM_PDF_DESTA_IMAGEM)

    await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual(['IMG-000003.pdf']))
  })

  it('"Todas as imagens (ZIP)" baixa o ZIP com os filtros da consulta na query', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    const dialogo = await abrir({ filial: '100', periodo: '10/2026', tipo: 'colaborador', busca: 'ana' })

    await exportar(user, dialogo, ITEM_ZIP_TODAS)

    await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([NOME_ZIP_IMAGENS]))
    expect(getsZip(chamadas)).toHaveLength(1)
    expect(Object.fromEntries(getsZip(chamadas)[0].url.searchParams.entries())).toEqual({
      filial: '100',
      periodo: '10/2026',
      tipo: 'colaborador',
      busca: 'ana',
    })
  })

  it('sem filtros (todas as filiais, sem período, tipo ou busca), o ZIP vai sem query', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    const dialogo = await abrir({ filial: 'todas', periodo: '', tipo: 'todas', busca: '' })

    await exportar(user, dialogo, ITEM_ZIP_TODAS)

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect([...getsZip(chamadas)[0].url.searchParams.keys()]).toEqual([])
  })

  it('durante a exportação o botão "Exportar" fica desabilitado; ao terminar, volta', async () => {
    const user = usuarioRapido()
    const lento = adiado<void>()
    simular({ 'GET /api/ped/imagens/zip': (init, url) => lento.promessa.then(() => rotaZip(init, url)) })
    const dialogo = await abrir()

    await exportar(user, dialogo, ITEM_ZIP_TODAS)

    await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeDisabled())
    expect(downloads).toHaveLength(0)

    lento.resolver()

    await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([NOME_ZIP_IMAGENS]))
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled())
  })

  it.each([
    ['sem imagens para exportar (400)', 400, MENSAGEM_SEM_IMAGENS_PARA_EXPORTAR],
    ['erro ao gerar o ZIP (500)', 500, ERRO_GERAR_ZIP],
    ['sem permissão (403)', 403, 'o validador so ve imagens da propria filial'],
  ])('erro na exportação do ZIP — %s: alerta com a mensagem, sem download; o PDF continua', async (_caso, status, mensagem) => {
    const user = usuarioRapido()
    simular({ 'GET /api/ped/imagens/zip': () => respostaErro(status, mensagem) })
    const dialogo = await abrir()

    await exportar(user, dialogo, ITEM_ZIP_TODAS)

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem)
    expect(downloads).toHaveLength(0)
    expect(within(dialogo).getByTitle(TITULO_PDF_ANA)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled()
  })

  /**
   * Alteração de 17/11/2026 (docs/backend/FRONT-pdf-zip (1).md): o ZIP grande pode exceder o tempo limite do
   * servidor (~60 s). Em falha de rede (status 0), 502, 503 ou 504 no ZIP, o alerta mostra a mensagem, o texto
   * "A montagem do ZIP pode ter excedido o tempo limite do servidor." e a dica da consulta
   * (`dicaFalhaZip` = "Use os filtros da consulta para reduzir a quantidade de imagens.").
   */
  describe('falha do ZIP por tempo limite', () => {
    const TEMPO = 'A montagem do ZIP pode ter excedido o tempo limite do servidor.'
    const DICA_CONSULTA = 'Use os filtros da consulta para reduzir a quantidade de imagens.'

    it('falha de rede no ZIP: "Não foi possível conectar ao servidor." seguido do tempo limite e da dica de filtrar', async () => {
      const user = usuarioRapido()
      simular({ 'GET /api/ped/imagens/zip': () => Promise.reject(new TypeError('Failed to fetch')) })
      const dialogo = await abrir({ filial: '100' })

      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent('Não foi possível conectar ao servidor.')
      expect(alerta).toHaveTextContent(TEMPO)
      expect(alerta).toHaveTextContent(DICA_CONSULTA)
      const texto = alerta.textContent ?? ''
      expect(texto.indexOf('Não foi possível conectar ao servidor.')).toBeLessThan(texto.indexOf(TEMPO))
      expect(texto.indexOf(TEMPO)).toBeLessThan(texto.indexOf(DICA_CONSULTA))
      expect(downloads).toHaveLength(0)
      expect(within(dialogo).getByTitle(TITULO_PDF_ANA)).toBeInTheDocument()
    })

    it('504 no ZIP: mensagem do servidor, tempo limite e dica de filtrar', async () => {
      const user = usuarioRapido()
      simular({ 'GET /api/ped/imagens/zip': () => respostaErro(504, 'Gateway Timeout') })
      const dialogo = await abrir()

      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent(TEMPO)
      expect(alerta).toHaveTextContent(DICA_CONSULTA)
    })

    it('500 no ZIP: só a mensagem, sem o tempo limite nem a dica', async () => {
      const user = usuarioRapido()
      simular({ 'GET /api/ped/imagens/zip': () => respostaErro(500, ERRO_GERAR_ZIP) })
      const dialogo = await abrir()

      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent(ERRO_GERAR_ZIP)
      expect(alerta).not.toHaveTextContent(TEMPO)
      expect(alerta).not.toHaveTextContent(DICA_CONSULTA)
    })
  })

  it('a exportação só faz GET (RN-18)', async () => {
    const user = usuarioRapido()
    const chamadas = simular()
    const dialogo = await abrir({ filial: '100' })

    await exportar(user, dialogo, ITEM_PDF_DESTA_IMAGEM)
    await waitFor(() => expect(downloads).toHaveLength(1))
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled())
    await exportar(user, dialogo, ITEM_ZIP_TODAS)
    await waitFor(() => expect(downloads).toHaveLength(2))

    expect(chamadas.every((c) => c.metodo === 'GET')).toBe(true)
  })

  /**
   * Alteração de 17/11/2026: sem limite de imagens por ZIP no back-end. Nova prop opcional
   * `quantidade?: number` (imagens da consulta filtrada, o que o ZIP exporta): o diálogo mostra o
   * `AvisoQuantidadeImagens` e, enquanto o ZIP é montado, "Montando o ZIP com {N} imagens…". Sem a prop,
   * o aviso não aparece.
   */
  describe('aviso da quantidade de imagens (ZIP sem limite)', () => {
    async function abrirCom(quantidade?: number) {
      render(<DialogoImagem imagem={LINHA_IMAGEM_ANA} onFechar={vi.fn()} filtros={{ filial: '100' }} quantidade={quantidade} />)
      const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
      await within(dialogo).findByTitle(TITULO_PDF_ANA)
      return dialogo
    }

    it('com quantidade 1.234, mostra "Serão geradas 1.234 imagens em PDF." e o aviso de demora', async () => {
      simular()
      const dialogo = await abrirCom(1234)

      const aviso = avisoQuantidadeImagens(dialogo)
      expect(aviso).not.toBeNull()
      expect(aviso).toHaveTextContent(textoQuantidadeImagens(1234))
      expect(aviso).toHaveTextContent('Serão geradas 1.234 imagens em PDF.')
      expect(aviso).toHaveTextContent(TEXTO_DEMORA_IMAGENS)
    })

    it('com quantidade 1, usa o singular "Será gerada 1 imagem em PDF."', async () => {
      simular()
      const dialogo = await abrirCom(1)

      expect(avisoQuantidadeImagens(dialogo)).toHaveTextContent('Será gerada 1 imagem em PDF.')
    })

    it.each([
      ['sem a prop quantidade', undefined],
      ['com quantidade 0', 0],
    ])('%s, o aviso não aparece', async (_caso, quantidade) => {
      simular()
      const dialogo = await abrirCom(quantidade)

      expect(avisoQuantidadeImagens(dialogo)).toBeNull()
      expect(within(dialogo).queryByText(/imagens? em PDF\./)).not.toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: ROTULO_EXPORTAR })).toBeInTheDocument()
    })

    it('enquanto o ZIP é montado, mostra "Montando o ZIP com 3 imagens…"; some ao baixar', async () => {
      const user = usuarioRapido()
      const lento = adiado<void>()
      simular({ 'GET /api/ped/imagens/zip': (init, url) => lento.promessa.then(() => rotaZip(init, url)) })
      const dialogo = await abrirCom(3)

      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      const status = await within(dialogo).findByText(textoMontandoZip(3))
      expect(status.closest('[role="status"]')).not.toBeNull()

      lento.resolver()

      await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([NOME_ZIP_IMAGENS]))
      await waitFor(() => expect(within(dialogo).queryByText(/Montando o ZIP/)).not.toBeInTheDocument())
    })

    it('sem a prop quantidade, a montagem do ZIP mostra só "Montando o ZIP…"', async () => {
      const user = usuarioRapido()
      const lento = adiado<void>()
      simular({ 'GET /api/ped/imagens/zip': (init, url) => lento.promessa.then(() => rotaZip(init, url)) })
      const dialogo = await abrirCom()

      await exportar(user, dialogo, ITEM_ZIP_TODAS)

      const status = await within(dialogo).findByText(textoMontandoZip())
      expect(status.closest('[role="status"]')).not.toBeNull()

      lento.resolver()
      await waitFor(() => expect(within(dialogo).queryByText(/Montando o ZIP/)).not.toBeInTheDocument())
    })
  })
})
