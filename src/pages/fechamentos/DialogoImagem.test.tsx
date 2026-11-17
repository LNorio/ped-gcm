import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaErro, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { adiado, tituloDialogoImagem } from '../../test/consultaImagensFalsos'
import {
  LINHA_IMAGEM_ANA,
  LINHA_IMAGEM_COMERCIAL_100,
  TEXTO_GERANDO_PDF,
  TIPO_PDF,
  conteudoPdfImagem,
  respostaArquivo,
  simularUrlsDeObjeto,
  tituloPdf,
  urlDoPdf,
} from '../../test/pdfFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoImagem } from './DialogoImagem'

const LINHA_ANA = LINHA_IMAGEM_ANA
const LINHA_COMERCIAL_100 = LINHA_IMAGEM_COMERCIAL_100

/**
 * F10.6 — Diálogo de uma imagem da consulta retroativa (`src/pages/fechamentos/DialogoImagem.tsx`; RF-84, RN-18).
 *
 * Alteração de 17/11/2026 (F10.10): a imagem congelada passa a ser mostrada **em PDF**, gerado pelo
 * back-end (`obterPdfImagem(imagem.id)` → `GET /api/ped/imagens/{id}/pdf`), embutido no diálogo
 * (`iframe`/`object` com a URL de objeto do Blob), no lugar da `VisualizacaoImagem` e da consulta do
 * detalhe (`GET /api/ped/imagens/{id}` deixa de ser chamado pelo diálogo).
 *
 * Props: `{ imagem: ImagemDaConsulta | null; onFechar: () => void; filtros?: FiltrosImagens }` (`filtros`:
 * os da consulta, usados pela exportação em ZIP — ver `DialogoImagem.exportar.test.tsx`).
 * - `imagem` null: não renderiza nada nem consulta;
 * - aberto: diálogo "Imagem congelada {código}"; pede o PDF, anuncia "Gerando PDF…" e mostra o PDF com o
 *   título "PDF da imagem — Filial {código}[ · {colaborador}]";
 * - erro: alerta com a mensagem dentro do diálogo e "Tentar novamente";
 * - trocar a imagem pede o PDF da nova (só a resposta mais recente vale) e libera a URL anterior
 *   (`URL.revokeObjectURL`), também ao fechar;
 * - "Fechar" e Esc chamam `onFechar`; somente leitura (só GET; sem alterar ou excluir).
 */
