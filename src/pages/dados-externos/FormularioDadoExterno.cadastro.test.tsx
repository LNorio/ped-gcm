import { render, screen, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import type { NovoDadoExterno } from '../../types/dominio'
import { FormularioDadoExterno, type FormularioDadoExternoProps } from './FormularioDadoExterno'

/**
 * Campos comuns do cadastro (RF-25) e ausência de edição (RF-29). Os testes usam a variante Admin
 * (preenchendo o identificador e o campo ou cálculo) quando precisam enviar o formulário; as regras específicas de cada
 * variante estão em `*.admin.test.tsx` (F5.5) e `*.solicitacao.test.tsx` (F5.6).
 */
describe('F5.4 — FormularioDadoExterno: campos comuns do cadastro (RF-25, RF-29)', () => {
  function renderizar(props: Partial<FormularioDadoExternoProps> = {}) {
    const onSalvar = props.onSalvar ?? vi.fn<(dados: NovoDadoExterno) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <FormularioDadoExterno
        tipos={props.tipos ?? TIPOS_DO_USUARIO_API}
        variante={props.variante ?? 'admin'}
        identificadores={props.identificadores ?? []}
        salvando={props.salvando ?? false}
        erro={props.erro ?? null}
        onSalvar={onSalvar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onSalvar, onCancelar }
  }

  const nome = () => screen.getByRole('textbox', { name: 'Nome' })
  const tipo = () => screen.getByRole('combobox', { name: 'Tipo' })
  const origem = () => screen.getByRole('combobox', { name: 'Sistema de origem' })
  const tipoValor = () => screen.getByRole('combobox', { name: 'Tipo de valor' })
  const referencia = () => screen.getByRole('combobox', { name: 'Referência' })
  const coleta = () => screen.getByRole('combobox', { name: 'Coleta' })
  const dia = () => screen.getByRole('spinbutton', { name: 'Dia' })
  const sentido = () => screen.getByRole('combobox', { name: 'Sentido do cálculo' })
  const janela = () => screen.getByRole('combobox', { name: 'Janela retroativa' })
  const comentarios = () => screen.getByRole('textbox', { name: 'Comentários' })
  const identificador = () => screen.getByLabelText('Identificador da consulta')
  const campoCalculo = () => screen.getByRole('textbox', { name: 'Campo ou cálculo' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })

  const textos = (select: HTMLElement) => within(select).getAllByRole('option').map((opcao) => opcao.textContent)

  async function escolher(user: Usuario, select: HTMLElement, rotulo: string) {
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  /** Preenche todos os campos obrigatórios com valores válidos (coleta diária, soma em 3 meses). */
  async function preencherValido(user: Usuario) {
    await colar(user, nome(), '  Faturamento líquido  ')
    await escolher(user, tipo(), 'Comercial')
    await escolher(user, origem(), 'Senior ERP (Sapiens)')
    await escolher(user, tipoValor(), 'Numeral')
    await escolher(user, referencia(), 'Filial')
    await escolher(user, coleta(), 'Diária')
    await escolher(user, sentido(), 'Somar')
    await escolher(user, janela(), '3 meses')
    await user.type(identificador(), 'FATURAMENTO')
    await colar(user, campoCalculo(), 'Soma do valor líquido das notas de venda.')
  }

  describe('campos e opções', () => {
    it('tem Nome, Tipo, Sistema de origem, Tipo de valor, Referência, Coleta, Sentido do cálculo, Janela retroativa e Comentários', () => {
      renderizar()

      for (const campo of [nome, tipo, origem, tipoValor, referencia, coleta, sentido, janela, comentarios]) {
        expect(campo()).toBeInTheDocument()
      }
      expect(comentarios().tagName).toBe('TEXTAREA')
    })

    it('Nome, Tipo, Sistema de origem, Tipo de valor, Referência, Coleta, Sentido do cálculo e Janela retroativa são obrigatórios (aria-required)', () => {
      renderizar()

      for (const campo of [nome, tipo, origem, tipoValor, referencia, coleta, sentido, janela]) {
        expect(campo()).toHaveAttribute('aria-required', 'true')
      }
    })

    it('Tipo oferece "Selecione" e os tipos recebidos, na ordem', () => {
      renderizar()

      expect(textos(tipo())).toEqual(['Selecione', 'Comercial', 'Financeiro', 'Recursos Humanos', 'Tecnologia da Informação'])
      expect(tipo()).toHaveValue('')
    })

    it('Sistema de origem oferece Senior ERP (Sapiens), Senior HCM, Bitrix24 e Outro sistema', () => {
      renderizar()

      expect(textos(origem())).toEqual(['Selecione', 'Senior ERP (Sapiens)', 'Senior HCM', 'Bitrix24', 'Outro sistema'])
    })

    it('Tipo de valor oferece Porcentagem, Numeral e Booleano', () => {
      renderizar()

      expect(textos(tipoValor())).toEqual(['Selecione', 'Porcentagem', 'Numeral', 'Booleano'])
    })

    it('Referência oferece Filial, Colaborador e Zona de venda, todas habilitadas', () => {
      renderizar()

      expect(textos(referencia())).toEqual(['Selecione', 'Filial', 'Colaborador', 'Zona de venda'])
      for (const rotulo of ['Filial', 'Colaborador', 'Zona de venda']) {
        expect(within(referencia()).getByRole('option', { name: rotulo })).toBeEnabled()
      }
    })

    it('Coleta oferece Diária e Data específica do mês', () => {
      renderizar()

      expect(textos(coleta())).toEqual(['Selecione', 'Diária', 'Data específica do mês'])
    })

    it('Sentido do cálculo oferece Somar, Fazer a média e Usar só o último valor', () => {
      renderizar()

      expect(textos(sentido())).toEqual(['Selecione', 'Somar', 'Fazer a média', 'Usar só o último valor'])
    })

    it('Janela retroativa oferece Somente o mês, 2, 3, 6, 12 e 24 meses', () => {
      renderizar()

      expect(textos(janela())).toEqual(['Selecione', 'Somente o mês', '2 meses', '3 meses', '6 meses', '12 meses', '24 meses'])
    })

    it('tem "Salvar" (submit) e "Cancelar"; Cancelar chama onCancelar sem salvar', async () => {
      const user = usuarioRapido()
      const { onSalvar, onCancelar } = renderizar()

      expect(salvar()).toHaveAttribute('type', 'submit')
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('não tem campo de situação nem ação de editar (o dado não é editável depois de salvo — RF-29)', () => {
      renderizar()

      expect(screen.queryByLabelText(/situa/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    })
  })

  describe('campos condicionais', () => {
    it('"Dia" só aparece com a coleta "Data específica do mês" e é obrigatório', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(screen.queryByRole('spinbutton', { name: 'Dia' })).not.toBeInTheDocument()
      await escolher(user, coleta(), 'Data específica do mês')
      expect(dia()).toHaveAttribute('aria-required', 'true')

      await escolher(user, coleta(), 'Diária')
      expect(screen.queryByRole('spinbutton', { name: 'Dia' })).not.toBeInTheDocument()
    })

    it('"Janela retroativa" fica oculta quando o sentido é "Usar só o último valor" e volta nos demais', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolher(user, sentido(), 'Usar só o último valor')
      expect(screen.queryByRole('combobox', { name: 'Janela retroativa' })).not.toBeInTheDocument()

      await escolher(user, sentido(), 'Fazer a média')
      expect(janela()).toBeInTheDocument()
    })

    it('Comentários só é obrigatório quando a origem é "Outro sistema"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(comentarios()).not.toHaveAttribute('aria-required', 'true')
      await escolher(user, origem(), 'Outro sistema')
      expect(comentarios()).toHaveAttribute('aria-required', 'true')
      await escolher(user, origem(), 'Senior HCM')
      expect(comentarios()).not.toHaveAttribute('aria-required', 'true')
    })
  })

  describe('validação (sem chamar onSalvar)', () => {
    it('enviar vazio mostra a mensagem de cada campo obrigatório comum e marca os campos como inválidos', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(salvar())

      for (const mensagem of [
        'Informe o nome.',
        'Selecione o tipo.',
        'Selecione o sistema de origem.',
        'Selecione o tipo de valor.',
        'Selecione a referência.',
        'Selecione a coleta.',
        'Selecione o sentido do cálculo.',
        'Selecione a janela retroativa.',
      ]) {
        expect(screen.getByText(mensagem)).toBeInTheDocument()
      }
      for (const campo of [nome, tipo, origem, tipoValor, referencia, coleta, sentido, janela]) {
        expect(campo()).toHaveAttribute('aria-invalid', 'true')
      }
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('nome só com espaços conta como vazio', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await user.clear(nome())
      await user.type(nome(), '   ')

      await user.click(salvar())

      expect(screen.getByText('Informe o nome.')).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it.each(['', '0', '32', '1.5'])('coleta "Data específica do mês" com dia "%s" mostra "Informe o dia da coleta, de 1 a 31."', async (valor) => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, coleta(), 'Data específica do mês')
      if (valor !== '') await user.type(dia(), valor)

      await user.click(salvar())

      expect(screen.getByText('Informe o dia da coleta, de 1 a 31.')).toBeInTheDocument()
      expect(dia()).toHaveAttribute('aria-invalid', 'true')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('"Outro sistema" sem comentários mostra "Informe nos comentários qual é o sistema de origem."', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, origem(), 'Outro sistema')
      await user.type(comentarios(), '   ')

      await user.click(salvar())

      expect(screen.getByText('Informe nos comentários qual é o sistema de origem.')).toBeInTheDocument()
      expect(comentarios()).toHaveAttribute('aria-invalid', 'true')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('com sentido "Usar só o último valor", a janela não é exigida', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, sentido(), 'Usar só o último valor')

      await user.click(salvar())

      expect(screen.queryByText('Selecione a janela retroativa.')).not.toBeInTheDocument()
      expect(onSalvar).toHaveBeenCalledTimes(1)
    })
  })

  describe('envio (onSalvar recebe NovoDadoExterno)', () => {
    it('com os campos válidos chama onSalvar uma vez com os valores tratados (nome sem espaços nas pontas)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith(
        expect.objectContaining({
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
        }),
      )
    })

    it('coleta no dia 31 envia coleta "dia do mes" e diaDaColeta 31; dia 1 também é aceito', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, coleta(), 'Data específica do mês')
      await user.type(dia(), '31')

      await user.click(salvar())
      expect(onSalvar).toHaveBeenLastCalledWith(expect.objectContaining({ coleta: 'dia do mes', diaDaColeta: 31 }))

      await user.clear(dia())
      await user.type(dia(), '1')
      await user.click(salvar())
      expect(onSalvar).toHaveBeenLastCalledWith(expect.objectContaining({ coleta: 'dia do mes', diaDaColeta: 1 }))
    })

    it('voltar a coleta para "Diária" envia diaDaColeta null', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, coleta(), 'Data específica do mês')
      await user.type(dia(), '10')
      await escolher(user, coleta(), 'Diária')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ coleta: 'diaria', diaDaColeta: null }))
    })

    it('sentido "Usar só o último valor" envia sentidoCalculo "ultimo" e janelaRetroativa null', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, sentido(), 'Usar só o último valor')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ sentidoCalculo: 'ultimo', janelaRetroativa: null }))
    })

    it('"Somente o mês" envia janelaRetroativa 1 e "Fazer a média" envia "media"', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, sentido(), 'Fazer a média')
      await escolher(user, janela(), 'Somente o mês')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ sentidoCalculo: 'media', janelaRetroativa: 1 }))
    })

    it('"Outro sistema" com comentários envia sistemaOrigem "outro" e o comentário sem espaços nas pontas', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, origem(), 'Outro sistema')
      await colar(user, comentarios(), '  Sistema GLPI  ')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ sistemaOrigem: 'outro', comentarios: 'Sistema GLPI' }))
    })

    it('comentários opcionais preenchidos em outra origem também são enviados', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await colar(user, comentarios(), 'Relatório de vendas por filial')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ comentarios: 'Relatório de vendas por filial' }))
    })

    it.each([
      ['Colaborador', 'colaborador'],
      ['Zona de venda', 'zona'],
    ])('referência "%s" é enviada como "%s" (a liberação é decidida pela API)', async (rotulo, valor) => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, referencia(), rotulo)

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ referencia: valor }))
    })

    it('Senior HCM, Bitrix24, Porcentagem e Booleano são enviados com os valores da API', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherValido(user)
      await escolher(user, origem(), 'Bitrix24')
      await escolher(user, tipoValor(), 'Booleano')

      await user.click(salvar())
      expect(onSalvar).toHaveBeenLastCalledWith(expect.objectContaining({ sistemaOrigem: 'bitrix24', tipoValor: 'booleano' }))

      await escolher(user, origem(), 'Senior HCM')
      await escolher(user, tipoValor(), 'Porcentagem')
      await user.click(salvar())
      expect(onSalvar).toHaveBeenLastCalledWith(expect.objectContaining({ sistemaOrigem: 'senior_hcm', tipoValor: 'porcentagem' }))
    })
  })

  describe('estado de envio e erro da API', () => {
    it('com salvando, "Salvar" fica desabilitado', () => {
      renderizar({ salvando: true })

      expect(salvar()).toBeDisabled()
    })

    it('erro da API aparece em alerta dentro do formulário sem apagar o que foi digitado', async () => {
      const user = usuarioRapido()
      const { rerender, onSalvar, onCancelar } = renderizar()
      await preencherValido(user)

      rerender(
        <FormularioDadoExterno
          tipos={TIPOS_DO_USUARIO_API}
          variante="admin"
          identificadores={[]}
          salvando={false}
          erro="A referência colaborador ainda não está disponível."
          onSalvar={onSalvar}
          onCancelar={onCancelar}
        />,
      )

      expect(screen.getByRole('alert')).toHaveTextContent('A referência colaborador ainda não está disponível.')
      expect(nome()).toHaveValue('  Faturamento líquido  ')
      expect((within(janela()).getByRole('option', { name: '3 meses' }) as HTMLOptionElement).selected).toBe(true)
    })
  })
})
