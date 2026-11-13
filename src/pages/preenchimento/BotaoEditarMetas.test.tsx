import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usuarioRapido } from '../../test/usuario'
import { BotaoEditarMetas, type BotaoEditarMetasProps } from './BotaoEditarMetas'

/**
 * Botão "Editar metas (N)" da área de ações do Preenchimento (RF-71). `quantidade` é o número de
 * indicadores da `JanelaMetas` (`listarMetasPreenchimento`); com 0 (ou menos) o botão não aparece.
 */
describe('F9.9 — BotaoEditarMetas (botão "Editar metas" com contagem — RF-71)', () => {
  function renderizar(props: Partial<BotaoEditarMetasProps> = {}) {
    const onAbrir = props.onAbrir ?? vi.fn()
    const utils = render(<BotaoEditarMetas quantidade={props.quantidade ?? 2} desabilitado={props.desabilitado} onAbrir={onAbrir} />)
    return { ...utils, onAbrir }
  }

  it('mostra "Editar metas (N)" com a quantidade de indicadores, como botão comum (type="button")', () => {
    renderizar({ quantidade: 2 })

    const botao = screen.getByRole('button', { name: 'Editar metas (2)' })
    expect(botao).toHaveAttribute('type', 'button')
    expect(botao).toBeEnabled()
  })

  it.each([1, 12])('com quantidade %i, a contagem acompanha o número', (quantidade) => {
    renderizar({ quantidade })

    expect(screen.getByRole('button', { name: `Editar metas (${quantidade})` })).toBeInTheDocument()
  })

  it.each([0, -1])('com quantidade %i não renderiza nada', (quantidade) => {
    const { container } = renderizar({ quantidade })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('clicar chama onAbrir uma vez', async () => {
    const user = usuarioRapido()
    const { onAbrir } = renderizar()

    await user.click(screen.getByRole('button', { name: 'Editar metas (2)' }))

    expect(onAbrir).toHaveBeenCalledTimes(1)
  })

  it('com desabilitado, o botão fica desabilitado e não chama onAbrir', async () => {
    const user = usuarioRapido()
    const { onAbrir } = renderizar({ desabilitado: true })

    const botao = screen.getByRole('button', { name: 'Editar metas (2)' })
    expect(botao).toBeDisabled()
    await user.click(botao)

    expect(onAbrir).not.toHaveBeenCalled()
  })
})
