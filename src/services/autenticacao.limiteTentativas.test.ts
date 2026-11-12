import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { ApiError } from './api'
import { entrar } from './autenticacao'
import { limparToken, obterToken } from './sessao'

/**
 * F2.1 (alteração de 12/11/2026) — limite de tentativas de login.
 * `POST /api/valida-usuario` responde 429 com `Retry-After` ao exceder 5/min (usuário+IP) ou 30/min (IP).
 * Cada reenvio conta como tentativa: `entrar` nunca repete a chamada sozinho (429, 401 ou 404).
 */

const MENSAGEM_429_API = 'muitas tentativas de login - aguarde alguns instantes e tente novamente'

function resposta429(): Response {
  return new Response(JSON.stringify({ mensagem: MENSAGEM_429_API, 'segundos para tentar novamente': 42 }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '42' },
  })
}

async function capturarErro(promessa: Promise<unknown>): Promise<ApiError> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ApiError) return erro
    throw erro
  }
  throw new Error('entrar deveria ter rejeitado com ApiError')
}

describe('F2.1 — Autenticação: limite de tentativas de login (429)', () => {
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

  it('429: rejeita com ApiError 429, a mensagem da API e tentarNovamenteEm = 42, sem guardar token', async () => {
    simularApi(fetchFalso, { 'POST /api/valida-usuario': () => resposta429() })

    const erro = await capturarErro(entrar('fulano', 'segredo'))

    expect(erro.status).toBe(429)
    expect(erro.mensagem).toBe(MENSAGEM_429_API)
    expect(erro.tentarNovamenteEm).toBe(42)
    expect(obterToken()).toBeNull()
    expect(sessionStorage.getItem('ped.token')).toBeNull()
  })

  it.each([
    [429, () => resposta429()],
    [401, () => respostaJson({ mensagem: 'senha incorreta' }, 401)],
    [404, () => respostaJson({ mensagem: 'usuario nao encontrado' }, 404)],
  ])('não reenvia POST /api/valida-usuario sozinho após %i (uma única chamada)', async (_status, rota) => {
    const chamadas = simularApi(fetchFalso, { 'POST /api/valida-usuario': rota })

    await capturarErro(entrar('fulano', 'segredo'))

    expect(chamadas).toHaveLength(1)
  })

  it('401 "senha incorreta" e 404 "usuario nao encontrado" mantêm a mensagem da API', async () => {
    simularApi(fetchFalso, { 'POST /api/valida-usuario': () => respostaJson({ mensagem: 'senha incorreta' }, 401) })
    expect((await capturarErro(entrar('fulano', 'errada'))).mensagem).toBe('senha incorreta')

    simularApi(fetchFalso, { 'POST /api/valida-usuario': () => respostaJson({ mensagem: 'usuario nao encontrado' }, 404) })
    expect((await capturarErro(entrar('ninguem', 'x'))).mensagem).toBe('usuario nao encontrado')
  })
})
