import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { DASHBOARD_FINANCEIRO_API } from '../../test/dashboardsFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { Dashboard } from '../../types/dominio'
import { DialogoExcluirDashboard } from './DialogoExcluirDashboard'

const FINANCEIRO = paraDashboard(DASHBOARD_FINANCEIRO_API)
const IMPACTO =
  'O dashboard “PED Financeiro” será excluído, com a composição, os vínculos e o histórico de modificações. As imagens congeladas já geradas são mantidas.'

describe('F7.10 — DialogoExcluirDashboard: confirmação da exclusão (RF-59, RN-18, RNF-07)', () => {
  function renderizar(dashboard: Dashboard | null, excluindo = false) {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    render(<DialogoExcluirDashboard dashboard={dashboard} excluindo={excluindo} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    return { onConfirmar, onCancelar }
  }

  it('com dashboard null não renderiza nada', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Excluir dashboard" com o impacto (composição, vínculos e histórico apagados; imagens mantidas) e o botão "Excluir"', () => {
    renderizar(FINANCEIRO)

    const dialogo = screen.getByRole('dialog', { name: 'Excluir dashboard' })
    expect(within(dialogo).getByText(IMPACTO)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toBeEnabled()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('"Excluir" chama onConfirmar; Cancelar e Esc chamam onCancelar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(FINANCEIRO)

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('com excluindo, o botão "Excluir" fica desabilitado', () => {
    renderizar(FINANCEIRO, true)

    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })
})
