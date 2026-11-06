import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDashboard } from '../../services/adaptadores'
import { DASHBOARD_LOGISTICA_API, DASHBOARD_SUPERVISORES_API } from '../../test/dashboardsFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { Dashboard } from '../../types/dominio'
import { DialogoConcluirDashboard } from './DialogoConcluirDashboard'

const SUPERVISORES = paraDashboard(DASHBOARD_SUPERVISORES_API)
const LOGISTICA = paraDashboard(DASHBOARD_LOGISTICA_API)

describe('F7.10 — DialogoConcluirDashboard: concluir construção ou modificação pela TI (RF-55, RF-56, RNF-07)', () => {
  function renderizar(dashboard: Dashboard | null, concluindo = false) {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    render(<DialogoConcluirDashboard dashboard={dashboard} concluindo={concluindo} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    return { onConfirmar, onCancelar }
  }

  it('com dashboard null não renderiza nada', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('em construção: "Concluir construção", o dashboard passa a ficar ativo, com o número da tarefa ("Tarefa #40")', () => {
    renderizar(SUPERVISORES)

    const dialogo = screen.getByRole('dialog', { name: 'Concluir construção' })
    expect(within(dialogo).getByText('Confirme que a TI concluiu a construção do dashboard “PED Supervisores”. Ele passa a ficar ativo.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Tarefa #40')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Concluir' })).toBeEnabled()
  })

  it('em modificação: "Concluir modificação", o dashboard volta à situação anterior', () => {
    renderizar(LOGISTICA)

    const dialogo = screen.getByRole('dialog', { name: 'Concluir modificação' })
    expect(
      within(dialogo).getByText('Confirme que a TI concluiu a modificação do dashboard “PED Logística”. Ele volta à situação anterior à modificação.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByText('Tarefa #41')).toBeInTheDocument()
  })

  it('sem tarefa conhecida, não mostra número de tarefa nem o rótulo de aguardando envio', () => {
    renderizar({ ...SUPERVISORES, tarefaBitrix: null })

    expect(screen.queryByText(/Tarefa/)).not.toBeInTheDocument()
    expect(screen.queryByText('Aguardando envio ao Bitrix')).not.toBeInTheDocument()
  })

  it('tarefa sem número (id null, ainda não enviada ao Bitrix24): mostra "Aguardando envio ao Bitrix", sem número', () => {
    renderizar({ ...SUPERVISORES, tarefaBitrix: { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: PED Supervisores' } })

    const dialogo = screen.getByRole('dialog', { name: 'Concluir construção' })
    expect(within(dialogo).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
    expect(within(dialogo).queryByText(/#/)).not.toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Concluir' })).toBeEnabled()
  })

  it('tarefa com número e status "aguardando_envio": mostra "Aguardando envio ao Bitrix" no lugar do número', () => {
    renderizar({ ...SUPERVISORES, tarefaBitrix: { id: 40, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: PED Supervisores' } })

    const dialogo = screen.getByRole('dialog', { name: 'Concluir construção' })
    expect(within(dialogo).getByText('Aguardando envio ao Bitrix')).toBeInTheDocument()
    expect(within(dialogo).queryByText('Tarefa #40')).not.toBeInTheDocument()
  })

  it('"Concluir" chama onConfirmar; Cancelar e Esc chamam onCancelar; concluindo desabilita o botão', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(SUPERVISORES)

    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('com concluindo, o botão "Concluir" fica desabilitado', () => {
    renderizar(LOGISTICA, true)

    expect(screen.getByRole('button', { name: 'Concluir' })).toBeDisabled()
  })
})
