import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../test/usuario'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialogo } from './Dialogo'

function Harness({ onFechar }: { onFechar?: () => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Abrir
      </button>
      <button type="button">Outro botão da página</button>
      <Dialogo
        aberto={aberto}
        titulo="Excluir apontamento"
        onFechar={() => {
          onFechar?.()
          setAberto(false)
        }}
        acoes={
          <>
            <button type="button">Cancelar</button>
            <button type="button">Excluir</button>
          </>
        }
      >
        <p>Esta ação é definitiva.</p>
        <input aria-label="Motivo" />
      </Dialogo>
    </>
  )
}

describe('F1.8 — Dialogo modal acessível', () => {
  it('não renderiza nada quando fechado', () => {
    render(
      <Dialogo aberto={false} titulo="Título" onFechar={() => {}}>
        <p>Conteúdo</p>
      </Dialogo>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument()
  })

  it('quando aberto, é um dialog modal nomeado pelo título', () => {
    render(
      <Dialogo aberto titulo="Excluir apontamento" onFechar={() => {}}>
        <p>Esta ação é definitiva.</p>
      </Dialogo>,
    )

    const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(within(dialogo).getByRole('heading', { name: 'Excluir apontamento' })).toBeInTheDocument()
    expect(within(dialogo).getByText('Esta ação é definitiva.')).toBeInTheDocument()
  })

  it('exibe a descrição como descrição acessível quando informada', () => {
    render(
      <Dialogo aberto titulo="Confirmar" descricao="O apontamento será removido." onFechar={() => {}}>
        <p>Conteúdo</p>
      </Dialogo>,
    )

    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('O apontamento será removido.')
  })

  it('renderiza as ações informadas', () => {
    render(
      <Dialogo aberto titulo="Confirmar" onFechar={() => {}} acoes={<button type="button">Confirmar</button>}>
        <p>Conteúdo</p>
      </Dialogo>,
    )

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('tem um botão "Fechar" com nome acessível que chama onFechar', async () => {
    const user = usuarioRapido()
    const onFechar = vi.fn()
    render(
      <Dialogo aberto titulo="Confirmar" onFechar={onFechar}>
        <p>Conteúdo</p>
      </Dialogo>,
    )

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))

    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('Esc chama onFechar', async () => {
    const user = usuarioRapido()
    const onFechar = vi.fn()
    render(
      <Dialogo aberto titulo="Confirmar" onFechar={onFechar}>
        <p>Conteúdo</p>
      </Dialogo>,
    )

    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('ao abrir, move o foco para dentro do diálogo', async () => {
    const user = usuarioRapido()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Abrir' }))

    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toContainElement(document.activeElement as HTMLElement)
  })

  it('prende o foco: Tab a partir do último elemento volta para dentro do diálogo', async () => {
    const user = usuarioRapido()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialogo = screen.getByRole('dialog')

    within(dialogo).getByRole('button', { name: 'Excluir' }).focus()
    await user.tab()

    expect(dialogo).toContainElement(document.activeElement as HTMLElement)
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Outro botão da página' }))
  })

  it('prende o foco: Shift+Tab a partir do primeiro elemento permanece dentro do diálogo', async () => {
    const user = usuarioRapido()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    const dialogo = screen.getByRole('dialog')

    const focaveis = within(dialogo).getAllByRole('button')
    focaveis[0].focus()
    await user.tab({ shift: true })

    expect(dialogo).toContainElement(document.activeElement as HTMLElement)
  })

  it('Tab a partir do próprio painel, sem campos no conteúdo, mantém o foco dentro do diálogo', async () => {
    const user = usuarioRapido()
    render(
      <Dialogo aberto titulo="Aviso" onFechar={() => {}}>
        <p>Somente texto, sem elementos focáveis.</p>
      </Dialogo>,
    )
    const dialogo = screen.getByRole('dialog')
    dialogo.focus()
    expect(dialogo).toHaveFocus()

    await user.tab()
    expect(dialogo).toContainElement(document.activeElement as HTMLElement)

    await user.tab()
    expect(dialogo).toContainElement(document.activeElement as HTMLElement)

    await user.tab({ shift: true })
    expect(dialogo).toContainElement(document.activeElement as HTMLElement)
  })

  it('bloqueia a rolagem da página enquanto aberto e a restaura ao fechar', async () => {
    const user = usuarioRapido()
    document.body.style.overflow = 'auto'
    render(<Harness />)
    expect(document.body.style.overflow).toBe('auto')

    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('auto')

    document.body.style.overflow = ''
  })

  it('restaura a rolagem da página ao desmontar enquanto ainda aberto', () => {
    document.body.style.overflow = ''
    const { unmount } = render(
      <Dialogo aberto titulo="Confirmar" onFechar={() => {}}>
        <p>Conteúdo</p>
      </Dialogo>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('')
  })

  it('não altera a rolagem da página quando renderizado fechado', () => {
    document.body.style.overflow = ''
    render(
      <Dialogo aberto={false} titulo="Confirmar" onFechar={() => {}}>
        <p>Conteúdo</p>
      </Dialogo>,
    )

    expect(document.body.style.overflow).toBe('')
  })

  it('ao fechar com Esc, devolve o foco ao elemento que abriu o diálogo', async () => {
    const user = usuarioRapido()
    const onFechar = vi.fn()
    render(<Harness onFechar={onFechar} />)
    const abrir = screen.getByRole('button', { name: 'Abrir' })

    await user.click(abrir)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(abrir).toHaveFocus()
  })
})
