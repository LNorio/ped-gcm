import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AvisoQuantidadeImagens, TEXTO_DEMORA_IMAGENS, textoQuantidadeImagens } from './AvisoQuantidadeImagens'

/**
 * F10.10 — Aviso da quantidade de imagens em PDF (alteração de 17/11/2026). O back-end deixou de limitar o
 * número de imagens por ZIP para o usuário poder exportar todas; em troca, o front avisa quantas imagens
 * serão geradas e que a exibição dos PDFs e a montagem do ZIP podem demorar.
 *
 * `AvisoQuantidadeImagens` (`src/pages/fechamentos/AvisoQuantidadeImagens.tsx`), prop `quantidade: number`:
 * - `Aviso tipo="info"` (nota, `role="note"`) com "Serão geradas {N} imagens em PDF." (N em pt-BR, com
 *   ponto de milhar) ou, com 1, "Será gerada 1 imagem em PDF.", e o `TEXTO_DEMORA_IMAGENS`;
 * - com quantidade 0, não renderiza nada.
 * Exporta também `textoQuantidadeImagens(quantidade)` e `TEXTO_DEMORA_IMAGENS`.
 */
describe('F10.10 — AvisoQuantidadeImagens: quantidade de imagens e aviso de demora', () => {
  describe('textoQuantidadeImagens', () => {
    it.each([
      [2, 'Serão geradas 2 imagens em PDF.'],
      [37, 'Serão geradas 37 imagens em PDF.'],
      [999, 'Serão geradas 999 imagens em PDF.'],
      [1000, 'Serão geradas 1.000 imagens em PDF.'],
      [1234, 'Serão geradas 1.234 imagens em PDF.'],
      [1234567, 'Serão geradas 1.234.567 imagens em PDF.'],
    ])('%i imagens: "%s"', (quantidade, esperado) => {
      expect(textoQuantidadeImagens(quantidade)).toBe(esperado)
    })

    it('1 imagem: singular "Será gerada 1 imagem em PDF."', () => {
      expect(textoQuantidadeImagens(1)).toBe('Será gerada 1 imagem em PDF.')
    })
  })

  it('TEXTO_DEMORA_IMAGENS avisa que a exibição dos PDFs e o ZIP podem demorar', () => {
    expect(TEXTO_DEMORA_IMAGENS).toBe(
      'Dependendo da quantidade de imagens, a exibição dos PDFs em tela e a montagem do ZIP com todas elas podem levar algum tempo.',
    )
  })

  it('mostra uma nota informativa (Aviso tipo="info") com a quantidade e a demora', () => {
    render(<AvisoQuantidadeImagens quantidade={1234} />)

    const nota = screen.getByRole('note')
    expect(nota).toHaveClass('aviso--info')
    expect(nota).toHaveTextContent('Serão geradas 1.234 imagens em PDF.')
    expect(nota).toHaveTextContent(TEXTO_DEMORA_IMAGENS)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('com 1 imagem, usa o singular', () => {
    render(<AvisoQuantidadeImagens quantidade={1} />)

    const nota = screen.getByRole('note')
    expect(nota).toHaveTextContent('Será gerada 1 imagem em PDF.')
    expect(nota).not.toHaveTextContent('Serão geradas')
    expect(nota).toHaveTextContent(TEXTO_DEMORA_IMAGENS)
  })

  it('com 0 imagens, não renderiza nada', () => {
    const { container } = render(<AvisoQuantidadeImagens quantidade={0} />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('atualiza o texto quando a quantidade muda', () => {
    const { rerender } = render(<AvisoQuantidadeImagens quantidade={3} />)
    expect(screen.getByRole('note')).toHaveTextContent('Serão geradas 3 imagens em PDF.')

    rerender(<AvisoQuantidadeImagens quantidade={1} />)
    expect(screen.getByRole('note')).toHaveTextContent('Será gerada 1 imagem em PDF.')

    rerender(<AvisoQuantidadeImagens quantidade={0} />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
