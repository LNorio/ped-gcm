import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NovoTipo } from '../../services/tiposService'
import { colaboradoresDominio, gruposDominio, tiposDominio } from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { FormularioTipo, type FormularioTipoProps } from './FormularioTipo'

const MSG_NOME = 'Informe o nome do tipo.'
const MSG_DUPLICADO = 'Já existe um tipo com esse nome.'
const MSG_VINCULO = 'Vincule ao menos um grupo ou usuário.'

describe('F3.4 — FormularioTipo: cadastro de tipo personalizado (RF-13, RF-16)', () => {
  function renderizar(props: Partial<FormularioTipoProps> = {}) {
    const onSalvar = props.onSalvar ?? vi.fn<(dados: NovoTipo) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <FormularioTipo
        tiposExistentes={props.tiposExistentes ?? tiposDominio()}
        grupos={props.grupos ?? gruposDominio()}
        colaboradores={props.colaboradores ?? colaboradoresDominio()}
        carregandoListas={props.carregandoListas ?? false}
        erroListas={props.erroListas ?? null}
        salvando={props.salvando ?? false}
        erro={props.erro ?? null}
        onSalvar={onSalvar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onSalvar, onCancelar }
  }

  const nome = () => screen.getByRole('textbox', { name: 'Nome do tipo' })
  const grupoGrupos = () => screen.getByRole('group', { name: 'Grupos vinculados' })
  const grupoUsuarios = () => screen.getByRole('group', { name: 'Usuários vinculados' })
  const botaoGrupo = () => within(grupoGrupos()).getByRole('button', { name: 'Selecionar grupo' })
  const botaoUsuario = () => within(grupoUsuarios()).getByRole('button', { name: 'Selecionar usuário' })
  const listaGrupos = () => within(grupoGrupos()).getByRole('listbox', { name: 'Grupos vinculados' })
  const listaUsuarios = () => within(grupoUsuarios()).getByRole('listbox', { name: 'Usuários vinculados' })
  const buscaGrupo = () => within(grupoGrupos()).getByRole('searchbox', { name: 'Buscar grupo' })
  const buscaUsuario = () => within(grupoUsuarios()).getByRole('searchbox', { name: 'Buscar usuário' })
  const gruposEscolhidos = () => within(grupoGrupos()).getByRole('list', { name: 'Grupos escolhidos' })
  const usuariosEscolhidos = () => within(grupoUsuarios()).getByRole('list', { name: 'Usuários escolhidos' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar tipo' })

  const textosDaLista = (lista: HTMLElement) => within(lista).getAllByRole('option').map((opcao) => opcao.textContent)
  const textosEscolhidos = (lista: HTMLElement) => within(lista).getAllByRole('listitem').map((item) => item.textContent)
  /** Opção cujo nome acessível começa pelo rótulo (o nome inclui o subtexto). */
  const opcao = (lista: HTMLElement, rotulo: string) =>
    within(lista).getByRole('option', { name: (nomeOpcao) => nomeOpcao.startsWith(rotulo) })

  async function escolherGrupo(user: Usuario, rotulo: string) {
    if (within(grupoGrupos()).queryByRole('listbox') === null) await user.click(botaoGrupo())
    await user.click(opcao(listaGrupos(), rotulo))
  }

  async function escolherUsuario(user: Usuario, rotulo: string) {
    if (within(grupoUsuarios()).queryByRole('listbox') === null) await user.click(botaoUsuario())
    await user.click(opcao(listaUsuarios(), rotulo))
  }

  describe('campos', () => {
    it('tem o campo obrigatório "Nome do tipo" (placeholder "Ex.: Logística"), começa vazio, e os botões "Salvar tipo" e "Cancelar"', () => {
      renderizar()

      expect(nome()).toHaveValue('')
      expect(nome()).toHaveAttribute('placeholder', 'Ex.: Logística')
      expect(nome()).toHaveAttribute('aria-required', 'true')
      expect(salvar()).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    })

    it('grupos (principal) e usuários (secundário) começam sem seleção', () => {
      renderizar()

      expect(within(grupoGrupos()).getByText('Nenhum grupo selecionado.')).toBeInTheDocument()
      expect(within(grupoUsuarios()).getByText('Nenhum usuário selecionado.')).toBeInTheDocument()
    })

    it('o seletor de grupos vem antes do de usuários', () => {
      renderizar()

      expect(grupoGrupos().compareDocumentPosition(grupoUsuarios()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  describe('seleção de grupos (lista da API)', () => {
    it('"Selecionar grupo" abre a busca "Buscar grupo" e a lista com os grupos da API e a quantidade de usuários de cada um', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoGrupo())

      expect(botaoGrupo()).toHaveAttribute('aria-expanded', 'true')
      expect(buscaGrupo()).toHaveAttribute('placeholder', 'Buscar grupo...')
      expect(textosDaLista(listaGrupos())).toEqual([
        'DEF_OPERADOR DE CAIXA37 usuários',
        'DEF_GERENTE DE LOJA12 usuários',
        'DEF_ANALISTA FINANCEIRO1 usuário',
        'DEF_SUPERVISÃO LOGÍSTICA5 usuários',
      ])
    })

    it('a busca filtra os grupos sem diferenciar acentos nem maiúsculas; sem resultado mostra "Nenhum resultado para a busca."', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(botaoGrupo())

      await user.type(buscaGrupo(), 'supervisao logistica')
      expect(textosDaLista(listaGrupos())).toEqual(['DEF_SUPERVISÃO LOGÍSTICA5 usuários'])

      await user.clear(buscaGrupo())
      await user.type(buscaGrupo(), 'CAIXA')
      expect(textosDaLista(listaGrupos())).toEqual(['DEF_OPERADOR DE CAIXA37 usuários'])

      await user.clear(buscaGrupo())
      await user.type(buscaGrupo(), 'xyz')
      expect(within(listaGrupos()).queryAllByRole('option')).toHaveLength(0)
      expect(within(grupoGrupos()).getByText('Nenhum resultado para a busca.')).toBeInTheDocument()
    })

    it('escolher grupos os acrescenta a "Grupos escolhidos", na ordem da escolha, e os tira das opções; o painel continua aberto', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherGrupo(user, 'DEF_GERENTE DE LOJA')
      expect(botaoGrupo()).toHaveAttribute('aria-expanded', 'true')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')

      expect(textosEscolhidos(gruposEscolhidos())).toEqual([
        expect.stringContaining('DEF_GERENTE DE LOJA'),
        expect.stringContaining('DEF_OPERADOR DE CAIXA'),
      ])
      expect(textosDaLista(listaGrupos())).toEqual(['DEF_ANALISTA FINANCEIRO1 usuário', 'DEF_SUPERVISÃO LOGÍSTICA5 usuários'])
      expect(within(grupoGrupos()).queryByText('Nenhum grupo selecionado.')).not.toBeInTheDocument()
    })

    it('com todos os grupos escolhidos mostra "Todos os grupos já foram adicionados."', async () => {
      const user = usuarioRapido()
      renderizar()

      for (const grupo of ['DEF_OPERADOR DE CAIXA', 'DEF_GERENTE DE LOJA', 'DEF_ANALISTA FINANCEIRO', 'DEF_SUPERVISÃO LOGÍSTICA']) {
        await escolherGrupo(user, grupo)
      }

      expect(within(grupoGrupos()).getByText('Todos os grupos já foram adicionados.')).toBeInTheDocument()
    })

    it('"Remover {grupo}" tira o grupo escolhido e ele volta às opções', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherGrupo(user, 'DEF_GERENTE DE LOJA')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')

      await user.click(within(gruposEscolhidos()).getByRole('button', { name: 'Remover DEF_GERENTE DE LOJA' }))

      expect(textosEscolhidos(gruposEscolhidos())).toEqual([expect.stringContaining('DEF_OPERADOR DE CAIXA')])
      if (within(grupoGrupos()).queryByRole('listbox') === null) await user.click(botaoGrupo())
      expect(textosDaLista(listaGrupos())).toContain('DEF_GERENTE DE LOJA12 usuários')
    })
  })

  describe('seleção de usuários (secundária)', () => {
    it('"Selecionar usuário" abre a busca "Buscar usuário" ("Buscar por nome, cargo ou filial...") com nome, cargo e filial', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(botaoUsuario())

      expect(buscaUsuario()).toHaveAttribute('placeholder', 'Buscar por nome, cargo ou filial...')
      expect(textosDaLista(listaUsuarios())).toEqual([
        'FulanoGerente de Loja · Filial 101',
        'BeltranoAnalista de TI · Filial 100',
        'CiclanoVendedor · Filial 102',
        'Maria SouzaAnalista Financeiro · Filial 100',
      ])
    })

    it('a busca encontra por nome, cargo ou filial, sem acento nem maiúsculas', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(botaoUsuario())

      await user.type(buscaUsuario(), 'MARIA')
      expect(textosDaLista(listaUsuarios())).toEqual(['Maria SouzaAnalista Financeiro · Filial 100'])

      await user.clear(buscaUsuario())
      await user.type(buscaUsuario(), 'vendedor')
      expect(textosDaLista(listaUsuarios())).toEqual(['CiclanoVendedor · Filial 102'])

      await user.clear(buscaUsuario())
      await user.type(buscaUsuario(), '101')
      expect(textosDaLista(listaUsuarios())).toEqual(['FulanoGerente de Loja · Filial 101'])
    })

    it('escolher e remover usuários atualiza "Usuários escolhidos"', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherUsuario(user, 'Ciclano')
      await escolherUsuario(user, 'Fulano')
      expect(textosEscolhidos(usuariosEscolhidos())).toEqual([expect.stringContaining('Ciclano'), expect.stringContaining('Fulano')])

      await user.click(within(usuariosEscolhidos()).getByRole('button', { name: 'Remover Ciclano' }))
      expect(textosEscolhidos(usuariosEscolhidos())).toEqual([expect.stringContaining('Fulano')])
    })
  })

  describe('validação (RF-13)', () => {
    it('enviar vazio mostra as mensagens do nome e do vínculo, marca o nome como inválido e não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await user.click(salvar())

      expect(screen.getByText(MSG_NOME)).toBeInTheDocument()
      expect(screen.getByText(MSG_VINCULO)).toBeInTheDocument()
      expect(nome()).toHaveAttribute('aria-invalid', 'true')
      expect(nome()).toHaveAccessibleDescription(expect.stringContaining(MSG_NOME))
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('nome só com espaços conta como vazio', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), '   ')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')

      await user.click(salvar())

      expect(screen.getByText(MSG_NOME)).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it.each([['comercial'], ['COMERCIAL'], ['  Logística  '], ['MARKETING']])(
      'nome "%s" já existente na lista (sem diferenciar maiúsculas, ignorando espaços nas pontas) mostra "Já existe um tipo com esse nome."',
      async (valor) => {
        const user = usuarioRapido()
        const { onSalvar } = renderizar()
        await user.type(nome(), valor)
        await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')

        await user.click(salvar())

        expect(screen.getByText(MSG_DUPLICADO)).toBeInTheDocument()
        expect(nome()).toHaveAttribute('aria-invalid', 'true')
        expect(onSalvar).not.toHaveBeenCalled()
      },
    )

    it('a unicidade é verificada contra a lista recebida em tiposExistentes', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ tiposExistentes: [] })
      await user.type(nome(), 'Comercial')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')

      await user.click(salvar())

      expect(screen.queryByText(MSG_DUPLICADO)).not.toBeInTheDocument()
      expect(onSalvar).toHaveBeenCalledTimes(1)
    })

    it('sem grupo nem usuário mostra "Vincule ao menos um grupo ou usuário." e não chama onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), 'Compras')

      await user.click(salvar())

      expect(screen.getByText(MSG_VINCULO)).toBeInTheDocument()
      expect(screen.queryByText(MSG_NOME)).not.toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('a mensagem do vínculo some ao escolher um grupo ou um usuário', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(salvar())
      expect(screen.getByText(MSG_VINCULO)).toBeInTheDocument()

      await escolherUsuario(user, 'Fulano')

      expect(screen.queryByText(MSG_VINCULO)).not.toBeInTheDocument()
    })
  })

  describe('envio (onSalvar recebe NovoTipo)', () => {
    it('só com grupos: nome aparado, ids dos grupos na ordem da escolha e usuarios []', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), '  Compras  ')
      await escolherGrupo(user, 'DEF_GERENTE DE LOJA')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({ nome: 'Compras', grupos: [7, 4], usuarios: [] })
    })

    it('só com usuários: grupos [] e os ids dos usuários', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), 'Compras')
      await escolherUsuario(user, 'Beltrano')
      await escolherUsuario(user, 'Fulano')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({ nome: 'Compras', grupos: [], usuarios: [20, 12] })
    })

    it('com grupos e usuários envia as duas listas', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), 'Compras')
      await escolherGrupo(user, 'DEF_ANALISTA FINANCEIRO')
      await escolherUsuario(user, 'Maria Souza')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith({ nome: 'Compras', grupos: [9], usuarios: [30] })
    })

    it('Enter no campo de nome envia o formulário', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')
      await user.type(nome(), 'Compras{Enter}')

      expect(onSalvar).toHaveBeenCalledWith({ nome: 'Compras', grupos: [4], usuarios: [] })
    })

    it('Enter na busca "Buscar grupo" não envia o formulário, mesmo com dados válidos', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), 'Compras')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')

      await user.type(buscaGrupo(), 'gerente{Enter}')

      expect(onSalvar).not.toHaveBeenCalled()
      expect(buscaGrupo()).toHaveValue('gerente')
      expect(textosEscolhidos(gruposEscolhidos())).toHaveLength(1)
    })

    it('Enter na busca "Buscar usuário" não envia o formulário, mesmo com dados válidos', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), 'Compras')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')
      await user.click(botaoUsuario())

      await user.type(buscaUsuario(), 'fulano{Enter}')

      expect(onSalvar).not.toHaveBeenCalled()
      expect(buscaUsuario()).toHaveValue('fulano')
    })

    it('depois do Enter na busca, "Salvar tipo" continua enviando normalmente', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.type(nome(), 'Compras')
      await escolherGrupo(user, 'DEF_OPERADOR DE CAIXA')
      await user.type(buscaGrupo(), '{Enter}')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      expect(onSalvar).toHaveBeenCalledWith({ nome: 'Compras', grupos: [4], usuarios: [] })
    })

    it('"Cancelar" chama onCancelar sem chamar onSalvar', async () => {
      const user = usuarioRapido()
      const { onSalvar, onCancelar } = renderizar()
      await user.type(nome(), 'Compras')

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('estados', () => {
    it('salvando desabilita "Salvar tipo"', () => {
      renderizar({ salvando: true })

      expect(salvar()).toBeDisabled()
    })

    it('exibe o erro recebido (ex.: 400 da API) em um alerta dentro do formulário, mantendo os dados digitados', async () => {
      const user = usuarioRapido()
      const props = {
        tiposExistentes: tiposDominio(),
        grupos: gruposDominio(),
        colaboradores: colaboradoresDominio(),
        carregandoListas: false,
        erroListas: null,
        salvando: false,
        onSalvar: vi.fn(),
        onCancelar: vi.fn(),
      }
      const { rerender } = render(<FormularioTipo {...props} erro={null} />)
      await user.type(nome(), 'Compras')

      rerender(<FormularioTipo {...props} erro="Já existe um tipo com este nome." />)

      const alerta = screen.getByRole('alert')
      expect(alerta).toHaveTextContent('Já existe um tipo com este nome.')
      expect(alerta).toHaveClass('aviso--erro')
      expect(nome()).toHaveValue('Compras')
    })

    it('enquanto carrega as listas, anuncia "Carregando grupos e usuários..." em região de status', () => {
      renderizar({ carregandoListas: true, grupos: [], colaboradores: [] })

      expect(screen.getByText('Carregando grupos e usuários...').closest('[role="status"]')).not.toBeNull()
    })

    it('erro na carga das listas aparece como alerta com a mensagem', () => {
      renderizar({ erroListas: 'Não foi possível conectar ao servidor.', grupos: [], colaboradores: [] })

      const alerta = screen.getByRole('alert')
      expect(alerta).toHaveTextContent('Não foi possível conectar ao servidor.')
      expect(alerta).toHaveClass('aviso--erro')
    })
  })
})
