import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento } from '../../services/adaptadores'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_ROTEIRO_API,
  APONTAMENTO_TREINAMENTOS_API,
} from '../../test/apontamentosFalsos'
import type { Apontamento } from '../../types/dominio'
import { DialogoExcluirApontamento } from './DialogoExcluirApontamento'

const CHAMADOS = paraApontamento(APONTAMENTO_CHAMADOS_API)
const TREINAMENTOS = paraApontamento(APONTAMENTO_TREINAMENTOS_API)
const ROTEIRO = paraApontamento(APONTAMENTO_ROTEIRO_API)

const IMPACTO_CHAMADOS =
  'O apontamento Chamados resolvidos no prazo e todos os seus lançamentos e histórico serão apagados. Esta ação não pode ser desfeita.'
const BLOQUEIO_TREINAMENTOS =
  'Este apontamento compõe os indicadores: Capacitação, Desenvolvimento de equipe e não pode ser excluído.'
const BLOQUEIO_ROTEIRO = 'Este apontamento compõe os indicadores: Cobertura de visitas e não pode ser excluído.'

describe('F4.6 — DialogoExcluirApontamento (confirmação da exclusão)', () => {
  function renderizar(
    apontamento: Apontamento | null,
    opcoes: { excluindo?: boolean; onConfirmar?: () => void; onCancelar?: () => void } = {},
  ) {
    const onConfirmar = opcoes.onConfirmar ?? vi.fn()
    const onCancelar = opcoes.onCancelar ?? vi.fn()
    const utils = render(
      <DialogoExcluirApontamento
        apontamento={apontamento}
        excluindo={opcoes.excluindo ?? false}
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

  describe('apontamento sem indicadores (confirmação — RNF-07)', () => {
    it('abre o diálogo modal "Excluir apontamento" com o impacto e os botões Excluir (perigo) e Cancelar', () => {
      renderizar(CHAMADOS)

      const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(within(dialogo).getByText(IMPACTO_CHAMADOS)).toBeInTheDocument()
      const confirmar = within(dialogo).getByRole('button', { name: 'Excluir' })
      expect(confirmar).toBeEnabled()
      expect(confirmar).toHaveClass('botao--perigo-cheio')
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    })

    it('clicar em Excluir chama onConfirmar uma vez e não chama onCancelar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar(CHAMADOS)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onCancelar).not.toHaveBeenCalled()
    })

    it('clicar em Cancelar chama onCancelar e não chama onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar(CHAMADOS)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('Esc chama onCancelar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar(CHAMADOS)

      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('com excluindo, o botão Excluir fica desabilitado e o clique não chama onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar(CHAMADOS, { excluindo: true })

      const confirmar = within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' })
      expect(confirmar).toBeDisabled()
      await user.click(confirmar)

      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('o impacto usa o nome do apontamento recebido', () => {
      renderizar({ ...CHAMADOS, nome: 'Relatório mensal entregue' })

      expect(
        within(screen.getByRole('dialog')).getByText(
          'O apontamento Relatório mensal entregue e todos os seus lançamentos e histórico serão apagados. Esta ação não pode ser desfeita.',
        ),
      ).toBeInTheDocument()
    })

    it('um apontamento inativo sem indicadores também abre em modo confirmação', () => {
      renderizar({ ...CHAMADOS, ativo: false })

      expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
    })
  })

  describe('apontamento com indicadores (bloqueio — RN-11, RN-12)', () => {
    it('abre em modo bloqueio listando os indicadores e só o botão "Entendi"', () => {
      renderizar(TREINAMENTOS)

      const dialogo = screen.getByRole('dialog', { name: 'Excluir apontamento' })
      expect(within(dialogo).getByText(BLOQUEIO_TREINAMENTOS)).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByText(/serão apagados/)).not.toBeInTheDocument()
    })

    it('com um único indicador, lista só ele', () => {
      renderizar(ROTEIRO)

      expect(within(screen.getByRole('dialog')).getByText(BLOQUEIO_ROTEIRO)).toBeInTheDocument()
    })

    it('"Entendi" chama onCancelar e nunca onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar(TREINAMENTOS)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Entendi' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('Esc no modo bloqueio também chama onCancelar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar(TREINAMENTOS)

      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('troca do apontamento', () => {
    it('ao trocar o apontamento, o conteúdo acompanha (de confirmação para bloqueio)', () => {
      const { rerender } = renderizar(CHAMADOS)
      expect(within(screen.getByRole('dialog')).getByText(IMPACTO_CHAMADOS)).toBeInTheDocument()

      rerender(<DialogoExcluirApontamento apontamento={TREINAMENTOS} excluindo={false} onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

      expect(within(screen.getByRole('dialog')).queryByText(IMPACTO_CHAMADOS)).not.toBeInTheDocument()
      expect(within(screen.getByRole('dialog')).getByText(BLOQUEIO_TREINAMENTOS)).toBeInTheDocument()
    })

    it('ao receber null depois de aberto, o diálogo fecha', () => {
      const { rerender } = renderizar(CHAMADOS)

      rerender(<DialogoExcluirApontamento apontamento={null} excluindo={false} onConfirmar={vi.fn()} onCancelar={vi.fn()} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
