import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Notificacao } from './Notificacao'

describe('F1.9 — Notificacao temporária', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exibe a mensagem em uma região de status (anunciada)', () => {
    render(<Notificacao mensagem="Apontamento salvo" onFechar={() => {}} />)

    expect(screen.getByRole('status')).toHaveTextContent('Apontamento salvo')
  })

  it('usa o tipo "sucesso" por padrão e aplica a classe do tipo informado', () => {
    const { rerender } = render(<Notificacao mensagem="Salvo" onFechar={() => {}} />)
    expect(screen.getByRole('status')).toHaveClass('notificacao', 'notificacao--sucesso')

    rerender(<Notificacao mensagem="Falhou" tipo="erro" onFechar={() => {}} />)
    expect(screen.getByRole('status')).toHaveClass('notificacao--erro')

    rerender(<Notificacao mensagem="Info" tipo="info" onFechar={() => {}} />)
    expect(screen.getByRole('status')).toHaveClass('notificacao--info')
  })

  it('chama onFechar após cerca de 3 segundos (padrão 3000 ms)', () => {
    const onFechar = vi.fn()
    render(<Notificacao mensagem="Apontamento salvo" onFechar={onFechar} />)

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(onFechar).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Apontamento salvo')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('respeita a duração personalizada', () => {
    const onFechar = vi.fn()
    render(<Notificacao mensagem="Apontamento salvo" duracaoMs={5000} onFechar={onFechar} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(onFechar).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('cancela o temporizador ao desmontar antes do prazo', () => {
    const onFechar = vi.fn()
    const { unmount } = render(<Notificacao mensagem="Apontamento salvo" onFechar={onFechar} />)

    unmount()
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(onFechar).not.toHaveBeenCalled()
  })

  it('reinicia o temporizador quando a mensagem muda', () => {
    const onFechar = vi.fn()
    const { rerender } = render(<Notificacao mensagem="Primeira" onFechar={onFechar} />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    rerender(<Notificacao mensagem="Segunda" onFechar={onFechar} />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onFechar).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Segunda')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('sem mensagem não exibe texto nem dispara onFechar', () => {
    const onFechar = vi.fn()
    render(<Notificacao mensagem={null} onFechar={onFechar} />)

    expect(screen.queryByText(/./)).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onFechar).not.toHaveBeenCalled()
  })
})
