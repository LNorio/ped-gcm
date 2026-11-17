import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type ArquivoBaixado } from '../../services/api'
import { adiado } from '../../test/consultaImagensFalsos'
import {
  ITEM_PDF_DESTA_IMAGEM,
  ITEM_ZIP_TODAS,
  ROTULO_EXPORTAR,
  TIPO_PDF,
  TIPO_ZIP,
  simularDownloads,
  simularUrlsDeObjeto,
  textoMontandoZip,
} from '../../test/pdfFalsos'
import { usuarioRapido, type Usuario } from '../../test/usuario'
import { ExportarImagens, type ObterArquivo } from './ExportarImagens'

/**
 * F10.10 — "Exportar": status enquanto o ZIP é montado (alteração de 17/11/2026). Sem o limite de imagens
 * por ZIP no back-end, a montagem pode demorar; o usuário vê quantas imagens estão sendo reunidas.
 *
 * `ExportarImagens` ganha a prop opcional `quantidade?: number` (imagens que o ZIP exporta):
 * - enquanto "Todas as imagens (ZIP)" está em andamento, `role="status"` com "Montando o ZIP com {N}
 *   imagens…" (N em pt-BR; singular "Montando o ZIP com 1 imagem…"; sem a prop, "Montando o ZIP…");
 * - o status some ao terminar (sucesso ou erro) e com a desmontagem;
 * - o PDF avulso ("PDF desta imagem") não mostra esse status.
 */
const PDF: ArquivoBaixado = { blob: new Blob(['%PDF-1.4'], { type: TIPO_PDF }), nomeArquivo: 'IMG-000003.pdf' }
const ZIP: ArquivoBaixado = { blob: new Blob(['PK'], { type: TIPO_ZIP }), nomeArquivo: 'IMAGENS_2026-11-17.zip' }

describe('F10.10 — ExportarImagens: status "Montando o ZIP" com a quantidade de imagens', () => {
  let downloads: ReturnType<typeof simularDownloads>

  beforeEach(() => {
    simularUrlsDeObjeto()
    downloads = simularDownloads()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function exportar(user: Usuario, item: string) {
    await user.click(screen.getByRole('button', { name: ROTULO_EXPORTAR }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: item }))
  }

  /** ZIP que só responde quando o teste mandar. */
  function zipLento() {
    const lento = adiado<void>()
    const obterZip = vi.fn<ObterArquivo>(() => lento.promessa.then(() => ZIP))
    return { obterZip, liberar: () => lento.resolver() }
  }

  it.each([
    [3, 'Montando o ZIP com 3 imagens…'],
    [1, 'Montando o ZIP com 1 imagem…'],
    [1234, 'Montando o ZIP com 1.234 imagens…'],
  ])('com quantidade %i, mostra "%s" enquanto o ZIP é montado e some ao baixar', async (quantidade, esperado) => {
    expect(textoMontandoZip(quantidade)).toBe(esperado)
    const user = usuarioRapido()
    const { obterZip, liberar } = zipLento()
    render(<ExportarImagens obterPdf={vi.fn<ObterArquivo>().mockResolvedValue(PDF)} obterZip={obterZip} quantidade={quantidade} />)

    await exportar(user, ITEM_ZIP_TODAS)

    expect(await screen.findByRole('status')).toHaveTextContent(esperado)
    expect(downloads).toHaveLength(0)

    liberar()

    await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([ZIP.nomeArquivo]))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.queryByText(/Montando o ZIP/)).not.toBeInTheDocument()
  })

  it('sem a prop quantidade, mostra "Montando o ZIP…"', async () => {
    const user = usuarioRapido()
    const { obterZip, liberar } = zipLento()
    render(<ExportarImagens obterPdf={vi.fn<ObterArquivo>().mockResolvedValue(PDF)} obterZip={obterZip} />)

    await exportar(user, ITEM_ZIP_TODAS)

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Montando o ZIP…')
    expect(status).not.toHaveTextContent(/imagens?…/)

    liberar()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('em erro na montagem do ZIP, o status some e o alerta mostra a mensagem', async () => {
    const user = usuarioRapido()
    const falha = adiado<void>()
    const obterZip = vi.fn<ObterArquivo>(() => falha.promessa.then(() => Promise.reject(new ApiError(500, 'erro ao gerar o zip'))))
    render(<ExportarImagens obterPdf={vi.fn<ObterArquivo>().mockResolvedValue(PDF)} obterZip={obterZip} quantidade={5} />)

    await exportar(user, ITEM_ZIP_TODAS)
    expect(await screen.findByRole('status')).toHaveTextContent('Montando o ZIP com 5 imagens…')

    falha.resolver()

    expect(await screen.findByRole('alert')).toHaveTextContent('erro ao gerar o zip')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(downloads).toHaveLength(0)
  })

  it('o PDF avulso não mostra o status de montagem do ZIP', async () => {
    const user = usuarioRapido()
    const lento = adiado<void>()
    const obterPdf = vi.fn<ObterArquivo>(() => lento.promessa.then(() => PDF))
    render(<ExportarImagens obterPdf={obterPdf} obterZip={vi.fn<ObterArquivo>().mockResolvedValue(ZIP)} quantidade={3} />)

    await exportar(user, ITEM_PDF_DESTA_IMAGEM)

    await waitFor(() => expect(screen.getByRole('button', { name: ROTULO_EXPORTAR })).toBeDisabled())
    expect(screen.queryByText(/Montando o ZIP/)).not.toBeInTheDocument()

    lento.resolver()
    await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([PDF.nomeArquivo]))
    expect(screen.queryByText(/Montando o ZIP/)).not.toBeInTheDocument()
  })

  it('ao desmontar durante a montagem, o status some e nada é baixado', async () => {
    const user = usuarioRapido()
    const { obterZip, liberar } = zipLento()
    const { unmount } = render(
      <ExportarImagens obterPdf={vi.fn<ObterArquivo>().mockResolvedValue(PDF)} obterZip={obterZip} quantidade={3} />,
    )

    await exportar(user, ITEM_ZIP_TODAS)
    expect(await screen.findByRole('status')).toHaveTextContent('Montando o ZIP com 3 imagens…')

    unmount()
    liberar()
    await new Promise((r) => setTimeout(r, 20))

    expect(screen.queryByText(/Montando o ZIP/)).not.toBeInTheDocument()
    expect(downloads).toHaveLength(0)
  })

  it('sem exportação em andamento, não há status de montagem', () => {
    render(
      <ExportarImagens
        obterPdf={vi.fn<ObterArquivo>().mockResolvedValue(PDF)}
        obterZip={vi.fn<ObterArquivo>().mockResolvedValue(ZIP)}
        quantidade={3}
      />,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/Montando o ZIP/)).not.toBeInTheDocument()
  })
})
