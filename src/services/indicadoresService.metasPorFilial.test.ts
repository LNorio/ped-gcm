import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaJson, simularApi } from '../test/apiFalsa'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_MARGEM_API,
  INDICADOR_TICKET_MEDIO_API,
  respostaIndicadorApi,
  respostaIndicadoresApi,
  respostaIndicadoresComMetasApi,
} from '../test/indicadoresFalsos'
import type { NovoIndicador } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA } from './api'
import { criarIndicador, definirMeta, listarIndicadores } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.10 — Meta por filial no serviço de indicadores (proposta de contrato; ver o topo da seção F6.10
 * em `src/test/indicadoresFalsos.ts`). A API atual não traz os campos novos: a resposta atual continua
 * válida (sem metas por filial e sem pendência).
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.10 — Meta por filial: serviço de indicadores', () => {
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

  describe('listarIndicadores — metas por filial e alerta "meta pendente por filial"', () => {
    it('converte "metas por filial" e "filiais sem meta" de cada indicador', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresComMetasApi([INDICADOR_TICKET_MEDIO_API, INDICADOR_MARGEM_API])),
      })

      const { indicadores } = await listarIndicadores()

      expect(indicadores[0]).toMatchObject({
        id: 8,
        meta: null,
        metasPorFilial: [
          { filial: '100', nomeFilial: 'MATRIZ', meta: 1500.5 },
          { filial: '101', nomeFilial: 'CAMPO GRANDE', meta: null },
          { filial: '102', nomeFilial: 'DOURADOS', meta: null },
        ],
        filiaisSemMeta: ['101', '102'],
      })
      expect(indicadores[1]).toMatchObject({ id: 9, filiaisSemMeta: [] })
      expect(indicadores[1].metasPorFilial).toHaveLength(3)
    })

    it('alertas trazem metaPendentePorFilial a partir de "meta pendente por filial"', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresComMetasApi([INDICADOR_TICKET_MEDIO_API, INDICADOR_MARGEM_API, INDICADOR_DEVOLUCOES_API])),
      })

      const { alertas } = await listarIndicadores()

      expect(alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 0, metaPendentePorFilial: 1 })
    })

    it('resposta atual (sem os campos novos) continua válida: sem metas por filial, sem pendência e metaPendentePorFilial 0', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi([INDICADOR_COBERTURA_VISITAS_API])) })

      const { indicadores, alertas } = await listarIndicadores()

      expect(indicadores[0]).toMatchObject({ meta: 85, metasPorFilial: [], filiaisSemMeta: [] })
      expect(alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 0, metaPendentePorFilial: 0 })
    })

    it('campos novos nulos são aceitos (listas vazias)', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson({
            indicadores: [{ ...INDICADOR_COBERTURA_VISITAS_API, 'metas por filial': null, 'filiais sem meta': null }],
            alertas: { 'aguardando meta': 0, 'com componente desativado': 0, 'meta pendente por filial': null },
          }),
      })

      const { indicadores, alertas } = await listarIndicadores()

      expect(indicadores[0]).toMatchObject({ metasPorFilial: [], filiaisSemMeta: [] })
      expect(alertas.metaPendentePorFilial).toBe(0)
    })

    it('código de filial numérico é aceito e vira texto', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson({
            indicadores: [
              {
                ...INDICADOR_TICKET_MEDIO_API,
                'metas por filial': [
                  { filial: 100, 'nome filial': 'MATRIZ', meta: 1500.5 },
                  { filial: 101, meta: null },
                ],
                'filiais sem meta': [101],
              },
            ],
          }),
      })

      const { indicadores } = await listarIndicadores()

      expect(indicadores[0].metasPorFilial).toEqual([
        { filial: '100', nomeFilial: 'MATRIZ', meta: 1500.5 },
        { filial: '101', nomeFilial: null, meta: null },
      ])
      expect(indicadores[0].filiaisSemMeta).toEqual(['101'])
    })

    it.each([
      ['"metas por filial" que não é lista', { 'metas por filial': 'todas' }],
      ['item de "metas por filial" sem filial', { 'metas por filial': [{ meta: 10 }] }],
      ['item de "metas por filial" com meta em texto', { 'metas por filial': [{ filial: '100', meta: '1.500,50' }] }],
      ['item de "metas por filial" com nome filial numérico', { 'metas por filial': [{ filial: '100', 'nome filial': 100, meta: 10 }] }],
      ['"filiais sem meta" que não é lista', { 'filiais sem meta': '101' }],
      ['"filiais sem meta" com item que não é código', { 'filiais sem meta': [{ filial: '101' }] }],
    ])('%s rejeita a resposta inteira com ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)', async (_caso, campos) => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ indicadores: [{ ...INDICADOR_TICKET_MEDIO_API, ...campos }] }),
      })

      const erro = await listarIndicadores().catch((falha: unknown) => falha)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('"meta pendente por filial" não numérico rejeita a resposta', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson({
            indicadores: [INDICADOR_TICKET_MEDIO_API],
            alertas: { 'aguardando meta': 0, 'com componente desativado': 0, 'meta pendente por filial': '1' },
          }),
      })

      await expect(listarIndicadores()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('criarIndicador — POST com "metas por filial"', () => {
    const BASE: Omit<NovoIndicador, 'meta' | 'metasPorFilial'> = {
      nome: 'Ticket médio por filial',
      descricao: null,
      sentido: 'maior_melhor',
      calculo: 'soma',
      metaEditavel: false,
      apontamentos: [6],
    }

    it('com metasPorFilial: envia "metas por filial" só com as filiais informadas e sem "meta"', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaIndicadorApi(INDICADOR_TICKET_MEDIO_API), 201),
      })

      const criado = await criarIndicador({
        ...BASE,
        metasPorFilial: [
          { filial: '100', meta: 1500.5 },
          { filial: '102', meta: 900 },
        ],
      })

      const corpo = corpoDaChamada(chamadas[0])
      expect(corpo).toEqual({
        nome: 'Ticket médio por filial',
        descricao: null,
        'origem da meta': 'manual',
        'metas por filial': [
          { filial: '100', meta: 1500.5 },
          { filial: '102', meta: 900 },
        ],
        sentido: 'maior_melhor',
        'meta editavel': false,
        calculo: 'soma',
        apontamentos: [6],
      })
      expect(corpo).not.toHaveProperty('meta')
      expect(criado).toMatchObject({ id: 8, filiaisSemMeta: ['101', '102'] })
    })

    it('com meta única: o corpo continua com "meta" e sem "metas por filial"', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaIndicadorApi(INDICADOR_COBERTURA_VISITAS_API), 201),
      })

      await criarIndicador({ ...BASE, meta: 1500.5 })

      const corpo = corpoDaChamada(chamadas[0])
      expect(corpo).toMatchObject({ meta: 1500.5 })
      expect(corpo).not.toHaveProperty('metas por filial')
    })
  })

  describe('definirMeta — PUT .../{id}/meta com "metas por filial"', () => {
    it('com metasPorFilial: envia { sentido, "meta editavel", "metas por filial" } sem "meta"', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/meta`]: () => respostaJson(respostaIndicadorApi(INDICADOR_DEVOLUCOES_API)),
      })

      await definirMeta(4, {
        sentido: 'maior_melhor',
        metaEditavel: true,
        metasPorFilial: [{ filial: '101', meta: 2500 }],
      })

      const corpo = corpoDaChamada(chamadas[0])
      expect(corpo).toEqual({ sentido: 'maior_melhor', 'meta editavel': true, 'metas por filial': [{ filial: '101', meta: 2500 }] })
      expect(corpo).not.toHaveProperty('meta')
    })

    it('com meta única: o corpo continua { meta, sentido, "meta editavel" } sem "metas por filial"', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/meta`]: () => respostaJson(respostaIndicadorApi(INDICADOR_DEVOLUCOES_API)),
      })

      await definirMeta(4, { meta: 2500, sentido: 'menor_melhor', metaEditavel: false })

      expect(corpoDaChamada(chamadas[0])).toEqual({ meta: 2500, sentido: 'menor_melhor', 'meta editavel': false })
    })
  })
})
