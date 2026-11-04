import { act, screen } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { renderizarApp } from '../../test/renderizarApp'

const MENSAGEM = 'Usuário sem acesso ao sistema, favor verificar com a equipe de Departamento Pessoal'

describe('F2.8 — Tela de usuário sem acesso (integração: perfil null → sem acesso)', () => {
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

  const acessoSemPerfil = () => respostaJson(acessoApi({ perfil: null, tipos: [], filiais: [], 'periodo aberto': null }))

  it('login válido de usuário com perfil null leva à tela de sem acesso, sem abas nem cabeçalho', async () => {
    const user = usuarioRapido()
    simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      'GET /api/ped/acesso': acessoSemPerfil,
    })
    renderizarApp('/login')

    await user.type(await screen.findByLabelText('Usuário'), 'fulano')
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(MENSAGEM)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Início' })).not.toBeInTheDocument()
  })

  it('com token salvo e perfil null, abrir a raiz leva à tela de sem acesso', async () => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, { 'GET /api/ped/acesso': acessoSemPerfil })

    renderizarApp('/')

    expect(await screen.findByText(MENSAGEM)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Abas' })).not.toBeInTheDocument()
  })

  it.each(['/tipos', '/apontamentos', '/preenchimento'])('usuário sem acesso abrindo %s diretamente vê a tela de sem acesso', async (caminho) => {
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, { 'GET /api/ped/acesso': acessoSemPerfil })

    renderizarApp(caminho)

    expect(await screen.findByText(MENSAGEM)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toHaveTextContent(/^(Tipos|Apontamentos|Preenchimento)$/)
  })

  it('"Voltar ao login" limpa a sessão e abre a tela de login', async () => {
    const user = usuarioRapido()
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, { 'GET /api/ped/acesso': acessoSemPerfil })
    renderizarApp('/')
    await screen.findByText(MENSAGEM)

    await user.click(screen.getByRole('button', { name: 'Voltar ao login' }))

    expect(await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM)).not.toBeInTheDocument()
    expect(obterToken()).toBeNull()
    expect(sessionStorage.getItem('ped.token')).toBeNull()
  })

  it('depois de voltar ao login, tentar abrir uma aba continua exigindo login', async () => {
    const user = usuarioRapido()
    sessionStorage.setItem('ped.token', 'token-salvo')
    simularApi(fetchFalso, { 'GET /api/ped/acesso': acessoSemPerfil })
    const { roteador } = renderizarApp('/')
    await screen.findByText(MENSAGEM)

    await user.click(screen.getByRole('button', { name: 'Voltar ao login' }))
    await screen.findByRole('heading', { name: 'Programa de Excelência em Distribuição' })

    await act(async () => {
      await roteador.navigate('/apontamentos')
    })

    expect(screen.getByRole('heading', { name: 'Programa de Excelência em Distribuição' })).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM)).not.toBeInTheDocument()
  })
})
