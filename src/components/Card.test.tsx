import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

describe('F1.6 — Componentes base: Card', () => {
  it('renderiza o conteúdo', () => {
    render(
      <Card>
        <p>Conteúdo do card</p>
      </Card>,
    )

    expect(screen.getByText('Conteúdo do card')).toBeInTheDocument()
  })

  it('exibe o título como cabeçalho quando informado', () => {
    render(
      <Card titulo="Apontamentos">
        <p>Lista</p>
      </Card>,
    )

    expect(screen.getByRole('heading', { name: 'Apontamentos' })).toBeInTheDocument()
  })

  it('não renderiza cabeçalho sem título', () => {
    render(
      <Card>
        <p>Lista</p>
      </Card>,
    )

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('exibe as ações informadas junto ao título', () => {
    render(
      <Card titulo="Apontamentos" acoes={<button type="button">Novo apontamento</button>}>
        <p>Lista</p>
      </Card>,
    )

    expect(screen.getByRole('button', { name: 'Novo apontamento' })).toBeInTheDocument()
  })

  it('é uma região nomeada pelo título (acessível por role region)', () => {
    render(
      <Card titulo="Indicadores">
        <p>Lista</p>
      </Card>,
    )

    const regiao = screen.getByRole('region', { name: 'Indicadores' })
    expect(within(regiao).getByText('Lista')).toBeInTheDocument()
  })
})
