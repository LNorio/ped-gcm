import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ArquivoBaixado } from '../../services/api'
import { MENSAGEM_LIMITE_REQUISICOES, SEGUNDOS_ESPERA_PADRAO, TIPO_PDF, simularUrlsDeObjeto } from '../../test/pdfFalsos'
import { usePdfImagem, type CarregarPdf } from './usePdfImagem'
import { VisualizadorPdf } from './VisualizadorPdf'

/**
 * F10.10 — PDF embutido e o limite de uso do back-end (`429`), resposta do back-end de 17/11/2026 à
 * `PROPOSTA-pdf-imagens` (`docs/backend/FRONT-pdf-fechamento.md`; `API (29).md`, "PDF do fechamento"):
 * 20 PDFs por minuto por usuário, as duas rotas de PDF (`previa/pdf` e `imagens/{id}/pdf`) dividem o
 * contador; `"segundos para tentar novamente": N` e `Retry-After` chegam em `ApiError.tentarNovamenteEm`.
 *
 * `usePdfImagem` + `VisualizadorPdf` (prévia e diálogo da imagem):
 * - `429`: alerta com a `mensagem` do back-end e "Tentar novamente" **desabilitado pelos N segundos**
 *   (sem N, pelo padrão de 60 s, o mesmo do login); nenhuma nova tentativa automática;
 * - no último segundo ainda está desabilitado; ao fim, habilitado, e o clique pede o PDF de novo;
 * - outros erros não bloqueiam "Tentar novamente".
 *
 * Relógio falso (setTimeout/setInterval/Date); interações com `fireEvent`.
 */

const CHAVE = '1|filial:101'
const TITULO = 'PDF da imagem — Filial 101'
const PDF: ArquivoBaixado = { blob: new Blob(['%PDF-1.4'], { type: TIPO_PDF }), nomeArquivo: 'PREVIA_PED-Comercial_4-tri-2026_F101.pdf' }

function erro429(segundos?: number): ApiError {
  const dados: Record<string, unknown> = { mensagem: MENSAGEM_LIMITE_REQUISICOES }
  if (segundos !== undefined) dados['segundos para tentar novamente'] = segundos
  return new ApiError(429, MENSAGEM_LIMITE_REQUISICOES, dados, segundos)
}

function PdfDeTeste({ carregar }: { carregar: CarregarPdf }) {
  const pdf = usePdfImagem(CHAVE, carregar)
  return <VisualizadorPdf pdf={pdf} titulo={TITULO} />
}

async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('F10.10 — PDF embutido (usePdfImagem/VisualizadorPdf): limite de uso (429)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    simularUrlsDeObjeto()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const tentarNovamente = () => screen.getByRole('button', { name: 'Tentar novamente' })

  async function renderizar(carregar: CarregarPdf) {
    render(<PdfDeTeste carregar={carregar} />)
    await avancar(0)
  }

  it('429 com 20 s: mostra a mensagem e "Tentar novamente" fica desabilitado pelos 20 s', async () => {
    const carregar = vi.fn<CarregarPdf>().mockRejectedValue(erro429(20))
    await renderizar(carregar)

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_LIMITE_REQUISICOES)
    expect(tentarNovamente()).toBeDisabled()
    expect(screen.queryByTitle(TITULO)).not.toBeInTheDocument()

    await avancar(19_000)
    expect(tentarNovamente()).toBeDisabled()

    await avancar(1_000)
    expect(tentarNovamente()).toBeEnabled()
    expect(carregar).toHaveBeenCalledTimes(1)
  })

  it('ao fim da espera, "Tentar novamente" pede o PDF de novo e o mostra', async () => {
    const carregar = vi.fn<CarregarPdf>().mockRejectedValueOnce(erro429(20)).mockResolvedValue(PDF)
    await renderizar(carregar)

    await avancar(20_000)
    fireEvent.click(tentarNovamente())
    await avancar(0)

    expect(carregar).toHaveBeenCalledTimes(2)
    expect(screen.getByTitle(TITULO)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it(`429 sem o tempo de espera: "Tentar novamente" fica desabilitado pelo padrão de ${SEGUNDOS_ESPERA_PADRAO} s`, async () => {
    const carregar = vi.fn<CarregarPdf>().mockRejectedValue(erro429())
    await renderizar(carregar)

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_LIMITE_REQUISICOES)
    expect(tentarNovamente()).toBeDisabled()

    await avancar((SEGUNDOS_ESPERA_PADRAO - 1) * 1_000)
    expect(tentarNovamente()).toBeDisabled()

    await avancar(1_000)
    expect(tentarNovamente()).toBeEnabled()
    expect(carregar).toHaveBeenCalledTimes(1)
  })

  it('outro erro (500) não bloqueia: "Tentar novamente" fica habilitado', async () => {
    const mensagem = 'erro ao gerar o pdf: falha interna'
    await renderizar(vi.fn<CarregarPdf>().mockRejectedValue(new ApiError(500, mensagem)))

    expect(screen.getByRole('alert')).toHaveTextContent(mensagem)
    expect(tentarNovamente()).toBeEnabled()
  })
})
