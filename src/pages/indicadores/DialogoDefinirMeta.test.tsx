import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import type { DadosMeta } from '../../services/indicadoresService'
import { INDICADOR_DEVOLUCOES_API } from '../../test/indicadoresFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { DialogoDefinirMeta, type DialogoDefinirMetaProps } from './DialogoDefinirMeta'

/** Nome diferente do dado de origem, para distinguir os dois textos no diálogo. */
const AUTOMATICO: Indicador = { ...paraIndicador(INDICADOR_DEVOLUCOES_API), nome: 'Indicador de devoluções' }

describe('F6.5 — DialogoDefinirMeta (meta do indicador criado automaticamente — RF-36)', () => {
  function renderizar(props: Partial<DialogoDefinirMetaProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(dados: DadosMeta) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <DialogoDefinirMeta
        indicador={props.indicador === undefined ? AUTOMATICO : props.indicador}
        definindo={props.definindo ?? false}
        erro={props.erro ?? null}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onConfirmar, onCancelar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Definir meta' })
  const meta = () => within(dialogo()).getByRole('textbox', { name: 'Meta' })
  const sentido = () => within(dialogo()).getByRole('combobox', { name: 'Sentido' })
  const metaEditavel = () => within(dialogo()).getByRole('checkbox', { name: 'Meta editável no preenchimento' })
  const confirmar = () => within(dialogo()).getByRole('button', { name: 'Definir meta' })

  async function escolher(user: Usuario, select: HTMLElement, rotulo: string) {
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  it('com indicador null não renderiza nada', () => {
    renderizar({ indicador: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre "Definir meta" com o nome do indicador e o dado externo de origem', () => {
    renderizar()

    expect(dialogo()).toHaveTextContent('Indicador de devoluções')
    expect(within(dialogo()).getByText('Dado externo de origem: Devoluções (dado externo)')).toBeInTheDocument()
  })

  it('tem Meta e Sentido obrigatórios (Sentido inicia em "Selecione") e "Meta editável no preenchimento" desmarcada', () => {
    renderizar()

    expect(meta()).toHaveAttribute('aria-required', 'true')
    expect(sentido()).toHaveAttribute('aria-required', 'true')
    expect(sentido()).toHaveValue('')
    expect(within(sentido()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Selecione', 'Maior é melhor', 'Menor é melhor (custo)'])
    expect(metaEditavel()).not.toBeChecked()
  })

  it('não há campo de cálculo (composição por dado externo)', () => {
    renderizar()

    expect(within(dialogo()).queryByRole('combobox', { name: 'Cálculo do realizado' })).not.toBeInTheDocument()
  })

  it('tem "Definir meta" (submit) e "Cancelar"; Cancelar e Esc chamam onCancelar sem confirmar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar()

    expect(confirmar()).toHaveAttribute('type', 'submit')
    await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onCancelar).toHaveBeenCalledTimes(2)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('enviar vazio mostra "Informe uma meta maior que zero." e "Selecione o sentido." sem chamar onConfirmar', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.click(confirmar())

    expect(within(dialogo()).getByText('Informe uma meta maior que zero.')).toBeInTheDocument()
    expect(within(dialogo()).getByText('Selecione o sentido.')).toBeInTheDocument()
    expect(meta()).toHaveAttribute('aria-invalid', 'true')
    expect(sentido()).toHaveAttribute('aria-invalid', 'true')
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it.each(['0', '0,00', '-10', 'abc'])('meta "%s" é recusada com "Informe uma meta maior que zero."', async (valor) => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()
    await user.type(meta(), valor)
    await escolher(user, sentido(), 'Maior é melhor')

    await user.click(confirmar())

    expect(within(dialogo()).getByText('Informe uma meta maior que zero.')).toBeInTheDocument()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('confirma com meta (vírgula decimal aceita), sentido e meta editável', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()
    await user.type(meta(), '2.500,75')
    await escolher(user, sentido(), 'Menor é melhor (custo)')
    await user.click(metaEditavel())

    await user.click(confirmar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith({ meta: 2500.75, sentido: 'menor_melhor', metaEditavel: true })
  })

  it('meta inteira e meta editável desmarcada', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()
    await user.type(meta(), '2500')
    await escolher(user, sentido(), 'Maior é melhor')

    await user.click(confirmar())

    expect(onConfirmar).toHaveBeenCalledWith({ meta: 2500, sentido: 'maior_melhor', metaEditavel: false })
  })

  it('com definindo, o botão "Definir meta" fica desabilitado', () => {
    renderizar({ definindo: true })

    expect(confirmar()).toBeDisabled()
  })

  it('exibe o erro da API em um alerta dentro do diálogo, mantendo os valores digitados', async () => {
    const user = usuarioRapido()
    const { rerender, onConfirmar, onCancelar } = renderizar()
    await user.type(meta(), '2500')

    rerender(
      <DialogoDefinirMeta
        indicador={AUTOMATICO}
        definindo={false}
        erro="A meta deste indicador já foi definida."
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )

    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('A meta deste indicador já foi definida.')
    expect(meta()).toHaveValue('2500')
  })
})
