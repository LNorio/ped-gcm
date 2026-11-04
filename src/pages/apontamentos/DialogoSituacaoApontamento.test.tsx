import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento } from '../../services/adaptadores'
import { APONTAMENTO_CHAMADOS_API, APONTAMENTO_RELATORIO_API } from '../../test/apontamentosFalsos'
import type { Apontamento } from '../../types/dominio'
import { DialogoSituacaoApontamento } from './DialogoSituacaoApontamento'

const ATIVO = paraApontamento(APONTAMENTO_CHAMADOS_API)
const INATIVO = paraApontamento(APONTAMENTO_RELATORIO_API)

const IMPACTO_DESATIVAR =
  'Desativado, o apontamento sai do Preenchimento e dos próximos fechamentos. Lançamentos já feitos são mantidos.'
const IMPACTO_ATIVAR = 'Ativado, o apontamento volta ao Preenchimento.'

describe('F4.5 — DialogoSituacaoApontamento (confirmação de ativar/desativar)', () => {
  function renderizar(
    apontamento: Apontamento | null,
    opcoes: { alterando?: boolean; onConfirmar?: () => void; onCancelar?: () => void } = {},
  ) {
    const onConfirmar = opcoes.onConfirmar ?? vi.fn()
    const onCancelar = opcoes.onCancelar ?? vi.fn()
    const utils = render(
      <DialogoSituacaoApontamento
        apontamento={apontamento}
        alterando={opcoes.alterando ?? false}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onConfirmar, onCancelar }
  }

  it('com apontamento null não renderiza diálogo', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  describe('apontamento ativo → desativar (RNF-07)', () => {
    it('abre o diálogo modal "Desativar apontamento" com o impacto e os botões Desativar e Cancelar', () => {
      renderizar(ATIVO)

      const dialogo = screen.getByRole('dialog', { name: 'Desativar apontamento' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(within(dialogo).getByText(IMPACTO_DESATIVAR)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Desativar' })).toBeEnabled()
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    })

    it('clicar em Desativar chama onConfirmar uma vez e não chama onCancelar', async () => {
      const user = userEvent.setup()
      const { onConfirmar, onCancelar } = renderizar(ATIVO)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }))

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onCancelar).not.toHaveBeenCalled()
    })
  })

  describe('apontamento inativo → ativar', () => {
    it('abre o diálogo "Ativar apontamento" com o impacto e os botões Ativar e Cancelar', () => {
      renderizar(INATIVO)

      const dialogo = screen.getByRole('dialog', { name: 'Ativar apontamento' })
      expect(within(dialogo).getByText(IMPACTO_ATIVAR)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Ativar' })).toBeEnabled()
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByText(IMPACTO_DESATIVAR)).not.toBeInTheDocument()
    })

    it('clicar em Ativar chama onConfirmar', async () => {
      const user = userEvent.setup()
      const { onConfirmar } = renderizar(INATIVO)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ativar' }))

      expect(onConfirmar).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancelamento', () => {
    it('Cancelar chama onCancelar e não chama onConfirmar', async () => {
      const user = userEvent.setup()
      const { onConfirmar, onCancelar } = renderizar(ATIVO)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('Esc chama onCancelar', async () => {
      const user = userEvent.setup()
      const { onConfirmar, onCancelar } = renderizar(INATIVO)

      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('alterando', () => {
    it('com alterando, o botão de confirmar fica desabilitado e o clique não chama onConfirmar', async () => {
      const user = userEvent.setup()
      const { onConfirmar } = renderizar(ATIVO, { alterando: true })

      const confirmar = within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' })
      expect(confirmar).toBeDisabled()
      await user.click(confirmar)

      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('troca do apontamento', () => {
    it('ao trocar de um ativo para um inativo, título, impacto e botão acompanham', () => {
      const { rerender } = renderizar(ATIVO)
      expect(screen.getByRole('dialog', { name: 'Desativar apontamento' })).toBeInTheDocument()

      rerender(<DialogoSituacaoApontamento apontamento={INATIVO} alterando={false} onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

      expect(screen.getByRole('dialog', { name: 'Ativar apontamento' })).toBeInTheDocument()
      expect(screen.getByText(IMPACTO_ATIVAR)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ativar' })).toBeInTheDocument()
    })

    it('ao receber null depois de aberto, o diálogo fecha', () => {
      const { rerender } = renderizar(ATIVO)

      rerender(<DialogoSituacaoApontamento apontamento={null} alterando={false} onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
