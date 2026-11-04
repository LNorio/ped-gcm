import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import { DADO_COBERTURA_API, DADO_FATURAMENTO_API } from '../../test/dadosExternosFalsos'
import type { DadoExterno } from '../../types/dominio'
import { DialogoSituacaoDadoExterno } from './DialogoSituacaoDadoExterno'

const FATURAMENTO = paraDadoExterno(DADO_FATURAMENTO_API)
const COBERTURA = paraDadoExterno(DADO_COBERTURA_API)

const IMPACTO_DESATIVAR =
  'Desativado, o dado deixa de ser coletado e de compor os indicadores dos próximos fechamentos. Imagens já congeladas são mantidas.'
const IMPACTO_ATIVAR = 'Ativado, o dado volta a ser coletado.'

describe('F5.8 — DialogoSituacaoDadoExterno (confirmação de ativar/desativar — RF-30, RNF-07)', () => {
  function renderizar(dado: DadoExterno | null, alterando = false) {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    render(<DialogoSituacaoDadoExterno dado={dado} alterando={alterando} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    return { onConfirmar, onCancelar }
  }

  it('com dado null não renderiza nada', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dado ativo: "Desativar dado externo" com o impacto do RF-30 e o botão "Desativar"', () => {
    renderizar(FATURAMENTO)

    const dialogo = screen.getByRole('dialog', { name: 'Desativar dado externo' })
    expect(within(dialogo).getByText(IMPACTO_DESATIVAR)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Desativar' })).toBeEnabled()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('dado inativo: "Ativar dado externo" com "Ativado, o dado volta a ser coletado." e o botão "Ativar"', () => {
    renderizar(COBERTURA)

    const dialogo = screen.getByRole('dialog', { name: 'Ativar dado externo' })
    expect(within(dialogo).getByText(IMPACTO_ATIVAR)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Ativar' })).toBeInTheDocument()
  })

  it('confirmar chama onConfirmar; Cancelar e Esc chamam onCancelar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(FATURAMENTO)

    await user.click(screen.getByRole('button', { name: 'Desativar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('com alterando, o botão de confirmar fica desabilitado', () => {
    renderizar(FATURAMENTO, true)

    expect(screen.getByRole('button', { name: 'Desativar' })).toBeDisabled()
  })
})
