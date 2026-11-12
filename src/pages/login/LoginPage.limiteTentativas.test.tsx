import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { SessaoContexto, type Sessao } from '../../sessao/SessaoProvider'
import { sessaoFalsa } from '../../test/sessaoFalsa'
import { LoginPage } from './LoginPage'

/**
 * F2.2 (alteração de 12/11/2026) — bloqueio temporário do botão "Entrar" após 429.
 * Documento do back-end: docs/backend/FRONT-erros-e-limite-de-login (1).md.
 *
 * Textos:
 * - botão durante o bloqueio: "Aguarde N s" (desabilitado);
 * - contagem visível: "Tente novamente em N s." (fora de região viva, para não ser anunciada a cada segundo);
 * - a mensagem da API continua no alerta; ao zerar, a contagem some, o alerta permanece e o botão volta a "Entrar".
 * Sem "segundos para tentar novamente" nem Retry-After (tentarNovamenteEm ausente), o bloqueio é de 60 s.
 *
 * Relógio: a digitação usa o user-event com relógio real; o relógio falso (setTimeout/setInterval/Date)
 * é ligado logo antes do envio, e as interações seguintes usam fireEvent (o asyncWrapper do user-event
 * espera um setTimeout real e travaria com o relógio falso). Assim a contagem é determinística.
 */

const MENSAGEM_429_API = 'muitas tentativas de login - aguarde alguns instantes e tente novamente'

/** Emula o contrato do provider: ao falhar, `entrar` expõe a mensagem em `erro` e rejeita com o erro original. */
function ProvedorComErro({ entrar, children }: { entrar: Sessao['entrar']; children: ReactNode }) {
  const [erro, setErro] = useState<string | null>(null)
  const sessao = sessaoFalsa({
    estado: 'anonimo',
    acesso: null,
    erro,
    entrar: async (usuario, senha) => {
      try {
        await entrar(usuario, senha)
        setErro(null)
      } catch (falha) {
        setErro(falha instanceof ApiError ? falha.mensagem : 'Erro desconhecido')
        throw falha
      }
    },
  })
  return <SessaoContexto.Provider value={sessao}>{children}</SessaoContexto.Provider>
}

function renderizar(entrar: Sessao['entrar']) {
  return render(
    <ProvedorComErro entrar={entrar}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>Página inicial</h1>} />
        </Routes>
      </MemoryRouter>
    </ProvedorComErro>,
  )
}

function erro429(tentarNovamenteEm?: number): ApiError {
  return new ApiError(429, MENSAGEM_429_API, { mensagem: MENSAGEM_429_API }, tentarNovamenteEm)
}