describe('F10.6 — DialogoImagem (visualizar imagem congelada em PDF)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let urls: ReturnType<typeof simularUrlsDeObjeto>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    urls = simularUrlsDeObjeto()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  const pdfDe = (codigo: string): RotaFalsa => () => respostaArquivo(conteudoPdfImagem(codigo), TIPO_PDF, `${codigo}.pdf`)

  function simular(rotas: Record<string, RotaFalsa> = {}) {
    return simularApi(fetchFalso, {
      'GET /api/ped/imagens/1/pdf': pdfDe('IMG-000001'),
      'GET /api/ped/imagens/3/pdf': pdfDe('IMG-000003'),
      ...rotas,
    })
  }

  const getsPdf = (chamadas: ChamadaRegistrada[], id: number) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `/api/ped/imagens/${id}/pdf`)
  const getsDetalhe = (chamadas: ChamadaRegistrada[], id: number) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === `/api/ped/imagens/${id}`)

  const TITULO_PDF_ANA = tituloPdf('100', 'Ana Souza')
  const TITULO_PDF_COMERCIAL = tituloPdf('100')

  it('sem imagem (null): não mostra diálogo e não consulta a API', async () => {
    const chamadas = simular()

    render(<DialogoImagem imagem={null} onFechar={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 20))
    expect(chamadas).toHaveLength(0)
  })

  it('com imagem: diálogo "Imagem congelada {código}", um GET do PDF e o PDF embutido com título acessível', async () => {
    const chamadas = simular()

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    const pdf = await within(dialogo).findByTitle(TITULO_PDF_ANA)
    expect(['IFRAME', 'OBJECT']).toContain(pdf.tagName)
    expect(urlDoPdf(pdf)).toBe(urls.criadas.at(-1)!.url)
    expect(getsPdf(chamadas, 3)).toHaveLength(1)
    // O detalhe em JSON e a visualização com os valores na tela (F10.3) não são mais usados aqui.
    expect(getsDetalhe(chamadas, 3)).toHaveLength(0)
    expect(within(dialogo).queryByRole('region', { name: 'Imagem IMG-000003' })).not.toBeInTheDocument()
  })

  it('enquanto pede o PDF, anuncia "Gerando PDF…" e ainda não mostra o PDF', async () => {
    const lenta = adiado<void>()
    simular({ 'GET /api/ped/imagens/3/pdf': (init, url) => lenta.promessa.then(() => pdfDe('IMG-000003')(init, url)) })

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByText(TEXTO_GERANDO_PDF)).toBeInTheDocument()
    expect(within(dialogo).queryByTitle(TITULO_PDF_ANA)).not.toBeInTheDocument()

    lenta.resolver()

    expect(await within(dialogo).findByTitle(TITULO_PDF_ANA)).toBeInTheDocument()
    expect(within(dialogo).queryByText(TEXTO_GERANDO_PDF)).not.toBeInTheDocument()
  })

  it('imagem de filial: PDF com o título só da filial', async () => {
    const chamadas = simular()

    render(<DialogoImagem imagem={LINHA_COMERCIAL_100} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000001') })
    expect(await within(dialogo).findByTitle(TITULO_PDF_COMERCIAL)).toBeInTheDocument()
    expect(getsPdf(chamadas, 1)).toHaveLength(1)
  })

  it('erro HTTP: alerta com a mensagem no diálogo; "Tentar novamente" pede de novo e mostra o PDF', async () => {
    const user = usuarioRapido()
    let falhar = true
    const chamadas = simular({
      'GET /api/ped/imagens/3/pdf': (init, url) => (falhar ? respostaErro(500) : pdfDe('IMG-000003')(init, url)),
    })
    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)
    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))
    expect(within(dialogo).queryByTitle(TITULO_PDF_ANA)).not.toBeInTheDocument()

    falhar = false
    await user.click(within(dialogo).getByRole('button', { name: 'Tentar novamente' }))

    expect(await within(dialogo).findByTitle(TITULO_PDF_ANA)).toBeInTheDocument()
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument()
    expect(getsPdf(chamadas, 3)).toHaveLength(2)
  })

  it('falha de rede: alerta com a mensagem de sem conexão', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
  })

  it.each([
    [404, 'recurso nao encontrado'],
    [403, 'o validador so ve imagens da propria filial'],
  ])('erro %i: alerta com a mensagem do servidor, sem PDF', async (status, mensagem) => {
    simular({ 'GET /api/ped/imagens/3/pdf': () => respostaErro(status, mensagem) })

    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem)
    expect(within(dialogo).queryByTitle(TITULO_PDF_ANA)).not.toBeInTheDocument()
  })

  it('trocar a imagem pede o PDF da nova, mostra o título dela e libera a URL anterior', async () => {
    const chamadas = simular()
    const { rerender } = render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)
    const anterior = urlDoPdf(await screen.findByTitle(TITULO_PDF_ANA))

    rerender(<DialogoImagem imagem={LINHA_COMERCIAL_100} onFechar={vi.fn()} />)

    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000001') })
    const pdf = await within(dialogo).findByTitle(TITULO_PDF_COMERCIAL)
    expect(within(dialogo).queryByTitle(TITULO_PDF_ANA)).not.toBeInTheDocument()
    expect(getsPdf(chamadas, 1)).toHaveLength(1)
    await waitFor(() => expect(urls.revogadas).toContain(anterior))
    expect(urls.revogadas).not.toContain(urlDoPdf(pdf))
  })

  it('só a resposta da imagem mais recente é aplicada (PDF lento da anterior é descartado, sem URL vazada)', async () => {
    const lenta = adiado<void>()
    simular({ 'GET /api/ped/imagens/3/pdf': (init, url) => lenta.promessa.then(() => pdfDe('IMG-000003')(init, url)) })
    const { rerender } = render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)

    rerender(<DialogoImagem imagem={LINHA_COMERCIAL_100} onFechar={vi.fn()} />)
    const pdf = await screen.findByTitle(TITULO_PDF_COMERCIAL)

    lenta.resolver()
    await new Promise((r) => setTimeout(r, 20))

    expect(screen.getByTitle(TITULO_PDF_COMERCIAL)).toBe(pdf)
    expect(screen.queryByTitle(TITULO_PDF_ANA)).not.toBeInTheDocument()
    const exibida = urlDoPdf(pdf)
    expect(urls.revogadas).not.toContain(exibida)
    for (const { url } of urls.criadas.filter((c) => c.url !== exibida)) expect(urls.revogadas).toContain(url)
  })

  it('ao fechar (imagem null ou desmontar), libera a URL do PDF exibido', async () => {
    simular()
    const { rerender, unmount } = render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)
    const primeira = urlDoPdf(await screen.findByTitle(TITULO_PDF_ANA))

    rerender(<DialogoImagem imagem={null} onFechar={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(urls.revogadas).toContain(primeira))

    rerender(<DialogoImagem imagem={LINHA_COMERCIAL_100} onFechar={vi.fn()} />)
    const segunda = urlDoPdf(await screen.findByTitle(TITULO_PDF_COMERCIAL))

    unmount()

    expect(urls.revogadas).toContain(segunda)
  })

  it('"Fechar" e Esc chamam onFechar', async () => {
    const user = usuarioRapido()
    simular()
    const onFechar = vi.fn()
    render(<DialogoImagem imagem={LINHA_ANA} onFechar={onFechar} />)
    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    await within(dialogo).findByTitle(TITULO_PDF_ANA)

    await user.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    expect(onFechar).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onFechar).toHaveBeenCalledTimes(2)
  })

  it('somente leitura (RN-18): só GET e nenhuma ação de alterar ou excluir no diálogo', async () => {
    const chamadas = simular()
    render(<DialogoImagem imagem={LINHA_ANA} onFechar={vi.fn()} />)
    const dialogo = screen.getByRole('dialog', { name: tituloDialogoImagem('IMG-000003') })
    await within(dialogo).findByTitle(TITULO_PDF_ANA)

    await waitFor(() => expect(chamadas.length).toBeGreaterThan(0))
    expect(chamadas.every((c) => c.metodo === 'GET')).toBe(true)
    expect(within(dialogo).queryByRole('button', { name: /alterar|editar|excluir/i })).not.toBeInTheDocument()
  })
})
