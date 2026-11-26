import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { UsePdfImagemResultado } from './usePdfImagem'
import { VisualizadorPdf } from './VisualizadorPdf'

const TITULO = 'PDF da imagem — Filial 101'
const URL_PDF = 'blob:teste/42'

function pdf(parcial: Partial<UsePdfImagemResultado> = {}): UsePdfImagemResultado {
  return {
    url: URL_PDF,
    arquivo: null,
    carregando: false,
    erro: null,
    aguardandoLimite: false,
    tentarNovamente: vi.fn(),
    ...parcial,
  }
}

/**
 * F12.2 (RNF-04, revisão de responsividade de 24/11/2026) — link alternativo do PDF embutido
 * (`VisualizadorPdf.tsx`). Em telas pequenas e em navegadores que não mostram PDF dentro do `iframe`,
 * abaixo do `iframe` há o link "Abrir PDF em nova aba", com `href` = URL de objeto do PDF exibido,
 * `target="_blank"` e `rel` com `noopener`. Sem PDF carregado (carregando, erro), não há link.
 */
describe('F12.2 — VisualizadorPdf: link "Abrir PDF em nova aba"', () => {
  const link = () => screen.getByRole('link', { name: 'Abrir PDF em nova aba' })

  it('com o PDF carregado, mostra o link para a URL do PDF, em nova aba e com rel="noopener"', () => {
    render(<VisualizadorPdf pdf={pdf()} titulo={TITULO} />)

    expect(screen.getByTitle(TITULO)).toHaveAttribute('src', URL_PDF)
    expect(link()).toHaveAttribute('href', URL_PDF)
    expect(link()).toHaveAttribute('target', '_blank')
    expect(link().getAttribute('rel') ?? '').toMatch(/(^|\s)noopener(\s|$)/)
  })

  it('o link fica abaixo do iframe (depois dele na ordem do documento)', () => {
    render(<VisualizadorPdf pdf={pdf()} titulo={TITULO} />)

    const iframe = screen.getByTitle(TITULO)
    expect(iframe.compareDocumentPosition(link()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('o link acompanha a troca de PDF (nova URL)', () => {
    const { rerender } = render(<VisualizadorPdf pdf={pdf()} titulo={TITULO} />)

    rerender(<VisualizadorPdf pdf={pdf({ url: 'blob:teste/43' })} titulo={TITULO} />)

    expect(link()).toHaveAttribute('href', 'blob:teste/43')
  })

  it('enquanto o PDF é gerado, não há link', () => {
    render(<VisualizadorPdf pdf={pdf({ url: null, carregando: true })} titulo={TITULO} />)

    expect(screen.queryByRole('link', { name: 'Abrir PDF em nova aba' })).not.toBeInTheDocument()
  })

  it('com erro, não há link (só o alerta e "Tentar novamente")', () => {
    render(<VisualizadorPdf pdf={pdf({ url: null, erro: 'Falha ao gerar o PDF.' })} titulo={TITULO} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao gerar o PDF.')
    expect(screen.queryByRole('link', { name: 'Abrir PDF em nova aba' })).not.toBeInTheDocument()
  })
})
