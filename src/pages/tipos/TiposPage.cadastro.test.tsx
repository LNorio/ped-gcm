import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import {
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { colaboradoresApi, gruposApi, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Perfil } from '../../types/dominio'
import { TiposPage } from './TiposPage'

const TITULO = 'Novo tipo de apontamento'

/**
 * Envolve o fetch simulado: a partir da segunda chamada a GET /api/ped/tipos-apontamento (as recargas),
 * a resposta só sai depois de `liberar()`. `transformar` pode trocar a resposta de outras chamadas.
 */
function segurarRecargas(
  fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>,
  transformar: (metodo: string, resposta: Response) => Response = (_metodo, resposta) => resposta,
) {
  const original = fetchFalso.getMockImplementation()!
  let liberar: () => void = () => {}
  const portao = new Promise<void>((resolve) => {
    liberar = resolve
  })
  let listagensFeitas = 0
  fetchFalso.mockImplementation(async (entrada, init) => {
    const metodo = (init?.method ?? 'GET').toUpperCase()
    const texto = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
    if (metodo === 'GET' && new URL(texto, 'http://localhost').pathname === '/api/ped/tipos-apontamento') {
      listagensFeitas += 1
      if (listagensFeitas > 1) await portao
    }
    return transformar(metodo, await original(entrada, init))
  })
  return { liberar: () => liberar(), listagens: () => listagensFeitas }
}

describe('F3.4 — Cadastro de tipo personalizado (TiposPage)', () => {
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

  /**
   * API com estado: o POST acrescenta o tipo enviado à lista devolvida pelo GET (com os grupos e
   * usuários escolhidos). `aoCriar` pode devolver outra resposta (erro, corpo sem tipo, promessa pendente).
   */
  function simularApiComEstado(rotas: { aoCriar?: () => Response | Promise<Response> | undefined } & Record<string, unknown> = {}) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const { aoCriar, ...outras } = rotas
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
      'GET /api/ped/vinculos': (_init, url) =>
        url.searchParams.get('tipo') === 'colaboradores' ? respostaJson(colaboradoresApi()) : respostaErro(400, 'tipo inválido'),
      'POST /api/ped/tipos-apontamento': (init) => {
        const personalizada = aoCriar?.()
        if (personalizada) return personalizada
        const corpo = JSON.parse(String(init?.body)) as { nome: string; grupos: number[]; usuarios: number[] }
        const novo: TipoApontamentoApiFalso = {
          id: 10,
          nome: corpo.nome,
          origem: 'Personalizado',
          'quantidade usuarios': 37,
          'quantidade apontamentos': 0,
          grupos: gruposApi()
            .filter((grupo) => corpo.grupos.includes(grupo.id))
            .map((grupo) => ({ id: grupo.id, nome: grupo.nome })),
          usuarios: [],
        }
        lista = [...lista, novo]
        return respostaJson(novo, 201)
      },
      ...(outras as Record<string, RotaFalsa>),
    })
    return chamadas
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST')
  const listagens = (chamadas: ChamadaRegistrada[]) =>
    chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/tipos-apontamento')

  function renderizar(perfil: Perfil = 'admin') {
    return render(
      <ProvedorSessaoFalso sessao={{ acesso: acessoFalso({ perfil, todasAsFiliais: true, filiais: FILIAIS }) }}>
        <TiposPage />
      </ProvedorSessaoFalso>,
    )
  }

  async function abrirTela(perfil: Perfil = 'admin') {
    renderizar(perfil)
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
  }

  async function abrirCadastro(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo tipo' }))
    const dialogo = screen.getByRole('dialog', { name: TITULO })
    // As listas de grupos e usuários chegam da API.
    await within(dialogo).findByRole('button', { name: 'Selecionar grupo' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando grupos e usuários...')).not.toBeInTheDocument())
    return dialogo
  }

  async function escolherGrupo(user: Usuario, dialogo: HTMLElement, rotulo: string) {
    const grupo = within(dialogo).getByRole('group', { name: 'Grupos vinculados' })
    if (within(grupo).queryByRole('listbox') === null) await user.click(within(grupo).getByRole('button', { name: 'Selecionar grupo' }))
    const lista = within(grupo).getByRole('listbox', { name: 'Grupos vinculados' })
    await user.click(within(lista).getByRole('option', { name: (nome) => nome.startsWith(rotulo) }))
  }

  async function preencher(user: Usuario, dialogo: HTMLElement, nome: string, grupo = 'DEF_OPERADOR DE CAIXA') {
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), nome)
    await escolherGrupo(user, dialogo, grupo)
  }

  describe('botão "Novo tipo" (Admin e Validador)', () => {
    it.each<Perfil>(['admin', 'validador'])('%s vê o botão "Novo tipo"', async (perfil) => {
      simularApiComEstado()
      await abrirTela(perfil)

      expect(screen.getByRole('button', { name: 'Novo tipo' })).toBeInTheDocument()
    })

    it('perfil sem a ação cadastrar-tipo (Preenchedor, se chegar à tela) não vê o botão', async () => {
      simularApiComEstado()
      await abrirTela('preenchedor')

      expect(screen.queryByRole('button', { name: 'Novo tipo' })).not.toBeInTheDocument()
    })
  })

  describe('diálogo', () => {
    it('abre o diálogo modal largo "Novo tipo de apontamento" com o formulário e carrega os grupos (GET /api/ped/grupos) e os usuários (GET /api/ped/vinculos?tipo=colaboradores)', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()

      const dialogo = await abrirCadastro(user)

      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(dialogo).toHaveClass('dialogo--largo')
      expect(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' })).toHaveValue('')
      const grupos = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/grupos')
      expect(grupos).toHaveLength(1)
      expect(cabecalhoDaChamada(grupos[0], 'Authorization')).toBe('Bearer token-123')
      const vinculos = chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/vinculos')
      expect(vinculos).toHaveLength(1)
      expect(vinculos[0].url.searchParams.get('tipo')).toBe('colaboradores')

      await user.click(within(dialogo).getByRole('button', { name: 'Selecionar grupo' }))
      expect(within(dialogo).getByRole('option', { name: (nome) => nome.startsWith('DEF_SUPERVISÃO LOGÍSTICA') })).toBeInTheDocument()
    })

    it('não carrega grupos nem usuários antes de abrir o diálogo', async () => {
      const chamadas = simularApiComEstado()
      await abrirTela()

      expect(chamadas.some((c) => c.caminho === '/api/ped/grupos' || c.caminho === '/api/ped/vinculos')).toBe(false)
    })

    it('"Cancelar" fecha o diálogo sem chamar a API; ao reabrir, o formulário começa vazio', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'Compras')

      await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(0)
      const reaberto = await abrirCadastro(user)
      expect(within(reaberto).getByRole('textbox', { name: 'Nome do tipo' })).toHaveValue('')
      expect(within(reaberto).getByText('Nenhum grupo selecionado.')).toBeInTheDocument()
    })

    it('erro ao carregar os grupos mostra a mensagem da API dentro do diálogo', async () => {
      const user = usuarioRapido()
      simularApiComEstado({ 'GET /api/ped/grupos': () => respostaErro(500, 'Falha ao consultar os grupos.') })
      await abrirTela()

      await user.click(screen.getByRole('button', { name: 'Novo tipo' }))
      const dialogo = screen.getByRole('dialog', { name: TITULO })

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Falha ao consultar os grupos.')
    })
  })

  describe('cadastro', () => {
    it('salvar faz POST com { nome, grupos, usuarios }, desabilita "Salvar tipo" durante a chamada, fecha o diálogo, notifica "Tipo cadastrado." e recarrega a lista', async () => {
      const user = usuarioRapido()
      let liberar: () => void = () => {}
      let pendente = true
      const chamadas = simularApiComEstado({
        aoCriar: () =>
          pendente
            ? new Promise<Response>((resolve) => {
                liberar = () => {
                  pendente = false
                  resolve(respostaJson({ mensagem: 'tipo cadastrado' }, 201))
                }
              })
            : undefined,
      })
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, '  Compras  ')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Salvar tipo' })).toBeDisabled())
      expect(posts(chamadas)).toHaveLength(1)
      expect(corpoDaChamada(posts(chamadas)[0])).toEqual({ nome: 'Compras', grupos: [4], usuarios: [] })
      expect(cabecalhoDaChamada(posts(chamadas)[0], 'Authorization')).toBe('Bearer token-123')

      liberar()

      const notificacao = await screen.findByText('Tipo cadastrado.')
      expect(notificacao.closest('[role="status"]')).toHaveClass('notificacao--sucesso')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(listagens(chamadas)).toHaveLength(2))
    })

    it('o tipo criado aparece na tabela, com os grupos escolhidos, e a contagem de Personalizado sobe', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'Compras', 'DEF_GERENTE DE LOJA')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      const celula = await screen.findByRole('cell', { name: 'Compras' })
      const linha = celula.closest('tr')!
      expect(within(linha).getByText('Personalizado')).toBeInTheDocument()
      expect(within(linha).getAllByRole('cell')[2]).toHaveTextContent('DEF_GERENTE DE LOJA')
      const personalizado = within(screen.getByRole('listbox', { name: 'Origem' }))
        .getAllByRole('option')
        .find((opcao) => within(opcao).queryByText('Personalizado') !== null)!
      expect(within(personalizado).getByText('3')).toBeInTheDocument()
    })

    it('nome já existente na lista (sem diferenciar maiúsculas) é recusado no front, sem chamar a API', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'LOGÍSTICA')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      expect(within(dialogo).getByText('Já existe um tipo com esse nome.')).toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(0)
      expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
    })

    it('sem grupo nem usuário é recusado no front, sem chamar a API', async () => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), 'Compras')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      expect(within(dialogo).getByText('Vincule ao menos um grupo ou usuário.')).toBeInTheDocument()
      expect(posts(chamadas)).toHaveLength(0)
    })

    it('400 da API (ex.: nome duplicado no servidor): o diálogo continua aberto com a mensagem e sem notificação', async () => {
      const user = usuarioRapido()
      simularApiComEstado({ aoCriar: () => respostaErro(400, 'Já existe um tipo com este nome.') })
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'Compras')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      const alerta = await within(dialogo).findByRole('alert')
      expect(alerta).toHaveTextContent('Já existe um tipo com este nome.')
      expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
      expect(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' })).toHaveValue('Compras')
      expect(within(dialogo).getByRole('button', { name: 'Salvar tipo' })).toBeEnabled()
      expect(screen.queryByText('Tipo cadastrado.')).not.toBeInTheDocument()
    })

    it('falha de rede mostra a mensagem padrão de conexão dentro do diálogo', async () => {
      const user = usuarioRapido()
      simularApiComEstado({ aoCriar: () => Promise.reject(new TypeError('Failed to fetch')) })
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'Compras')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
    })

    it('depois de um erro, um novo envio bem-sucedido fecha o diálogo e notifica', async () => {
      const user = usuarioRapido()
      let tentativa = 0
      simularApiComEstado({
        aoCriar: () => {
          tentativa += 1
          return tentativa === 1 ? respostaErro(500, 'Falha temporária.') : undefined
        },
      })
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'Compras')
      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))
      expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Falha temporária.')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      await screen.findByText('Tipo cadastrado.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await screen.findByRole('cell', { name: 'Compras' })).toBeInTheDocument()
    })
  })

  describe('Enter na busca dos seletores', () => {
    it.each([
      ['Buscar grupo', 'Selecionar grupo', 'Grupos vinculados'],
      ['Buscar usuário', 'Selecionar usuário', 'Usuários vinculados'],
    ])('Enter na busca "%s" não envia o formulário (sem POST), mesmo com dados válidos', async (rotuloBusca, rotuloBotao, rotuloGrupo) => {
      const user = usuarioRapido()
      const chamadas = simularApiComEstado()
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'Compras')
      const grupo = within(dialogo).getByRole('group', { name: rotuloGrupo })
      if (within(grupo).queryByRole('searchbox') === null) await user.click(within(grupo).getByRole('button', { name: rotuloBotao }))

      await user.type(within(grupo).getByRole('searchbox', { name: rotuloBusca }), 'a{Enter}')

      expect(posts(chamadas)).toHaveLength(0)
      expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
      expect(screen.queryByText('Tipo cadastrado.')).not.toBeInTheDocument()
    })
  })

  describe('recarga depois de cadastrar', () => {
    it('a tabela continua visível enquanto a lista é recarregada e, ao terminar, o foco volta a "Novo tipo"', async () => {
      const user = usuarioRapido()
      simularApiComEstado()
      const recargas = segurarRecargas(fetchFalso)
      await abrirTela()
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, 'Compras')

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

      await waitFor(() => expect(recargas.listagens()).toBe(2))
      expect(screen.getByRole('table', { name: 'Tipos de apontamento' })).toBeInTheDocument()
      expect(screen.getByRole('cell', { name: 'Comercial' })).toBeInTheDocument()

      recargas.liberar()

      await screen.findByText('Tipo cadastrado.')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(await screen.findByRole('cell', { name: 'Compras' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Novo tipo' })).toHaveFocus()
    })
  })
})
