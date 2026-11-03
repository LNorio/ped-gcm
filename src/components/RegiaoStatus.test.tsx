import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RegiaoStatus } from './RegiaoStatus'

describe('F1.9 — RegiaoStatus (aria-live)', () => {
  it('anuncia mensagens de status em uma região polite', () => {
    render(<RegiaoStatus mensagem="Carregando apontamentos..." />)

    const regiao = screen.getByRole('status')
    expect(regiao).toHaveTextContent('Carregando apontamentos...')
    expect(regiao).toHaveAttribute('aria-live', 'polite')
  })

  it('anuncia erros como alerta (assertive)', () => {
    render(<RegiaoStatus tipo="erro" mensagem="Não foi possível conectar ao servidor." />)

    const regiao = screen.getByRole('alert')
    expect(regiao).toHaveTextContent('Não foi possível conectar ao servidor.')
    expect(regiao).toHaveAttribute('aria-live', 'assertive')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('mantém a região presente (vazia) sem mensagem, para que a próxima mensagem seja anunciada', () => {
    const { rerender } = render(<RegiaoStatus mensagem={null} />)

    const regiao = screen.getByRole('status')
    expect(regiao).toBeEmptyDOMElement()

    rerender(<RegiaoStatus mensagem="Salvo com sucesso" />)
    expect(screen.getByRole('status')).toHaveTextContent('Salvo com sucesso')
  })

  it('é atômica (aria-atomic="true") para que a mensagem inteira seja lida a cada mudança', () => {
    const { rerender } = render(<RegiaoStatus mensagem="Carregando..." />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true')

    rerender(<RegiaoStatus tipo="erro" mensagem="Falha ao salvar." />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-atomic', 'true')
  })

  it('atualiza o texto quando a mensagem muda', () => {
    const { rerender } = render(<RegiaoStatus mensagem="Carregando..." />)

    rerender(<RegiaoStatus mensagem="3 apontamentos encontrados" />)

    expect(screen.getByRole('status')).toHaveTextContent('3 apontamentos encontrados')
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
  })
})
