import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken, obterToken } from '../../services/sessao'
import { acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { renderizarApp } from '../../test/renderizarApp'

/**
 * F2.2 (alteração de 12/11/2026) — limite de tentativas de login, fluxo completo
 * (LoginPage + SessaoProvider + autenticacao + apiFetch), simulando só a rede.
 * Documento do back-end: docs/backend/FRONT-erros-e-limite-de-login (1).md.
 *
 * O relógio falso (só setTimeout/setInterval/Date) é ligado depois da digitação, logo antes do envio;
 * dali em diante as interações usam fireEvent (o asyncWrapper do user-event espera um setTimeout real).
 * A leitura do corpo da Response continua com o setImmediate real, usado por `processarRede` para
 * esperar a resposta sem avançar o relógio. Assim a contagem é determinística.
 */

const MENSAGEM_429_API = 'muitas tentativas de login - aguarde alguns instantes e tente novamente'
const TITULO_LOGIN = 'Programa de Excelência em Distribuição'

function resposta429(segundos: number | null, retryAfter: string | null): Response {
  const corpo: Record<string, unknown> = { mensagem: MENSAGEM_429_API }
  if (segundos !== null) corpo['segundos para tentar novamente'] = segundos
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (retryAfter !== null) headers['Retry-After'] = retryAfter
  return new Response(JSON.stringify(corpo), { status: 429, headers })
}

/** Deixa as promessas da rede simulada concluírem (sem avançar o relógio falso). */
async function processarRede() {
  await act(async () => {
    for (let i = 0; i < 30; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  })
}

async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('F2.2 — Tela de login: limite de tentativas (integração: 429 da API)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  async function abrirLoginComRelogioFalso() {
    renderizarApp('/login')
    await screen.findByLabelText('Usuário')
    return userEvent.setup({ delay: null })
  }

  /** Digita com o relógio real, liga o relógio falso e envia. */
  async function preencherEEntrar(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Usuário'), 'fulano')
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    await clicar('Entrar')
  }

  async function clicar(nome: string) {
    fireEvent.click(screen.getByRole('button', { name: nome }))
    await processarRede()
  }

  it('429 com "segundos para tentar novamente": mensagem da API, botão "Aguarde 42 s" e contagem até liberar', async () => {
    const chamadas = simularApi(fetchFalso, { 'POST /api/valida-usuario': () => resposta429(42, '42') })
    const user = await abrirLoginComRelogioFalso()

    await preencherEEntrar(user)

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_429_API)
    expect(screen.getByRole('button', { name: 'Aguarde 42 s' })).toBeDisabled()
    expect(screen.getByText('Tente novamente em 42 s.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: TITULO_LOGIN })).toBeInTheDocument()
    expect(obterToken()).toBeNull()

    await avancar(41_000)
    expect(screen.getByRole('button', { name: 'Aguarde 1 s' })).toBeDisabled()

    await avancar(1000)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(screen.queryByText(/^Tente novamente em/)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_429_API)
    expect(chamadas).toHaveLength(1)
  })

  it('sem o campo no corpo, usa o cabeçalho Retry-After', async () => {
    simularApi(fetchFalso, { 'POST /api/valida-usuario': () => resposta429(null, '30') })
    const user = await abrirLoginComRelogioFalso()

    await preencherEEntrar(user)

    expect(screen.getByRole('button', { name: 'Aguarde 30 s' })).toBeDisabled()
    expect(screen.getByText('Tente novamente em 30 s.')).toBeInTheDocument()
  })

  it('sem o campo no corpo e sem Retry-After, bloqueia por 60 s', async () => {
    simularApi(fetchFalso, { 'POST /api/valida-usuario': () => resposta429(null, null) })
    const user = await abrirLoginComRelogioFalso()

    await preencherEEntrar(user)

    expect(screen.getByRole('button', { name: 'Aguarde 60 s' })).toBeDisabled()

    await avancar(60_000)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('não reenvia POST /api/valida-usuario sozinho, nem por clique ou Enter durante o bloqueio', async () => {
    const chamadas = simularApi(fetchFalso, { 'POST /api/valida-usuario': () => resposta429(42, '42') })
    const user = await abrirLoginComRelogioFalso()

    await preencherEEntrar(user)
    await clicar('Aguarde 42 s')
    // Enter num campo = envio implícito do formulário.
    fireEvent.submit(screen.getByLabelText('Senha').closest('form')!)
    await processarRede()
    await avancar(42_000)
    await avancar(60_000)
    await processarRede()

    expect(chamadas.filter((c) => c.caminho === '/api/valida-usuario')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('após liberar, uma nova tentativa do usuário com credenciais corretas entra no sistema', async () => {
    let tentativas = 0
    const chamadas = simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => {
        tentativas += 1
        return tentativas === 1 ? resposta429(5, '5') : respostaJson({ token: 'token-123' })
      },
      'GET /api/ped/acesso': () => respostaJson(acessoApi()),
    })
    const user = await abrirLoginComRelogioFalso()

    await preencherEEntrar(user)
    await avancar(5000)
    await clicar('Entrar')

    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument()
    expect(obterToken()).toBe('token-123')
    expect(chamadas.map((c) => `${c.metodo} ${c.caminho}`)).toEqual([
      'POST /api/valida-usuario',
      'POST /api/valida-usuario',
      'GET /api/ped/acesso',
    ])
  })

  it.each([
    [401, 'senha incorreta'],
    [404, 'usuario nao encontrado'],
  ])('%i: mostra "%s", não bloqueia o botão e não reenvia sozinho', async (status, mensagem) => {
    const chamadas = simularApi(fetchFalso, {
      'POST /api/valida-usuario': () => respostaJson({ mensagem }, status),
    })
    const user = await abrirLoginComRelogioFalso()

    await preencherEEntrar(user)

    expect(screen.getByRole('alert')).toHaveTextContent(mensagem)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(screen.queryByText(/^Tente novamente em/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: TITULO_LOGIN })).toBeInTheDocument()

    await avancar(60_000)
    await processarRede()
    expect(chamadas).toHaveLength(1)
    expect(obterToken()).toBeNull()
  })
})
