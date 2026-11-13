import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { historicoPeriodosApi, periodoApi } from '../test/preenchimentoFalsos'
import type { PeriodoAberto } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { abrirPeriodo, listarHistoricoPeriodos, obterPeriodo } from './periodoService'
import { MENSAGEM_MES_INVALIDO } from './preenchimentoService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/periodo'

const OUTUBRO: PeriodoAberto = {
  mesDeReferencia: '2026-10-01',
  abertoPor: 'Ana Costa',
  abertoEm: '2026-10-01 08:00:00',
  reaberto: false,
}

describe('F9.1 — Serviço do período aberto (RF-75, RF-76)', () => {
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

  describe('obterPeriodo() — GET /api/ped/periodo', () => {
    it('faz GET /api/ped/periodo sem query, com JSON e o token, e devolve o período convertido (camelCase)', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(periodoApi()) })

      const periodo = await obterPeriodo()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(periodo).toEqual(OUTUBRO)
    })

    it('"reaberto": true indica que o mês aberto é uma reabertura', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(periodoApi({ 'mes de referencia': '2026-08-01', reaberto: true })) })

      await expect(obterPeriodo()).resolves.toMatchObject({ mesDeReferencia: '2026-08-01', reaberto: true })
    })

    it('aceita o período dentro de { periodo }', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ periodo: periodoApi() }) })

      await expect(obterPeriodo()).resolves.toEqual(OUTUBRO)
    })

    it('campos opcionais ausentes ou null: "aberto por"/"aberto em" viram null e "reaberto" vira false', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ 'mes de referencia': '2026-10-01', 'aberto por': null, reaberto: null }),
      })

      await expect(obterPeriodo()).resolves.toEqual({ mesDeReferencia: '2026-10-01', abertoPor: null, abertoEm: null, reaberto: false })
    })

    it.each([
      ['sem "mes de referencia"', { 'aberto por': 'Ana Costa' }],
      ['"mes de referencia" numérico', { 'mes de referencia': 202610 }],
      ['"reaberto" em texto', { ...periodoApi(), reaberto: 'sim' }],
      ['uma lista', [periodoApi()]],
      ['null', null],
    ])('resposta 2xx %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await obterPeriodo().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 chega como ApiError com a mensagem da API; 500 sem mensagem usa a mensagem padrão; falha de rede vira ApiError de conexão', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Sem acesso ao PED.') })
      await expect(obterPeriodo()).rejects.toMatchObject({ status: 403, mensagem: 'Sem acesso ao PED.' })

      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500) })
      await expect(obterPeriodo()).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(obterPeriodo()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('listarHistoricoPeriodos() — GET /api/ped/periodo/historico (RF-76: mês, usuário e data de cada abertura)', () => {
    it('faz GET .../periodo/historico e devolve as aberturas convertidas, na ordem da API (mais recente primeiro), com "reaberto"', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/historico`]: () => respostaJson(historicoPeriodosApi()) })

      const historico = await listarHistoricoPeriodos()

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/historico`)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(historico).toEqual<PeriodoAberto[]>([
        OUTUBRO,
        { mesDeReferencia: '2026-08-01', abertoPor: 'Admin PED', abertoEm: '2026-09-20 14:00:00', reaberto: true },
        { mesDeReferencia: '2026-09-01', abertoPor: 'Admin PED', abertoEm: '2026-09-01 07:00:00', reaberto: false },
      ])
    })

    it('aceita a lista dentro de { historico }; lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/historico`]: () => respostaJson({ historico: historicoPeriodosApi() }) })
      await expect(listarHistoricoPeriodos()).resolves.toHaveLength(3)

      simularApi(fetchFalso, { [`GET ${ROTA}/historico`]: () => respostaJson([]) })
      await expect(listarHistoricoPeriodos()).resolves.toEqual([])
    })

    it('linha sem "reaberto" vale false', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/historico`]: () => respostaJson([{ 'mes de referencia': '2026-10-01', 'aberto por': 'Ana Costa', 'aberto em': '2026-10-01 08:00:00' }]),
      })

      await expect(listarHistoricoPeriodos()).resolves.toEqual([OUTUBRO])
    })

    it.each([
      ['um objeto sem a lista', { mensagem: 'ok' }],
      ['um texto', 'nada'],
      ['uma linha sem "mes de referencia"', [periodoApi(), { 'aberto por': 'Admin PED' }]],
      ['uma linha com "reaberto" em texto', [periodoApi({ reaberto: 'nao' as unknown as boolean })]],
    ])('resposta 2xx com %s vira ApiError "resposta inválida" (a resposta inteira)', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/historico`]: () => respostaJson(corpo) })

      await expect(listarHistoricoPeriodos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('erros HTTP chegam como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/historico`]: () => respostaErro(403, 'Sem acesso ao PED.') })

      await expect(listarHistoricoPeriodos()).rejects.toMatchObject({ status: 403, mensagem: 'Sem acesso ao PED.' })
    })
  })

  describe('abrirPeriodo(mesDeReferencia) — POST /api/ped/periodo/abrir (Admin; RF-76)', () => {
    it('envia { "mes de referencia": "AAAA-MM-01" } a partir de "AAAA-MM" e devolve reaberto false em "periodo aberto"', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}/abrir`]: () => respostaJson({ mensagem: 'periodo aberto', 'mes de referencia': '2026-11-01' }, 201),
      })

      const resultado = await abrirPeriodo('2026-11')

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(`${ROTA}/abrir`)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({ 'mes de referencia': '2026-11-01' })
      expect(resultado).toEqual({ reaberto: false, mesDeReferencia: '2026-11-01', mensagem: 'periodo aberto' })
    })

    it('qualquer dia do mês ("AAAA-MM-DD") vai como o dia 01', async () => {
      const chamadas = simularApi(fetchFalso, { [`POST ${ROTA}/abrir`]: () => respostaJson({ mensagem: 'periodo aberto' }, 201) })

      await abrirPeriodo('2026-11-15')

      expect(corpoDaChamada(chamadas[0])).toEqual({ 'mes de referencia': '2026-11-01' })
    })

    it('"periodo reaberto" (mês passado) devolve reaberto true', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}/abrir`]: () => respostaJson({ mensagem: 'periodo reaberto', 'mes de referencia': '2026-09-01' }, 201),
      })

      await expect(abrirPeriodo('2026-09')).resolves.toEqual({ reaberto: true, mesDeReferencia: '2026-09-01', mensagem: 'periodo reaberto' })
    })

    it('"reaberto": true na resposta também indica reabertura, sem depender da mensagem', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}/abrir`]: () => respostaJson({ reaberto: true }, 201) })

      await expect(abrirPeriodo('2026-09')).resolves.toMatchObject({ reaberto: true })
    })

    it.each<[string, () => Response]>([
      ['201 com corpo vazio', () => new Response('', { status: 201 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['um texto solto', () => respostaJson('ok', 201)],
      ['uma lista', () => respostaJson([], 201)],
    ])('2xx com %s resolve sem erro (foi gravado): reaberto false, mês enviado e mensagem null', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`POST ${ROTA}/abrir`]: resposta })

      await expect(abrirPeriodo('2026-11')).resolves.toEqual({ reaberto: false, mesDeReferencia: '2026-11-01', mensagem: null })
    })

    it.each(['2026', '11/2026', '2026-13', '2026-00-01', '', 'abc'])(
      'mês "%s" fora do formato rejeita com ApiError 400 (MENSAGEM_MES_INVALIDO) sem chamar a API',
      async (mes) => {
        const erro = await abrirPeriodo(mes).catch((e: unknown) => e)

        expect(erro).toBeInstanceOf(ApiError)
        expect(erro).toMatchObject({ status: 400, mensagem: MENSAGEM_MES_INVALIDO })
        expect(fetchFalso).not.toHaveBeenCalled()
      },
    )

    it('400 (mês já aberto, mês futuro) e 403 (não Admin) chegam como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}/abrir`]: () => respostaErro(400, 'este mes ja e o periodo aberto') })
      await expect(abrirPeriodo('2026-10')).rejects.toMatchObject({ status: 400, mensagem: 'este mes ja e o periodo aberto' })

      simularApi(fetchFalso, { [`POST ${ROTA}/abrir`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(abrirPeriodo('2026-11')).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(abrirPeriodo('2026-11')).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
