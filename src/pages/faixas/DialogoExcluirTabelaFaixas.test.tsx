import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { TABELA_COMERCIAL_101_API, TABELA_EXCLUIDO_101_API } from '../../test/faixasFalsos'
import { colar, usuarioRapido } from '../../test/usuario'
import { DialogoExcluirTabelaFaixas, type DialogoExcluirTabelaFaixasProps } from './DialogoExcluirTabelaFaixas'

const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const EXCLUIDO_101 = paraTabelaFaixas(TABELA_EXCLUIDO_101_API)

const IMPACTO =
  'A tabela de faixas de “PED Antigo · Filial 101” e o seu histórico de versões serão excluídos. Imagens já congeladas mantêm as faixas vigentes no fechamento.'
/** 12/11/2026 (F8.7): a faixa vinculada a um dashboard existente só pode ser inativada. */
const BLOQUEIO =
  'Esta tabela pertence a um dashboard existente e não pode ser excluída — use “Inativar tabela” para que ela deixe de valer ou “Alterar faixas” para gerar uma nova versão.'
const ERRO_MOTIVO = 'Informe o motivo da exclusão.'

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
const campoMotivo = () => within(dialogo()).getByRole('textbox', { name: 'Motivo da exclusão' })

describe('F8.6 — DialogoExcluirTabelaFaixas (exclusão só de tabela de dashboard excluído, com motivo obrigatório — RF-46, RN-18, RNF-07)', () => {
  it('com tabela null não renderiza nada', () => {
    renderizar({ tabela: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('tabela de dashboard excluído', () => {
    it('"Excluir tabela de faixas" descreve o impacto (tabela e histórico excluídos; imagens congeladas mantêm as faixas) com o motivo obrigatório, Cancelar e Excluir', () => {
      renderizar()

      expect(within(dialogo()).getByText(IMPACTO)).toBeInTheDocument()
      expect(campoMotivo()).toHaveValue('')
      expect(campoMotivo()).toHaveAttribute('aria-required', 'true')
      expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Excluir' })).toBeEnabled()
      expect(within(dialogo()).queryByRole('button', { name: 'Entendi' })).not.toBeInTheDocument()
    })

    it('"Excluir" usa a variante de perigo e chama onConfirmar com o motivo sem os espaços das pontas', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar()

      await colar(user, campoMotivo(), '  Dashboard encerrado em 2025  ')
      const excluir = within(dialogo()).getByRole('button', { name: 'Excluir' })
      expect(excluir).toHaveClass('botao--perigo-cheio')
      await user.click(excluir)

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith('Dashboard encerrado em 2025')
      expect(onCancelar).not.toHaveBeenCalled()
    })

    it.each([
      ['vazio', ''],
      ['só com espaços', '   '],
    ])('motivo %s: "Excluir" mostra "Informe o motivo da exclusão." e não chama onConfirmar', async (_caso, motivo) => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      if (motivo !== '') await colar(user, campoMotivo(), motivo)
      await user.click(within(dialogo()).getByRole('button', { name: 'Excluir' }))

      expect(within(dialogo()).getByText(ERRO_MOTIVO)).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('depois do erro, preencher o motivo e excluir chama onConfirmar', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.click(within(dialogo()).getByRole('button', { name: 'Excluir' }))
      await colar(user, campoMotivo(), 'Dashboard encerrado')
      await user.click(within(dialogo()).getByRole('button', { name: 'Excluir' }))

      expect(onConfirmar).toHaveBeenCalledWith('Dashboard encerrado')
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

  describe('tabela de dashboard existente (bloqueada — RF-46; inativar em vez de excluir — F8.7)', () => {
    it('explica o bloqueio (indicando "Inativar tabela") e oferece só "Entendi", sem motivo e sem Excluir', () => {
      renderizar({ tabela: COMERCIAL_101 })

      expect(within(dialogo()).getByText(BLOQUEIO)).toBeInTheDocument()
      expect(within(dialogo()).getByRole('button', { name: 'Entendi' })).toBeInTheDocument()
      expect(within(dialogo()).queryByRole('textbox', { name: 'Motivo da exclusão' })).not.toBeInTheDocument()
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
