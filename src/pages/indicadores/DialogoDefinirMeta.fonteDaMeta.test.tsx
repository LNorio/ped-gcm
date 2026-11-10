import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import type { DadosMeta } from '../../services/indicadoresService'
import { DADO_COBERTURA_API, DADO_DEVOLUCOES_API } from '../../test/dadosExternosFalsos'
import { INDICADOR_DEVOLUCOES_API } from '../../test/indicadoresFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { DadoExterno, Indicador } from '../../types/dominio'
import { DialogoDefinirMeta, type DialogoDefinirMetaProps } from './DialogoDefinirMeta'

/**
 * F6.11 — Fonte da meta no "Definir meta" do indicador criado automaticamente (contrato final:
 * RESPOSTA-FINAL-meta-via-api.md, seção 2.1 — 10/11/2026).
 *
 * A composição do automático é o dado externo de origem (`indicador.composicao.itens[0].id`). O diálogo
 * recebe a lista `dadosExternos` (prop opcional, padrão `[]`; a página carrega com `listarDadosExternos`
 * ao abrir) e procura o dado pelo id:
 * - dado com `forneceMeta: true` + "Buscar metas via API" marcado → checkbox "Meta vinda do dado externo"
 *   marcado por padrão → `onConfirmar({ origemDaMeta: 'terceiro', fonteDaMeta: 'dado_externo', sentido,
 *   metaEditavel: false })`;
 * - desmarcado, dado sem `forneceMeta`, dado fora da lista ou lista vazia → sem o checkbox (ou desmarcado)
 *   e `fonteDaMeta: 'integracao'`.
 * - `consultaIntegracaoDisponivel` (padrão `true`): com `false` e a fonte `integracao`, o mesmo aviso do
 *   cadastro, sem bloquear a confirmação.
 */
const AUTOMATICO: Indicador = paraIndicador(INDICADOR_DEVOLUCOES_API)
const ID_DADO = INDICADOR_DEVOLUCOES_API.composicao.itens[0].id
const DADO_FORNECE: DadoExterno = { ...paraDadoExterno(DADO_DEVOLUCOES_API), id: ID_DADO, forneceMeta: true }
const DADO_NAO_FORNECE: DadoExterno = { ...DADO_FORNECE, forneceMeta: false }
const OUTRO_DADO: DadoExterno = { ...paraDadoExterno(DADO_COBERTURA_API), forneceMeta: true }

const BUSCAR_VIA_API = 'Buscar metas via API'
const META_DO_DADO = 'Meta vinda do dado externo'
const AVISO =
  'A consulta desta fonte ainda não está disponível. O indicador será cadastrado e a integração poderá ser configurada; a meta chegará quando a consulta for liberada.'

describe('F6.11 — DialogoDefinirMeta: fonte da meta ("Meta vinda do dado externo") e aviso da consulta', () => {
  function renderizar(props: Partial<DialogoDefinirMetaProps> = {}) {
    const onConfirmar = vi.fn<(dados: DadosMeta) => void>()
    render(
      <DialogoDefinirMeta
        indicador={AUTOMATICO}
        definindo={false}
        erro={null}
        filialSelecionada="todas"
        filiais={FILIAIS}
        onConfirmar={onConfirmar}
        onCancelar={vi.fn()}
        {...props}
      />,
    )
    return { onConfirmar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Definir meta' })
  const buscarViaApi = () => within(dialogo()).getByRole('checkbox', { name: BUSCAR_VIA_API })
  const metaDoDado = () => within(dialogo()).queryByRole('checkbox', { name: META_DO_DADO })
  const confirmar = () => within(dialogo()).getByRole('button', { name: 'Definir meta' })

  async function escolherSentido(user: Usuario) {
    const sentido = within(dialogo()).getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
  }

  it('dado do indicador fornece meta: "Meta vinda do dado externo" aparece marcado ao marcar "Buscar metas via API"', async () => {
    const user = usuarioRapido()
    renderizar({ dadosExternos: [OUTRO_DADO, DADO_FORNECE] })
    expect(metaDoDado()).not.toBeInTheDocument()

    await user.click(buscarViaApi())

    expect(metaDoDado()).toBeChecked()
  })

  it('marcado (padrão): onConfirmar com fonteDaMeta "dado_externo"', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar({ dadosExternos: [DADO_FORNECE] })
    await escolherSentido(user)
    await user.click(buscarViaApi())

    await user.click(confirmar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar.mock.calls[0][0]).toEqual({
      origemDaMeta: 'terceiro',
      fonteDaMeta: 'dado_externo',
      sentido: 'maior_melhor',
      metaEditavel: false,
    })
  })

  it('desmarcado: onConfirmar com fonteDaMeta "integracao"', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar({ dadosExternos: [DADO_FORNECE] })
    await escolherSentido(user)
    await user.click(buscarViaApi())

    await user.click(metaDoDado()!)
    await user.click(confirmar())

    expect(onConfirmar.mock.calls[0][0]).toEqual({
      origemDaMeta: 'terceiro',
      fonteDaMeta: 'integracao',
      sentido: 'maior_melhor',
      metaEditavel: false,
    })
  })

  it.each<[string, DadoExterno[] | undefined]>([
    ['dado do indicador sem forneceMeta', [DADO_NAO_FORNECE]],
    ['dado do indicador fora da lista', [OUTRO_DADO]],
    ['lista vazia', []],
    ['sem a prop dadosExternos', undefined],
  ])('%s: sem "Meta vinda do dado externo" e fonteDaMeta "integracao"', async (_nome, dadosExternos) => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar({ dadosExternos })
    await escolherSentido(user)

    await user.click(buscarViaApi())
    expect(metaDoDado()).not.toBeInTheDocument()
    await user.click(confirmar())

    expect(onConfirmar.mock.calls[0][0]).toMatchObject({ origemDaMeta: 'terceiro', fonteDaMeta: 'integracao' })
  })

  it('consultaIntegracaoDisponivel false + fonte integracao: aviso visível, confirmação liberada', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar({ dadosExternos: [DADO_NAO_FORNECE], consultaIntegracaoDisponivel: false })
    await escolherSentido(user)

    await user.click(buscarViaApi())

    expect(within(dialogo()).getByText(AVISO)).toBeInTheDocument()
    await user.click(confirmar())
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })

  it('consultaIntegracaoDisponivel false + fonte dado_externo: sem aviso até desmarcar "Meta vinda do dado externo"', async () => {
    const user = usuarioRapido()
    renderizar({ dadosExternos: [DADO_FORNECE], consultaIntegracaoDisponivel: false })

    await user.click(buscarViaApi())
    expect(within(dialogo()).queryByText(AVISO)).not.toBeInTheDocument()

    await user.click(metaDoDado()!)
    expect(within(dialogo()).getByText(AVISO)).toBeInTheDocument()
  })

  it('consultaIntegracaoDisponivel ausente (padrão true): sem aviso na fonte integracao', async () => {
    const user = usuarioRapido()
    renderizar({ dadosExternos: [DADO_NAO_FORNECE] })

    await user.click(buscarViaApi())

    expect(within(dialogo()).queryByText(AVISO)).not.toBeInTheDocument()
  })
})
