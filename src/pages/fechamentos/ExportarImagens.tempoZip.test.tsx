import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_SEM_CONEXAO, type ArquivoBaixado } from '../../services/api'
import {
  ITEM_PDF_DESTA_IMAGEM,
  ITEM_ZIP_TODAS,
  ROTULO_EXPORTAR,
  TIPO_PDF,
  TIPO_ZIP,
  simularDownloads,
  simularUrlsDeObjeto,
} from '../../test/pdfFalsos'
import { usuarioRapido, type Usuario } from '../../test/usuario'
import { ExportarImagens, TEXTO_ZIP_TEMPO, type ObterArquivo } from './ExportarImagens'

/**
 * F10.10 — "Exportar": dica quando o ZIP falha por tempo (alteração de 17/11/2026, docs/backend/FRONT-pdf-zip (1).md).
 * O ZIP não tem limite de imagens; a geração é síncrona (~0,11 s/PDF) e o Apache corta a resposta em ~60 s
 * (~500 PDFs). Acima disso o fetch pode falhar e a tela só mostrava "Não foi possível conectar ao servidor.".
 *
 * Interface (`src/pages/fechamentos/ExportarImagens.tsx`):
 * - `export const TEXTO_ZIP_TEMPO = 'A montagem do ZIP pode ter excedido o tempo limite do servidor.'`
 * - nova prop opcional `dicaFalhaZip?: string`.
 * Comportamento:
 * - ZIP com `ApiError` de status 0 (falha de rede), 502, 503 ou 504: o alerta (`role="alert"`) mostra a
 *   mensagem do erro, depois `TEXTO_ZIP_TEMPO` e depois a `dicaFalhaZip` (quando informada);
 * - nada é acrescentado no PDF avulso com esses status, nem no ZIP com 400, 403, 500 ou 429 (o 429 mantém
 *   o bloqueio do "Exportar").
 */
const PDF: ArquivoBaixado = { blob: new Blob(['%PDF-1.4'], { type: TIPO_PDF }), nomeArquivo: 'IMG-000003.pdf' }
const ZIP: ArquivoBaixado = { blob: new Blob(['PK'], { type: TIPO_ZIP }), nomeArquivo: 'IMAGENS_2026-11-17.zip' }
/** Texto exato exigido de `TEXTO_ZIP_TEMPO` (as asserções usam o literal, para não depender do export). */
const TEMPO = 'A montagem do ZIP pode ter excedido o tempo limite do servidor.'
const DICA = 'Use os filtros da consulta para reduzir a quantidade de imagens.'

const MENSAGENS: Record<number, string> = {
  0: MENSAGEM_SEM_CONEXAO,
  502: 'Bad Gateway',
  503: 'Serviço indisponível',
  504: 'Gateway Timeout',
}

