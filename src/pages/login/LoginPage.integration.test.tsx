import { screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { limparToken, obterToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { renderizarApp } from '../../test/renderizarApp'

describe('F2.2 — Tela de login (integração: login → Início)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  async function preencherEEntrar(usuario: string, senha: string) {
    const user = usuarioRapido()
    await user.type(await screen.findByLabelText('Usuário'), usuario)
    await user.type(screen.getByLabelText('Senha'), senha)
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
  }

  it('login válido: chama a API, guarda o token, obtém o acesso e abre o Início com o cabeçalho do usuário', async () => {
    const chamadas = simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
    })
    renderizarApp('/login')

    await preencherEEntrar('fulano', 'segredo')

    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument()
    expect(screen.getByText('Olá, Fulano')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Programa de Excelência em Distribuição' })).not.toBeInTheDocument()

    expect(chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho}`)).toEqual([
      'POST /api/valida-usuario',
      'GET /api/ped/acesso',
    ])
    expect(corpoDaChamada(chamadas[0])).toEqual({ usuario: 'fulano', senha: 'segredo' })
    expect(new Headers(chamadas[1].init?.headers).get('Authorization')).toBe('Bearer token-123')
    expect(obterToken()).toBe('token-123')
    expect(sessionStorage.getItem('ped.token')).toBe('token-123')
  })

  it('a senha não fica armazenada em nenhum storage após o login', async () => {
    simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      'GET /api/ped/acesso': () => respostaJson(acessoApi()),
    })
    renderizarApp('/login')

    await preencherEEntrar('fulano', 'segredo-super-secreto')
    await screen.findByRole('heading', { name: 'Início' })

    const guardados = [
      ...Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.getItem(sessionStorage.key(i)!)),
      ...Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)!)),
    ]
    expect(guardados.some((valor) => valor?.includes('segredo-super-secreto'))).toBe(false)
  })

  it('abrindo a aplicação na raiz sem sessão, cai no login e, após entrar, volta ao Início', async () => {
    simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      'GET /api/ped/acesso': () => respostaJson(acessoApi()),
    })
    renderizarApp('/')

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()

    await preencherEEntrar('fulano', 'segredo')

    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument()
  })

  it('credenciais inválidas: mostra a mensagem da API junto ao formulário e permanece no login sem token', async () => {
    const chamadas = simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaErro(401, 'Usuário ou senha inválidos.'),
    })
    renderizarApp('/login')

    await preencherEEntrar('fulano', 'errada')

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos.')
    expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(chamadas).toHaveLength(1)
    expect(obterToken()).toBeNull()
    expect(sessionStorage.getItem('ped.token')).toBeNull()
  })

  it('sem conexão: mostra "Não foi possível conectar ao servidor." e permanece no login', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
    renderizarApp('/login')

    await preencherEEntrar('fulano', 'segredo')

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
    expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
  })

  it('erro ao obter o acesso depois do login (500) mostra a mensagem e não entra no sistema', async () => {
    simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      'GET /api/ped/acesso': () => respostaErro(500),
    })
    renderizarApp('/login')

    await preencherEEntrar('fulano', 'segredo')

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor. Tente novamente mais tarde.')
    expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Início' })).not.toBeInTheDocument()
  })

  it('após um erro, uma nova tentativa válida entra no sistema e some o alerta', async () => {
    let tentativas = 0
    simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => {
        tentativas += 1
        return tentativas === 1 ? respostaErro(401, 'Usuário ou senha inválidos.') : respostaJson({ token: 'token-123' })
      },
      'GET /api/ped/acesso': () => respostaJson(acessoApi()),
    })
    renderizarApp('/login')
    const user = usuarioRapido()

    await preencherEEntrar('fulano', 'errada')
    await screen.findByRole('alert')

    await user.clear(screen.getByLabelText('Senha'))
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument()
    const cabecalho = screen.getByRole('banner')
    expect(within(cabecalho).getByText('Olá, Fulano')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
