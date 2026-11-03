import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AreaTexto } from './AreaTexto'

describe('F1.6 — Componentes base: AreaTexto', () => {
  it('associa o rótulo ao textarea', () => {
    render(<AreaTexto rotulo="Descrição" />)

    const area = screen.getByLabelText('Descrição')
    expect(area.tagName).toBe('TEXTAREA')
  })

  it('repassa atributos nativos (placeholder, rows, required, maxLength)', () => {
    render(<AreaTexto rotulo="Comentários" placeholder="Descreva" rows={4} required maxLength={500} />)

    const area = screen.getByLabelText(/Comentários/)
    expect(area).toHaveAttribute('placeholder', 'Descreva')
    expect(area).toHaveAttribute('rows', '4')
    expect(area).toBeRequired()
    expect(area).toHaveAttribute('maxlength', '500')
  })

  it('chama onChange ao digitar', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AreaTexto rotulo="Motivo" onChange={onChange} />)

    await user.type(screen.getByLabelText('Motivo'), 'digitação errada')

    expect(onChange).toHaveBeenCalled()
    expect(screen.getByLabelText('Motivo')).toHaveValue('digitação errada')
  })

  it('exibe a mensagem de erro, marca aria-invalid e a usa como descrição acessível', () => {
    render(<AreaTexto rotulo="Motivo" erro="Informe o motivo da correção" />)

    const area = screen.getByLabelText('Motivo')
    expect(screen.getByText('Informe o motivo da correção')).toBeInTheDocument()
    expect(area).toHaveAttribute('aria-invalid', 'true')
    expect(area).toHaveAccessibleDescription('Informe o motivo da correção')
  })

  it('não marca inválido sem erro', () => {
    render(<AreaTexto rotulo="Motivo" />)

    expect(screen.getByLabelText('Motivo')).not.toHaveAttribute('aria-invalid', 'true')
  })
})
