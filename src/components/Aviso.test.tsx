import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Aviso } from './Aviso'

describe('F1.6 — Componentes base: Aviso (nota)', () => {
  it('exibe o conteúdo como nota informativa por padrão', () => {
    render(<Aviso>Os 7 tipos fixos não podem ser excluídos.</Aviso>)

    const aviso = screen.getByRole('note')
    expect(aviso).toHaveTextContent('Os 7 tipos fixos não podem ser excluídos.')
    expect(aviso).toHaveClass('aviso', 'aviso--info')
  })

  it('exibe o título quando informado', () => {
    render(<Aviso titulo="Atenção">Somente um período fica aberto por vez.</Aviso>)

    expect(screen.getByText('Atenção')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Somente um período fica aberto por vez.')
  })

  it.each(['info', 'alerta', 'sucesso'] as const)('tipo "%s" é uma nota com a classe correspondente', (tipo) => {
    render(<Aviso tipo={tipo}>Texto</Aviso>)

    expect(screen.getByRole('note')).toHaveClass(`aviso--${tipo}`)
  })

  it('tipo "erro" é anunciado como alerta', () => {
    render(<Aviso tipo="erro">Não foi possível salvar.</Aviso>)

    const aviso = screen.getByRole('alert')
    expect(aviso).toHaveTextContent('Não foi possível salvar.')
    expect(aviso).toHaveClass('aviso--erro')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
