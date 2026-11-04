import { render, screen, waitFor, within } from '@testing-library/react'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escolherAcao, rotuloAcoesApontamento } from '../../test/menuAcoes'
import { MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  rotaListarApontamentos,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { ApontamentosPage } from './ApontamentosPage'

const ROTA = '/api/ped/apontamentos'

interface CorpoPost {
  nome: string
  'id tipo': number
  'tipo de valor': string
  descricao: string | null
}

describe('F4.4 — Cadastro de apontamento (ApontamentosPage)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /** API com estado: o POST cria o apontamento (ativo) a partir do corpo e o inclui no GET seguinte. */
  function simularApiComEstado(aoCriar?: () => Response | Promise<Response> | undefined) {
    let lista = apontamentosApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`POST ${ROTA}`]: (init) => {
        const personalizada = aoCriar?.()
        if (personalizada) return personalizada
        const corpo = JSON.parse(String(init?.body)) as CorpoPost
        const tipo = TIPOS_DO_USUARIO_API.find((t) => t.id === corpo['id tipo'])
        const valor = corpo['tipo de valor']
        const criado: ApontamentoApiFalso = {
          id: 10,
          nome: corpo.nome,
          descricao: corpo.descricao,
          ativo: true,
          'id tipo': corpo['id tipo'],
          tipo: tipo?.nome ?? 'Desconhecido',
          'tipo de valor': (valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase()) as ApontamentoApiFalso['tipo de valor'],
          indicadores: [],
          'vinculado a dashboard': false,
          'desativado mas usado em indicador ativo': false,
          'cadastrado em': '2026-11-03 10:00:00',
          'cadastrado por': 'Fulano',
          'situacao alterada em': null,
          'situacao alterada por': null,
        }
        lista = [...lista, criado]
        return respostaJson(criado, 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  function renderizar(perfil: Perfil = 'admin') {
    const acesso =
      perfil === 'preenchedor'
        ? acessoFalso({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], todasAsFiliais: false, filiais: [FILIAIS[1]] })
        : acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    return render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function abrirTela(perfil: Perfil = 'admin') {
    renderizar(perfil)
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  const botaoNovo = () => screen.getByRole('button', { name: 'Novo apontamento' })
  const dialogo = () => screen.getByRole('dialog', { name: 'Novo apontamento' })

  async function abrirFormulario(user: Usuario) {
    await user.click(botaoNovo())
    return dialogo()
  }

  async function preencher(
    user: Usuario,
    dados: { nome: string; tipo: string; tipoValor: string; descricao?: string },
  ) {
    const form = dialogo()
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), dados.nome)
    const selectTipo = within(form).getByRole('combobox', { name: 'Tipo' })
    await user.selectOptions(selectTipo, within(selectTipo).getByRole('option', { name: dados.tipo }))
    const selectValor = within(form).getByRole('combobox', { name: 'Tipo de valor' })
    await user.selectOptions(selectValor, within(selectValor).getByRole('option', { name: dados.tipoValor }))
    if (dados.descricao) await user.type(within(form).getByRole('textbox', { name: 'Descrição' }), dados.descricao)
  }

  describe('botão "Novo apontamento"', () => {
    it.each<Perfil>(['admin', 'validador', 'preenchedor'])('%s vê o botão primário "Novo apontamento" no topo da tela', async (perfil) => {
      simularApiComEstado()
      await abrirTela(perfil)

      expect(botaoNovo()).toHaveClass('botao--primario')
      expect(botaoNovo()).toBeEnabled()
    })

    it('abre o diálogo modal "Novo apontamento" com o formulário e os botões Salvar e Cancelar', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      const form = await abrirFormulario(user)

      expect(form).toHaveAttribute('aria-modal', 'true')
      expect(within(form).getByRole('textbox', { name: 'Nome' })).toBeInTheDocument()
      expect(within(form).getByRole('combobox', { name: 'Tipo' })).toBeInTheDocument()
      expect(within(form).getByRole('combobox', { name: 'Tipo de valor' })).toBeInTheDocument()
      expect(within(form).getByRole('textbox', { name: 'Descrição' })).toBeInTheDocument()
      expect(within(form).getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'submit')
      expect(within(form).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    })

    it('o select Tipo oferece os tipos do usuário logado (useSessao().acesso.tipos)', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela('admin')

      const form = await abrirFormulario(user)

      const opcoes = within(within(form).getByRole('combobox', { name: 'Tipo' })).getAllByRole('option')
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
        'Selecione',
        'Comercial',
        'Financeiro',
        'Recursos Humanos',
        'Tecnologia da Informação',
      ])
    })

    it('Preenchedor com um tipo vê só o seu tipo no select', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela('preenchedor')

      const form = await abrirFormulario(user)

      expect(within(within(form).getByRole('combobox', { name: 'Tipo' })).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Selecione',
        'Comercial',
      ])
    })

    it('Cancelar fecha o diálogo sem chamar a API', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      const form = await abrirFormulario(user)
      await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Rascunho')
      await user.click(within(form).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(0)
    })

    it('Esc fecha o diálogo sem chamar a API', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await abrirFormulario(user)
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(0)
    })

    it('reabrir o diálogo depois de cancelar mostra o formulário limpo', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      let form = await abrirFormulario(user)
      await user.type(within(form).getByRole('textbox', { name: 'Nome' }), 'Rascunho')
      await user.click(within(form).getByRole('button', { name: 'Cancelar' }))

      form = await abrirFormulario(user)
      expect(within(form).getByRole('textbox', { name: 'Nome' })).toHaveValue('')
      expect(within(form).queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('validação (RF-19)', () => {
    it('Salvar com o formulário vazio mostra as três mensagens e não chama a API', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      const form = await abrirFormulario(user)
      await user.click(within(form).getByRole('button', { name: 'Salvar' }))

      expect(within(form).getByText('Informe o nome.')).toBeInTheDocument()
      expect(within(form).getByText('Selecione o tipo.')).toBeInTheDocument()
      expect(within(form).getByText('Selecione o tipo de valor.')).toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(0)
      expect(screen.getByRole('dialog', { name: 'Novo apontamento' })).toBeInTheDocument()
    })
  })

  describe('cadastro com sucesso', () => {
    it('Salvar envia POST com { nome, "id tipo", "tipo de valor", descricao }, fecha o diálogo, notifica "Apontamento cadastrado." e o novo apontamento aparece ativo na lista', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await abrirFormulario(user)
      await preencher(user, {
        nome: 'Visitas a clientes novos',
        tipo: 'Comercial',
        tipoValor: 'Numeral',
        descricao: 'Clientes novos visitados no mês.',
      })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))

      const notificacao = await screen.findByText('Apontamento cadastrado.')
      expect(notificacao.closest('[role="status"]')).not.toBeNull()
      expect(notificacao.closest('[role="status"]')).toHaveClass('notificacao--sucesso')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      expect(posts(chamadas)).toHaveLength(1)
      expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
        nome: 'Visitas a clientes novos',
        'id tipo': 1,
        'tipo de valor': 'numeral',
        descricao: 'Clientes novos visitados no mês.',
      })

      const linha = (await screen.findByText('Visitas a clientes novos')).closest('tr')!
      const celulas = within(linha).getAllByRole('cell')
      expect(celulas[0]).toHaveTextContent('Clientes novos visitados no mês.')
      expect(celulas[1]).toHaveTextContent('Comercial')
      expect(celulas[2]).toHaveTextContent('Numeral')
      expect(within(celulas[3]).getByText('Ativo')).toHaveClass('etiqueta--sucesso')
      expect(celulas[4]).toHaveTextContent('—')
      expect(celulas[5]).toHaveTextContent('03/11/2026 10:00')
      expect(celulas[5]).toHaveTextContent('por Fulano')
    })

    it('sem descrição, o POST envia descricao null', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      await abrirFormulario(user)
      await preencher(user, { nome: 'Sem descrição', tipo: 'Financeiro', tipoValor: 'Booleano' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Apontamento cadastrado.')
      expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
        nome: 'Sem descrição',
        'id tipo': 2,
        'tipo de valor': 'booleano',
        descricao: null,
      })
    })

    it('o botão Salvar fica desabilitado enquanto a API não responde e um segundo clique não gera outro POST', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      let lista = apontamentosApi()
      const chamadas = simularApi(fetchFalso, {
        [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
        [`POST ${ROTA}`]: () =>
          new Promise<Response>((resolve) => {
            liberar = () => {
              const criado: ApontamentoApiFalso = {
                ...apontamentosApi()[3],
                id: 10,
                nome: 'Visitas a clientes novos',
                'id tipo': 1,
                tipo: 'Comercial',
                'tipo de valor': 'Numeral',
              }
              lista = [...lista, criado]
              resolve(respostaJson(criado, 201))
            }
          }),
      })
      await abrirTela()

      await abrirFormulario(user)
      await preencher(user, { nome: 'Visitas a clientes novos', tipo: 'Comercial', tipoValor: 'Numeral' })
      const salvar = within(dialogo()).getByRole('button', { name: 'Salvar' })
      await user.click(salvar)

      await waitFor(() => expect(within(dialogo()).getByRole('button', { name: 'Salvar' })).toBeDisabled())
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))
      expect(posts(chamadas)).toHaveLength(1)

      liberar()
      await screen.findByText('Apontamento cadastrado.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('Preenchedor cadastra no seu tipo como os demais perfis', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela('preenchedor')

      await abrirFormulario(user)
      await preencher(user, { nome: 'Prospecções registradas', tipo: 'Comercial', tipoValor: 'Numeral' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Apontamento cadastrado.')
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ nome: 'Prospecções registradas', 'id tipo': 1 })
      expect(await screen.findByText('Prospecções registradas')).toBeInTheDocument()
    })

    it('depois de salvar, abrir "Novo apontamento" de novo mostra o formulário limpo', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await abrirFormulario(user)
      await preencher(user, { nome: 'Visitas a clientes novos', tipo: 'Comercial', tipoValor: 'Numeral' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))
      await screen.findByText('Apontamento cadastrado.')

      const form = await abrirFormulario(user)
      expect(within(form).getByRole('textbox', { name: 'Nome' })).toHaveValue('')
      expect(within(form).getByRole('combobox', { name: 'Tipo' })).toHaveValue('')
      expect(within(form).getByRole('combobox', { name: 'Tipo de valor' })).toHaveValue('')
    })
  })

  describe('erros da API no cadastro', () => {
    it('403 (tipo que não é do usuário): a mensagem da API aparece em um Aviso de erro dentro do diálogo, que permanece aberto, sem notificação', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado(() => respostaErro(403, 'Você só pode cadastrar apontamentos nos seus tipos.'))
      await abrirTela('preenchedor')

      await abrirFormulario(user)
      await preencher(user, { nome: 'Visitas', tipo: 'Comercial', tipoValor: 'Numeral' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))

      const alerta = await within(dialogo()).findByRole('alert')
      expect(alerta).toHaveTextContent('Você só pode cadastrar apontamentos nos seus tipos.')
      expect(alerta).toHaveClass('aviso--erro')
      expect(screen.getByRole('dialog', { name: 'Novo apontamento' })).toBeInTheDocument()
      expect(screen.queryByText('Apontamento cadastrado.')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(1)
      expect(within(dialogo()).getByRole('textbox', { name: 'Nome' })).toHaveValue('Visitas')
      expect(within(dialogo()).getByRole('button', { name: 'Salvar' })).toBeEnabled()
    })

    it('400 mostra a mensagem da API no diálogo', async () => {
      const user = usuarioRapido()
      simularApiComEstado(() => respostaErro(400, 'Já existe um apontamento com este nome.'))
      await abrirTela()

      await abrirFormulario(user)
      await preencher(user, { nome: 'Roteiro de visitas elaborado', tipo: 'Comercial', tipoValor: 'Porcentagem' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))

      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent('Já existe um apontamento com este nome.')
    })

    it('erro sem mensagem usa a mensagem padrão do status; falha de rede usa a mensagem de conexão', async () => {
      const user = usuarioRapido()
      let tentativa = 0
      simularApiComEstado(() => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(500) : Promise.reject(new TypeError('Failed to fetch'))
      })
      await abrirTela()

      await abrirFormulario(user)
      await preencher(user, { nome: 'Visitas', tipo: 'Comercial', tipoValor: 'Numeral' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))
      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(mensagemPadraoPorStatus(500))

      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))
      expect(await within(dialogo()).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
    })

    it('depois de um erro, corrigir e salvar com sucesso fecha o diálogo e notifica', async () => {
      const user = usuarioRapido()
      let tentativa = 0
      simularApiComEstado(() => {
        tentativa += 1
        return tentativa === 1 ? respostaErro(400, 'Já existe um apontamento com este nome.') : undefined
      })
      await abrirTela()

      await abrirFormulario(user)
      await preencher(user, { nome: 'Roteiro', tipo: 'Comercial', tipoValor: 'Numeral' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))
      await within(dialogo()).findByRole('alert')

      await user.type(within(dialogo()).getByRole('textbox', { name: 'Nome' }), ' semanal')
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))

      await screen.findByText('Apontamento cadastrado.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await screen.findByText('Roteiro semanal')).toBeInTheDocument()
    })
  })

  describe('sem edição (RF-20)', () => {
    it('nenhum botão ou link "Editar" existe na tela, nem na tabela nem no diálogo', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument()

      await abrirFormulario(user)
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    })

    it('clicar no nome de um apontamento não abre formulário algum', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()

      await user.click(screen.getByText('Roteiro de visitas elaborado'))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
  describe('erro de ação anterior', () => {
    /** API com estado: POST cria; PUT de situação e DELETE do apontamento 4 são recusados. */
    function simularApiComAcoesRecusadas(aoCriar?: () => Response | undefined) {
      const chamadas = simularApiComEstado(aoCriar)
      const rotasPadrao = fetchFalso.getMockImplementation()
      fetchFalso.mockImplementation(async (entrada, init) => {
        const url = new URL(String(entrada), 'http://localhost')
        const metodo = (init?.method ?? 'GET').toUpperCase()
        if (url.pathname === `${ROTA}/4/situacao` && metodo === 'PUT') return respostaErro(403, 'Apenas Admin e Validador alteram a situação.')
        if (url.pathname === `${ROTA}/4` && metodo === 'DELETE') return respostaErro(403, 'Apenas o administrador exclui apontamentos.')
        return rotasPadrao!(entrada, init)
      })
      return chamadas
    }

    async function cadastrar(user: Usuario) {
      await abrirFormulario(user)
      await preencher(user, { nome: 'Visitas a clientes novos', tipo: 'Comercial', tipoValor: 'Numeral' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))
      await screen.findByText('Apontamento cadastrado.')
    }

    it('o erro de uma alteração de situação recusada é apagado depois de um cadastro bem-sucedido', async () => {
      const user = usuarioRapido()
      simularApiComAcoesRecusadas()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Apenas Admin e Validador alteram a situação.')

      await cadastrar(user)

      await waitFor(() => expect(screen.queryByText('Apenas Admin e Validador alteram a situação.')).not.toBeInTheDocument())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('o erro de uma exclusão recusada é apagado depois de um cadastro bem-sucedido', async () => {
      const user = usuarioRapido()
      simularApiComAcoesRecusadas()
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Excluir')
      await user.click(within(screen.getByRole('dialog', { name: 'Excluir apontamento' })).getByRole('button', { name: 'Excluir' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Apenas o administrador exclui apontamentos.')

      await cadastrar(user)

      await waitFor(() => expect(screen.queryByText('Apenas o administrador exclui apontamentos.')).not.toBeInTheDocument())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('um cadastro recusado não apaga o erro da ação anterior (só o sucesso apaga)', async () => {
      const user = usuarioRapido()
      simularApiComAcoesRecusadas(() => respostaErro(400, 'Já existe um apontamento com este nome.'))
      await abrirTela()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')
      await user.click(within(screen.getByRole('dialog', { name: 'Desativar apontamento' })).getByRole('button', { name: 'Desativar' }))
      await screen.findByText('Apenas Admin e Validador alteram a situação.')

      await abrirFormulario(user)
      await preencher(user, { nome: 'Roteiro', tipo: 'Comercial', tipoValor: 'Numeral' })
      await user.click(within(dialogo()).getByRole('button', { name: 'Salvar' }))
      await within(dialogo()).findByText('Já existe um apontamento com este nome.')

      expect(screen.getByText('Apenas Admin e Validador alteram a situação.')).toBeInTheDocument()
    })
  })

  describe('usuário sem tipos disponíveis', () => {
    it('o diálogo mostra o aviso "Você não tem tipos de apontamento disponíveis para cadastro." e "Salvar" desabilitado; nenhum POST', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      render(
        <ProvedorSessaoFalso
          sessao={{ acesso: acessoFalso({ perfil: 'preenchedor', tipos: [], todasAsFiliais: false, filiais: [FILIAIS[1]] }) }}
        >
          <ApontamentosPage />
        </ProvedorSessaoFalso>,
      )
      await screen.findByRole('table', { name: 'Apontamentos' })

      await abrirFormulario(user)

      const aviso = within(dialogo()).getByText('Você não tem tipos de apontamento disponíveis para cadastro.').closest('.aviso')
      expect(aviso).toHaveClass('aviso--alerta')
      const salvar = within(dialogo()).getByRole('button', { name: 'Salvar' })
      expect(salvar).toBeDisabled()
      await user.click(salvar)
      expect(posts(chamadas)).toHaveLength(0)
    })
  })
})
