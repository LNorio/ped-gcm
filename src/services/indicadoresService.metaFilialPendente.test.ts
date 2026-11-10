import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_MARGEM_API,
  INDICADOR_TICKET_MEDIO_API,
  type IndicadorApiFalso,
  respostaIndicadoresComMetasApi,
} from '../test/indicadoresFalsos'
import { paraIndicador } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA } from './api'
import { ROTULOS_SITUACAO_FILTRO_INDICADOR, SITUACOES_FILTRO_INDICADOR, listarIndicadores } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.10 — Ajustes ao contrato real da meta por filial (API (26).md, seção "fase 4", e
 * FRONT-meta-por-filial.md, 2026-11-10):
 * - filtro de situação: nova opção `meta_filial_pendente` ("Meta pendente por filial"), entre
 *   "Aguardando meta" e "Com problemas", na ordem da API;
 * - cada indicador traz `"meta por filial"` (booleano), lido em `Indicador.metaPorFilial`; ausente →
 *   derivado de `"metas por filial"` não vazia; fora do formato → resposta inválida;
 * - `"metas por filial": null` (meta única ou sem meta) → `metasPorFilial: []`.
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.10 — Serviço de indicadores: contrato real da meta por filial', () => {
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

  describe('filtro "Meta pendente por filial"', () => {
    it('SITUACOES_FILTRO_INDICADOR inclui meta_filial_pendente entre meta e problemas', () => {
      expect(SITUACOES_FILTRO_INDICADOR).toEqual(['todas', 'ativos', 'inativos', 'meta', 'meta_filial_pendente', 'problemas'])
    })

    it('rótulo "Meta pendente por filial"', () => {
      expect(ROTULOS_SITUACAO_FILTRO_INDICADOR).toEqual({
        todas: 'Todas',
        ativos: 'Ativos',
        inativos: 'Inativos',
        meta: 'Aguardando meta',
        meta_filial_pendente: 'Meta pendente por filial',
        problemas: 'Com problemas',
      })
    })

    it('listarIndicadores({ situacao: "meta_filial_pendente" }) envia ?situacao=meta_filial_pendente', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresComMetasApi([INDICADOR_TICKET_MEDIO_API])) })

      await listarIndicadores({ situacao: 'meta_filial_pendente' })

      expect(chamadas[0].url.searchParams.get('situacao')).toBe('meta_filial_pendente')
    })
  })

  describe('campo "meta por filial" da listagem', () => {
    function comCampo(indicador: IndicadorApiFalso, valor: unknown): IndicadorApiFalso {
      return { ...indicador, 'meta por filial': valor } as IndicadorApiFalso
    }

    it('"meta por filial": true vira metaPorFilial true', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresComMetasApi([comCampo(INDICADOR_TICKET_MEDIO_API, true)])) })

      const { indicadores } = await listarIndicadores()

      expect(indicadores[0]).toMatchObject({ id: 8, metaPorFilial: true, meta: null })
    })

    it('"meta por filial": false com meta única vira metaPorFilial false', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(respostaIndicadoresComMetasApi([{ ...comCampo(INDICADOR_COBERTURA_VISITAS_API, false), 'metas por filial': null } as unknown as IndicadorApiFalso])),
      })

      const { indicadores } = await listarIndicadores()

      expect(indicadores[0]).toMatchObject({ id: 1, metaPorFilial: false, meta: 85, metasPorFilial: [], filiaisSemMeta: [] })
    })

    it('o valor informado pela API prevalece sobre a lista (true mesmo com "metas por filial" vazia)', () => {
      const indicador = paraIndicador({ ...comCampo(INDICADOR_TICKET_MEDIO_API, true), meta: null, 'metas por filial': [], 'filiais sem meta': [] })

      expect(indicador.metaPorFilial).toBe(true)
    })

    it('ausente: derivado de "metas por filial" não vazia', () => {
      expect(paraIndicador(INDICADOR_TICKET_MEDIO_API).metaPorFilial).toBe(true)
      expect(paraIndicador(INDICADOR_MARGEM_API).metaPorFilial).toBe(true)
      expect(paraIndicador(INDICADOR_COBERTURA_VISITAS_API).metaPorFilial).toBe(false)
    })

    it('null é aceito e também é derivado da lista', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(respostaIndicadoresComMetasApi([comCampo(INDICADOR_TICKET_MEDIO_API, null), comCampo(INDICADOR_COBERTURA_VISITAS_API, null)])),
      })

      const { indicadores } = await listarIndicadores()

      expect(indicadores.map((i) => i.metaPorFilial)).toEqual([true, false])
    })

    it.each([['texto', 'sim'], ['número', 1]])('"meta por filial" em %s rejeita a resposta (ApiError 200, resposta inválida)', async (_caso, valor) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresComMetasApi([comCampo(INDICADOR_TICKET_MEDIO_API, valor)])) })

      const falha = await listarIndicadores().catch((erro: unknown) => erro)

      expect(falha).toBeInstanceOf(ApiError)
      expect(falha).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  it('"metas por filial": null (meta única) e "filiais sem meta": [] viram listas vazias', async () => {
    const metaUnica = { ...INDICADOR_COBERTURA_VISITAS_API, 'metas por filial': null, 'filiais sem meta': [], 'meta por filial': false }
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresComMetasApi([metaUnica as unknown as IndicadorApiFalso])) })

    const { indicadores } = await listarIndicadores()

    expect(indicadores[0]).toMatchObject({ meta: 85, metasPorFilial: [], filiaisSemMeta: [], metaPorFilial: false })
  })
})
