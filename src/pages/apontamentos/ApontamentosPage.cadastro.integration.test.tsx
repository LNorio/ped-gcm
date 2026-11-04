import { screen, within } from '@testing-library/react'
import { type Usuario, usuarioRapido } from '../../test/usuario'
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
import {
  APONTAMENTO_CHAMADOS_API,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  rotaListarApontamentos,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/apontamentos'
const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

describe('F4.4 — Cadastro de apontamento (integração: /apontamentos com Admin, Validador e Preenchedor)', () => {
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

  function simularSessao(
    perfil: 'admin' | 'validador' | 'preenchedor',
    opcoes: {
      tiposDoUsuario?: Array<{ id: number; nome: string }>
      /** Substitui a resposta do POST sem gravar (erros). */
      aoCriar?: () => Response | undefined
      /** Grava o apontamento e responde com este corpo 2xx em vez do apontamento na raiz. */
      respostaGravado?: (criado: ApontamentoApiFalso) => Response
    } = {},
  ) {
    const tipos = opcoes.tiposDoUsuario ?? (perfil === 'preenchedor' ? [TIPOS_DO_USUARIO_API[0]] : TIPOS_DO_USUARIO_API)
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos, 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos, 'todas as filiais': true, filiais: FILIAIS_API })
    let lista = apontamentosApi()
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`POST ${ROTA}`]: (init) => {
        const personalizada = opcoes.aoCriar?.()
        if (personalizada) return personalizada
        const corpo = JSON.parse(String(init?.body)) as { nome: string; 'id tipo': number }
        const criado: ApontamentoApiFalso = {
          ...APONTAMENTO_CHAMADOS_API,
          id: 10,
          nome: corpo.nome,
          descricao: null,
          'id tipo': corpo['id tipo'],
          tipo: TIPOS_DO_USUARIO_API.find((t) => t.id === corpo['id tipo'])?.nome ?? 'Desconhecido',
          'tipo de valor': 'Numeral',
          'cadastrado em': '2026-11-03 10:00:00',
          'cadastrado por': acesso.nome,
        }
        lista = [...lista, criado]
        return opcoes.respostaGravado ? opcoes.respostaGravado(criado) : respostaJson(criado, 201)
      },
    })
  }

  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  async function abrirTela() {
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  async function cadastrar(user: Usuario, nome: string, tipo: string) {
    await user.click(screen.getByRole('button', { name: 'Novo apontamento' }))
    const form = screen.getByRole('dialog', { name: 'Novo apontamento' })
    await user.type(within(form).getByRole('textbox', { name: 'Nome' }), nome)
    const selectTipo = within(form).getByRole('combobox', { name: 'Tipo' })
    await user.selectOptions(selectTipo, within(selectTipo).getByRole('option', { name: tipo }))
    const selectValor = within(form).getByRole('combobox', { name: 'Tipo de valor' })
    await user.selectOptions(selectValor, within(selectValor).getByRole('option', { name: 'Numeral' }))
    await user.click(within(form).getByRole('button', { name: 'Salvar' }))
    return form
  }

  it('Admin cadastra: POST com o Bearer e o corpo da API → notificação "Apontamento cadastrado." → novo apontamento ativo na lista', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin')
    await abrirTela()

    await cadastrar(user, 'Visitas a clientes novos', 'Comercial')

    const notificacao = await screen.findByText('Apontamento cadastrado.')
    expect(notificacao.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(posts(chamadas)).toHaveLength(1)
    expect(cabecalhoDaChamada(posts(chamadas)[0], 'Authorization')).toBe('Bearer token-salvo')
    expect(corpoDaChamada(posts(chamadas)[0])).toEqual({
      nome: 'Visitas a clientes novos',
      'id tipo': 1,
      'tipo de valor': 'numeral',
      descricao: null,
    })

    const linha = (await screen.findByText('Visitas a clientes novos')).closest('tr')!
    expect(within(linha).getByText('Ativo')).toHaveClass('etiqueta--sucesso')
  })

  it('POST 2xx que responde só { mensagem: "apontamento cadastrado" }: o diálogo fecha, nenhuma mensagem de erro aparece e a lista recarregada mostra o novo apontamento', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('admin', {
      respostaGravado: () => respostaJson({ mensagem: 'apontamento cadastrado' }, 201),
    })
    await abrirTela()

    await cadastrar(user, 'Visitas a clientes novos', 'Comercial')

    await screen.findByText('Apontamento cadastrado.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(posts(chamadas)).toHaveLength(1)
    expect(chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)).toHaveLength(2)

    const linha = (await screen.findByText('Visitas a clientes novos')).closest('tr')!
    expect(within(linha).getByText('Ativo')).toHaveClass('etiqueta--sucesso')
  })

  it('POST 2xx com envelope { mensagem, apontamento }: cadastra sem erro e o novo apontamento aparece na lista', async () => {
    const user = usuarioRapido()
    simularSessao('admin', {
      respostaGravado: (criado) => respostaJson({ mensagem: 'Apontamento cadastrado.', apontamento: criado }, 201),
    })
    await abrirTela()

    await cadastrar(user, 'Visitas a clientes novos', 'Comercial')

    await screen.findByText('Apontamento cadastrado.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await screen.findByText('Visitas a clientes novos')).toBeInTheDocument()
  })

  it('POST 201 com corpo vazio: cadastra sem erro e o novo apontamento aparece na lista', async () => {
    const user = usuarioRapido()
    simularSessao('admin', { respostaGravado: () => new Response('', { status: 201 }) })
    await abrirTela()

    await cadastrar(user, 'Visitas a clientes novos', 'Comercial')

    await screen.findByText('Apontamento cadastrado.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await screen.findByText('Visitas a clientes novos')).toBeInTheDocument()
  })

  it('Validador cadastra do mesmo modo', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('validador')
    await abrirTela()

    await cadastrar(user, 'Fechamento de caixa conferido', 'Financeiro')

    await screen.findByText('Apontamento cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ nome: 'Fechamento de caixa conferido', 'id tipo': 2 })
    expect(await screen.findByText('Fechamento de caixa conferido')).toBeInTheDocument()
  })

  it('Preenchedor cadastra no seu tipo (o select só oferece os tipos dele)', async () => {
    const user = usuarioRapido()
    const chamadas = simularSessao('preenchedor')
    await abrirTela()

    await user.click(screen.getByRole('button', { name: 'Novo apontamento' }))
    const form = screen.getByRole('dialog', { name: 'Novo apontamento' })
    expect(within(within(form).getByRole('combobox', { name: 'Tipo' })).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Selecione',
      'Comercial',
    ])
    await user.keyboard('{Escape}')

    await cadastrar(user, 'Prospecções registradas', 'Comercial')

    await screen.findByText('Apontamento cadastrado.')
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ 'id tipo': 1 })
    expect(await screen.findByText('Prospecções registradas')).toBeInTheDocument()
  })

  it('Preenchedor recusado pela API (403 em tipo alheio) vê a mensagem da API dentro do diálogo, que permanece aberto', async () => {
    const user = usuarioRapido()
    // O acesso ainda lista Financeiro (vínculo desatualizado), mas a API recusa o cadastro nesse tipo.
    simularSessao('preenchedor', {
      tiposDoUsuario: [TIPOS_DO_USUARIO_API[0], TIPOS_DO_USUARIO_API[1]],
      aoCriar: () => respostaErro(403, 'Você só pode cadastrar apontamentos nos seus tipos.'),
    })
    await abrirTela()

    const form = await cadastrar(user, 'Conciliação diária', 'Financeiro')

    expect(await within(form).findByRole('alert')).toHaveTextContent('Você só pode cadastrar apontamentos nos seus tipos.')
    expect(screen.getByRole('dialog', { name: 'Novo apontamento' })).toBeInTheDocument()
    expect(screen.queryByText('Apontamento cadastrado.')).not.toBeInTheDocument()
    expect(screen.queryByText('Conciliação diária')).not.toBeInTheDocument()
    // 403 não encerra a sessão.
    expect(screen.getByRole('heading', { level: 1, name: 'Apontamentos' })).toBeInTheDocument()
  })

  it('401 ao cadastrar (token recusado) encerra a sessão e volta ao login com "Sua sessão expirou. Entre novamente."', async () => {
    const user = usuarioRapido()
    simularSessao('admin', { aoCriar: () => respostaErro(401) })
    await abrirTela()

    await cadastrar(user, 'Visitas', 'Comercial')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(obterToken()).toBeNull()
  })
})
