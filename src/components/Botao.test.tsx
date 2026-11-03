import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Botao } from './Botao'

describe('F1.6 — Componentes base: Botao', () => {
  it('renderiza um botão com o texto informado e type="button" por padrão', () => {
    render(<Botao>Salvar</Botao>)

    const botao = screen.getByRole('button', { name: 'Salvar' })
    expect(botao).toBeInTheDocument()
    expect(botao).toHaveAttribute('type', 'button')
  })

  it('aceita type="submit"', () => {
    render(<Botao type="submit">Enviar</Botao>)

    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit')
  })

  it('chama onClick ao ser clicado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Botao onClick={onClick}>Salvar</Botao>)

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('não chama onClick quando desabilitado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Botao onClick={onClick} disabled>
        Salvar
      </Botao>,
    )

    const botao = screen.getByRole('button', { name: 'Salvar' })
    expect(botao).toBeDisabled()
    await user.click(botao)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('usa a variante "primario" por padrão', () => {
    render(<Botao>Salvar</Botao>)

    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveClass('botao', 'botao--primario')
  })

  it.each(['primario', 'dourado', 'contorno', 'perigo', 'perigo-cheio', 'link'] as const)(
    'aplica a classe da variante "%s"',
    (variante) => {
      render(<Botao variante={variante}>Ação</Botao>)

      expect(screen.getByRole('button', { name: 'Ação' })).toHaveClass(`botao--${variante}`)
    },
  )

  it('aplica a classe de tamanho pequeno', () => {
    render(<Botao tamanho="pequeno">Ver</Botao>)

    expect(screen.getByRole('button', { name: 'Ver' })).toHaveClass('botao--pequeno')
  })

  it('não aplica classe de tamanho pequeno por padrão', () => {
    render(<Botao>Ver</Botao>)

    expect(screen.getByRole('button', { name: 'Ver' })).not.toHaveClass('botao--pequeno')
  })

  it('botão de ícone recebe nome acessível por aria-label', () => {
    render(
      <Botao aria-label="Fechar">
        <svg aria-hidden="true" />
      </Botao>,
    )

    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('mantém classes extras passadas em className', () => {
    render(<Botao className="minha-classe">Salvar</Botao>)

    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveClass('botao', 'minha-classe')
  })
})
