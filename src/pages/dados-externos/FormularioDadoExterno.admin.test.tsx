import { render, screen, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { identificadoresApi } from '../../test/dadosExternosFalsos'
import type { NovoDadoExterno } from '../../types/dominio'
import { FormularioDadoExterno, type FormularioDadoExternoProps } from './FormularioDadoExterno'

describe('F5.5 — FormularioDadoExterno variante Admin: identificador da consulta obrigatório, em maiúsculas e só com A–Z, 0–9 e "_", e campo ou cálculo obrigatório (RF-26)', () => {
  function renderizar(props: Partial<FormularioDadoExternoProps> = {}) {
    const onSalvar = props.onSalvar ?? vi.fn<(dados: NovoDadoExterno) => void>()
    render(
      <FormularioDadoExterno
        tipos={TIPOS_DO_USUARIO_API}
        variante="admin"
        identificadores={props.identificadores ?? identificadoresApi()}
        salvando={false}
        erro={null}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onSalvar }
  }

  const identificador = () => screen.getByLabelText('Identificador da consulta') as HTMLInputElement
  const campoCalculo = () => screen.getByRole('textbox', { name: 'Campo ou cálculo' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })
  const sugestoes = () => screen.queryByRole('group', { name: 'Identificadores existentes' })

  async function escolher(user: Usuario, nomeCampo: string, rotulo: string) {
    const select = screen.getByRole('combobox', { name: nomeCampo })
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  /** Preenche os campos comuns e, salvo `comCampoCalculo: false`, o "Campo ou cálculo". */
  async function preencherComuns(user: Usuario, { comCampoCalculo = true }: { comCampoCalculo?: boolean } = {}) {
    await colar(user, screen.getByRole('textbox', { name: 'Nome' }), 'Faturamento líquido')
    await escolher(user, 'Tipo', 'Comercial')
    await escolher(user, 'Sistema de origem', 'Senior ERP (Sapiens)')
    await escolher(user, 'Tipo de valor', 'Numeral')
    await escolher(user, 'Referência', 'Filial')
    await escolher(user, 'Coleta', 'Diária')
    await escolher(user, 'Sentido do cálculo', 'Somar')
    await escolher(user, 'Janela retroativa', '3 meses')
    if (comCampoCalculo) await colar(user, campoCalculo(), 'Soma do valor líquido das notas de venda.')
  }

  it('tem o campo "Identificador da consulta", obrigatório', () => {
    renderizar()

    expect(identificador()).toBeInTheDocument()
    expect(identificador()).toHaveAttribute('aria-required', 'true')
  })

  it('tem o campo "Campo ou cálculo" (área de texto, obrigatório)', () => {
    renderizar()

    expect(campoCalculo().tagName).toBe('TEXTAREA')
    expect(campoCalculo()).toHaveAttribute('aria-required', 'true')
  })

  it('não tem "Observação para a TI" (própria do pedido de construção)', () => {
    renderizar()

    expect(screen.queryByLabelText('Observação para a TI')).not.toBeInTheDocument()
  })

  it('sem campo ou cálculo mostra "Descreva o campo a buscar ou o cálculo a fazer." e não salva', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user, { comCampoCalculo: false })
    await user.type(identificador(), 'FATURAMENTO')

    await user.click(salvar())

    expect(screen.getByText('Descreva o campo a buscar ou o cálculo a fazer.')).toBeInTheDocument()
    expect(campoCalculo()).toHaveAttribute('aria-invalid', 'true')
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('campo ou cálculo só com espaços conta como vazio', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user, { comCampoCalculo: false })
    await user.type(identificador(), 'FATURAMENTO')
    await user.type(campoCalculo(), '   ')

    await user.click(salvar())

    expect(screen.getByText('Descreva o campo a buscar ou o cálculo a fazer.')).toBeInTheDocument()
    expect(campoCalculo()).toHaveAttribute('aria-invalid', 'true')
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('sem identificador e sem campo ou cálculo mostra as duas mensagens', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user, { comCampoCalculo: false })

    await user.click(salvar())

    expect(screen.getByText('Informe o identificador da consulta.')).toBeInTheDocument()
    expect(screen.getByText('Descreva o campo a buscar ou o cálculo a fazer.')).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('sem identificador mostra "Informe o identificador da consulta." e não salva', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user)

    await user.click(salvar())

    expect(screen.getByText('Informe o identificador da consulta.')).toBeInTheDocument()
    expect(identificador()).toHaveAttribute('aria-invalid', 'true')
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it.each(['   ', 'çã -.!'])('identificador só com espaços ou caracteres inválidos ("%s") fica vazio e conta como vazio', async (texto) => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user)
    await user.type(identificador(), texto)
    expect(identificador()).toHaveValue('')

    await user.click(salvar())

    expect(screen.getByText('Informe o identificador da consulta.')).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('o texto digitado é convertido para maiúsculas no próprio campo, descartando o que não é A–Z, 0–9 ou "_"', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.type(identificador(), 'fat_liq.filial-1')

    expect(identificador()).toHaveValue('FAT_LIQFILIAL1')
  })

  describe('caracteres inválidos são descartados na hora (acentos, espaço e caracteres especiais)', () => {
    it.each([
      ['ação ok', 'AOOK'],
      ['NOVOS-CLIENTES 2', 'NOVOSCLIENTES2'],
      ['novos_clientes', 'NOVOS_CLIENTES'],
    ])('ao digitar "%s" o campo mostra "%s"', async (texto, esperado) => {
      const user = usuarioRapido()
      renderizar()

      await user.type(identificador(), texto)

      expect(identificador()).toHaveValue(esperado)
    })

    it.each([
      ['ação ok', 'AOOK'],
      ['NOVOS-CLIENTES 2', 'NOVOSCLIENTES2'],
      ['novos_clientes', 'NOVOS_CLIENTES'],
    ])('ao colar "%s" o campo mostra "%s"', async (texto, esperado) => {
      const user = usuarioRapido()
      renderizar()

      await colar(user, identificador(), texto)

      expect(identificador()).toHaveValue(esperado)
    })

    it('o campo nunca mostra caractere inválido, mesmo digitando no meio de um identificador válido', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(identificador(), 'abc')
      await user.type(identificador(), ' é-')
      await user.type(identificador(), '_9')

      expect(identificador()).toHaveValue('ABC_9')
      expect(identificador().value).toMatch(/^[A-Z0-9_]*$/)
    })

    it('envia o identificador já limpo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)
      await colar(user, identificador(), 'Novos-Clientes Ação 2')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ identificador: 'NOVOSCLIENTESAO2' }))
    })
  })

  it('envia o identificador em maiúsculas e sem espaços e o campo ou cálculo sem espaços nas pontas, com observacao null', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherComuns(user, { comCampoCalculo: false })
    await colar(user, campoCalculo(), '  Soma do valor líquido das notas de venda.  ')
    await user.type(identificador(), '  faturamento ')

    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
    expect(onSalvar).toHaveBeenCalledWith({
      nome: 'Faturamento líquido',
      idTipo: 1,
      sistemaOrigem: 'senior_erp',
      tipoValor: 'numeral',
      referencia: 'filial',
      coleta: 'diaria',
      diaDaColeta: null,
      sentidoCalculo: 'soma',
      janelaRetroativa: 3,
      comentarios: null,
      campoCalculo: 'Soma do valor líquido das notas de venda.',
      identificador: 'FATURAMENTO',
      observacao: null,
    })
  })

  describe('sugestões a partir da lista de identificadores', () => {
    it('mostra cada identificador existente em maiúsculas com quantos dados o usam', () => {
      renderizar()

      const grupo = sugestoes()!
      expect(within(grupo).getAllByRole('button').map((botao) => botao.textContent)).toEqual([
        'FATURAMENTO — usado por 1 dado(s)',
        'COBERTURA — usado por 1 dado(s)',
        'VOLUME_VENDAS — usado por 2 dado(s)',
        'NOVOS_CLIENTES — usado por 0 dado(s)',
      ])
    })

    it('filtra as sugestões pelo texto digitado, sem diferenciar maiúsculas', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.type(identificador(), 'vol')

      expect(within(sugestoes()!).getAllByRole('button').map((botao) => botao.textContent)).toEqual([
        'VOLUME_VENDAS — usado por 2 dado(s)',
      ])
    })

    it('clicar em uma sugestão preenche o campo com o identificador em maiúsculas', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherComuns(user)

      await user.click(within(sugestoes()!).getByRole('button', { name: 'NOVOS_CLIENTES — usado por 0 dado(s)' }))
      expect(identificador()).toHaveValue('NOVOS_CLIENTES')

      await user.click(salvar())
      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ identificador: 'NOVOS_CLIENTES' }))
    })

    it('escolher uma sugestão com caracteres inválidos preenche o campo com o identificador limpo, que é o enviado', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ identificadores: [{ identificador: 'vendas líq-2', quantidade: 1 }] })
      await preencherComuns(user)

      await user.click(within(sugestoes()!).getByRole('button', { name: /usado por 1 dado\(s\)/ }))
      expect(identificador()).toHaveValue('VENDASLQ2')

      await user.click(salvar())
      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ identificador: 'VENDASLQ2' }))
    })

    it('sem identificadores recebidos não há lista de sugestões e o campo continua livre', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ identificadores: [] })
      await preencherComuns(user)

      expect(sugestoes()).not.toBeInTheDocument()
      await user.type(identificador(), 'novo_codigo')
      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ identificador: 'NOVO_CODIGO' }))
    })
  })
})
