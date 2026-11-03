import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Rodape } from './Rodape'

describe('F1.5 — Rodapé institucional', () => {
  it('exibe o texto do Departamento de TI do Grupo Comercial Mariano', () => {
    render(<Rodape />)

    expect(screen.getByText('Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano')).toBeInTheDocument()
  })

  it('é um rodapé semântico (contentinfo)', () => {
    render(<Rodape />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano',
    )
  })

  it('com tom="claro" (telas de fundo azul) mantém o mesmo texto e o papel de rodapé', () => {
    render(<Rodape tom="claro" />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano',
    )
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
  })
})
