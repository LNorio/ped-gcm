import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { renderizarApp } from '../../test/renderizarApp'
import { colaboradoresApi, gruposApi, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const TITULO = 'Novo tipo de apontamento'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F3.4 — Cadastro de tipo personalizado (integração: /tipos com Admin e Validador)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  /** Sessão do perfil + API de tipos com estado (o POST acrescenta o tipo à lista do GET). */
  function simularSessao(perfil: 'admin' | 'validador', aoCriar?: () => Response | undefined) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })),
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
      'GET /api/ped/vinculos': (_init, url) =>
        url.searchParams.get('tipo') === 'colaboradores' ? respostaJson(colaboradoresApi()) : respostaErro(400, 'tipo inválido'),
      'POST /api/ped/tipos-apontamento': (init) => {
        const personalizada = aoCriar?.()
        if (personalizada) return personalizada
        const corpo = JSON.parse(String(init?.body)) as { nome: string; grupos: number[]; usuarios: number[] }
        const nomesGrupos = new Map(gruposApi().map((grupo) => [grupo.id, grupo.nome]))
        const nomesUsuarios = new Map(colaboradoresApi().map((c) => [c['id colaborador'], c.nome]))
        const novo: TipoApontamentoApiFalso = {
          id: 10,
          nome: corpo.nome,
          origem: 'Personalizado',
          'quantidade usuarios': 38,
          'quantidade apontamentos': 0,
          grupos: corpo.grupos.map((id) => ({ id, nome: nomesGrupos.get(id) ?? '' })),
          usuarios: corpo.usuarios.map((id) => ({ id, nome: nomesUsuarios.get(id) ?? '' })),
        }
        lista = [...lista, novo]
        // A API pode responder só com a mensagem ("2xx = gravado"): a tela recarrega a lista.
        return respostaJson({ mensagem: 'tipo cadastrado' }, 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST')

  async function abrirTipos() {
    renderizarApp('/tipos')
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
    await screen.findByRole('cell', { name: 'Logística' })
  }

  async function abrirCadastro(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo tipo' }))
    const dialogo = screen.getByRole('dialog', { name: TITULO })
    await within(dialogo).findByRole('button', { name: 'Selecionar grupo' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando grupos e usuários...')).not.toBeInTheDocument())
    return dialogo
  }

  async function escolher(user: Usuario, dialogo: HTMLElement, grupo: 'Grupos vinculados' | 'Usuários vinculados', rotulo: string) {
    const campo = within(dialogo).getByRole('group', { name: grupo })
    const botao = grupo === 'Grupos vinculados' ? 'Selecionar grupo' : 'Selecionar usuário'
    if (within(campo).queryByRole('listbox') === null) await user.click(within(campo).getByRole('button', { name: botao }))
    await user.click(within(campo).getByRole('option', { name: (nome) => nome.startsWith(rotulo) }))
  }

  it('Admin cadastra um tipo com grupos e um usuário: POST com o token → "Tipo cadastrado." → lista recarregada com o novo tipo e seus vínculos', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTipos()

    const dialogo = await abrirCadastro(user)
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), 'Compras')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_OPERADOR DE CAIXA')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_GERENTE DE LOJA')
    await escolher(user, dialogo, 'Usuários vinculados', 'Maria Souza')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

    expect(await screen.findByText('Tipo cadastrado.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({ nome: 'Compras', grupos: [4, 7], usuarios: [30] })
    expect(cabecalhoDaChamada(posts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')

    const linha = (await screen.findByRole('cell', { name: 'Compras' })).closest('tr')!
    const grupos = within(linha).getAllByRole('cell')[2]
    expect(grupos).toHaveTextContent('DEF_OPERADOR DE CAIXA')
    expect(grupos).toHaveTextContent('DEF_GERENTE DE LOJA')
    expect(grupos).toHaveTextContent('1 usuário vinculado')
  })

  it('Validador também cadastra (A-02): só com usuário, sem grupo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTipos()

    const dialogo = await abrirCadastro(user)
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), 'Auditoria')
    await escolher(user, dialogo, 'Usuários vinculados', 'Beltrano')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

    await screen.findByText('Tipo cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({ nome: 'Auditoria', grupos: [], usuarios: [20] })
    expect(await screen.findByRole('cell', { name: 'Auditoria' })).toBeInTheDocument()
  })

  it('nome repetido de um tipo fixo (outra caixa) é recusado na tela, sem POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTipos()

    const dialogo = await abrirCadastro(user)
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), 'fiscal')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_ANALISTA FINANCEIRO')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

    expect(within(dialogo).getByText('Já existe um tipo com esse nome.')).toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(0)
  })

  it('400 da API "informe ao menos um grupo ou usuario" aparece no diálogo, que continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(400, 'informe ao menos um grupo ou usuario'))
    await abrirTipos()

    const dialogo = await abrirCadastro(user)
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), 'Compras')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_OPERADOR DE CAIXA')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('informe ao menos um grupo ou usuario')
    expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'Compras' })).not.toBeInTheDocument()
  })

  it('401 ao cadastrar (token recusado) encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    await abrirTipos()

    const dialogo = await abrirCadastro(user)
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), 'Compras')
    await escolher(user, dialogo, 'Grupos vinculados', 'DEF_OPERADOR DE CAIXA')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
