import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESSAO_EXPIRADA } from '../services/api'
import { limparToken, obterToken } from '../services/sessao'
import { acessoApi, respostaJson, simularApi, type ChamadaRegistrada } from '../test/apiFalsa'
import { adiado } from '../test/inicioFalsos'
import { usuarioRapido } from '../test/usuario'
import { ouvirAcessoObtido } from './acessoObtido'
import { SessaoProvider, useSessao } from './SessaoProvider'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'

/** Nome do usuário devolvido por GET /api/ped/acesso a cada login, na ordem (para distinguir os logins). */
const NOMES = ['Fulano', 'Beltrano', 'Ciclano', 'Joana']

function Consumidor() {
  const sessao = useSessao()
  return (
    <div>
      <output aria-label="Estado">{sessao.estado}</output>
      <output aria-label="Nome">{sessao.acesso?.nome ?? ''}</output>
      <output aria-label="Erro">{sessao.erro ?? ''}</output>
      <button
        type="button"
        onClick={() => {
          sessao.entrar('fulano', 'segredo').catch(() => {})
        }}
      >
        Entrar
      </button>
      <button type="button" onClick={() => sessao.sair()}>
        Sair
      </button>
    </div>
  )
}

function renderizar() {
  return render(
    <SessaoProvider>
      <Consumidor />
    </SessaoProvider>,
  )
}

const estado = () => screen.getByRole('status', { name: 'Estado' })
const nome = () => screen.getByRole('status', { name: 'Nome' })
const erro = () => screen.getByRole('status', { name: 'Erro' })

/** 401 de uma chamada autenticada (o cliente HTTP dispara o evento). */
function receber401() {
  act(() => {
    window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
  })
}

/** Dá tempo a qualquer expiração residual ou adiada se manifestar. */
async function aguardarEfeitos() {
  await act(async () => {
    await new Promise((resolver) => setTimeout(resolver, 20))
  })
}

const getsAcesso = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/acesso')

/**
 * F2.5 — Marca de autenticação pendente do SessaoProvider (revisão de 16/11/2026).
 *
 * A expiração adiada (401 que chega antes de a sessão autenticada aparecer) não pode ficar presa: depois
 * de um novo login com a sessão já autenticada (sem sair antes) ou de dois logins concorrentes, um 401 leva
 * ao login com o aviso de sessão expirada; e sair no meio de uma expiração adiada não pode derrubar o
 * próximo login.
 */
describe('F2.5 — Sessão expirada depois de um novo login com a sessão já autenticada', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let pararDeOuvir: (() => void) | null = null

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    pararDeOuvir?.()
    pararDeOuvir = null
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  /** Cada login recebe um token e um nome próprios, na ordem das chamadas. */
  function simularLogins() {
    let logins = 0
    let acessos = 0
    return simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => {
        logins += 1
        return respostaJson({ token: `token-${logins}` })
      },
      'GET /api/ped/acesso': () => {
        const nomeDoAcesso = NOMES[acessos] ?? 'Outro'
        acessos += 1
        return respostaJson(acessoApi({ perfil: 'admin', nome: nomeDoAcesso }))
      },
    })
  }

  it('novo login sem sair antes: um 401 seguinte leva ao login com o aviso de sessão expirada', async () => {
    const user = usuarioRapido()
    simularLogins()
    renderizar()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(nome()).toHaveTextContent('Fulano'))

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(nome()).toHaveTextContent('Beltrano'))
    expect(estado()).toHaveTextContent('autenticado')

    receber401()

    await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
    expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(nome()).toHaveTextContent('')
    expect(obterToken()).toBeNull()
  })

  it('novo login sem sair antes, com 401 de consulta antecipada: a sessão aparece e logo depois expira', async () => {
    const user = usuarioRapido()
    simularLogins()
    renderizar()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(nome()).toHaveTextContent('Fulano'))

    // O 401 chega antes de a sessão do novo login aparecer (consulta antecipada da tela).
    let restantes = 1
    pararDeOuvir = ouvirAcessoObtido(() => {
      if (restantes <= 0) return
      restantes -= 1
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
    })
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
    expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(nome()).toHaveTextContent('')
    expect(obterToken()).toBeNull()
  })

  it('dois logins concorrentes: depois das duas respostas, um 401 leva ao login com o aviso de sessão expirada', async () => {
    const user = usuarioRapido()
    const primeiroAcesso = adiado<Response>()
    const segundoAcesso = adiado<Response>()
    let acessos = 0
    const chamadas = simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      'GET /api/ped/acesso': () => {
        acessos += 1
        return acessos === 1 ? primeiroAcesso.promessa : segundoAcesso.promessa
      },
    })
    renderizar()

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(2))

    await act(async () => {
      primeiroAcesso.resolver(respostaJson(acessoApi({ perfil: 'admin', nome: 'Fulano' })))
    })
    await waitFor(() => expect(nome()).toHaveTextContent('Fulano'))
    expect(estado()).toHaveTextContent('autenticado')

    await act(async () => {
      segundoAcesso.resolver(respostaJson(acessoApi({ perfil: 'admin', nome: 'Beltrano' })))
    })
    await waitFor(() => expect(nome()).toHaveTextContent('Beltrano'))
    expect(estado()).toHaveTextContent('autenticado')

    receber401()

    await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
    expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    expect(nome()).toHaveTextContent('')
    expect(obterToken()).toBeNull()
  })

  it('sair com uma expiração adiada pendente: o próximo login sem 401 permanece autenticado', async () => {
    const user = usuarioRapido()
    const chamadas = simularLogins()
    renderizar()
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(nome()).toHaveTextContent('Fulano'))

    // Novo login sem sair antes, com um 401 de consulta antecipada (expiração adiada).
    let restantes = 1
    pararDeOuvir = ouvirAcessoObtido(() => {
      if (restantes <= 0) return
      restantes -= 1
      window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
    })
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await aguardarEfeitos()

    await user.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))

    // Novo login, sem nenhum 401.
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(getsAcesso(chamadas)).toHaveLength(3))
    await aguardarEfeitos()

    expect(estado()).toHaveTextContent('autenticado')
    expect(nome()).toHaveTextContent('Ciclano')
    expect(erro()).toHaveTextContent('')
    expect(obterToken()).toBe('token-3')
  })
})
