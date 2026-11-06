import { render, screen, within } from '@testing-library/react'
import { colar, usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import { DADO_DEVOLUCOES_API, identificadoresApi } from '../../test/dadosExternosFalsos'
import { DialogoConcluirConstrucao, type DialogoConcluirConstrucaoProps } from './DialogoConcluirConstrucao'

const DEVOLUCOES = paraDadoExterno(DADO_DEVOLUCOES_API)

describe('F5.7 — DialogoConcluirConstrucao (Admin informa o identificador criado pela TI — RF-28)', () => {
  function renderizar(props: Partial<DialogoConcluirConstrucaoProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(identificador: string) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <DialogoConcluirConstrucao
        dado={props.dado === undefined ? DEVOLUCOES : props.dado}
        identificadores={props.identificadores ?? identificadoresApi()}
        concluindo={props.concluindo ?? false}
        erro={props.erro ?? null}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onConfirmar, onCancelar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Concluir construção' })
  const identificador = () => within(dialogo()).getByLabelText('Identificador da consulta') as HTMLInputElement
  const concluir = () => within(dialogo()).getByRole('button', { name: 'Concluir' })

  it('com dado null não renderiza nada', () => {
    renderizar({ dado: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre o diálogo "Concluir construção" citando o dado e com o campo "Identificador da consulta" obrigatório', () => {
    renderizar()

    expect(dialogo()).toHaveTextContent('Devoluções de venda')
    expect(identificador()).toHaveAttribute('aria-required', 'true')
    expect(identificador()).toHaveValue('')
    expect(concluir()).toBeEnabled()
    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it.each(['   ', 'çã !/@'])('sem identificador (só "%s", descartado) mostra "Informe o identificador da consulta." e não confirma', async (texto) => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.type(identificador(), texto)
    expect(identificador()).toHaveValue('')
    await user.click(concluir())

    expect(within(dialogo()).getByText('Informe o identificador da consulta.')).toBeInTheDocument()
    expect(identificador()).toHaveAttribute('aria-invalid', 'true')
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('converte para maiúsculas ao digitar, descarta os espaços e confirma com o identificador limpo', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.type(identificador(), ' devolucoes_venda ')
    expect(identificador()).toHaveValue('DEVOLUCOES_VENDA')
    await user.click(concluir())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith('DEVOLUCOES_VENDA')
  })

  describe('só A–Z, 0–9, "_", "-" e "." (regra do back-end de 06/11/2026): caracteres inválidos são descartados na hora', () => {
    it.each([
      ['ação ok', 'AOOK'],
      ['NOVOS-CLIENTES 2', 'NOVOS-CLIENTES2'],
      ['novos_clientes', 'NOVOS_CLIENTES'],
      ['fat.liq-2026 /!', 'FAT.LIQ-2026'],
    ])('ao digitar "%s" o campo mostra "%s"', async (texto, esperado) => {
      const user = usuarioRapido()
      renderizar()

      await user.type(identificador(), texto)

      expect(identificador()).toHaveValue(esperado)
    })

    it.each([
      ['ação ok', 'AOOK'],
      ['NOVOS-CLIENTES 2', 'NOVOS-CLIENTES2'],
      ['novos_clientes', 'NOVOS_CLIENTES'],
    ])('ao colar "%s" o campo mostra "%s"', async (texto, esperado) => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, identificador(), texto)

      expect(identificador()).toHaveValue(esperado)
    })

    it('confirma com o identificador já limpo', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await colar(user, identificador(), 'Devoluções de venda-2')
      await user.click(concluir())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith('DEVOLUESDEVENDA-2')
    })

    it('escolher uma sugestão com caracteres inválidos preenche o campo com o identificador limpo, que é o confirmado', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ identificadores: [{ identificador: 'vendas líq-2', quantidade: 1 }] })

      const grupo = within(dialogo()).getByRole('group', { name: 'Identificadores existentes' })
      await user.click(within(grupo).getByRole('button', { name: /usado por 1 dado\(s\)/ }))
      expect(identificador()).toHaveValue('VENDASLQ-2')

      await user.click(concluir())
      expect(onConfirmar).toHaveBeenCalledWith('VENDASLQ-2')
    })
  })

  it('mostra as sugestões "{IDENTIFICADOR} — usado por {n} dado(s)"; clicar preenche o campo', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    const grupo = within(dialogo()).getByRole('group', { name: 'Identificadores existentes' })
    expect(within(grupo).getAllByRole('button')).toHaveLength(4)
    await user.click(within(grupo).getByRole('button', { name: 'FATURAMENTO — usado por 1 dado(s)' }))
    expect(identificador()).toHaveValue('FATURAMENTO')

    await user.click(concluir())
    expect(onConfirmar).toHaveBeenCalledWith('FATURAMENTO')
  })

  it('sem identificadores recebidos não mostra a lista de sugestões', () => {
    renderizar({ identificadores: [] })

    expect(within(dialogo()).queryByRole('group', { name: 'Identificadores existentes' })).not.toBeInTheDocument()
  })

  it('com concluindo, "Concluir" fica desabilitado', () => {
    renderizar({ concluindo: true })

    expect(concluir()).toBeDisabled()
  })

  it('exibe o erro recebido em alerta dentro do diálogo, mantendo o identificador digitado', async () => {
    const user = usuarioRapido()
    const { rerender, onConfirmar, onCancelar } = renderizar()
    await user.type(identificador(), 'xpto')

    rerender(
      <DialogoConcluirConstrucao
        dado={DEVOLUCOES}
        identificadores={[]}
        concluindo={false}
        erro="Identificador sem coleta cadastrada."
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )

    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Identificador sem coleta cadastrada.')
    expect(identificador()).toHaveValue('XPTO')
  })

  it('Cancelar e Esc chamam onCancelar sem confirmar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar()

    await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onCancelar).toHaveBeenCalledTimes(2)
    expect(onConfirmar).not.toHaveBeenCalled()
  })
})
