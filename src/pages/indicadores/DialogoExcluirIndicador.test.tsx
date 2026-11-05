import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  INDICADOR_CAPACITACAO_API,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_ROTINAS_API,
} from '../../test/indicadoresFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { DialogoExcluirIndicador } from './DialogoExcluirIndicador'

const ROTINAS = paraIndicador(INDICADOR_ROTINAS_API)
const CAPACITACAO = paraIndicador(INDICADOR_CAPACITACAO_API)
const DEVOLUCOES = paraIndicador(INDICADOR_DEVOLUCOES_API)
const COBERTURA_VISITAS = paraIndicador(INDICADOR_COBERTURA_VISITAS_API)

const BLOQUEIO = 'Este indicador está ou já esteve vinculado a dashboard e não pode ser excluído. Se necessário, inative-o.'

describe('F6.7 — DialogoExcluirIndicador (confirmação e bloqueio da exclusão — RF-37, RN-11, RNF-07)', () => {
  function renderizar(indicador: Indicador | null, excluindo = false) {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    render(<DialogoExcluirIndicador indicador={indicador} excluindo={excluindo} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    return { onConfirmar, onCancelar }
  }

  it('com indicador null não renderiza nada', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('nunca vinculado: "Excluir indicador" com o impacto definitivo e os botões Excluir (perigo) e Cancelar', () => {
    renderizar(ROTINAS)

    const dialogo = screen.getByRole('dialog', { name: 'Excluir indicador' })
    expect(
      within(dialogo).getByText('O indicador Rotinas financeiras em dia será excluído definitivamente. Esta ação não pode ser desfeita.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toHaveClass('botao--perigo-cheio')
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('indicador inativo e automático sem meta também podem ser excluídos quando nunca vinculados', () => {
    renderizar(CAPACITACAO)
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
    screen.getByRole('dialog').remove()

    renderizar(DEVOLUCOES)
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()
  })

  it('vinculado a dashboard: bloqueio explicando a RN-11 e só "Entendi", sem Excluir', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(COBERTURA_VISITAS)

    const dialogo = screen.getByRole('dialog', { name: 'Excluir indicador' })
    expect(within(dialogo).getByText(BLOQUEIO)).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Entendi' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('o bloqueio vale pela marca "vinculado a dashboard", mesmo sem dashboards atuais (já esteve vinculado)', () => {
    renderizar({ ...ROTINAS, vinculadoADashboard: true, dashboards: [] })

    expect(screen.getByText(BLOQUEIO)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
  })

  it('Excluir chama onConfirmar; Cancelar e Esc chamam onCancelar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(ROTINAS)

    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('com excluindo, "Excluir" fica desabilitado', () => {
    renderizar(ROTINAS, true)

    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
  })
})
