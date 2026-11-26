import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API,
  TIPOS_FIXOS_ACESSO_API,
  TIPO_DEPARTAMENTO_PESSOAL_ACESSO_API,
  acessoApi,
  cabecalhoDaChamada,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  respostaPendente,
  rotaEmSequencia,
  simularApi,
  type ChamadaRegistrada,
  type RotaFalsa,
} from '../../test/apiFalsa'
import { APONTAMENTO_CHAMADOS_API, apontamentosApi, rotaListarApontamentos, type ApontamentoApiFalso } from '../../test/apontamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/apontamentos'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const BOTAO_NOVO = 'Novo apontamento'

type Tipos = Array<{ id: number; nome: string }>

describe('F4.4 — Cadastro de apontamento: tipos do acesso relidos ao abrir "Novo apontamento" (integração: /apontamentos)', () => {
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

  function acessoDoPerfil(perfil: 'admin' | 'preenchedor', tipos: Tipos) {
    return perfil === 'preenchedor'
      ? acessoApi({ perfil, tipos, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
      : acessoApi({ perfil, tipos, 'todas as filiais': true, filiais: FILIAIS_API })
  }

  /**
   * Login com `tiposIniciais`; `releituras` são as respostas de GET /api/ped/acesso depois do login
   * (em sequência; a última se repete). O POST grava o apontamento com o nome do tipo enviado.
   */
  function simularSessao(opcoes: { perfil?: 'admin' | 'preenchedor'; tiposIniciais?: Tipos; releituras: RotaFalsa[] }) {
    const perfil = opcoes.perfil ?? 'admin'
    const tiposIniciais = opcoes.tiposIniciais ?? TIPOS_FIXOS_ACESSO_API
    let lista = apontamentosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': rotaEmSequencia(() => respostaJson(acessoDoPerfil(perfil, tiposIniciais)), ...opcoes.releituras),
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`POST ${ROTA}`]: (init) => {
        const corpo = JSON.parse(String(init?.body)) as { nome: string; 'id tipo': number }
        const criado: ApontamentoApiFalso = {
          ...APONTAMENTO_CHAMADOS_API,
          id: 10,
          nome: corpo.nome,
          descricao: null,
          'id tipo': corpo['id tipo'],
          tipo: TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API.find((t) => t.id === corpo['id tipo'])?.nome ?? 'Desconhecido',
          'tipo de valor': 'Numeral',
          'cadastrado em': '2026-11-18 10:00:00',
          'cadastrado por': 'Fulano',
        }
        lista = [...lista, criado]
        return respostaJson(criado, 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const getsAcesso = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/acesso')
  const acessoCom = (perfil: 'admin' | 'preenchedor', tipos: Tipos): RotaFalsa => () => respostaJson(acessoDoPerfil(perfil, tipos))

  async function abrirTela() {
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  async function abrirCadastro(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo apontamento' }))
    return screen.getByRole('dialog', { name: 'Novo apontamento' })
  }

  const selectTipo = (dialogo: HTMLElement) => within(dialogo).getByRole('combobox', { name: 'Tipo' })
  const nomesDasOpcoes = (dialogo: HTMLElement) =>
    within(selectTipo(dialogo))
      .getAllByRole('option')
      .map((opcao) => opcao.textContent)
      .filter((nome) => nome !== 'Selecione')

  async function salvar(user: Usuario, dialogo: HTMLElement, nome: string, tipo: string) {
    const campoNome = within(dialogo).getByRole('textbox', { name: 'Nome' })
    if ((campoNome as HTMLInputElement).value === '') await user.type(campoNome, nome)
    await user.selectOptions(selectTipo(dialogo), within(selectTipo(dialogo)).getByRole('option', { name: tipo }))
    const selectValor = within(dialogo).getByRole('combobox', { name: 'Tipo de valor' })
    await user.selectOptions(selectValor, within(selectValor).getByRole('option', { name: 'Numeral' }))
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
  }

  it('caso real (18/11/2026): login com os 7 fixos; ao abrir, GET /api/ped/acesso traz "Departamento Pessoal" (id 8) → a opção aparece, é escolhida e enviada no POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ releituras: [acessoCom('admin', TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API)] })
    await abrirTela()
    const antes = getsAcesso(chamadas).length

    const dialogo = await abrirCadastro(user)

    expect(await within(selectTipo(dialogo)).findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument()
    expect(getsAcesso(chamadas)).toHaveLength(antes + 1)
    expect(cabecalhoDaChamada(getsAcesso(chamadas).at(-1)!, 'Authorization')).toBe('Bearer token-salvo')
    expect(nomesDasOpcoes(dialogo)).toEqual(TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API.map((tipo) => tipo.nome))

    await salvar(user, dialogo, 'Admissões no mês', 'Departamento Pessoal')

    expect(await screen.findByText('Apontamento cadastrado.')).toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({
      nome: 'Admissões no mês',
      'id tipo': TIPO_DEPARTAMENTO_PESSOAL_ACESSO_API.id,
    })
  })

  it('enquanto a releitura está pendente, o select mostra os 7 tipos atuais, a tela não volta ao "Carregando..." e o cadastro pode ser enviado', async () => {
    const user = usuarioRapido()
    const pendente = respostaPendente()
    const chamadas = simularSessao({ releituras: [pendente.rota] })
    await abrirTela()

    const dialogo = await abrirCadastro(user)

    expect(nomesDasOpcoes(dialogo)).toEqual(TIPOS_FIXOS_ACESSO_API.map((tipo) => tipo.nome))
    expect(screen.getByRole('table', { name: 'Apontamentos' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()

    await salvar(user, dialogo, 'Visitas a clientes novos', 'Comercial')

    await waitFor(() => expect(posts(chamadas)).toHaveLength(1))
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ nome: 'Visitas a clientes novos', 'id tipo': 1 })
    pendente.responder(respostaJson(acessoDoPerfil('admin', TIPOS_FIXOS_ACESSO_API)))
    expect(await screen.findByText('Apontamento cadastrado.')).toBeInTheDocument()
  })

  it('a resposta da releitura chega com o diálogo aberto: a lista do select é trocada sem apagar o nome digitado', async () => {
    const user = usuarioRapido()
    const pendente = respostaPendente()
    simularSessao({ releituras: [pendente.rota] })
    await abrirTela()
    const dialogo = await abrirCadastro(user)
    await user.type(within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Admissões no mês')

    pendente.responder(respostaJson(acessoDoPerfil('admin', TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API)))

    expect(await within(selectTipo(dialogo)).findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo apontamento' })).toBe(dialogo)
    expect(within(dialogo).getByRole('textbox', { name: 'Nome' })).toHaveValue('Admissões no mês')
  })

  it.each([
    ['500', () => respostaErro(500)],
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as Array<[string, RotaFalsa]>)(
    'falha na releitura (%s): mantém a lista anterior, não mostra erro e o cadastro segue normalmente',
    async (_caso, falha) => {
      const user = usuarioRapido()
      const chamadas = simularSessao({ releituras: [falha] })
      await abrirTela()
      const antes = getsAcesso(chamadas).length

      const dialogo = await abrirCadastro(user)
      await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(antes + 1))

      expect(nomesDasOpcoes(dialogo)).toEqual(TIPOS_FIXOS_ACESSO_API.map((tipo) => tipo.nome))
      expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      await salvar(user, dialogo, 'Visitas a clientes novos', 'Comercial')

      expect(await screen.findByText('Apontamento cadastrado.')).toBeInTheDocument()
      expect(obterToken()).toBe('token-salvo')
    },
  )

  it('401 na releitura encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    const user = usuarioRapido()
    simularSessao({ releituras: [() => respostaErro(401)] })
    await abrirTela()

    // A releitura responde 401 na hora: a sessão expira e o diálogo some junto com a tela.
    await user.click(screen.getByRole('button', { name: BOTAO_NOVO }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })

  it('cada abertura relê o acesso: abrir, cancelar e abrir de novo faz duas novas chamadas a GET /api/ped/acesso', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ releituras: [acessoCom('admin', TIPOS_FIXOS_ACESSO_API)] })
    await abrirTela()
    const antes = getsAcesso(chamadas).length

    const dialogo = await abrirCadastro(user)
    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(antes + 1))
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await abrirCadastro(user)

    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(antes + 2))
  })

  it('Preenchedor vinculado ao tipo novo por outro usuário durante a sessão vê o tipo ao abrir o cadastro, sem novo login', async () => {
    const user = usuarioRapido()
    simularSessao({
      perfil: 'preenchedor',
      tiposIniciais: [TIPOS_FIXOS_ACESSO_API[0]],
      releituras: [acessoCom('preenchedor', [TIPOS_FIXOS_ACESSO_API[0], TIPO_DEPARTAMENTO_PESSOAL_ACESSO_API])],
    })
    await abrirTela()

    const dialogo = await abrirCadastro(user)

    expect(await within(selectTipo(dialogo)).findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument()
    expect(nomesDasOpcoes(dialogo)).toEqual(['Comercial', 'Departamento Pessoal'])
  })
})
