import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { GRUPO_CAIXA_API, GRUPO_FINANCEIRO_API, grupoDominio, gruposApi } from '../test/tiposFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { definirToken, limparToken } from './sessao'
import { listarGrupos } from './tiposService'

/**
 * A-02 (06/11/2026): `GET /api/ped/grupos` (Admin e Validador), filtro opcional `?busca=`.
 * Resposta: `[{ "id": 4, "nome": "DEF_OPERADOR DE CAIXA", "quantidade usuarios": 37, "tipos": [{ "id": 1, "nome": "Comercial" }] }]`.
 */
describe('F3.1 — Serviço de tipos: lista de grupos do ERP (listarGrupos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  it('sem filtro: faz GET /api/ped/grupos sem query, pedindo JSON com o token da sessão', async () => {
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
    })

    await listarGrupos()

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].metodo).toBe('GET')
    expect(chamadas[0].caminho).toBe('/api/ped/grupos')
    expect(chamadas[0].url.search).toBe('')
    expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
    expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    expect(chamadas[0].init?.body).toBeUndefined()
  })

  it('com busca: envia ?busca= com o texto informado', async () => {
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaJson([GRUPO_CAIXA_API]),
    })

    await listarGrupos({ busca: 'caixa' })

    expect(chamadas[0].url.searchParams.get('busca')).toBe('caixa')
  })

  it.each([[''], ['   ']])('busca vazia ou só com espaços (%j) é omitida da query', async (busca) => {
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
    })

    await listarGrupos({ busca })

    expect(chamadas[0].url.search).toBe('')
  })

  it('converte cada grupo para o domínio (camelCase), mantendo a ordem da API', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaJson(gruposApi()),
    })

    const grupos = await listarGrupos()

    expect(grupos).toEqual(gruposApi().map(grupoDominio))
    expect(grupos[0]).toEqual({
      id: 4,
      nome: 'DEF_OPERADOR DE CAIXA',
      quantidadeUsuarios: 37,
      tipos: [
        { id: 1, nome: 'Comercial' },
        { id: 9, nome: 'Marketing' },
      ],
    })
  })

  it('"quantidade usuarios" ausente vira 0 e "tipos" ausente ou null vira []', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/grupos': () =>
        respostaJson([
          { id: 4, nome: 'DEF_OPERADOR DE CAIXA' },
          { id: 9, nome: 'DEF_ANALISTA FINANCEIRO', 'quantidade usuarios': null, tipos: null },
        ]),
    })

    await expect(listarGrupos()).resolves.toEqual([
      { id: 4, nome: 'DEF_OPERADOR DE CAIXA', quantidadeUsuarios: 0, tipos: [] },
      { id: 9, nome: 'DEF_ANALISTA FINANCEIRO', quantidadeUsuarios: 0, tipos: [] },
    ])
  })

  it('lista vazia resolve []', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaJson([]),
    })

    await expect(listarGrupos()).resolves.toEqual([])
  })

  it('resposta 200 que não é lista ou com corpo vazio rejeita com ApiError de resposta inválida', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaJson({ mensagem: 'ok' }),
    })
    const erro = await listarGrupos().catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })

    simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => new Response('', { status: 200 }),
    })
    await expect(listarGrupos()).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
  })

  it('grupo sem nome, com id em texto ou nulo rejeita com ApiError de resposta inválida', async () => {
    for (const invalido of [{ id: 4 }, { ...GRUPO_FINANCEIRO_API, id: '9' }, null]) {
      simularApi(fetchFalso, {
        'GET /api/ped/grupos': () => respostaJson([GRUPO_CAIXA_API, invalido]),
      })
      await expect(listarGrupos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    }
  })

  it('403 rejeita com ApiError e a mensagem da API; 500 sem mensagem usa a mensagem padrão', async () => {
    simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaErro(403, 'Sem permissão.'),
    })
    const erro = await listarGrupos().catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 403, mensagem: 'Sem permissão.' })

    simularApi(fetchFalso, {
      'GET /api/ped/grupos': () => respostaErro(500),
    })
    await expect(listarGrupos()).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
  })

  it('falha de rede rejeita com ApiError status 0', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(listarGrupos()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
  })
})
