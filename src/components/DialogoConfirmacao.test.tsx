import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { DialogoConfirmacao } from './DialogoConfirmacao'

describe('F1.8 — DialogoConfirmacao', () => {
  describe('confirmação com impacto (RNF-07)', () => {
    it('exibe o título e a descrição do impacto em um dialog modal', () => {
      render(
        <DialogoConfirmacao
          aberto
          titulo="Desativar apontamento"
          impacto="O apontamento sai do Preenchimento e dos próximos fechamentos. Lançamentos já feitos são mantidos."
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />,
      )

      const dialogo = screen.getByRole('dialog', { name: 'Desativar apontamento' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(
        within(dialogo).getByText(
          'O apontamento sai do Preenchimento e dos próximos fechamentos. Lançamentos já feitos são mantidos.',
        ),
      ).toBeInTheDocument()
    })

    it('oferece "Confirmar" e "Cancelar" por padrão', () => {
      render(
        <DialogoConfirmacao aberto titulo="Abrir período" impacto="..." onConfirmar={() => {}} onCancelar={() => {}} />,
      )

      const dialogo = screen.getByRole('dialog')
      expect(within(dialogo).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    })

    it('aceita textos personalizados para confirmar e cancelar', () => {
      render(
        <DialogoConfirmacao
          aberto
          titulo="Excluir dashboard"
          impacto="..."
          textoConfirmar="Excluir"
          textoCancelar="Manter"
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />,
      )

      const dialogo = screen.getByRole('dialog')
      expect(within(dialogo).getByRole('button', { name: 'Excluir' })).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Manter' })).toBeInTheDocument()
    })

    it('chama onConfirmar ao confirmar e onCancelar ao cancelar', async () => {
      const user = usuarioRapido()
      const onConfirmar = vi.fn()
      const onCancelar = vi.fn()
      render(
        <DialogoConfirmacao aberto titulo="Excluir" impacto="..." onConfirmar={onConfirmar} onCancelar={onCancelar} />,
      )

      await user.click(screen.getByRole('button', { name: 'Confirmar' }))
      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onCancelar).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(onCancelar).toHaveBeenCalledTimes(1)
    })

    it('Esc cancela', async () => {
      const user = usuarioRapido()
      const onConfirmar = vi.fn()
      const onCancelar = vi.fn()
      render(
        <DialogoConfirmacao aberto titulo="Excluir" impacto="..." onConfirmar={onConfirmar} onCancelar={onCancelar} />,
      )

      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('ação perigosa usa o botão de confirmar na variante de perigo', () => {
      render(
        <DialogoConfirmacao
          aberto
          titulo="Excluir"
          impacto="..."
          perigo
          textoConfirmar="Excluir"
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />,
      )

      expect(screen.getByRole('button', { name: 'Excluir' })).toHaveClass('botao--perigo-cheio')
    })

    it('desabilita a confirmação enquanto processa', () => {
      render(
        <DialogoConfirmacao
          aberto
          titulo="Excluir"
          impacto="..."
          processando
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />,
      )

      expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    })

    it('não renderiza nada quando fechado', () => {
      render(
        <DialogoConfirmacao aberto={false} titulo="Excluir" impacto="..." onConfirmar={() => {}} onCancelar={() => {}} />,
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('bloqueado por regra (RNF-07)', () => {
    it('explica o motivo e oferece só o botão "Entendi"', () => {
      render(
        <DialogoConfirmacao
          aberto
          titulo="Não é possível excluir"
          bloqueio="Este apontamento compõe os indicadores: Atingimento de cobertura, Mix premium."
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />,
      )

      const dialogo = screen.getByRole('dialog', { name: 'Não é possível excluir' })
      expect(
        within(dialogo).getByText(
          'Este apontamento compõe os indicadores: Atingimento de cobertura, Mix premium.',
        ),
      ).toBeInTheDocument()
      const ehBotaoFechar = (botao: HTMLElement) =>
        botao.getAttribute('aria-label') === 'Fechar' || botao.textContent?.trim() === 'Fechar'
      const botoes = within(dialogo)
        .getAllByRole('button')
        .filter((botao) => !ehBotaoFechar(botao))
      expect(botoes).toHaveLength(1)
      expect(botoes[0]).toHaveTextContent('Entendi')
      expect(within(dialogo).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
      expect(within(dialogo).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    })

    it('"Entendi" chama onCancelar e nunca onConfirmar', async () => {
      const user = usuarioRapido()
      const onConfirmar = vi.fn()
      const onCancelar = vi.fn()
      render(
        <DialogoConfirmacao
          aberto
          titulo="Não é possível excluir"
          bloqueio="Motivo do bloqueio."
          onConfirmar={onConfirmar}
          onCancelar={onCancelar}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Entendi' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('aceita o motivo como conteúdo rico (lista de itens)', () => {
      render(
        <DialogoConfirmacao
          aberto
          titulo="Não é possível excluir"
          bloqueio={
            <>
              <p>Este dado externo compõe os indicadores:</p>
              <ul>
                <li>Cobertura</li>
                <li>Faturamento</li>
              </ul>
            </>
          }
          onConfirmar={() => {}}
          onCancelar={() => {}}
        />,
      )

      const dialogo = screen.getByRole('dialog')
      expect(within(dialogo).getByText('Cobertura')).toBeInTheDocument()
      expect(within(dialogo).getByText('Faturamento')).toBeInTheDocument()
      expect(within(dialogo).getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
    })
  })
})
