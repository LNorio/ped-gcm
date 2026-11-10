import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_DADO_EXTERNO_API,
  META_VIA_API_FASE_1,
  alertasApi,
  alertasComFonteDaMetaApi,
  respostaIndicadorApi,
  tarefaMetaApi,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA } from './api'
import {
  ROTULOS_SITUACAO_FILTRO_INDICADOR,
  ROTULOS_SITUACAO_FILTRO_INDICADOR_ADMIN,
  SITUACOES_FILTRO_INDICADOR,
  SITUACOES_FILTRO_INDICADOR_ADMIN,
  criarIndicador,
  definirMeta,
  listarIndicadores,
} from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.11 — Contrato final da meta via API no serviço de indicadores
 * (`docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md`, seções 2.1 e 2.4 — 10/11/2026).
 *
 * - Listagem: `"fonte da meta"`, `"situacao da meta via api"`, `tarefa` e `"integracao do dado externo"`
 *   validados (fora do formato rejeitam a resposta inteira com `ApiError(200, resposta inválida)`);
 *   topo `"meta via api": { "dado externo", integracao }` → `metaViaApi` (ausente/`null` → `undefined`;
 *   campo ausente → `null`; fora do formato rejeita).
 * - Filtro `situacao=integracao_pendente` (fonte `integracao`): só do Admin, em
 *   `SITUACOES_FILTRO_INDICADOR_ADMIN` (as situações padrão não mudam).
 * - POST e `PUT .../meta` com `origemDaMeta: 'terceiro'`: `"fonte da meta"` (ausente → `integracao`).
 * - POST: a tarefa do Bitrix (`tarefa`, no indicador ou na raiz da resposta) vira `tarefaBitrix` do
 *   indicador devolvido; tarefa fora do formato vira `null`, sem erro (regra "2xx = gravado").
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.11 — Meta via API, contrato final: serviço de indicadores', () => {
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

  function listarCom(corpo: unknown) {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })
    return listarIndicadores()
  }

  const listar = (lista: unknown[], extras: Record<string, unknown> = {}) =>
    listarCom({ indicadores: lista, alertas: alertasApi(lista as IndicadorApiFalso[]), ...extras })

  describe('listarIndicadores — fonte, situação, tarefa e integração do dado externo', () => {
    it('converte os campos do contrato final', async () => {
      const { indicadores } = await listar([INDICADOR_META_DADO_EXTERNO_API, INDICADOR_META_AGUARDANDO_API])

      expect(indicadores[0]).toMatchObject({
        id: 12,
        fonteDaMeta: 'dado_externo',
        situacaoDaMetaViaApi: 'ok',
        tarefaBitrix: null,
        integracaoDoDadoExterno: { identificador: 'FATURAMENTO' },
      })
      expect(indicadores[1]).toMatchObject({
        id: 14,
        fonteDaMeta: 'integracao',
        situacaoDaMetaViaApi: 'aguardando_consulta',
        tarefaBitrix: { id: 4521, titulo: '[PED] Integração da meta: Novos clientes com meta da TI' },
        integracaoDoDadoExterno: null,
      })
    })

    it.each<[string, Partial<Record<string, unknown>>]>([
      ['"fonte da meta" desconhecida', { 'fonte da meta': 'erp' }],
      ['"fonte da meta" não textual', { 'fonte da meta': 1 }],
      ['"situacao da meta via api" desconhecida', { 'situacao da meta via api': 'pendente' }],
      ['"situacao da meta via api" não textual', { 'situacao da meta via api': true }],
      ['tarefa que não é objeto', { tarefa: 'tarefa 31' }],
      ['tarefa sem titulo', { tarefa: { status: 'aberta', 'id bitrix': 31 } }],
      ['tarefa com "id bitrix" inválido', { tarefa: { titulo: 'T', status: 'aberta', 'id bitrix': '31a' } }],
      ['"integracao do dado externo" que não é objeto', { 'integracao do dado externo': 'FATURAMENTO' }],
      ['"integracao do dado externo" com url não textual', { 'integracao do dado externo': { identificador: 'X', url: 5 } }],
    ])('%s rejeita a lista com ApiError(200, resposta inválida)', async (_nome, campos) => {
      const erro = await listar([{ ...INDICADOR_META_DADO_EXTERNO_API, ...campos }]).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('tarefa null e "integracao do dado externo" null são aceitas', async () => {
      const { indicadores } = await listar([{ ...INDICADOR_META_DADO_EXTERNO_API, tarefa: null, 'integracao do dado externo': null }])

      expect(indicadores[0].tarefaBitrix).toBeNull()
      expect(indicadores[0].integracaoDoDadoExterno).toBeNull()
    })
  })

  describe('listarIndicadores — "meta via api" no topo da resposta', () => {
    it('{ "dado externo": true, integracao: false } → metaViaApi { dadoExterno: true, integracao: false }', async () => {
      const resultado = await listar([INDICADOR_COBERTURA_VISITAS_API], { 'meta via api': META_VIA_API_FASE_1 })

      expect(resultado.metaViaApi).toEqual({ dadoExterno: true, integracao: false })
    })

    it('sem o campo (API anterior): metaViaApi undefined', async () => {
      const resultado = await listar([INDICADOR_COBERTURA_VISITAS_API])

      expect(resultado.metaViaApi).toBeUndefined()
    })

    it('null: metaViaApi undefined', async () => {
      const resultado = await listar([INDICADOR_COBERTURA_VISITAS_API], { 'meta via api': null })

      expect(resultado.metaViaApi).toBeUndefined()
    })

    it('campo interno ausente vira null', async () => {
      const resultado = await listar([INDICADOR_COBERTURA_VISITAS_API], { 'meta via api': { 'dado externo': true } })

      expect(resultado.metaViaApi).toEqual({ dadoExterno: true, integracao: null })
    })

    it.each<[string, unknown]>([
      ['texto', 'sim'],
      ['lista', [true, false]],
      ['integracao não booleana', { 'dado externo': true, integracao: 'false' }],
      ['"dado externo" não booleano', { 'dado externo': 1, integracao: false }],
    ])('fora do formato (%s) rejeita a resposta', async (_nome, valor) => {
      const erro = await listar([INDICADOR_COBERTURA_VISITAS_API], { 'meta via api': valor }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('os alertas continuam lidos como antes ("integracao pendente" da fonte integracao)', async () => {
      const lista = [INDICADOR_META_API_PENDENTE_API, INDICADOR_META_DADO_EXTERNO_API]

      const { alertas } = await listarCom({ indicadores: lista, alertas: alertasComFonteDaMetaApi(lista), 'meta via api': META_VIA_API_FASE_1 })

      expect(alertas.integracaoPendente).toBe(1)
    })
  })

  describe('filtro "Integração pendente (TI)" (só Admin)', () => {
    it('SITUACOES_FILTRO_INDICADOR_ADMIN = as situações padrão + integracao_pendente, no fim', () => {
      expect(SITUACOES_FILTRO_INDICADOR_ADMIN).toEqual([...SITUACOES_FILTRO_INDICADOR, 'integracao_pendente'])
    })

    it('as situações padrão não incluem integracao_pendente', () => {
      expect(SITUACOES_FILTRO_INDICADOR).not.toContain('integracao_pendente')
    })

    it('ROTULOS_SITUACAO_FILTRO_INDICADOR_ADMIN: os rótulos padrão + "Integração pendente (TI)"', () => {
      expect(ROTULOS_SITUACAO_FILTRO_INDICADOR_ADMIN).toEqual({
        ...ROTULOS_SITUACAO_FILTRO_INDICADOR,
        integracao_pendente: 'Integração pendente (TI)',
      })
    })

    it('listarIndicadores({ situacao: "integracao_pendente" }) envia situacao=integracao_pendente', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ indicadores: [INDICADOR_META_API_PENDENTE_API], alertas: alertasApi([]) }),
      })

      await listarIndicadores({ situacao: 'integracao_pendente' })

      expect(chamadas[0].url.searchParams.get('situacao')).toBe('integracao_pendente')
    })
  })

  describe('criarIndicador com a fonte da meta', () => {
    const NOVO = {
      nome: 'Faturamento com meta do ERP',
      descricao: null,
      origemDaMeta: 'terceiro' as const,
      sentido: 'maior_melhor' as const,
      metaEditavel: false,
      dadoExterno: 1,
    }

    it('fonte dado_externo: POST com "fonte da meta" dado_externo', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaIndicadorApi(INDICADOR_META_DADO_EXTERNO_API), 201),
      })

      const criado = await criarIndicador({ ...NOVO, fonteDaMeta: 'dado_externo' })

      expect(corpoDaChamada(chamadas[0])).toEqual({
        nome: 'Faturamento com meta do ERP',
        descricao: null,
        'origem da meta': 'terceiro',
        'fonte da meta': 'dado_externo',
        sentido: 'maior_melhor',
        'meta editavel': false,
        'dado externo': 1,
      })
      expect(criado).toMatchObject({ id: 12, fonteDaMeta: 'dado_externo', tarefaBitrix: null })
    })

    it('fonte integracao (Validador): a tarefa dentro do indicador vira tarefaBitrix', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson(
            respostaIndicadorApi({ ...INDICADOR_META_API_PENDENTE_API, tarefa: tarefaMetaApi('[PED] Integração da meta: X', 4600) }),
            201,
          ),
      })

      const criado = await criarIndicador({ ...NOVO, fonteDaMeta: 'integracao' })

      expect(criado?.tarefaBitrix).toEqual({ id: 4600, status: 'aberta', titulo: '[PED] Integração da meta: X' })
    })

    it('fonte integracao: a tarefa na raiz da resposta ({ indicador, tarefa }) também vira tarefaBitrix', async () => {
      const semTarefa: IndicadorApiFalso = { ...INDICADOR_META_API_PENDENTE_API }
      delete semTarefa.tarefa
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson({ indicador: semTarefa, tarefa: tarefaMetaApi('[PED] Integração da meta: Y', '4601') }, 201),
      })

      const criado = await criarIndicador({ ...NOVO, fonteDaMeta: 'integracao' })

      expect(criado?.tarefaBitrix).toEqual({ id: 4601, status: 'aberta', titulo: '[PED] Integração da meta: Y' })
    })

    it('tarefa fora do formato na resposta do POST: indicador devolvido com tarefaBitrix null, sem erro', async () => {
      const semTarefa: IndicadorApiFalso = { ...INDICADOR_META_API_PENDENTE_API }
      delete semTarefa.tarefa
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson({ indicador: semTarefa, tarefa: { status: 'aberta' } }, 201),
      })

      const criado = await criarIndicador({ ...NOVO, fonteDaMeta: 'integracao' })

      expect(criado).toMatchObject({ id: 10, tarefaBitrix: null })
    })

    it('400 com a mensagem do back-end é propagado como ApiError', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaErro(400, 'o dado externo Cobertura de clientes nao fornece meta; informe a meta manualmente'),
      })

      await expect(criarIndicador({ ...NOVO, fonteDaMeta: 'dado_externo', dadoExterno: 2 })).rejects.toMatchObject({
        status: 400,
        mensagem: 'o dado externo Cobertura de clientes nao fornece meta; informe a meta manualmente',
      })
    })
  })

  describe('definirMeta com a fonte da meta', () => {
    it.each(['dado_externo', 'integracao'] as const)(
      'fonteDaMeta %s: PUT .../{id}/meta com { "origem da meta": "terceiro", "fonte da meta", sentido, "meta editavel": false }',
      async (fonte) => {
        const chamadas = simularApi(fetchFalso, {
          [`PUT ${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`]: () => new Response(null, { status: 204 }),
        })

        await definirMeta(INDICADOR_DEVOLUCOES_API.id, { origemDaMeta: 'terceiro', fonteDaMeta: fonte, sentido: 'maior_melhor', metaEditavel: false })

        expect(corpoDaChamada(chamadas[0])).toEqual({
          'origem da meta': 'terceiro',
          'fonte da meta': fonte,
          sentido: 'maior_melhor',
          'meta editavel': false,
        })
      },
    )

    it('meta manual: o corpo não leva "fonte da meta"', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/${INDICADOR_DEVOLUCOES_API.id}/meta`]: () => new Response(null, { status: 204 }),
      })

      await definirMeta(INDICADOR_DEVOLUCOES_API.id, { meta: 10, sentido: 'maior_melhor', metaEditavel: true, fonteDaMeta: 'dado_externo' })

      expect(corpoDaChamada(chamadas[0])).not.toHaveProperty('fonte da meta')
    })
  })
})
