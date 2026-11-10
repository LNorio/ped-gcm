import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { dadosExternosAdminApi, integracoesPendentesApi } from '../test/dadosExternosFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import { listarIntegracoesPendentes } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro/integracoes-pendentes'

/**
 * Alerta de integração pendente (F5.17), contrato de 09/11/2026:
 * `GET /api/ped/dados-externos-cadastro/integracoes-pendentes` (só Admin) →
 * `{ quantidade, dados: [{ id, nome, identificador, situacao }] }` — dados ativos/inativos sem integração.
 */
describe('F5.17 — Serviço: listarIntegracoesPendentes()', () => {
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

  it('faz GET .../integracoes-pendentes com o token e devolve { quantidade, dados }', async () => {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson(integracoesPendentesApi(dadosExternosAdminApi())),
    })

    const pendentes = await listarIntegracoesPendentes()

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].metodo).toBe('GET')
    expect(chamadas[0].caminho).toBe(ROTA)
    expect(chamadas[0].url.search).toBe('')
    expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    expect(pendentes).toEqual({
      quantidade: 2,
      dados: [
        { id: 2, nome: 'Cobertura de clientes', identificador: 'COBERTURA', situacao: 'inativo' },
        { id: 5, nome: 'Chamados atendidos no prazo', identificador: 'CHAMADOS_SLA', situacao: 'ativo' },
      ],
    })
  })

  it('usa a quantidade informada pela API (não a contagem da lista)', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () =>
        respostaJson({ quantidade: 11, dados: [{ id: 9, nome: 'Faturamento ERP', identificador: 'FATURAMENTO', situacao: 'ativo' }] }),
    })

    await expect(listarIntegracoesPendentes()).resolves.toMatchObject({ quantidade: 11 })
  })

  it('identificador null é aceito', async () => {
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: () => respostaJson({ quantidade: 1, dados: [{ id: 9, nome: 'X', identificador: null, situacao: 'inativo' }] }),
    })

    await expect(listarIntegracoesPendentes()).resolves.toEqual({
      quantidade: 1,
      dados: [{ id: 9, nome: 'X', identificador: null, situacao: 'inativo' }],
    })
  })

  it('sem pendentes: { quantidade: 0, dados: [] }', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ quantidade: 0, dados: [] }) })

    await expect(listarIntegracoesPendentes()).resolves.toEqual({ quantidade: 0, dados: [] })
  })

  describe('resposta fora do formato → ApiError(200, "Resposta inválida do servidor.")', () => {
    it.each<[string, unknown]>([
      ['sem quantidade', { dados: [] }],
      ['quantidade em texto', { quantidade: '2', dados: [] }],
      ['dados que não é lista', { quantidade: 0, dados: {} }],
      ['item sem id', { quantidade: 1, dados: [{ nome: 'X', identificador: null, situacao: 'ativo' }] }],
      ['item sem nome', { quantidade: 1, dados: [{ id: 1, identificador: null, situacao: 'ativo' }] }],
      ['situação desconhecida', { quantidade: 1, dados: [{ id: 1, nome: 'X', identificador: null, situacao: 'pendente' }] }],
      ['identificador que não é texto', { quantidade: 1, dados: [{ id: 1, nome: 'X', identificador: 10, situacao: 'ativo' }] }],
      ['lista pura', [{ id: 1, nome: 'X', identificador: null, situacao: 'ativo' }]],
      ['texto solto', 'ok'],
    ])('%s', async (_nome, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await listarIntegracoesPendentes().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  it('403 (perfil que não é Admin) e falha de rede são propagados como ApiError', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })
    await expect(listarIntegracoesPendentes()).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(listarIntegracoesPendentes()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
  })
})
