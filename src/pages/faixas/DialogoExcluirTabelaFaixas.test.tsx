import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { TABELA_COMERCIAL_101_API, TABELA_EXCLUIDO_101_API } from '../../test/faixasFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoExcluirTabelaFaixas, type DialogoExcluirTabelaFaixasProps } from './DialogoExcluirTabelaFaixas'

const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const EXCLUIDO_101 = paraTabelaFaixas(TABELA_EXCLUIDO_101_API)

const IMPACTO =
  'A tabela de faixas de “PED Antigo · Filial 101” e o seu histórico de versões serão excluídos. Imagens já congeladas mantêm as faixas vigentes no fechamento.'
const BLOQUEIO =
  'Esta tabela pertence a um dashboard existente e não pode ser excluída — use “Alterar faixas” para gerar uma nova versão.'

function renderizar(props: Partial<DialogoExcluirTabelaFaixasProps> = {}) {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  render(
    <DialogoExcluirTabelaFaixas
      tabela={props.tabela === undefined ? EXCLUIDO_101 : props.tabela}
      excluindo={props.excluindo ?? false}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />,
  )
  return { onConfirmar, onCancelar }
}

const dialogo = () => screen.getByRole('dialog', { name: 'Excluir tabela de faixas' })

describe('F8.6 — DialogoExcluirTabelaFaixas (exclusão só de tabela de dashboard excluído — RF-46, RN-18, RNF-07)', () => {
  it('com tabela null não renderiza nada', () => {
    renderizar({ tabela: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('tabela de dashboard excluído', () => {
    it('"Excluir tabela de faixas" descreve o impacto (tabela e histórico excluídos; imagens congeladas mantêm as faixas) com Cancelar e Excluir', () => {
      renderizar()

      expect(within(dialogo()).getByText(IMPACTO)).toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Excluir' })).toBeEnabled()
      expect(within(dialogo()).queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    })

    it('"Excluir" usa a variante de perigo e chama onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar()

      const excluir = within(dialogo()).getByRole('button', { name: 'Excluir' })
      expect(excluir).toHaveClass('botao--perigo-cheio')
      await user.click(excluir)

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onCancelar).not.toHaveBeenCalled()
    })

    it('excluindo: "Excluir" fica desabilitado', () => {
      renderizar({ excluindo: true })

      expect(within(dialogo()).getByRole('button', { name: 'Excluir' })).toBeDisabled()
    })

    it('"Cancelar" e Esc chamam onCancelar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(2)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('tabela de dashboard existente (bloqueada — RF-46)', () => {
    it('explica o bloqueio e oferece só "Entendi", sem Excluir', () => {
      renderizar({ tabela: COMERCIAL_101 })

      expect(within(dialogo()).getByText(BLOQUEIO)).toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    })

    it('"Entendi" chama onCancelar, nunca onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar({ tabela: COMERCIAL_101 })

      await user.click(within(dialogo()).getByRole('button', { name: 'Entendi' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })
})
