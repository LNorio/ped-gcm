import { render, screen, within } from '@testing-library/react'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import type { NovoApontamento } from '../../types/dominio'
import { FormularioApontamento, type FormularioApontamentoProps } from './FormularioApontamento'

describe('F4.4 — FormularioApontamento (cadastro de apontamento)', () => {
  function renderizar(props: Partial<FormularioApontamentoProps> = {}) {
    const onSalvar = props.onSalvar ?? vi.fn<(dados: NovoApontamento) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <FormularioApontamento
        tipos={props.tipos ?? TIPOS_DO_USUARIO_API}
        salvando={props.salvando ?? false}
        erro={props.erro ?? null}
        onSalvar={onSalvar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onSalvar, onCancelar }
  }

  const campoNome = () => screen.getByRole('textbox', { name: 'Nome' })
  const selectTipo = () => screen.getByRole('combobox', { name: 'Tipo' })
  const selectTipoValor = () => screen.getByRole('combobox', { name: 'Tipo de valor' })
  const campoDescricao = () => screen.getByRole('textbox', { name: 'Descrição' })
  const botaoSalvar = () => screen.getByRole('button', { name: 'Salvar' })

  async function preencherValido(user: Usuario) {
    await user.type(campoNome(), 'Visitas a clientes novos')
    await user.selectOptions(selectTipo(), within(selectTipo()).getByRole('option', { name: 'Comercial' }))
    await user.selectOptions(selectTipoValor(), within(selectTipoValor()).getByRole('option', { name: 'Numeral' }))
  }

  describe('campos', () => {
    it('tem os campos Nome, Tipo, Tipo de valor e Descrição, todos com rótulo associado', () => {
      renderizar()

      expect(campoNome()).toBeInTheDocument()
      expect(selectTipo()).toBeInTheDocument()
      expect(selectTipoValor()).toBeInTheDocument()
      expect(campoDescricao()).toBeInTheDocument()
      expect(campoDescricao().tagName).toBe('TEXTAREA')
    })

    it('o select Tipo oferece "Selecione" (desabilitado, selecionado) e os tipos recebidos, na ordem', () => {
      renderizar()

      const opcoes = within(selectTipo()).getAllByRole('option')
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
        'Selecione',
        'Comercial',
        'Financeiro',
        'Recursos Humanos',
        'Tecnologia da Informação',
      ])
      expect(opcoes[0]).toBeDisabled()
      expect(selectTipo()).toHaveValue('')
    })

    it('o select Tipo mostra só os tipos recebidos (Preenchedor com um tipo vê uma única opção além de "Selecione")', () => {
      renderizar({ tipos: [TIPOS_DO_USUARIO_API[0]] })

      expect(within(selectTipo()).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual(['Selecione', 'Comercial'])
    })

    it('o select Tipo de valor oferece "Selecione" e Porcentagem, Numeral e Booleano, nesta ordem', () => {
      renderizar()

      const opcoes = within(selectTipoValor()).getAllByRole('option')
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Selecione', 'Porcentagem', 'Numeral', 'Booleano'])
      expect(opcoes[0]).toBeDisabled()
      expect(selectTipoValor()).toHaveValue('')
    })

    it('tem os botões "Salvar" (submit) e "Cancelar" (não submit)', () => {
      renderizar()

      expect(botaoSalvar()).toHaveAttribute('type', 'submit')
      expect(botaoSalvar()).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Cancelar' })).not.toHaveAttribute('type', 'submit')
    })

    it('não tem campo de situação nem opção de editar: o apontamento nasce ativo e não é editável (RF-19, RF-20)', () => {
      renderizar()

      expect(screen.queryByLabelText(/situa/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    })
  })

  describe('validação (sem chamar onSalvar)', () => {
    it('enviar vazio mostra "Informe o nome.", "Selecione o tipo." e "Selecione o tipo de valor." e não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(botaoSalvar())

      expect(screen.getByText('Informe o nome.')).toBeInTheDocument()
      expect(screen.getByText('Selecione o tipo.')).toBeInTheDocument()
      expect(screen.getByText('Selecione o tipo de valor.')).toBeInTheDocument()
      expect(campoNome()).toHaveAttribute('aria-invalid', 'true')
      expect(selectTipo()).toHaveAttribute('aria-invalid', 'true')
      expect(selectTipoValor()).toHaveAttribute('aria-invalid', 'true')
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('nome só com espaços conta como vazio', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.type(campoNome(), '   ')
      await user.selectOptions(selectTipo(), within(selectTipo()).getByRole('option', { name: 'Comercial' }))
      await user.selectOptions(selectTipoValor(), within(selectTipoValor()).getByRole('option', { name: 'Numeral' }))
      await user.click(botaoSalvar())

      expect(screen.getByText('Informe o nome.')).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('só o tipo faltando mostra apenas "Selecione o tipo."', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.type(campoNome(), 'Visitas')
      await user.selectOptions(selectTipoValor(), within(selectTipoValor()).getByRole('option', { name: 'Booleano' }))
      await user.click(botaoSalvar())

      expect(screen.getByText('Selecione o tipo.')).toBeInTheDocument()
      expect(screen.queryByText('Informe o nome.')).not.toBeInTheDocument()
      expect(screen.queryByText('Selecione o tipo de valor.')).not.toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('só o tipo de valor faltando mostra apenas "Selecione o tipo de valor."', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.type(campoNome(), 'Visitas')
      await user.selectOptions(selectTipo(), within(selectTipo()).getByRole('option', { name: 'Financeiro' }))
      await user.click(botaoSalvar())

      expect(screen.getByText('Selecione o tipo de valor.')).toBeInTheDocument()
      expect(screen.queryByText('Informe o nome.')).not.toBeInTheDocument()
      expect(screen.queryByText('Selecione o tipo.')).not.toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('a descrição é opcional: sem ela o formulário é válido', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencherValido(user)
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('depois de corrigir os campos, enviar de novo chama onSalvar e as mensagens somem', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(botaoSalvar())
      expect(screen.getByText('Informe o nome.')).toBeInTheDocument()

      await preencherValido(user)
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Informe o nome.')).not.toBeInTheDocument()
      expect(screen.queryByText('Selecione o tipo.')).not.toBeInTheDocument()
      expect(screen.queryByText('Selecione o tipo de valor.')).not.toBeInTheDocument()
    })
  })

  describe('envio', () => {
    it('chama onSalvar com { nome, idTipo (número), tipoValor (enum da aplicação), descricao }', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencherValido(user)
      await user.type(campoDescricao(), 'Clientes novos visitados no mês.')
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({
        nome: 'Visitas a clientes novos',
        idTipo: 1,
        tipoValor: 'numeral',
        descricao: 'Clientes novos visitados no mês.',
      })
    })

    it('envia o tipo e o tipo de valor escolhidos (não o primeiro da lista)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.type(campoNome(), 'Conciliação diária')
      await user.selectOptions(selectTipo(), within(selectTipo()).getByRole('option', { name: 'Tecnologia da Informação' }))
      await user.selectOptions(selectTipoValor(), within(selectTipoValor()).getByRole('option', { name: 'Booleano' }))
      await user.click(botaoSalvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ idTipo: 4, tipoValor: 'booleano' }))
    })

    it('sem descrição, envia descricao vazia ou nula (nunca texto inventado)', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencherValido(user)
      await user.click(botaoSalvar())

      const dados = onSalvar.mock.calls[0][0]
      expect([undefined, null, '']).toContain(dados.descricao)
    })

    it('Enter no campo Nome envia o formulário', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await preencherValido(user)
      await user.type(campoNome(), '{Enter}')

      expect(onSalvar).toHaveBeenCalledTimes(1)
    })

    it('Cancelar chama onCancelar e não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar, onCancelar } = renderizar()

      await preencherValido(user)
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('estados salvando e erro', () => {
    it('com salvando, o botão Salvar fica desabilitado e o clique não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ salvando: true })

      expect(botaoSalvar()).toBeDisabled()
      await user.click(botaoSalvar())

      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('com erro, mostra a mensagem em um Aviso de erro (role alert) dentro do formulário', () => {
      renderizar({ erro: 'Você só pode cadastrar apontamentos nos seus tipos.' })

      const alerta = screen.getByRole('alert')
      expect(alerta).toHaveTextContent('Você só pode cadastrar apontamentos nos seus tipos.')
      expect(alerta).toHaveClass('aviso--erro')
    })

    it('sem erro, não há Aviso de erro', () => {
      renderizar({ erro: null })

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('o erro da API não apaga o que o usuário digitou (rerender com erro mantém os campos)', async () => {
      const user = usuarioRapido()
      const { rerender, onSalvar, onCancelar } = renderizar()
      await preencherValido(user)

      rerender(
        <FormularioApontamento
          tipos={TIPOS_DO_USUARIO_API}
          salvando={false}
          erro="Falha ao salvar."
          onSalvar={onSalvar}
          onCancelar={onCancelar}
        />,
      )

      expect(campoNome()).toHaveValue('Visitas a clientes novos')
      expect(within(selectTipo()).getByRole('option', { name: 'Comercial', selected: true })).toBeInTheDocument()
      expect(within(selectTipoValor()).getByRole('option', { name: 'Numeral', selected: true })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Falha ao salvar.')
    })
  })
  describe('campos obrigatórios (F1.13 aplicado à F4.4)', () => {
    it('Nome, Tipo e Tipo de valor são marcados como obrigatórios (aria-required) sem mudar o nome acessível', () => {
      renderizar()

      expect(campoNome()).toHaveAttribute('aria-required', 'true')
      expect(selectTipo()).toHaveAttribute('aria-required', 'true')
      expect(selectTipoValor()).toHaveAttribute('aria-required', 'true')
    })

    it('os rótulos de Nome, Tipo e Tipo de valor têm a marca visual de obrigatório; Descrição (opcional) não', () => {
      const { container } = renderizar()

      const marcadas = [...container.querySelectorAll('label')]
        .filter((rotulo) => rotulo.querySelector('.campo__obrigatorio[aria-hidden="true"]') !== null)
        .map((rotulo) => (rotulo.textContent ?? '').replace('*', '').trim())
      expect(marcadas).toEqual(['Nome', 'Tipo', 'Tipo de valor'])
      expect(campoDescricao()).not.toHaveAttribute('aria-required')
    })
  })

  describe('sem tipos disponíveis', () => {
    const MENSAGEM_SEM_TIPOS = 'Você não tem tipos de apontamento disponíveis para cadastro.'

    it('com tipos vazio, mostra um Aviso de alerta explicando e desabilita "Salvar"', () => {
      renderizar({ tipos: [] })

      const aviso = screen.getByText(MENSAGEM_SEM_TIPOS).closest('.aviso')
      expect(aviso).not.toBeNull()
      expect(aviso).toHaveClass('aviso--alerta')
      expect(aviso).toHaveAttribute('role', 'note')
      expect(botaoSalvar()).toBeDisabled()
    })

    it('com tipos vazio, enviar o formulário (Enter no Nome) não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ tipos: [] })

      await user.type(campoNome(), 'Visitas{Enter}')

      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('com tipos vazio, "Cancelar" continua habilitado e chama onCancelar', async () => {
      const user = usuarioRapido()
      const { onCancelar } = renderizar({ tipos: [] })

      const cancelar = screen.getByRole('button', { name: 'Cancelar' })
      expect(cancelar).toBeEnabled()
      await user.click(cancelar)

      expect(onCancelar).toHaveBeenCalledTimes(1)
    })

    it('com tipos disponíveis, o aviso não aparece e "Salvar" fica habilitado', () => {
      renderizar()

      expect(screen.queryByText(MENSAGEM_SEM_TIPOS)).not.toBeInTheDocument()
      expect(botaoSalvar()).toBeEnabled()
    })
  })
})
