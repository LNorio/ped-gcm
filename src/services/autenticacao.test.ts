import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FILIAIS_API, acessoApi, cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { ApiError, EVENTO_SESSAO_EXPIRADA, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { entrar, obterAcesso } from './autenticacao'
import { definirToken, limparToken, obterToken } from './sessao'

describe('F2.1 — Autenticação e sessão', () => {
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

  describe('entrar(usuario, senha)', () => {
    it('faz POST /api/valida-usuario com { usuario, senha } em JSON e sem Authorization', async () => {
      const chamadas = simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      })

      await entrar('fulano', 'segredo')

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe('/api/valida-usuario')
      expect(corpoDaChamada(chamadas[0])).toEqual({ usuario: 'fulano', senha: 'segredo' })
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBeNull()
    })

    it('devolve o token e o guarda na sessão (memória e sessionStorage)', async () => {
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      })

      const token = await entrar('fulano', 'segredo')

      expect(token).toBe('token-123')
      expect(obterToken()).toBe('token-123')
      expect(sessionStorage.getItem('ped.token')).toBe('token-123')
    })

    it('nunca armazena a senha', async () => {
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
      })

      await entrar('fulano', 'segredo-super-secreto')

      const valoresGuardados = [
        ...Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.getItem(sessionStorage.key(i)!)),
        ...Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)!)),
      ]
      expect(valoresGuardados.some((valor) => valor?.includes('segredo-super-secreto'))).toBe(false)
    })

    it('credenciais inválidas (401 com mensagem) rejeitam com ApiError e a mensagem da API, sem guardar token', async () => {
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaErro(401, 'Usuário ou senha inválidos.'),
      })

      await expect(entrar('fulano', 'errada')).rejects.toBeInstanceOf(ApiError)
      await expect(entrar('fulano', 'errada')).rejects.toMatchObject({
        status: 401,
        mensagem: 'Usuário ou senha inválidos.',
      })
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('login recusado (401 sem token na sessão) não dispara o evento de sessão expirada', async () => {
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaErro(401, 'Usuário ou senha inválidos.'),
      })

      await expect(entrar('fulano', 'errada')).rejects.toBeInstanceOf(ApiError)

      expect(ouvinte).not.toHaveBeenCalled()
      window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
    })

    it('falha de rede rejeita com ApiError status 0 e a mensagem padrão de conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(entrar('fulano', 'segredo')).rejects.toMatchObject({
        status: 0,
        mensagem: MENSAGEM_SEM_CONEXAO,
      })
      expect(obterToken()).toBeNull()
    })

    it('resposta 200 sem o campo "token" rejeita com ApiError de resposta inválida e não guarda token', async () => {
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaJson({ mensagem: 'ok' }),
      })

      await expect(entrar('fulano', 'segredo')).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
      expect(obterToken()).toBeNull()
    })

    it('substitui um token anterior ao entrar de novo', async () => {
      definirToken('token-antigo')
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-novo' }),
      })

      await entrar('fulano', 'segredo')

      expect(obterToken()).toBe('token-novo')
      expect(sessionStorage.getItem('ped.token')).toBe('token-novo')
    })
  })

  describe('obterAcesso()', () => {
    it('faz GET /api/ped/acesso com o Bearer da sessão e devolve o Acesso convertido (paraAcesso)', async () => {
      definirToken('token-123')
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/acesso': () =>
          respostaJson(
            acessoApi({
              perfil: 'validador',
              'todas as filiais': true,
              filiais: FILIAIS_API,
            }),
          ),
      })

      const acesso = await obterAcesso()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe('/api/ped/acesso')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(acesso).toEqual({
        idColaborador: 12,
        nome: 'Fulano',
        perfil: 'validador',
        tipos: [{ id: 1, nome: 'Comercial' }],
        todasAsFiliais: true,
        filiais: [
          { codigo: '100', nome: 'MATRIZ', empresa: null },
          { codigo: '101', nome: 'CAMPO GRANDE', empresa: null },
          { codigo: '102', nome: 'DOURADOS', empresa: null },
        ],
        periodoAberto: '2026-10-01',
      })
    })

    it('usuário sem acesso ao PED devolve perfil null (não é erro)', async () => {
      definirToken('token-123')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: null, tipos: [], filiais: [], 'periodo aberto': null })),
      })

      const acesso = await obterAcesso()

      expect(acesso.perfil).toBeNull()
      expect(acesso.nome).toBe('Fulano')
      expect(acesso.filiais).toEqual([])
      expect(acesso.periodoAberto).toBeNull()
    })

    it('token recusado (401) rejeita com ApiError e dispara o evento de sessão expirada', async () => {
      definirToken('token-vencido')
      const ouvinte = vi.fn()
      window.addEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaErro(401),
      })

      await expect(obterAcesso()).rejects.toMatchObject({ status: 401 })

      expect(ouvinte).toHaveBeenCalledTimes(1)
      window.removeEventListener(EVENTO_SESSAO_EXPIRADA, ouvinte)
    })

    it('403 rejeita com ApiError e a mensagem da API', async () => {
      definirToken('token-123')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaErro(403, 'Usuário sem acesso à plataforma.'),
      })

      await expect(obterAcesso()).rejects.toMatchObject({ status: 403, mensagem: 'Usuário sem acesso à plataforma.' })
    })
  })
})
