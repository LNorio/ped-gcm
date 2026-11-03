import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Etiqueta } from './Etiqueta'

describe('F1.6 — Componentes base: Etiqueta (tag)', () => {
  it('exibe o texto informado', () => {
    render(<Etiqueta>Vinculado a dashboard</Etiqueta>)

    expect(screen.getByText('Vinculado a dashboard')).toBeInTheDocument()
  })

  it('usa o tom "neutro" por padrão', () => {
    render(<Etiqueta>Inativo</Etiqueta>)

    expect(screen.getByText('Inativo')).toHaveClass('etiqueta', 'etiqueta--neutro')
  })

  it.each(['neutro', 'info', 'sucesso', 'alerta', 'perigo', 'dourado'] as const)('aplica o tom "%s"', (tom) => {
    render(<Etiqueta tom={tom}>Texto</Etiqueta>)

    expect(screen.getByText('Texto')).toHaveClass(`etiqueta--${tom}`)
  })

  it('não é um botão (é somente informativa)', () => {
    render(<Etiqueta>Meta a definir</Etiqueta>)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
