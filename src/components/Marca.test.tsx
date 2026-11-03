import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Marca } from './Marca'

describe('F2.3 — Rotas e layout principal (Marca "Comercial Mariano")', () => {
  it('é exposta a leitores de tela como uma única imagem chamada "Comercial Mariano"', () => {
    render(<Marca />)

    const marca = screen.getByRole('img', { name: 'Comercial Mariano' })
    expect(marca).toBeInTheDocument()
    expect(marca).toHaveAccessibleName('Comercial Mariano')
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('o símbolo SVG fica oculto da árvore de acessibilidade', () => {
    const { container } = render(<Marca />)

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('focusable', 'false')
  })

  it('o texto interno "Comercial" / "Mariano" fica oculto da árvore de acessibilidade (não duplica o nome)', () => {
    render(<Marca />)

    const linha1 = screen.getByText('Comercial')
    const linha2 = screen.getByText('Mariano')
    expect(linha1.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(linha2.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByRole('img')).toHaveAccessibleName('Comercial Mariano')
  })

  // Exceção à regra de não verificar classes: `marca--claro` / `marca--escuro` são a API visual
  // do componente (prop `tom`), e não há outro efeito observável do tom no DOM.
  it('usa o tom "claro" por padrão', () => {
    render(<Marca />)

    const marca = screen.getByRole('img', { name: 'Comercial Mariano' })
    expect(marca).toHaveClass('marca', 'marca--claro')
    expect(marca).not.toHaveClass('marca--escuro')
  })

  it('aceita tom="escuro"', () => {
    render(<Marca tom="escuro" />)

    const marca = screen.getByRole('img', { name: 'Comercial Mariano' })
    expect(marca).toHaveClass('marca', 'marca--escuro')
    expect(marca).not.toHaveClass('marca--claro')
  })

  it('aceita tom="claro" explicitamente', () => {
    render(<Marca tom="claro" />)

    expect(screen.getByRole('img', { name: 'Comercial Mariano' })).toHaveClass('marca--claro')
  })

  it('acrescenta a className extra sem perder as classes próprias', () => {
    render(<Marca className="layout-principal__marca" />)

    const marca = screen.getByRole('img', { name: 'Comercial Mariano' })
    expect(marca).toHaveClass('marca', 'marca--claro', 'layout-principal__marca')
  })

  it('combina tom e className', () => {
    render(<Marca tom="escuro" className="sem-acesso__marca-logo" />)

    const marca = screen.getByRole('img', { name: 'Comercial Mariano' })
    expect(marca).toHaveClass('marca', 'marca--escuro', 'sem-acesso__marca-logo')
  })

  it('não renderiza botões, links nem imagens externas', () => {
    const { container } = render(<Marca />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
