import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { usuarioRapido } from '../test/usuario'
import { Dialogo } from './Dialogo'

/**
 * Diálogos empilhados (F1.8 — revisão da F9 em 13/11/2026): um diálogo aberto por cima de outro (ex.:
 * "Histórico de metas" por cima de "Editar metas"). Só o diálogo de cima responde ao teclado:
 * - Esc fecha só o de cima; o de baixo continua aberto, com o que foi digitado, e recebe o foco de volta
 *   no elemento que abriu o de cima; um novo Esc fecha o de baixo;
 * - Tab/Shift+Tab seguem a ordem normal dentro do de cima e ficam presos nele (nunca vão para o de baixo).
 */
describe('F1.8 — Dialogo empilhado (só o diálogo de cima responde a Esc e Tab)', () => {
  function Empilhados({ onFecharBase, onFecharTopo }: { onFecharBase: () => void; onFecharTopo: () => void }) {
    const [base, setBase] = useState(true)
    const [topo, setTopo] = useState(false)
    return (
      <>
        <button type="button">Botão da página</button>
        <Dialogo
          aberto={base}
          titulo="Editar metas"
          onFechar={() => {
            onFecharBase()
            setBase(false)
          }}
        >
          <input aria-label="Motivo" />
          <button type="button" onClick={() => setTopo(true)}>
            Abrir histórico
          </button>
        </Dialogo>
        <Dialogo
          aberto={topo}
          titulo="Histórico de metas"
          onFechar={() => {
            onFecharTopo()
            setTopo(false)
          }}
        >
          <button type="button">Primeira ação</button>
          <button type="button">Segunda ação</button>
        </Dialogo>
      </>
    )
  }

  async function abrirOsDois() {
    const user = usuarioRapido()
    const onFecharBase = vi.fn()
    const onFecharTopo = vi.fn()
    render(<Empilhados onFecharBase={onFecharBase} onFecharTopo={onFecharTopo} />)
    const base = screen.getByRole('dialog', { name: 'Editar metas' })
    await user.type(within(base).getByRole('textbox', { name: 'Motivo' }), 'sazonalidade')
    await user.click(within(base).getByRole('button', { name: 'Abrir histórico' }))
    const topo = screen.getByRole('dialog', { name: 'Histórico de metas' })
    return { user, onFecharBase, onFecharTopo, base, topo }
  }

  it('Esc fecha só o diálogo de cima; o de baixo continua aberto com o que foi digitado', async () => {
    const { user, onFecharBase, onFecharTopo } = await abrirOsDois()

    await user.keyboard('{Escape}')

    expect(onFecharTopo).toHaveBeenCalledTimes(1)
    expect(onFecharBase).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Histórico de metas' })).not.toBeInTheDocument()
    const base = screen.getByRole('dialog', { name: 'Editar metas' })
    expect(within(base).getByRole('textbox', { name: 'Motivo' })).toHaveValue('sazonalidade')
  })

  it('depois de fechar o de cima com Esc, o foco volta ao botão que o abriu, dentro do de baixo', async () => {
    const { user } = await abrirOsDois()

    await user.keyboard('{Escape}')

    const base = screen.getByRole('dialog', { name: 'Editar metas' })
    expect(within(base).getByRole('button', { name: 'Abrir histórico' })).toHaveFocus()
  })

  it('um segundo Esc fecha o diálogo de baixo', async () => {
    const { user, onFecharBase, onFecharTopo } = await abrirOsDois()

    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')

    expect(onFecharTopo).toHaveBeenCalledTimes(1)
    expect(onFecharBase).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Tab segue a ordem normal dentro do diálogo de cima', async () => {
    const { user, topo } = await abrirOsDois()

    within(topo).getByRole('button', { name: 'Primeira ação' }).focus()
    await user.tab()

    expect(within(topo).getByRole('button', { name: 'Segunda ação' })).toHaveFocus()
  })

  it('Shift+Tab segue a ordem normal dentro do diálogo de cima', async () => {
    const { user, topo } = await abrirOsDois()

    within(topo).getByRole('button', { name: 'Segunda ação' }).focus()
    await user.tab({ shift: true })

    expect(within(topo).getByRole('button', { name: 'Primeira ação' })).toHaveFocus()
  })

  it('Tab a partir do último elemento do diálogo de cima volta ao primeiro dele, sem passar pelo de baixo', async () => {
    const { user, topo, base } = await abrirOsDois()

    within(topo).getByRole('button', { name: 'Segunda ação' }).focus()
    await user.tab()

    expect(within(topo).getByRole('button', { name: 'Fechar' })).toHaveFocus()
    expect(base).not.toContainElement(document.activeElement as HTMLElement)
  })

  it('Shift+Tab a partir do primeiro elemento do diálogo de cima vai ao último dele, sem passar pelo de baixo', async () => {
    const { user, topo, base } = await abrirOsDois()

    within(topo).getByRole('button', { name: 'Fechar' }).focus()
    await user.tab({ shift: true })

    expect(within(topo).getByRole('button', { name: 'Segunda ação' })).toHaveFocus()
    expect(base).not.toContainElement(document.activeElement as HTMLElement)
  })
})
