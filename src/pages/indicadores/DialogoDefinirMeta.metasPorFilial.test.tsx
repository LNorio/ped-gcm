import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import type { DadosMeta } from '../../services/indicadoresService'
import { INDICADOR_DEVOLUCOES_API } from '../../test/indicadoresFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { DialogoDefinirMeta, type DialogoDefinirMetaProps } from './DialogoDefinirMeta'

/**
 * F6.10 — Meta por filial no diálogo "Definir meta" (indicador criado automaticamente).
 * Mesmo comportamento do cadastro: na visão "Todas as filiais", checkbox "Replicar a meta para todas
 * as filiais" marcado por padrão (campo "Meta") ou, desmarcado, o grupo "Metas por filial"; na visão
 * de uma filial, um único campo "Meta da filial {código} - {nome}". Sentido e "Meta editável no
 * preenchimento" continuam como estão.
 */
const AUTOMATICO: Indicador = paraIndicador(INDICADOR_DEVOLUCOES_API)

const REPLICAR = 'Replicar a meta para todas as filiais'
const MENSAGEM_META = 'Informe uma meta maior que zero.'
const MENSAGEM_NENHUMA_FILIAL = 'Informe a meta de ao menos uma filial.'

describe('F6.10 — DialogoDefinirMeta: meta por filial', () => {
  function renderizar(props: Partial<DialogoDefinirMetaProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(dados: DadosMeta) => void>()
    render(
      <DialogoDefinirMeta
        indicador={AUTOMATICO}
        definindo={false}
        erro={null}
        filialSelecionada={props.filialSelecionada === undefined ? 'todas' : props.filialSelecionada}
        filiais={props.filiais ?? FILIAIS}
        onConfirmar={onConfirmar}
        onCancelar={vi.fn()}
      />,
    )
    return { onConfirmar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Definir meta' })
  const replicar = () => within(dialogo()).getByRole('checkbox', { name: REPLICAR })
  const metaUnica = () => within(dialogo()).queryByRole('textbox', { name: 'Meta' })
  const grupoFiliais = () => within(dialogo()).getByRole('group', { name: 'Metas por filial' })
  const metaDaFilial = (rotulo: string) => within(dialogo()).getByRole('textbox', { name: `Meta da filial ${rotulo}` })
  const confirmar = () => within(dialogo()).getByRole('button', { name: 'Definir meta' })

  async function escolherSentido(user: Usuario) {
    const sentido = within(dialogo()).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
  }

  describe('visão "Todas as filiais"', () => {
    it('mostra "Replicar a meta para todas as filiais" marcado e o campo "Meta"', () => {
      renderizar()

      expect(replicar()).toBeChecked()
      expect(metaUnica()).toBeInTheDocument()
      expect(within(dialogo()).queryByRole('group', { name: 'Metas por filial' })).not.toBeInTheDocument()
    })

    it('com o checkbox marcado, confirma com a meta única e sem metasPorFilial', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()
      await user.type(metaUnica()!, '2.500,75')
      await escolherSentido(user)

      await user.click(confirmar())

      expect(onConfirmar).toHaveBeenCalledWith({ meta: 2500.75, sentido: 'maior_melhor', metaEditavel: false })
      expect(onConfirmar.mock.calls[0][0]).not.toHaveProperty('metasPorFilial')
    })

    it('desmarcado, troca o campo "Meta" pelo grupo "Metas por filial" com um campo por filial, na ordem recebida', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(replicar())

      expect(metaUnica()).not.toBeInTheDocument()
      expect(within(grupoFiliais()).getAllByRole('textbox')).toEqual([
        metaDaFilial('100 - MATRIZ'),
        metaDaFilial('101 - CAMPO GRANDE'),
        metaDaFilial('102 - DOURADOS'),
      ])
    })

    it('com a lista, confirma metasPorFilial só com as filiais preenchidas, sem meta, mantendo sentido e meta editável', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()
      await user.click(replicar())
      await user.type(metaDaFilial('101 - CAMPO GRANDE'), '2.000,25')
      await user.type(metaDaFilial('102 - DOURADOS'), '1800')
      await escolherSentido(user)
      await user.click(within(dialogo()).getByRole('checkbox', { name: 'Meta editável no preenchimento' }))

      await user.click(confirmar())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      const dados = onConfirmar.mock.calls[0][0]
      expect(dados).toEqual({
        metasPorFilial: [
          { filial: '101', meta: 2000.25 },
          { filial: '102', meta: 1800 },
        ],
        sentido: 'maior_melhor',
        metaEditavel: true,
      })
      expect(dados).not.toHaveProperty('meta')
    })

    it('com a lista toda em branco, mostra "Informe a meta de ao menos uma filial." e não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()
      await user.click(replicar())
      await escolherSentido(user)

      await user.click(confirmar())

      expect(within(grupoFiliais()).getByText(MENSAGEM_NENHUMA_FILIAL)).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it.each(['0', '-1', 'abc'])('com a lista, o valor "%s" é recusado no próprio campo com "Informe uma meta maior que zero."', async (valor) => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()
      await user.click(replicar())
      await user.type(metaDaFilial('100 - MATRIZ'), valor)
      await escolherSentido(user)

      await user.click(confirmar())

      expect(metaDaFilial('100 - MATRIZ')).toHaveAttribute('aria-invalid', 'true')
      expect(metaDaFilial('100 - MATRIZ')).toHaveAccessibleDescription(MENSAGEM_META)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('visão de uma filial específica', () => {
    it('sem checkbox nem grupo; um único campo obrigatório "Meta da filial {código} - {nome}"', () => {
      renderizar({ filialSelecionada: FILIAIS[2] })

      expect(within(dialogo()).queryByRole('checkbox', { name: REPLICAR })).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('group', { name: 'Metas por filial' })).not.toBeInTheDocument()
      expect(metaUnica()).not.toBeInTheDocument()
      expect(metaDaFilial('102 - DOURADOS')).toHaveAttribute('aria-required', 'true')
    })

    it('confirma metasPorFilial só com a filial do cabeçalho e sem meta', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ filialSelecionada: FILIAIS[2] })
      await user.type(metaDaFilial('102 - DOURADOS'), '2500')
      await escolherSentido(user)

      await user.click(confirmar())

      const dados = onConfirmar.mock.calls[0][0]
      expect(dados).toEqual({ metasPorFilial: [{ filial: '102', meta: 2500 }], sentido: 'maior_melhor', metaEditavel: false })
      expect(dados).not.toHaveProperty('meta')
    })

    it('campo da filial vazio mostra "Informe uma meta maior que zero." e não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ filialSelecionada: FILIAIS[2] })
      await escolherSentido(user)

      await user.click(confirmar())

      expect(metaDaFilial('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
      expect(within(dialogo()).getByText(MENSAGEM_META)).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })
})
