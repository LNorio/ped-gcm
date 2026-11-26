import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  CHAVE_ROTA_ALERTAS_MENU,
  MENSAGEM_ERRO_ALERTAS_MENU,
  ROTA_ALERTAS_MENU,
  alertasMenuAdminApi,
  alertasMenuGuiaApi,
  alertasMenuPreenchedorApi,
  respostaLimiteAlertasMenu,
} from '../test/alertasMenuFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { obterAlertasMenu, type AlertasMenu } from './alertasMenuService'
import { definirToken, limparToken } from './sessao'

/**
 * Serviço dos alertas das abas do menu (`GET /api/ped/alertas-menu`, `docs/backend/FRONT-alertas-menu.md`
 * e `docs/backend/API (31).md`): sem parâmetros (não envia `?filial`), converte a resposta para o domínio
 * (`AlertasMenu`), ignora chaves de aba desconhecidas e rejeita formatos inválidos.
 */
describe('F2.12 — Serviço dos alertas das abas do menu (obterAlertasMenu)', () => {
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

  function simularResposta(corpo: unknown) {
    return simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaJson(corpo) })
  }

  describe('chamada', () => {
    it('faz GET /api/ped/alertas-menu sem query (sem ?filial), pedindo JSON e com o token', async () => {
      const chamadas = simularResposta(alertasMenuGuiaApi())

      await obterAlertasMenu()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA_ALERTAS_MENU)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('repassa o signal recebido para a requisição', async () => {
      const chamadas = simularResposta(alertasMenuGuiaApi())
      const controle = new AbortController()

      await obterAlertasMenu({ signal: controle.signal })

      expect(chamadas[0].init?.signal).toBe(controle.signal)
    })
  })

  describe('conversão para o domínio', () => {
    it('converte o exemplo do guia (FRONT-alertas-menu.md): total, itens com código, quantidade e descrição', async () => {
      simularResposta(alertasMenuGuiaApi())

      const alertas = await obterAlertasMenu()

      const esperado: AlertasMenu = {
        inicio: { total: 0, itens: [] },
        'dados-externos': {
          total: 4,
          itens: [{ codigo: 'integracao pendente', quantidade: 4, descricao: '4 dados externos sem integração configurada' }],
        },
        indicadores: {
          total: 3,
          itens: [
            { codigo: 'aguardando meta', quantidade: 2, descricao: '2 indicadores aguardando definição de meta' },
            { codigo: 'integracao pendente', quantidade: 1, descricao: '1 indicador com integração da meta pendente' },
          ],
        },
      }
      expect(alertas).toEqual(esperado)
    })

    it('converte o exemplo completo do Admin (API (31).md): as 9 abas, mantendo a ordem dos itens', async () => {
      simularResposta(alertasMenuAdminApi())

      const alertas = await obterAlertasMenu()

      expect(Object.keys(alertas).sort()).toEqual(
        ['apontamentos', 'dados-externos', 'dashboards', 'faixas', 'fechamentos', 'indicadores', 'inicio', 'preenchimento', 'tipos'],
      )
      expect(alertas.indicadores).toEqual({
        total: 6,
        itens: [
          { codigo: 'aguardando meta', quantidade: 2, descricao: '2 indicadores aguardando definição de meta' },
          { codigo: 'meta pendente por filial', quantidade: 3, descricao: '3 indicadores com filial sem meta' },
          { codigo: 'integracao pendente', quantidade: 1, descricao: '1 indicador com integração da meta pendente' },
        ],
      })
      expect(alertas.tipos).toEqual({ total: 0, itens: [] })
      expect(alertas.fechamentos).toEqual({ total: 0, itens: [] })
    })

    it('Preenchedor: só as abas que vieram na resposta (as que ele não acessa ficam ausentes, não com total 0)', async () => {
      simularResposta(alertasMenuPreenchedorApi())

      const alertas = await obterAlertasMenu()

      expect(Object.keys(alertas).sort()).toEqual(['apontamentos', 'dados-externos', 'inicio', 'preenchimento'])
      expect(alertas).not.toHaveProperty('tipos')
      expect(alertas).not.toHaveProperty('indicadores')
    })

    it('ignora chaves de aba desconhecidas (ex.: uma aba nova do back-end que o menu não tem)', async () => {
      simularResposta({
        abas: {
          indicadores: { total: 1, itens: [{ codigo: 'aguardando meta', quantidade: 1, descricao: '1 indicador aguardando definição de meta' }] },
          relatorios: { total: 5, itens: [{ codigo: 'novo', quantidade: 5, descricao: '5 relatórios novos' }] },
          'dados externos': { total: 2, itens: [] },
        },
      })

      const alertas = await obterAlertasMenu()

      expect(Object.keys(alertas)).toEqual(['indicadores'])
    })

    it('"abas" vazio resulta em nenhum alerta', async () => {
      simularResposta({ abas: {} })

      await expect(obterAlertasMenu()).resolves.toEqual({})
    })

    it('descricao null ou ausente no item vira null', async () => {
      simularResposta({
        abas: {
          indicadores: {
            total: 3,
            itens: [
              { codigo: 'aguardando meta', quantidade: 2, descricao: null },
              { codigo: 'com componente desativado', quantidade: 1 },
            ],
          },
        },
      })

      const alertas = await obterAlertasMenu()

      expect(alertas.indicadores?.itens).toEqual([
        { codigo: 'aguardando meta', quantidade: 2, descricao: null },
        { codigo: 'com componente desativado', quantidade: 1, descricao: null },
      ])
    })
  })

  describe('formato inválido vira ApiError de resposta inválida', () => {
    const casos: Array<[string, unknown]> = [
      ['sem "abas"', { indicadores: { total: 1, itens: [] } }],
      ['"abas" null', { abas: null }],
      ['"abas" como lista', { abas: [] }],
      ['corpo null', null],
      ['corpo como lista', []],
      ['"total" não numérico', { abas: { indicadores: { total: '3', itens: [] } } }],
      ['"total" ausente', { abas: { indicadores: { itens: [] } } }],
      ['aba conhecida que não é objeto', { abas: { indicadores: 3 } }],
    ]

    it.each(casos)('%s', async (_descricao, corpo) => {
      simularResposta(corpo)

      const erro = await obterAlertasMenu().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect((erro as ApiError).mensagem).toBe(MENSAGEM_RESPOSTA_INVALIDA)
    })
  })

  describe('erros HTTP e de rede são propagados como ApiError', () => {
    it('401: ApiError com status 401', async () => {
      simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaErro(401) })

      await expect(obterAlertasMenu()).rejects.toMatchObject({ status: 401, mensagem: mensagemPadraoPorStatus(401) })
    })

    it('403 (usuário sem perfil no PED): ApiError com status 403', async () => {
      simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaErro(403, 'usuario sem acesso ao ped') })

      await expect(obterAlertasMenu()).rejects.toMatchObject({ status: 403, mensagem: 'usuario sem acesso ao ped' })
    })

    it('429: ApiError com status 429 e o tempo de espera em tentarNovamenteEm', async () => {
      simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaLimiteAlertasMenu(30) })

      const erro = await obterAlertasMenu().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 429, tentarNovamenteEm: 30 })
    })

    it('500: ApiError com status 500 e a mensagem genérica da rota', async () => {
      simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaErro(500, MENSAGEM_ERRO_ALERTAS_MENU) })

      await expect(obterAlertasMenu()).rejects.toMatchObject({ status: 500, mensagem: MENSAGEM_ERRO_ALERTAS_MENU })
    })

    it('falha de rede: ApiError com status 0 e a mensagem de sem conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(obterAlertasMenu()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