async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('F2.2 — Tela de login: limite de tentativas (429)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const configurarUsuario = () => userEvent.setup({ delay: null })

  /** Digita com o relógio real, liga o relógio falso e envia. */
  async function preencherEEntrar(user: ReturnType<typeof configurarUsuario>) {
    await user.type(screen.getByLabelText('Usuário'), 'fulano')
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    await clicar('Entrar')
  }

  async function clicar(nome: string) {
    fireEvent.click(screen.getByRole('button', { name: nome }))
    await avancar(0)
  }

  /** Equivale ao Enter num campo (envio implícito do formulário). */
  async function enviarFormulario() {
    fireEvent.submit(screen.getByLabelText('Senha').closest('form')!)
    await avancar(0)
  }

  it('429: mostra a mensagem da API no alerta e desabilita o botão com "Aguarde 42 s"', async () => {
    const user = configurarUsuario()
    renderizar(vi.fn().mockRejectedValue(erro429(42)))

    await preencherEEntrar(user)

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_429_API)
    const botao = screen.getByRole('button', { name: 'Aguarde 42 s' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('type', 'submit')
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(screen.getByText('Tente novamente em 42 s.')).toBeInTheDocument()
  })

  it('a contagem regressiva diminui a cada segundo', async () => {
    const user = configurarUsuario()
    renderizar(vi.fn().mockRejectedValue(erro429(42)))

    await preencherEEntrar(user)
    await avancar(1000)

    expect(screen.getByRole('button', { name: 'Aguarde 41 s' })).toBeDisabled()
    expect(screen.getByText('Tente novamente em 41 s.')).toBeInTheDocument()

    await avancar(10_000)

    expect(screen.getByRole('button', { name: 'Aguarde 31 s' })).toBeDisabled()
    expect(screen.getByText('Tente novamente em 31 s.')).toBeInTheDocument()
  })

  it('no último segundo ainda bloqueia; ao zerar o botão volta a "Entrar" habilitado, a contagem some e o alerta permanece', async () => {
    const user = configurarUsuario()
    renderizar(vi.fn().mockRejectedValue(erro429(42)))

    await preencherEEntrar(user)
    await avancar(41_000)

    expect(screen.getByRole('button', { name: 'Aguarde 1 s' })).toBeDisabled()
    expect(screen.getByText('Tente novamente em 1 s.')).toBeInTheDocument()

    await avancar(1000)

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /^Aguarde/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Tente novamente em/)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_429_API)
  })

  it('sem tempo informado pela API (tentarNovamenteEm ausente), bloqueia por 60 s', async () => {
    const user = configurarUsuario()
    renderizar(vi.fn().mockRejectedValue(erro429(undefined)))

    await preencherEEntrar(user)

    expect(screen.getByRole('button', { name: 'Aguarde 60 s' })).toBeDisabled()
    expect(screen.getByText('Tente novamente em 60 s.')).toBeInTheDocument()

    await avancar(59_000)
    expect(screen.getByRole('button', { name: 'Aguarde 1 s' })).toBeDisabled()

    await avancar(1000)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('a contagem não fica em região viva nem dentro do alerta (não é anunciada a cada segundo)', async () => {
    const user = configurarUsuario()
    renderizar(vi.fn().mockRejectedValue(erro429(42)))

    await preencherEEntrar(user)

    const contagem = screen.getByText('Tente novamente em 42 s.')
    expect(
      contagem.closest('[role="alert"], [role="status"], [role="log"], [aria-live="polite"], [aria-live="assertive"]'),
    ).toBeNull()
    expect(screen.getByRole('alert')).not.toHaveTextContent('Tente novamente em')
  })

  it('não reenvia sozinho: durante e depois do bloqueio, entrar só foi chamado uma vez', async () => {
    const user = configurarUsuario()
    const entrar = vi.fn().mockRejectedValue(erro429(5))
    renderizar(entrar)

    await preencherEEntrar(user)
    await avancar(5000)
    await avancar(60_000)

    expect(entrar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('clicar no botão ou pressionar Enter no formulário durante o bloqueio não envia', async () => {
    const user = configurarUsuario()
    const entrar = vi.fn().mockRejectedValue(erro429(42))
    renderizar(entrar)

    await preencherEEntrar(user)
    await clicar('Aguarde 42 s')
    await enviarFormulario()

    expect(entrar).toHaveBeenCalledTimes(1)
  })

  it('os campos continuam editáveis durante o bloqueio e o que foi digitado é mantido', async () => {
    const user = configurarUsuario()
    renderizar(vi.fn().mockRejectedValue(erro429(42)))

    await preencherEEntrar(user)

    expect(screen.getByLabelText('Usuário')).toHaveValue('fulano')
    expect(screen.getByLabelText('Usuário')).toBeEnabled()
    expect(screen.getByLabelText('Senha')).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo2' } })
    expect(screen.getByLabelText('Senha')).toHaveValue('segredo2')
  })

  it('depois do bloqueio, uma nova tentativa por ação do usuário chama entrar de novo', async () => {
    const user = configurarUsuario()
    const entrar = vi.fn().mockRejectedValueOnce(erro429(3)).mockResolvedValueOnce(undefined)
    renderizar(entrar)

    await preencherEEntrar(user)
    await avancar(3000)
    await clicar('Entrar')

    expect(entrar).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: 'Página inicial' })).toBeInTheDocument()
  })

  it('um novo 429 depois do bloqueio reinicia a contagem com o novo tempo', async () => {
    const user = configurarUsuario()
    const entrar = vi.fn().mockRejectedValueOnce(erro429(3)).mockRejectedValueOnce(erro429(20))
    renderizar(entrar)

    await preencherEEntrar(user)
    await avancar(3000)
    await clicar('Entrar')

    expect(screen.getByRole('button', { name: 'Aguarde 20 s' })).toBeDisabled()
    expect(screen.getByText('Tente novamente em 20 s.')).toBeInTheDocument()
  })

  it.each([
    [401, 'senha incorreta'],
    [404, 'usuario nao encontrado'],
  ])('%i não bloqueia: mostra "%s" e o botão "Entrar" volta habilitado, sem contagem', async (status, mensagem) => {
    const user = configurarUsuario()
    const entrar = vi.fn().mockRejectedValue(new ApiError(status, mensagem, { mensagem }))
    renderizar(entrar)

    await preencherEEntrar(user)

    expect(screen.getByRole('alert')).toHaveTextContent(mensagem)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(screen.queryByText(/^Tente novamente em/)).not.toBeInTheDocument()

    await avancar(60_000)
    expect(entrar).toHaveBeenCalledTimes(1)
  })

  it('desmontar a tela durante o bloqueio não gera erro nem aviso no console', async () => {
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = configurarUsuario()
    const { unmount } = renderizar(vi.fn().mockRejectedValue(erro429(42)))

    await preencherEEntrar(user)
    unmount()
    await avancar(60_000)

    expect(consoleErro).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
