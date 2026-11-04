import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import { DADO_DEVOLUCOES_API, DADO_FATURAMENTO_API, DADO_VOLUME_API } from '../../test/dadosExternosFalsos'
import type { DadoExterno } from '../../types/dominio'
import { DialogoExcluirDadoExterno } from './DialogoExcluirDadoExterno'

const FATURAMENTO = paraDadoExterno(DADO_FATURAMENTO_API)
const DEVOLUCOES = paraDadoExterno(DADO_DEVOLUCOES_API)
const VOLUME = paraDadoExterno(DADO_VOLUME_API)

describe('F5.9 — DialogoExcluirDadoExterno (confirmação e bloqueio da exclusão — RF-31, RN-12, RNF-07)', () => {
  function renderizar(dado: DadoExterno | null, excluindo = false) {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    render(<DialogoExcluirDadoExterno dado={dado} excluindo={excluindo} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    return { onConfirmar, onCancelar }
  }

  it('com dado null não renderiza nada', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sem indicadores: "Excluir dado externo" com o impacto e os botões Excluir (perigo) e Cancelar', () => {
    renderizar(FATURAMENTO)

    const dialogo = screen.getByRole('dialog', { name: 'Excluir dado externo' })
    expect(
      within(dialogo).getByText('O dado externo Faturamento líquido será excluído. Esta ação não pode ser desfeita.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toHaveClass('botao--perigo-cheio')
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('dado em construção (sem indicadores) também pode ser excluído', () => {
    renderizar(DEVOLUCOES)

    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  it('com indicadores: bloqueio listando os indicadores e só "Entendi", sem Excluir', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(VOLUME)

    const dialogo = screen.getByRole('dialog', { name: 'Excluir dado externo' })
    expect(
      within(dialogo).getByText(
        'Este dado externo compõe os indicadores: Volume mensal, Crescimento de vendas e não pode ser excluído.',
      ),
    ).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Entendi' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('Excluir chama onConfirmar; Cancelar e Esc chamam onCancelar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(FATURAMENTO)

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('com excluindo, "Excluir" fica desabilitado', () => {
    renderizar(FATURAMENTO, true)

    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })
})
