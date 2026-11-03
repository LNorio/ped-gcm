import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { paraTipoApontamento } from '../../services/adaptadores'
import { TIPO_LOGISTICA_API, TIPO_MARKETING_API } from '../../test/tiposFalsos'
import type { TipoApontamento } from '../../types/dominio'
import { DialogoExcluirTipo } from './DialogoExcluirTipo'

const LOGISTICA = paraTipoApontamento(TIPO_LOGISTICA_API)
const MARKETING = paraTipoApontamento(TIPO_MARKETING_API)

const IMPACTO_LOGISTICA = 'O tipo Logística será removido. Esta ação não pode ser desfeita.'
const BLOQUEIO_MARKETING = 'Este tipo possui 3 apontamento(s) vinculado(s) e não pode ser excluído.'

describe('F3.3 — DialogoExcluirTipo (confirmação da exclusão de tipo)', () => {
  function renderizar(
    tipo: TipoApontamento | null,
    opcoes: { excluindo?: boolean; onConfirmar?: () => void; onCancelar?: () => void } = {},
  ) {
    const onConfirmar = opcoes.onConfirmar ?? vi.fn()
    const onCancelar = opcoes.onCancelar ?? vi.fn()
    const utils = render(
      <DialogoExcluirTipo
        tipo={tipo}
        excluindo={opcoes.excluindo ?? false}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onConfirmar, onCancelar }
  }

  describe('fechado', () => {
    it('com tipo null não renderiza diálogo', () => {
      renderizar(null)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('tipo sem apontamentos (confirmação — RNF-07)', () => {
    it('abre o diálogo modal "Excluir tipo" com o impacto e os botões Excluir (perigo) e Cancelar', () => {
      renderizar(LOGISTICA)

      const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(within(dialogo).getByText(IMPACTO_LOGISTICA)).toBeInTheDocument()
      const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' })
      expect(confirmar).toBeEnabled()
      expect(confirmar).toHaveClass('botao--perigo-cheio')
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    })

    it('clicar em Excluir chama onConfirmar uma vez e não chama onCancelar', async () => {
      const user = userEvent.setup()
      const { onConfirmar, onCancelar } = renderizar(LOGISTICA)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onCancelar).not.toHaveBeenCalled()
    })

    it('clicar em Cancelar chama onCancelar e não chama onConfirmar', async () => {
      const user = userEvent.setup()
      const { onConfirmar, onCancelar } = renderizar(LOGISTICA)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('Esc chama onCancelar', async () => {
      const user = userEvent.setup()
      const { onConfirmar, onCancelar } = renderizar(LOGISTICA)

      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('com excluindo, o botão Excluir fica desabilitado e o clique não chama onConfirmar', async () => {
      const user = userEvent.setup()
      const { onConfirmar } = renderizar(LOGISTICA, { excluindo: true })

      const confirmar = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' })
      expect(confirmar).toBeDisabled()
      await user.click(confirmar)

      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('o impacto usa o nome do tipo recebido', () => {
      renderizar({ ...LOGISTICA, nome: 'Expedição' })

      expect(
        within(screen.getByRole('dialog')).getByText('O tipo Expedição será removido. Esta ação não pode ser desfeita.'),
      ).toBeInTheDocument()
    })
  })

  describe('tipo com apontamentos (bloqueio — RN-13)', () => {
    it('abre em modo bloqueio: motivo com a quantidade e só o botão "Entendi"', () => {
      renderizar(MARKETING)

      const dialogo = screen.getByRole('dialog', { name: 'Excluir tipo' })
      expect(within(dialogo).getByText(BLOQUEIO_MARKETING)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByText(/será removido/)).not.toBeInTheDocument()
    })

    it('"Entendi" chama onCancelar e nunca onConfirmar', async () => {
      const user = userEvent.setup()
      const { onConfirmar, onCancelar } = renderizar(MARKETING)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Entendi' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('o motivo usa a quantidade de apontamentos do tipo (1 apontamento)', () => {
      renderizar({ ...LOGISTICA, quantidadeApontamentos: 1 })

      expect(
        within(screen.getByRole('dialog')).getByText('Este tipo possui 1 apontamento(s) vinculado(s) e não pode ser excluído.'),
      ).toBeInTheDocument()
    })
  })

  describe('troca do tipo', () => {
    it('ao trocar o tipo, o conteúdo acompanha (de confirmação para bloqueio)', () => {
      const { rerender } = renderizar(LOGISTICA)
      expect(within(screen.getByRole('dialog')).getByText(IMPACTO_LOGISTICA)).toBeInTheDocument()

      rerender(<DialogoExcluirTipo tipo={MARKETING} excluindo={false} onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

      expect(within(screen.getByRole('dialog')).queryByText(IMPACTO_LOGISTICA)).not.toBeInTheDocument()
      expect(within(screen.getByRole('dialog')).getByText(BLOQUEIO_MARKETING)).toBeInTheDocument()
    })

    it('ao receber tipo null depois de aberto, o diálogo fecha', () => {
      const { rerender } = renderizar(LOGISTICA)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      rerender(<DialogoExcluirTipo tipo={null} excluindo={false} onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
