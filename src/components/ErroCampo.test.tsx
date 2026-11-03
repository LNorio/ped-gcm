import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErroCampo } from './ErroCampo'

describe('F1.6 — Componentes base: ErroCampo', () => {
  it('exibe a mensagem de erro anunciada como alerta', () => {
    render(<ErroCampo mensagem="Informe o nome" />)

    const erro = screen.getByRole('alert')
    expect(erro).toHaveTextContent('Informe o nome')
    expect(erro).toHaveClass('erro-campo')
  })

  it('usa o id informado para poder ser referenciado por aria-describedby', () => {
    render(<ErroCampo id="erro-nome" mensagem="Informe o nome" />)

    expect(screen.getByRole('alert')).toHaveAttribute('id', 'erro-nome')
  })

  it('não renderiza nada quando a mensagem está vazia, nula ou indefinida', () => {
    const { container, rerender } = render(<ErroCampo mensagem="" />)
    expect(container).toBeEmptyDOMElement()

    rerender(<ErroCampo mensagem={null} />)
    expect(container).toBeEmptyDOMElement()

    rerender(<ErroCampo mensagem={undefined} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
