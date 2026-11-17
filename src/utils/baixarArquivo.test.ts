import { afterEach, describe, expect, it, vi } from 'vitest'
import { TIPO_PDF, TIPO_ZIP, simularDownloads, simularUrlsDeObjeto } from '../test/pdfFalsos'
import { baixarArquivo } from './baixarArquivo'

/**
 * F10.10 — `baixarArquivo(arquivo)` (`src/utils/baixarArquivo.ts`): baixa um `ArquivoBaixado`
 * (`{ blob, nomeArquivo }`, de `services/api.ts`) no navegador, sem dependência nova:
 * cria a URL de objeto do Blob (`URL.createObjectURL`), clica num `<a href={url} download={nomeArquivo}>`
 * (`HTMLAnchorElement.click()`), não deixa o link no documento e libera a URL (`URL.revokeObjectURL`)
 * logo depois.
 */
describe('F10.10 — baixarArquivo (download de PDF e ZIP)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cria a URL de objeto do Blob e clica num link com download = nome do arquivo', () => {
    const urls = simularUrlsDeObjeto()
    const downloads = simularDownloads()
    const blob = new Blob(['%PDF-1.4'], { type: TIPO_PDF })

    baixarArquivo({ blob, nomeArquivo: 'IMG-000003_PED-Gerentes.pdf' })

    expect(urls.criadas).toHaveLength(1)
    expect(urls.criadas[0].blob).toBe(blob)
    expect(downloads).toEqual([{ nome: 'IMG-000003_PED-Gerentes.pdf', href: urls.criadas[0].url }])
  })

  it('libera a URL de objeto depois do download', async () => {
    const urls = simularUrlsDeObjeto()
    simularDownloads()

    baixarArquivo({ blob: new Blob(['PK'], { type: TIPO_ZIP }), nomeArquivo: 'PREVIA_1.zip' })

    await vi.waitFor(() => expect(urls.revogadas).toContain(urls.criadas[0].url))
  })

  it('não deixa o link no documento', () => {
    simularUrlsDeObjeto()
    simularDownloads()

    baixarArquivo({ blob: new Blob(['PK'], { type: TIPO_ZIP }), nomeArquivo: 'IMAGENS.zip' })

    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('cada chamada baixa o seu arquivo', () => {
    const urls = simularUrlsDeObjeto()
    const downloads = simularDownloads()

    baixarArquivo({ blob: new Blob(['a'], { type: TIPO_PDF }), nomeArquivo: 'a.pdf' })
    baixarArquivo({ blob: new Blob(['b'], { type: TIPO_ZIP }), nomeArquivo: 'b.zip' })

    expect(downloads).toEqual([
      { nome: 'a.pdf', href: urls.criadas[0].url },
      { nome: 'b.zip', href: urls.criadas[1].url },
    ])
  })
})
