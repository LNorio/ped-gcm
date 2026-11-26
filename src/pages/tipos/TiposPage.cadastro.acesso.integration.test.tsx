import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API,
  TIPOS_FIXOS_ACESSO_API,
  acessoApi,
  respostaErro,
  respostaJson,
  rotaEmSequencia,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { colaboradoresApi, gruposApi, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const TITULO = 'Novo tipo de apontamento'

describe('F3.4 — Cadastro de tipo personalizado: acesso relido depois de criar (integração: /tipos)', () => {
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

  const acessoAdmin = (tipos: Array<{ id: number; nome: string }>) =>
    acessoApi({ perfil: 'admin', tipos, 'todas as filiais': true, filiais: FILIAIS_API })

  /**
   * Admin com os 7 tipos fixos no login. `releituras`: respostas de GET /api/ped/acesso depois do
   * login, em sequência (padrão: o acesso com "Departamento Pessoal"). `aoCriar` substitui o POST.
   */
  function simularSessao(opcoes: { releituras?: RotaFalsa[]; aoCriar?: () => Response } = {}) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const releituras = opcoes.releituras ?? [() => respostaJson(acessoAdmin(TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API))]
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': rotaEmSequencia(() => respostaJson(acessoAdmin(TIPOS_FIXOS_ACESSO_API)), ...releituras),
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
      'GET /api/ped/vinculos': (_init, url) =>
        url.searchParams.get('tipo') === 'colaboradores' ? respostaJson(colaboradoresApi()) : respostaErro(400, 'tipo inválido'),
      'GET /api/ped/apontamentos': rotaListarApontamentos(() => apontamentosApi()),
      'POST /api/ped/tipos-apontamento': (init) => {
        if (opcoes.aoCriar) return opcoes.aoCriar()
        const corpo = JSON.parse(String(init?.body)) as { nome: string; grupos: number[]; usuarios: number[] }
        const nomesGrupos = new Map(gruposApi().map((grupo) => [grupo.id, grupo.nome]))
        lista = [
          ...lista,
          {
            id: 8,
            nome: corpo.nome,
            origem: 'Personalizado',
            'quantidade usuarios': 3,
            'quantidade apontamentos': 0,
            grupos: corpo.grupos.map((id) => ({ id, nome: nomesGrupos.get(id) ?? '' })),
            usuarios: [],
          },
        ]
        return respostaJson({ mensagem: 'tipo cadastrado' }, 201)
      },
    })
  }

  const getsAcesso = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/acesso')

  async function abrirTipos() {
    renderizarApp('/tipos')
    await screen.findByRole('table', { name: 'Tipos de apontamento' })
    await screen.findByRole('cell', { name: 'Logística' })
  }

  async function cadastrarDepartamentoPessoal(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo tipo' }))
    const dialogo = screen.getByRole('dialog', { name: TITULO })
    await within(dialogo).findByRole('button', { name: 'Selecionar grupo' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando grupos e usuários...')).not.toBeInTheDocument())
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome do tipo' }), 'Departamento Pessoal')
    const campo = within(dialogo).getByRole('group', { name: 'Grupos vinculados' })
    await user.click(within(campo).getByRole('button', { name: 'Selecionar grupo' }))
    await user.click(within(campo).getByRole('option', { name: (nome) => nome.startsWith('DEF_OPERADOR DE CAIXA') }))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar tipo' }))
    return dialogo
  }

  it('depois do "Tipo cadastrado.", GET /api/ped/acesso é chamado de novo com o Bearer, sem deslogar nem voltar ao "Carregando..."', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao()
    await abrirTipos()
    const antes = getsAcesso(chamadas).length

    await cadastrarDepartamentoPessoal(user)

    expect(await screen.findByText('Tipo cadastrado.')).toBeInTheDocument()
    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(antes + 1))
    expect(new Headers(getsAcesso(chamadas).at(-1)!.init?.headers).get('Authorization')).toBe('Bearer token-salvo')
    expect(await screen.findByRole('cell', { name: 'Departamento Pessoal' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Tipos de apontamento' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Olá, Fulano')).toBeInTheDocument()
  })

  it('o tipo criado já aparece no "Novo apontamento" da aba Apontamentos, mesmo que a releitura ao abrir o diálogo falhe (vale a releitura feita depois de criar)', async () => {
    const user = usuarioRapido()
    simularSessao({
      releituras: [() => respostaJson(acessoAdmin(TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API)), () => respostaErro(500)],
    })
    await abrirTipos()

    await cadastrarDepartamentoPessoal(user)
    await screen.findByText('Tipo cadastrado.')

    await user.click(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: 'Apontamentos' }))
    await screen.findByRole('table', { name: 'Apontamentos' })
    await user.click(screen.getByRole('button', { name: 'Novo apontamento' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo apontamento' })
    const selectTipo = within(dialogo).getByRole('combobox', { name: 'Tipo' })

    expect(await within(selectTipo).findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument()
  })

  it('400 no POST: o diálogo mostra o erro e o acesso não é relido', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ aoCriar: () => respostaErro(400, 'informe ao menos um grupo ou usuario') })
    await abrirTipos()
    const antes = getsAcesso(chamadas).length

    const dialogo = await cadastrarDepartamentoPessoal(user)

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('informe ao menos um grupo ou usuario')
    expect(getsAcesso(chamadas)).toHaveLength(antes)
  })

  it('falha (500) na releitura do acesso depois de criar não mostra erro nem desloga: "Tipo cadastrado." e a tabela continuam', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ releituras: [() => respostaErro(500)] })
    await abrirTipos()
    const antes = getsAcesso(chamadas).length

    await cadastrarDepartamentoPessoal(user)

    expect(await screen.findByText('Tipo cadastrado.')).toBeInTheDocument()
    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(antes + 1))
    expect(await screen.findByRole('cell', { name: 'Departamento Pessoal' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Olá, Fulano')).toBeInTheDocument()
    expect(obterToken()).toBe('token-salvo')
  })
})
