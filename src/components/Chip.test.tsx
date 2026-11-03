import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Chip } from './Chip'

describe('F1.6 — Componentes base: Chip (filtro)', () => {
  it('é um botão com o rótulo informado e aria-pressed refletindo "ativo"', () => {
    render(<Chip ativo>Ativos</Chip>)

    const chip = screen.getByRole('button', { name: /Ativos/ })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip).toHaveAttribute('type', 'button')
  })

  it('fica com aria-pressed="false" quando inativo (padrão)', () => {
    render(<Chip>Inativos</Chip>)

    expect(screen.getByRole('button', { name: /Inativos/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('exibe a contagem quando informada', () => {
    render(<Chip contagem={7}>Ativos</Chip>)

    const chip = screen.getByRole('button', { name: /Ativos/ })
    expect(chip).toHaveTextContent('Ativos')
    expect(chip).toHaveTextContent('7')
  })

  it('exibe contagem zero', () => {
    render(<Chip contagem={0}>Com problemas</Chip>)

    expect(screen.getByRole('button', { name: /Com problemas/ })).toHaveTextContent('0')
  })

  it('chama onClick ao ser clicado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Chip onClick={onClick}>Todas</Chip>)

    await user.click(screen.getByRole('button', { name: /Todas/ }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('pode ser desabilitado', () => {
    render(<Chip disabled>Todas</Chip>)

    expect(screen.getByRole('button', { name: /Todas/ })).toBeDisabled()
  })
})
