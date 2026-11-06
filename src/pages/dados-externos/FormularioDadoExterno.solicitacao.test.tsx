import { render, screen, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { identificadoresApi } from '../../test/dadosExternosFalsos'
import type { NovoDadoExterno } from '../../types/dominio'
import { FormularioDadoExterno } from './FormularioDadoExterno'

describe('F5.6 — FormularioDadoExterno variante solicitação (Validador/Preenchedor): campo ou cálculo obrigatório (RF-27)', () => {
  function renderizar() {
    const onSalvar = vi.fn<(dados: NovoDadoExterno) => void>()
    render(
      <FormularioDadoExterno
        tipos={[TIPOS_DO_USUARIO_API[0]]}
        variante="solicitacao"
        identificadores={identificadoresApi()}
        salvando={false}
        erro={null}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onSalvar }
  }

  const campoCalculo = () => screen.getByRole('textbox', { name: 'Campo ou cálculo' })
  const observacao = () => screen.getByRole('textbox', { name: 'Observação para a TI' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })

  async function escolher(user: Usuario, nomeCampo: string, rotulo: string) {
    const select = screen.getByRole('combobox', { name: nomeCampo })
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  async function preencherComuns(user: Usuario) {
    await colar(user, screen.getByRole('textbox', { name: 'Nome' }), 'Devoluções de venda')
    await escolher(user, 'Tipo', 'Comercial')
    await escolher(user, 'Sistema de origem', 'Senior ERP (Sapiens)')
    await escolher(user, 'Tipo de valor', 'Numeral')
    await escolher(user, 'Referência', 'Filial')
    await escolher(user, 'Coleta', 'Data específica do mês')
    await user.type(screen.getByRole('spinbutton', { name: 'Dia' }), '5')
    await escolher(user, 'Sentido do cálculo', 'Somar')
    await escolher(user, 'Janela retroativa', 'Somente o mês')
  }

  it('tem "Campo ou cálculo" (área de texto, obrigatório) e "Observação para a TI" (opcional)', () => {
    renderizar()

    expect(campoCalculo().tagName).toBe('TEXTAREA')
    expect(campoCalculo()).toHaveAttribute('aria-required', 'true')
    expect(observacao().tagName).toBe('TEXTAREA')
    expect(observacao()).not.toHaveAttribute('aria-required', 'true')
  })

  it('avisa que "Ao salvar, será aberta uma tarefa para a equipe de TI." (FRONT-tarefas-bitrix.md, seção 1)', () => {
    renderizar()

    expect(screen.getByText('Ao salvar, será aberta uma tarefa para a equipe de TI.')).toBeInTheDocument()
  })

  it('não tem o campo "Identificador da consulta" nem a lista de identificadores (a TI define depois)', () => {
    renderizar()

    expect(screen.queryByLabelText('Identificador da consulta')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Identificadores existentes' })).not.toBeInTheDocument()
  })

  it('sem campo ou cálculo mostra "Descreva o campo a buscar ou o cálculo a fazer." e não salva', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user)
    await user.type(campoCalculo(), '   ')

    await user.click(salvar())

    expect(screen.getByText('Descreva o campo a buscar ou o cálculo a fazer.')).toBeInTheDocument()
    expect(campoCalculo()).toHaveAttribute('aria-invalid', 'true')
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('envia campoCalculo e observacao sem espaços nas pontas, com identificador null', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user)
    await colar(user, campoCalculo(), '  Soma do valor líquido das notas de devolução.  ')
    await colar(user, observacao(), '  Usar a tabela de notas fiscais.  ')

    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
    expect(onSalvar).toHaveBeenCalledWith({
      nome: 'Devoluções de venda',
      idTipo: 1,
      sistemaOrigem: 'senior_erp',
      tipoValor: 'numeral',
      referencia: 'filial',
      coleta: 'dia do mes',
      diaDaColeta: 5,
      sentidoCalculo: 'soma',
      janelaRetroativa: 1,
      comentarios: null,
      campoCalculo: 'Soma do valor líquido das notas de devolução.',
      identificador: null,
      observacao: 'Usar a tabela de notas fiscais.',
    })
  })

  it('observação em branco é enviada como null', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user)
    await colar(user, campoCalculo(), 'Soma das devoluções')
    await user.type(observacao(), '   ')

    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ observacao: null, identificador: null }))
  })

  it('as regras comuns continuam valendo: "Outro sistema" exige comentários', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user)
    await colar(user, campoCalculo(), 'Soma das devoluções')
    await escolher(user, 'Sistema de origem', 'Outro sistema')

    await user.click(salvar())

    expect(screen.getByText('Informe nos comentários qual é o sistema de origem.')).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })
})
