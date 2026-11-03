import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

/**
 * Teste da prop `semPadding` em arquivo próprio, vinculado ao F1.12: o F1.6 (Card) já está
 * implementado e não pode ficar vermelho até a implementação desta prop.
 */
describe('F1.12 — Card: prop semPadding', () => {
  function corpoDoCard() {
    const corpo = screen.getByText('Conteúdo').closest('.card__corpo')
    if (!corpo) throw new Error('Corpo do card (.card__corpo) não encontrado')
    return corpo
  }

  it('sem a prop, o corpo não recebe a classe card__corpo--sem-padding', () => {
    render(
      <Card>
        <p>Conteúdo</p>
      </Card>,
    )

    expect(corpoDoCard()).toHaveClass('card__corpo')
    expect(corpoDoCard()).not.toHaveClass('card__corpo--sem-padding')
  })

  it('semPadding={false} equivale a não informar a prop', () => {
    render(
      <Card semPadding={false}>
        <p>Conteúdo</p>
      </Card>,
    )

    expect(corpoDoCard()).not.toHaveClass('card__corpo--sem-padding')
  })

  it('com semPadding, o corpo recebe a classe card__corpo--sem-padding mantendo card__corpo', () => {
    render(
      <Card semPadding>
        <p>Conteúdo</p>
      </Card>,
    )

    expect(corpoDoCard()).toHaveClass('card__corpo', 'card__corpo--sem-padding')
  })

  it('semPadding não afeta o título, as ações nem a região nomeada', () => {
    render(
      <Card semPadding titulo="Tipos" acoes={<button type="button">Novo</button>}>
        <p>Conteúdo</p>
      </Card>,
    )

    expect(screen.getByRole('region', { name: 'Tipos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tipos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo' })).toBeInTheDocument()
    expect(corpoDoCard()).toHaveClass('card__corpo--sem-padding')
  })

  it('semPadding não é repassada como atributo ao elemento', () => {
    render(
      <Card semPadding className="minha-classe">
        <p>Conteúdo</p>
      </Card>,
    )

    const card = corpoDoCard().closest('.card')
    expect(card).toHaveClass('minha-classe')
    expect(card).not.toHaveAttribute('sempadding')
    expect(card).not.toHaveAttribute('semPadding')
  })
})
