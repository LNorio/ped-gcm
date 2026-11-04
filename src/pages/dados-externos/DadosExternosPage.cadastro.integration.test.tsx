import { screen, waitFor, within } from '@testing-library/react'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  corpoDaChamada,
  respostaErro,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import { dadosExternosApi, identificadoresApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dados-externos-cadastro'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const MENSAGEM_REFERENCIA = 'A referência colaborador ainda não está disponível.'

describe('F5.4 — Cadastro de dado externo: campos comuns (integração: /dados-externos)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', aoCriar: () => Response) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(dadosExternosApi),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
      [`POST ${ROTA}`]: aoCriar,
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  async function abrirCadastro(user: Usuario) {
    renderizarApp('/dados-externos')
    await screen.findByRole('table', { name: 'Dados externos' })
    await user.click(screen.getByRole('button', { name: 'Novo dado externo' }))
    return screen.getByRole('dialog', { name: 'Novo dado externo' })
  }

  async function escolher(user: Usuario, dialogo: HTMLElement, campo: string, rotulo: string) {
    const select = within(dialogo).getByRole('combobox', { name: campo })
    await user.selectOptions(select, within(select).getByRole('option', { name: rotulo }))
  }

  async function preencher(user: Usuario, dialogo: HTMLElement, perfil: 'admin' | 'validador' | 'preenchedor') {
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Positivação por vendedor')
    await escolher(user, dialogo, 'Tipo', 'Comercial')
    await escolher(user, dialogo, 'Sistema de origem', 'Senior ERP (Sapiens)')
    await escolher(user, dialogo, 'Tipo de valor', 'Numeral')
    await escolher(user, dialogo, 'Referência', 'Colaborador')
    await escolher(user, dialogo, 'Coleta', 'Diária')
    await escolher(user, dialogo, 'Sentido do cálculo', 'Usar só o último valor')
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Campo ou cálculo' }), 'Clientes positivados por vendedor')
    if (perfil === 'admin') await user.type(within(dialogo).getByLabelText('Identificador da consulta'), 'positivacao')
  }

  it('"Novo dado externo" abre o diálogo com o formulário; Cancelar fecha sem chamar a API', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', () => respostaErro(500))
    const dialogo = await abrirCadastro(user)

    expect(within(dialogo).getByRole('textbox', { name: 'Nome' })).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(0)
  })

  it('validação local impede o POST quando falta campo obrigatório', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', () => respostaErro(500))
    const dialogo = await abrirCadastro(user)

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(within(dialogo).getByText('Informe o nome.')).toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(0)
  })

  it.each(['admin', 'validador', 'preenchedor'] as const)(
    '%s: 400 "ainda não está disponível" (referência não liberada) aparece no formulário com a mensagem da API, sem perder os dados',
    async (perfil) => {
      const user = usuarioRapido()
      const chamadas = simularSessao(perfil, () => respostaErro(400, MENSAGEM_REFERENCIA))
      const dialogo = await abrirCadastro(user)
      await preencher(user, dialogo, perfil)

      await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_REFERENCIA)
      expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ referencia: 'colaborador', 'janela retroativa': null })
      expect(screen.getByRole('dialog', { name: 'Novo dado externo' })).toBeInTheDocument()
      expect(within(dialogo).getByRole('textbox', { name: 'Nome' })).toHaveValue('Positivação por vendedor')
      expect(within(dialogo).getByRole('button', { name: 'Salvar' })).toBeEnabled()
    },
  )

  it('falha de rede no POST mostra "Não foi possível conectar ao servidor." no formulário', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => {
      throw new TypeError('Failed to fetch')
    })
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo, 'admin')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.')
  })

  it('401 no POST encerra a sessão e volta ao login', async () => {
    const user = usuarioRapido()
    simularSessao('admin', () => respostaErro(401))
    const dialogo = await abrirCadastro(user)
    await preencher(user, dialogo, 'admin')

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    await waitFor(() => expect(obterToken()).toBeNull())
  })
})
