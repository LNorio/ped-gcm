import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ArquivoBaixado } from '../../services/api'
import {
  ITEM_PDF_DESTA_IMAGEM,
  ITEM_ZIP_TODAS,
  MENSAGEM_LIMITE_REQUISICOES,
  ROTULO_EXPORTAR,
  SEGUNDOS_ESPERA_PADRAO,
  TIPO_PDF,
  TIPO_ZIP,
  simularDownloads,
  simularUrlsDeObjeto,
} from '../../test/pdfFalsos'
import { ExportarImagens, type ObterArquivo } from './ExportarImagens'

/**
 * F10.10 — "Exportar" e o limite de uso do back-end (`429`), resposta do back-end de 17/11/2026 à
 * `PROPOSTA-pdf-imagens` (`docs/backend/FRONT-pdf-zip.md` e `FRONT-pdf-fechamento.md`; `API (29).md`,
 * "PDF do fechamento"): 20 PDFs por minuto por usuário (as duas rotas de PDF dividem o contador) e
 * 5 ZIPs por minuto, com `"segundos para tentar novamente": N` e `Retry-After` (lidos por `apiFetchArquivo`
 * em `ApiError.tentarNovamenteEm`).
 *
 * `ExportarImagens` (`src/pages/fechamentos/ExportarImagens.tsx`, usado na prévia e no diálogo da imagem):
 * - `429`: alerta com a `mensagem` do back-end, sem download, e o botão "Exportar" **desabilitado pelos
 *   N segundos** informados (`tentarNovamenteEm`); sem N, pelo padrão de 60 s (o mesmo do login);
 * - no último segundo da espera ainda está desabilitado; ao fim, volta a ser habilitado e a exportação
 *   funciona de novo;
 * - outros erros (ex.: `400`) não bloqueiam: o botão volta habilitado assim que a chamada termina;
 * - o nome acessível do botão continua "Exportar" durante a espera.
 *
 * Relógio falso (setTimeout/setInterval/Date) desde o início; interações com `fireEvent` (o user-event
 * esperaria um setTimeout real).
 */

function erro429(segundos?: number): ApiError {
  const dados: Record<string, unknown> = { mensagem: MENSAGEM_LIMITE_REQUISICOES }
  if (segundos !== undefined) dados['segundos para tentar novamente'] = segundos
  return new ApiError(429, MENSAGEM_LIMITE_REQUISICOES, dados, segundos)
}

const PDF: ArquivoBaixado = { blob: new Blob(['%PDF-1.4'], { type: TIPO_PDF }), nomeArquivo: 'IMG-000003.pdf' }
const ZIP: ArquivoBaixado = { blob: new Blob(['PK'], { type: TIPO_ZIP }), nomeArquivo: 'IMAGENS_2026-11-17.zip' }

async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('F10.10 — ExportarImagens: limite de uso (429) do PDF e do ZIP', () => {
  let downloads: ReturnType<typeof simularDownloads>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    simularUrlsDeObjeto()
    downloads = simularDownloads()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function renderizar(obterPdf: ObterArquivo, obterZip: ObterArquivo) {
    render(<ExportarImagens obterPdf={obterPdf} obterZip={obterZip} />)
  }

  const botaoExportar = () => screen.getByRole('button', { name: ROTULO_EXPORTAR })

  async function exportar(item: string) {
    fireEvent.click(botaoExportar())
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }))
    await avancar(0)
  }

  it('429 no ZIP com 5 s: mostra a mensagem, sem download, e "Exportar" fica desabilitado pelos 5 s', async () => {
    const obterZip = vi.fn<ObterArquivo>().mockRejectedValue(erro429(5))
    renderizar(vi.fn<ObterArquivo>().mockResolvedValue(PDF), obterZip)

    await exportar(ITEM_ZIP_TODAS)

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_LIMITE_REQUISICOES)
    expect(downloads).toHaveLength(0)
    expect(botaoExportar()).toBeDisabled()

    await avancar(4_000)
    expect(botaoExportar()).toBeDisabled()

    await avancar(1_000)
    expect(botaoExportar()).toBeEnabled()
    expect(obterZip).toHaveBeenCalledTimes(1)
  })

  it('429 no PDF com 30 s: no último segundo ainda bloqueia; ao fim, volta a exportar normalmente', async () => {
    const obterPdf = vi.fn<ObterArquivo>().mockRejectedValueOnce(erro429(30)).mockResolvedValue(PDF)
    renderizar(obterPdf, vi.fn<ObterArquivo>().mockResolvedValue(ZIP))

    await exportar(ITEM_PDF_DESTA_IMAGEM)

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_LIMITE_REQUISICOES)
    expect(botaoExportar()).toBeDisabled()

    await avancar(29_000)
    expect(botaoExportar()).toBeDisabled()

    await avancar(1_000)
    expect(botaoExportar()).toBeEnabled()

    await exportar(ITEM_PDF_DESTA_IMAGEM)

    expect(obterPdf).toHaveBeenCalledTimes(2)
    expect(downloads.map((d) => d.nome)).toEqual(['IMG-000003.pdf'])
  })

  it('o bloqueio vale para os dois itens: durante a espera do PDF, o ZIP também não pode ser pedido', async () => {
    const obterZip = vi.fn<ObterArquivo>().mockResolvedValue(ZIP)
    renderizar(vi.fn<ObterArquivo>().mockRejectedValue(erro429(10)), obterZip)

    await exportar(ITEM_PDF_DESTA_IMAGEM)
    fireEvent.click(botaoExportar())
    await avancar(0)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(obterZip).not.toHaveBeenCalled()
  })

  it(`429 sem o tempo de espera: "Exportar" fica desabilitado pelo padrão de ${SEGUNDOS_ESPERA_PADRAO} s`, async () => {
    renderizar(vi.fn<ObterArquivo>().mockResolvedValue(PDF), vi.fn<ObterArquivo>().mockRejectedValue(erro429()))

    await exportar(ITEM_ZIP_TODAS)

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_LIMITE_REQUISICOES)
    expect(botaoExportar()).toBeDisabled()

    await avancar((SEGUNDOS_ESPERA_PADRAO - 1) * 1_000)
    expect(botaoExportar()).toBeDisabled()

    await avancar(1_000)
    expect(botaoExportar()).toBeEnabled()
  })

  it('outro erro (400) não bloqueia: o botão volta habilitado assim que a chamada termina', async () => {
    // O ZIP não tem mais limite de imagens (17/11/2026); um 400 do back-end só mostra a mensagem.
    const mensagem = 'nenhuma imagem encontrada para exportar'
    renderizar(vi.fn<ObterArquivo>().mockResolvedValue(PDF), vi.fn<ObterArquivo>().mockRejectedValue(new ApiError(400, mensagem)))

    await exportar(ITEM_ZIP_TODAS)

    expect(screen.getByRole('alert')).toHaveTextContent(mensagem)
    expect(botaoExportar()).toBeEnabled()
  })
})
