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
 * F6.11 — Meta buscada via API no diálogo "Definir meta" (decisão do usuário de 10/11/2026: a modal
 * tem o mesmo checkbox do cadastro).
 *
 * "Buscar metas via API", desmarcado por padrão. Marcado: somem "Meta", "Replicar a meta para todas as
 * filiais", "Metas por filial" / "Meta da filial ..." e "Meta editável no preenchimento" (com a meta via
 * API não é possível editar a meta manualmente); Sentido continua obrigatório. Confirmar marcado →
 * `onConfirmar({ origemDaMeta: 'terceiro', sentido, metaEditavel: false })`, sem `meta` nem
 * `metasPorFilial`. Desmarcar volta ao comportamento da F6.10, com "Meta editável" no valor anterior.
 * Contrato final (10/11/2026): sem a prop `dadosExternos` o dado do indicador não é conhecido, então a
 * fonte é `integracao` (`fonteDaMeta: 'integracao'`) — ver `DialogoDefinirMeta.fonteDaMeta.test.tsx`.
 */
const AUTOMATICO: Indicador = paraIndicador(INDICADOR_DEVOLUCOES_API)

const BUSCAR_VIA_API = 'Buscar metas via API'
const META_EDITAVEL = 'Meta editável no preenchimento'

describe('F6.11 — DialogoDefinirMeta: "Buscar metas via API"', () => {
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
  const buscarViaApi = () => within(dialogo()).getByRole('checkbox', { name: BUSCAR_VIA_API })
  const metaUnica = () => within(dialogo()).queryByRole('textbox', { name: 'Meta' })
  const replicar = () => within(dialogo()).queryByRole('checkbox', { name: 'Replicar a meta para todas as filiais' })
  const metaEditavel = () => within(dialogo()).queryByRole('checkbox', { name: META_EDITAVEL })
  const confirmar = () => within(dialogo()).getByRole('button', { name: 'Definir meta' })

  async function escolherSentido(user: Usuario) {
    const sentido = within(dialogo()).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
  }

  it('mostra "Buscar metas via API" desmarcado, com "Meta" e "Meta editável no preenchimento"', () => {
    renderizar()

    expect(buscarViaApi()).not.toBeChecked()
    expect(metaUnica()).toBeInTheDocument()
    expect(metaEditavel()).toBeInTheDocument()
  })

  it('marcado: esconde "Meta", "Replicar a meta para todas as filiais" e "Meta editável no preenchimento"; Sentido continua', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.click(buscarViaApi())

    expect(metaUnica()).not.toBeInTheDocument()
    expect(replicar()).not.toBeInTheDocument()
    expect(within(dialogo()).queryByRole('group', { name: 'Metas por filial' })).not.toBeInTheDocument()
    expect(metaEditavel()).not.toBeInTheDocument()
    expect(within(dialogo()).getByRole('combobox', { name: 'Sentido' })).toBeInTheDocument()
  })

  it('visão de uma filial: marcado esconde o campo "Meta da filial {código} - {nome}"', async () => {
    const user = usuarioRapido()
    renderizar({ filialSelecionada: FILIAIS[2] })
    expect(within(dialogo()).getByRole('textbox', { name: 'Meta da filial 102 - DOURADOS' })).toBeInTheDocument()

    await user.click(buscarViaApi())

    expect(within(dialogo()).queryByRole('textbox', { name: 'Meta da filial 102 - DOURADOS' })).not.toBeInTheDocument()
  })

  it('confirmar marcado (sem dadosExternos, fonte integracao): onConfirmar({ origemDaMeta: "terceiro", fonteDaMeta: "integracao", sentido, metaEditavel: false }), sem meta nem metasPorFilial', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()
    await escolherSentido(user)

    await user.click(buscarViaApi())
    await user.click(confirmar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    const dados = onConfirmar.mock.calls[0][0]
    expect(dados).toEqual({ origemDaMeta: 'terceiro', fonteDaMeta: 'integracao', sentido: 'maior_melhor', metaEditavel: false })
    expect(dados).not.toHaveProperty('meta')
    expect(dados).not.toHaveProperty('metasPorFilial')
  })

  it('"Meta editável no preenchimento" marcada antes: com a meta via API, metaEditavel vai false', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()
    await escolherSentido(user)
    await user.click(metaEditavel()!)

    await user.click(buscarViaApi())
    await user.click(confirmar())

    expect(onConfirmar.mock.calls[0][0]).toMatchObject({ origemDaMeta: 'terceiro', metaEditavel: false })
  })

  it('marcado, a meta não é validada, mas o Sentido continua obrigatório', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()
    await user.type(metaUnica()!, '0')
    await user.click(buscarViaApi())

    await user.click(confirmar())

    expect(onConfirmar).not.toHaveBeenCalled()
    expect(within(dialogo()).getByText('Selecione o sentido.')).toBeInTheDocument()
    expect(within(dialogo()).queryByText('Informe uma meta maior que zero.')).not.toBeInTheDocument()

    await escolherSentido(user)
    await user.click(confirmar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar.mock.calls[0][0]).not.toHaveProperty('meta')
  })

  it('desmarcar volta "Meta" e "Meta editável no preenchimento" com o valor anterior', async () => {
    const user = usuarioRapido()
    renderizar()
    await user.click(metaEditavel()!)

    await user.click(buscarViaApi())
    await user.click(buscarViaApi())

    expect(buscarViaApi()).not.toBeChecked()
    expect(metaUnica()).toBeInTheDocument()
    expect(metaEditavel()).toBeChecked()
  })

  it('desmarcado de novo, a confirmação volta a exigir a meta e envia meta (sem origemDaMeta "terceiro")', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()
    await escolherSentido(user)
    await user.click(buscarViaApi())
    await user.click(buscarViaApi())

    await user.click(confirmar())
    expect(onConfirmar).not.toHaveBeenCalled()
    expect(within(dialogo()).getByText('Informe uma meta maior que zero.')).toBeInTheDocument()

    await user.type(metaUnica()!, '25')
    await user.click(confirmar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar.mock.calls[0][0]).toMatchObject({ meta: 25, sentido: 'maior_melhor' })
    expect(onConfirmar.mock.calls[0][0].origemDaMeta).not.toBe('terceiro')
  })
})
