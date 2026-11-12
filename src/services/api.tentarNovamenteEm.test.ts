import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, mensagemPadraoPorStatus } from './api'
import { limparToken } from './sessao'

/**
 * F1.2 (alteração de 12/11/2026) — limite de tentativas de login (`429` com `Retry-After`).
 * Documento do back-end: docs/backend/FRONT-erros-e-limite-de-login (1).md.
 */

const MENSAGEM_429_API = 'muitas tentativas de login - aguarde alguns instantes e tente novamente'

function resposta(corpo: unknown, status: number, cabecalhos: Record<string, string> = {}): Response {
  return new Response(corpo === undefined ? '' : JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...cabecalhos },
  })
}

async function capturarErro(promessa: Promise<unknown>): Promise<ApiError> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ApiError) return erro
    throw erro
  }
  throw new Error('A chamada deveria ter rejeitado com ApiError')
}

describe('F1.2 — Cliente HTTP: tempo de espera do limite de tentativas (ApiError.tentarNovamenteEm)', () => {
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

  it('429 com corpo e Retry-After: ApiError com status 429, a mensagem da API, os dados e tentarNovamenteEm = 42', async () => {
    const corpo = { mensagem: MENSAGEM_429_API, 'segundos para tentar novamente': 42 }
    fetchFalso.mockResolvedValue(resposta(corpo, 429, { 'Retry-After': '42' }))

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST', body: { usuario: 'a', senha: 'b' } }))

    expect(erro.status).toBe(429)
    expect(erro.mensagem).toBe(MENSAGEM_429_API)
    expect(erro.message).toBe(MENSAGEM_429_API)
    expect(erro.dados).toEqual(corpo)
    expect(erro.tentarNovamenteEm).toBe(42)
  })

  it('o campo "segundos para tentar novamente" do corpo tem prioridade sobre o cabeçalho Retry-After', async () => {
    fetchFalso.mockResolvedValue(
      resposta({ mensagem: MENSAGEM_429_API, 'segundos para tentar novamente': 15 }, 429, { 'Retry-After': '42' }),
    )

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro.tentarNovamenteEm).toBe(15)
  })

  it('sem o campo no corpo, usa o cabeçalho Retry-After (segundos)', async () => {
    fetchFalso.mockResolvedValue(resposta({ mensagem: MENSAGEM_429_API }, 429, { 'Retry-After': '30' }))

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro.tentarNovamenteEm).toBe(30)
  })

  it.each([
    ['texto não numérico', 'abc'],
    ['zero', 0],
    ['negativo', -5],
    ['nulo', null],
  ])('campo do corpo inválido (%s) é ignorado e vale o Retry-After', async (_caso, valor) => {
    fetchFalso.mockResolvedValue(
      resposta({ mensagem: MENSAGEM_429_API, 'segundos para tentar novamente': valor }, 429, { 'Retry-After': '20' }),
    )

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro.tentarNovamenteEm).toBe(20)
  })

  it('valor fracionário é arredondado para cima (segundos inteiros)', async () => {
    fetchFalso.mockResolvedValue(resposta({ mensagem: MENSAGEM_429_API, 'segundos para tentar novamente': 41.2 }, 429))

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro.tentarNovamenteEm).toBe(42)
  })

  it.each([
    ['não numérico', 'abc'],
    ['zero', '0'],
    ['negativo', '-3'],
  ])('Retry-After inválido (%s) e sem campo no corpo: tentarNovamenteEm fica undefined', async (_caso, valor) => {
    fetchFalso.mockResolvedValue(resposta({ mensagem: MENSAGEM_429_API }, 429, { 'Retry-After': valor }))

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro.status).toBe(429)
    expect(erro.tentarNovamenteEm).toBeUndefined()
  })

  it('429 sem corpo e sem Retry-After: tentarNovamenteEm undefined e mensagem padrão em pt-BR do 429', async () => {
    fetchFalso.mockResolvedValue(resposta(undefined, 429))

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro.tentarNovamenteEm).toBeUndefined()
    expect(erro.mensagem).toBe('Muitas tentativas. Aguarde alguns instantes e tente novamente.')
  })

  it('mensagemPadraoPorStatus(429) é "Muitas tentativas. Aguarde alguns instantes e tente novamente."', () => {
    expect(mensagemPadraoPorStatus(429)).toBe('Muitas tentativas. Aguarde alguns instantes e tente novamente.')
  })

  it('401 e 404 do login sem esses campos: tentarNovamenteEm undefined e mensagem da API mantida', async () => {
    fetchFalso.mockResolvedValueOnce(resposta({ mensagem: 'senha incorreta' }, 401))
    fetchFalso.mockResolvedValueOnce(resposta({ mensagem: 'usuario nao encontrado' }, 404))

    const erro401 = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))
    const erro404 = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro401.mensagem).toBe('senha incorreta')
    expect(erro401.tentarNovamenteEm).toBeUndefined()
    expect(erro404.mensagem).toBe('usuario nao encontrado')
    expect(erro404.tentarNovamenteEm).toBeUndefined()
  })

  it('falha de rede (status 0): tentarNovamenteEm undefined', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    const erro = await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(erro.status).toBe(0)
    expect(erro.tentarNovamenteEm).toBeUndefined()
  })

  it('o cliente HTTP não repete a requisição sozinho após 429 (uma única chamada a fetch)', async () => {
    fetchFalso.mockResolvedValue(
      resposta({ mensagem: MENSAGEM_429_API, 'segundos para tentar novamente': 42 }, 429, { 'Retry-After': '42' }),
    )

    await capturarErro(apiFetch('/valida-usuario', { method: 'POST' }))

    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('o construtor de ApiError aceita tentarNovamenteEm como 4º argumento (opcional)', () => {
    expect(new ApiError(429, 'x', undefined, 10).tentarNovamenteEm).toBe(10)
    expect(new ApiError(401, 'y').tentarNovamenteEm).toBeUndefined()
  })
})
