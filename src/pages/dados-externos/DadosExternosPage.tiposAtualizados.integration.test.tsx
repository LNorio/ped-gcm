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
import {
  DADO_FATURAMENTO_API,
  dadosExternosApi,
  identificadoresApi,
  respostaCriacaoApi,
  rotaListarDadosExternos,
  type DadoExternoApiFalso,
} from '../../test/dadosExternosFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dados-externos-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const BOTAO_NOVO = 'Novo dado externo'

type Perfil = 'admin' | 'validador' | 'preenchedor'
type Tipos = Array<{ id: number; nome: string }>

describe('F5.4 — Cadastro de dado externo: tipos do acesso relidos ao abrir "Novo dado externo" (integração: /dados-externos)', () => {
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

  function acessoDoPerfil(perfil: Perfil, tipos: Tipos) {
    return perfil === 'preenchedor'
      ? acessoApi({ perfil, tipos, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
      : acessoApi({ perfil, nome: 'Beltrano', tipos, 'todas as filiais': true, filiais: FILIAIS_API })
  }

  /** Login com `tiposIniciais`; `releituras`: respostas de GET /api/ped/acesso depois do login, em sequência. */
  function simularSessao(opcoes: { perfil?: Perfil; tiposIniciais?: Tipos; releituras: RotaFalsa[] }) {
    const perfil = opcoes.perfil ?? 'admin'
    let lista = dadosExternosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': rotaEmSequencia(
        () => respostaJson(acessoDoPerfil(perfil, opcoes.tiposIniciais ?? TIPOS_FIXOS_ACESSO_API)),
        ...opcoes.releituras,
      ),
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`POST ${ROTA}`]: (init) => {
        const corpo = JSON.parse(String(init?.body)) as { nome: string; identificador: string | null; 'campo calculo': string | null }
        const criado: DadoExternoApiFalso = {
          ...DADO_FATURAMENTO_API,
          id: 20,
          nome: corpo.nome,
          identificador: corpo.identificador ?? DADO_FATURAMENTO_API.identificador,
          'campo calculo': corpo['campo calculo'],
          'cadastrado em': '2026-11-18 10:00:00',
          'cadastrado por': 'Beltrano',
        }
        lista = [...lista, criado]
        return respostaJson(respostaCriacaoApi(criado, null), 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)
  const getsAcesso = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/acesso')
  const acessoCom = (perfil: Perfil, tipos: Tipos): RotaFalsa => () => respostaJson(acessoDoPerfil(perfil, tipos))

  async function abrirTela() {
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
  }

  async function abrirCadastro(user: Usuario) {
    await user.click(screen.getByRole('button', { name: 'Novo dado externo' }))
    return screen.getByRole('dialog', { name: 'Novo dado externo' })
  }

  const selectTipo = (dialogo: HTMLElement) => within(dialogo).getByRole('combobox', { name: 'Tipo' })
  const nomesDasOpcoes = (dialogo: HTMLElement) =>
    within(selectTipo(dialogo))
      .getAllByRole('option')
      .map((opcao) => opcao.textContent)
      .filter((nome) => nome !== 'Selecione')

  async function escolher(user: Usuario, dialogo: HTMLElement, campo: string, rotulo: string) {
    const select = within(dialogo).getByRole('combobox', { name: campo })
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  /** Preenche e salva na variante Admin (com identificador). */
  async function salvarComoAdmin(user: Usuario, dialogo: HTMLElement, tipo: string) {
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Admissões no mês')
    await escolher(user, dialogo, 'Tipo', tipo)
    await escolher(user, dialogo, 'Sistema de origem', 'Senior HCM')
    await escolher(user, dialogo, 'Tipo de valor', 'Numeral')
    await escolher(user, dialogo, 'Referência', 'Filial')
    await escolher(user, dialogo, 'Coleta', 'Diária')
    await escolher(user, dialogo, 'Sentido do cálculo', 'Somar')
    await escolher(user, dialogo, 'Janela retroativa', 'Somente o mês')
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Campo ou cálculo' }), 'Admissões registradas no mês.')
    await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'admissoes')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
  }

  it('caso real (18/11/2026), Admin: login com os 7 fixos; ao abrir, GET /api/ped/acesso traz "Departamento Pessoal" (id 8) → a opção aparece e é enviada no POST', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao({ releituras: [acessoCom('admin', TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API)] })
    await abrirTela()
    const antes = getsAcesso(chamadas).length

    const dialogo = await abrirCadastro(user)

    expect(await within(selectTipo(dialogo)).findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument()
    expect(getsAcesso(chamadas)).toHaveLength(antes + 1)
    expect(cabecalhoDaChamada(getsAcesso(chamadas).at(-1)!, 'Authorization')).toBe('Bearer token-salvo')
    expect(nomesDasOpcoes(dialogo)).toEqual(TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API.map((tipo) => tipo.nome))

    await salvarComoAdmin(user, dialogo, 'Departamento Pessoal')

    expect(await screen.findByText('Dado externo cadastrado.')).toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({
      nome: 'Admissões no mês',
      'id tipo': TIPO_DEPARTAMENTO_PESSOAL_ACESSO_API.id,
    })
  })

  it.each<Perfil>(['validador', 'preenchedor'])(
    '%s (pedido de construção): ao abrir, o tipo novo do acesso relido aparece no select',
    async (perfil) => {
      const user = usuarioRapido()
      const iniciais = perfil === 'preenchedor' ? [TIPOS_FIXOS_ACESSO_API[0]] : TIPOS_FIXOS_ACESSO_API
      const relidos =
        perfil === 'preenchedor' ? [TIPOS_FIXOS_ACESSO_API[0], TIPO_DEPARTAMENTO_PESSOAL_ACESSO_API] : TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API
      simularSessao({ perfil, tiposIniciais: iniciais, releituras: [acessoCom(perfil, relidos)] })
      await abrirTela()

      const dialogo = await abrirCadastro(user)

      expect(await within(selectTipo(dialogo)).findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument()
      expect(nomesDasOpcoes(dialogo)).toEqual(relidos.map((tipo) => tipo.nome))
      expect(within(dialogo).getByRole('textbox', { name: 'Observação para a TI' })).toBeInTheDocument()
    },
  )

  it('enquanto a releitura está pendente, o select mostra os tipos atuais e a tela não volta ao "Carregando..."; a resposta troca a lista sem apagar o que foi digitado', async () => {
    const user = usuarioRapido()
    const pendente = respostaPendente()
    simularSessao({ releituras: [pendente.rota] })
    await abrirTela()

    const dialogo = await abrirCadastro(user)

    expect(nomesDasOpcoes(dialogo)).toEqual(TIPOS_FIXOS_ACESSO_API.map((tipo) => tipo.nome))
    expect(screen.getByRole('table', { name: 'Dados externos' })).toBeInTheDocument()
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument()
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Admissões no mês')
    await escolher(user, dialogo, 'Sistema de origem', 'Senior HCM')

    pendente.responder(respostaJson(acessoDoPerfil('admin', TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API)))

    expect(await within(selectTipo(dialogo)).findByRole('option', { name: 'Departamento Pessoal' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo dado externo' })).toBe(dialogo)
    expect(within(dialogo).getByRole('textbox', { name: 'Nome' })).toHaveValue('Admissões no mês')
    expect(within(dialogo).getByRole('combobox', { name: 'Sistema de origem' })).toHaveDisplayValue('Senior HCM')
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
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      await salvarComoAdmin(user, dialogo, 'Comercial')

      expect(await screen.findByText('Dado externo cadastrado.')).toBeInTheDocument()
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ 'id tipo': 1 })
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
})