describe('F10.10 — ExportarImagens: dica de tempo limite na falha do ZIP', () => {
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

  function renderizar({
    obterPdf = vi.fn<ObterArquivo>().mockResolvedValue(PDF),
    obterZip = vi.fn<ObterArquivo>().mockResolvedValue(ZIP),
    dicaFalhaZip,
  }: { obterPdf?: ObterArquivo; obterZip?: ObterArquivo; dicaFalhaZip?: string } = {}) {
    const user = usuarioRapido()
    render(<ExportarImagens obterPdf={obterPdf} obterZip={obterZip} quantidade={600} dicaFalhaZip={dicaFalhaZip} />)
    return { user }
  }

  const falha = (status: number, mensagem: string) => vi.fn<ObterArquivo>().mockRejectedValue(new ApiError(status, mensagem))

  it('o texto base é "A montagem do ZIP pode ter excedido o tempo limite do servidor."', () => {
    expect(TEXTO_ZIP_TEMPO).toBe('A montagem do ZIP pode ter excedido o tempo limite do servidor.')
  })

  it.each([0, 502, 503, 504])('ZIP com status %i: alerta com a mensagem, o texto de tempo limite e a dica, nessa ordem', async (status) => {
    const mensagem = MENSAGENS[status]
    const { user } = renderizar({ obterZip: falha(status, mensagem), dicaFalhaZip: DICA })

    await exportar(user, ITEM_ZIP_TODAS)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(mensagem)
    expect(alerta).toHaveTextContent(TEMPO)
    expect(alerta).toHaveTextContent(DICA)
    const texto = alerta.textContent ?? ''
    expect(texto.indexOf(mensagem)).toBeLessThan(texto.indexOf(TEMPO))
    expect(texto.indexOf(TEMPO)).toBeLessThan(texto.indexOf(DICA))
    expect(downloads).toHaveLength(0)
  })

  it('sem dicaFalhaZip, mostra só a mensagem e o texto de tempo limite', async () => {
    const { user } = renderizar({ obterZip: falha(504, MENSAGENS[504]) })

    await exportar(user, ITEM_ZIP_TODAS)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(MENSAGENS[504])
    expect(alerta).toHaveTextContent(TEMPO)
    expect(alerta).not.toHaveTextContent(DICA)
  })

  it('depois da falha por tempo, o "Exportar" continua disponível e uma nova exportação limpa o alerta', async () => {
    const obterZip = vi
      .fn<ObterArquivo>()
      .mockRejectedValueOnce(new ApiError(0, MENSAGEM_SEM_CONEXAO))
      .mockResolvedValueOnce(ZIP)
    const { user } = renderizar({ obterZip, dicaFalhaZip: DICA })

    await exportar(user, ITEM_ZIP_TODAS)
    expect(await screen.findByRole('alert')).toHaveTextContent(TEMPO)
    await waitFor(() => expect(screen.getByRole('button', { name: ROTULO_EXPORTAR })).toBeEnabled())

    await exportar(user, ITEM_ZIP_TODAS)

    await waitFor(() => expect(downloads.map((d) => d.nome)).toEqual([ZIP.nomeArquivo]))
    expect(document.body).not.toHaveTextContent(TEMPO)
  })

  it.each([0, 502, 503, 504])('PDF avulso com status %i: só a mensagem, sem o texto de tempo limite nem a dica', async (status) => {
    const mensagem = MENSAGENS[status]
    const { user } = renderizar({ obterPdf: falha(status, mensagem), dicaFalhaZip: DICA })

    await exportar(user, ITEM_PDF_DESTA_IMAGEM)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(mensagem)
    expect(alerta).not.toHaveTextContent(TEMPO)
    expect(alerta).not.toHaveTextContent(DICA)
  })

  it.each([
    [400, 'nenhuma imagem para exportar'],
    [403, 'o validador so ve imagens da propria filial'],
    [500, 'erro ao gerar o zip'],
  ])('ZIP com status %i: só a mensagem, sem o texto de tempo limite nem a dica', async (status, mensagem) => {
    const { user } = renderizar({ obterZip: falha(status, mensagem), dicaFalhaZip: DICA })

    await exportar(user, ITEM_ZIP_TODAS)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(mensagem)
    expect(alerta).not.toHaveTextContent(TEMPO)
    expect(alerta).not.toHaveTextContent(DICA)
  })

  it('ZIP com 429: só a mensagem, sem a dica, e o "Exportar" continua bloqueado', async () => {
    const mensagem = 'Muitas requisições. Tente novamente em instantes.'
    const obterZip = vi.fn<ObterArquivo>().mockRejectedValue(new ApiError(429, mensagem, undefined, 30))
    const { user } = renderizar({ obterZip, dicaFalhaZip: DICA })

    await exportar(user, ITEM_ZIP_TODAS)

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(mensagem)
    expect(alerta).not.toHaveTextContent(TEMPO)
    expect(alerta).not.toHaveTextContent(DICA)
    expect(screen.getByRole('button', { name: ROTULO_EXPORTAR })).toBeDisabled()
  })
})
