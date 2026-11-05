import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { DASHBOARD_COMERCIAL_API, DASHBOARD_FINANCEIRO_API } from '../../test/dashboardsFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { Dashboard } from '../../types/dominio'
import { DialogoSituacaoDashboard } from './DialogoSituacaoDashboard'

const COMERCIAL = paraDashboard(DASHBOARD_COMERCIAL_API)
const FINANCEIRO = paraDashboard(DASHBOARD_FINANCEIRO_API)

const IMPACTO_DESATIVAR =
  'O dashboard “PED Comercial” sai do Início e dos Fechamentos, e seus períodos não podem ser encerrados enquanto estiver inativo. Imagens congeladas e lançamentos são mantidos.'
const IMPACTO_ATIVAR = 'O dashboard “PED Financeiro” volta ao Início e aos Fechamentos a partir do período atual (2026).'

describe('F7.10 — DialogoSituacaoDashboard: confirmação de desativar/ativar (RF-58, RN-17, RN-18, RNF-07)', () => {
  function renderizar(dashboard: Dashboard | null, alterando = false) {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    render(<DialogoSituacaoDashboard dashboard={dashboard} alterando={alterando} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    return { onConfirmar, onCancelar }
  }

  it('com dashboard null não renderiza nada', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dashboard ativo: "Desativar dashboard" com o impacto do RF-58 e o botão "Desativar"', () => {
    renderizar(COMERCIAL)

    const dialogo = screen.getByRole('dialog', { name: 'Desativar dashboard' })
    expect(within(dialogo).getByText(IMPACTO_DESATIVAR)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Desativar' })).toBeEnabled()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('dashboard inativo: "Ativar dashboard" com o retorno a partir do período atual e o botão "Ativar"', () => {
    renderizar(FINANCEIRO)

    const dialogo = screen.getByRole('dialog', { name: 'Ativar dashboard' })
    expect(within(dialogo).getByText(IMPACTO_ATIVAR)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Ativar' })).toBeInTheDocument()
  })

  it('confirmar chama onConfirmar; Cancelar e Esc chamam onCancelar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(COMERCIAL)

    await user.click(screen.getByRole('button', { name: 'Desativar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('com alterando, o botão de confirmar fica desabilitado', () => {
    renderizar(FINANCEIRO, true)

    expect(screen.getByRole('button', { name: 'Ativar' })).toBeDisabled()
  })
})
