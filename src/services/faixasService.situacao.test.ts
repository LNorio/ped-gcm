import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  MENSAGEM_CONFLITO_GERAL_ATIVA,
  TABELA_COMERCIAL_100_INATIVA_API,
  TABELA_COMERCIAL_101_API,
  TABELA_GERAL_GERENTES_INATIVA_API,
  TABELA_GERAL_SUPERVISORES_API,
  respostaGravacaoFaixasApi,
  tabelasFaixasComSituacaoApi,
} from '../test/faixasFalsos'
import type { TabelaFaixas } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO } from './api'
import {
  alterarSituacaoTabelaFaixas,
  criarTabelaFaixas,
  listarTabelasFaixas,
  obterTabelaFaixas,
  type AlteracaoSituacaoFaixas,
} from './faixasService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/faixas'

/** Tabela 7 (faixa geral inativa do PED Gerentes) convertida para o domínio. */
const GERAL_GERENTES_INATIVA: TabelaFaixas = {
  id: 7,
  idDashboard: 2,
  dashboard: 'PED Gerentes',
  dashboardExcluido: false,
  geral: true,
  filial: null,
  nomeFilial: null,
  situacao: 'inativa',
  motivoDaSituacao: 'passou a valer faixa por filial',
  dataDaSituacao: '2026-11-12 14:05:00-04:00',
  usuarioDaSituacao: 'admin',
  descricao: null,
  versaoVigente: 2,
  dataDaVersao: '2026-11-01 10:00:00',
  autorDaVersao: 'admin',
  quantidadeDeFaixas: 1,
  faixas: [{ de: 0, ate: 1000, aliquota: 0 }],
}

/** `400` de conflito no formato final (a mensagem não cita o dashboard — F8.12*). */
const CONFLITO = {
  mensagem: MENSAGEM_CONFLITO_GERAL_ATIVA,
  conflitos: [{ id: 7, geral: true, filial: null, 'nome filial': null }],
}

/**
 * Proposta "faixa geral e situação" (12/11/2026 — `docs/propostas-backend/PROPOSTA-faixa-geral-e-situacao.md`):
 * - a tabela ganha `geral`, `situacao` e "motivo/data/usuario da situacao"; `filial` e "nome filial"
 *   podem ser `null` na faixa geral; sem os campos novos, a tabela é por filial e `ativa`;
 * - filtro `situacao` (`ativas`, `inativas`, `todas`) na listagem;
 * - cadastro da faixa geral com `"filial": "todas"`;
 * - `PUT /api/ped/faixas/{id}/situacao` `{ ativa, motivo }` (regra "2xx = gravado");
 * - o `400` de conflito chega como `ApiError` com a `mensagem` da API e o corpo (com `conflitos`) em `dados`.
 * Contrato final (F8.12*): data da situação no formato `2026-11-12 14:05:00-04:00` e mensagem de
 * conflito sem o nome do dashboard (ver `faixasService.contratoFinal.test.ts`).
 */
describe('F8.7 — Serviço de faixas: faixa geral, situação (ativa/inativa) e conflitos', () => {
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

  describe('leitura dos campos novos', () => {
    it('faixa geral inativa: geral true, filial e nome da filial null, situação e motivo, data e usuário da situação', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([TABELA_GERAL_GERENTES_INATIVA_API]) })

      const [tabela] = await listarTabelasFaixas()

      expect(tabela).toEqual(GERAL_GERENTES_INATIVA)
    })

    it('faixa geral ativa nunca alterada: motivo, data e usuário da situação null', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([TABELA_GERAL_SUPERVISORES_API]) })

      const [tabela] = await listarTabelasFaixas()

      expect(tabela).toMatchObject({
        id: 5,
        geral: true,
        filial: null,
        nomeFilial: null,
        situacao: 'ativa',
        motivoDaSituacao: null,
        dataDaSituacao: null,
        usuarioDaSituacao: null,
      })
    })

    it('faixa por filial inativa mantém filial e nome da filial', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([TABELA_COMERCIAL_100_INATIVA_API]) })

      const [tabela] = await listarTabelasFaixas()

      expect(tabela).toMatchObject({
        id: 6,
        geral: false,
        filial: '100',
        nomeFilial: 'MATRIZ',
        situacao: 'inativa',
        motivoDaSituacao: 'Filial passou a usar outra régua',
        dataDaSituacao: '2026-11-10 08:00:00-04:00',
        usuarioDaSituacao: 'Ana Costa',
      })
    })

    it('tolerância: sem os campos novos (formato atual), a tabela é por filial (geral false) e ativa, com os dados da situação null', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([TABELA_COMERCIAL_101_API]) })

      const [tabela] = await listarTabelasFaixas()

      expect(tabela).toMatchObject({
        geral: false,
        filial: '101',
        situacao: 'ativa',
        motivoDaSituacao: null,
        dataDaSituacao: null,
        usuarioDaSituacao: null,
      })
    })

    it('tolerância: "situacao", "geral" e os dados da situação em null contam como ausentes', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            {
              ...TABELA_COMERCIAL_101_API,
              geral: null,
              situacao: null,
              'motivo da situacao': null,
              'data da situacao': null,
              'usuario da situacao': null,
            },
          ]),
      })

      const [tabela] = await listarTabelasFaixas()

      expect(tabela).toMatchObject({ geral: false, situacao: 'ativa', motivoDaSituacao: null })
    })

    it('a lista com faixas gerais, inativas e no formato atual é convertida inteira, na ordem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(tabelasFaixasComSituacaoApi()) })

      const tabelas = await listarTabelasFaixas()

      expect(tabelas.map((t) => [t.id, t.geral, t.situacao])).toEqual([
        [1, false, 'ativa'],
        [2, false, 'ativa'],
        [3, false, 'ativa'],
        [4, false, 'ativa'],
        [5, true, 'ativa'],
        [6, false, 'inativa'],
        [7, true, 'inativa'],
      ])
    })

    it('o detalhe (GET /api/ped/faixas/{id}) também lê a faixa geral e a situação', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/7`]: () => respostaJson({ tabela: TABELA_GERAL_GERENTES_INATIVA_API }) })

      await expect(obterTabelaFaixas(7)).resolves.toEqual(GERAL_GERENTES_INATIVA)
    })

    it.each<[string, Record<string, unknown>]>([
      ['filial null sem "geral"', { ...TABELA_COMERCIAL_101_API, filial: null }],
      ['filial null com "geral" false', { ...TABELA_COMERCIAL_101_API, geral: false, filial: null }],
      ['filial null com "geral" null', { ...TABELA_COMERCIAL_101_API, geral: null, filial: null }],
      ['"nome filial" null numa tabela por filial', { ...TABELA_COMERCIAL_101_API, 'nome filial': null }],
      ['"nome filial" null com "geral" false', { ...TABELA_COMERCIAL_101_API, geral: false, 'nome filial': null }],
      ['"situacao" desconhecida ("suspensa")', { ...TABELA_COMERCIAL_101_API, situacao: 'suspensa' }],
      ['"geral" em texto ("true")', { ...TABELA_GERAL_SUPERVISORES_API, geral: 'true' }],
      ['"geral" numérico (1)', { ...TABELA_GERAL_SUPERVISORES_API, geral: 1 }],
    ])('tabela com %s rejeita a listagem inteira com ApiError "resposta inválida"', async (_caso, invalida) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([TABELA_GERAL_SUPERVISORES_API, invalida]) })

      const erro = await listarTabelasFaixas().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it.each<[string, Record<string, unknown>]>([
      ['filial null sem "geral"', { ...TABELA_COMERCIAL_101_API, filial: null }],
      ['"nome filial" null numa tabela por filial', { ...TABELA_COMERCIAL_101_API, 'nome filial': null }],
      ['"situacao" desconhecida ("suspensa")', { ...TABELA_COMERCIAL_101_API, situacao: 'suspensa' }],
      ['"geral" em texto ("sim")', { ...TABELA_GERAL_SUPERVISORES_API, geral: 'sim' }],
    ])('detalhe com %s vira ApiError "resposta inválida"', async (_caso, invalida) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson({ tabela: invalida }) })

      await expect(obterTabelaFaixas(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('filtro de situação na listagem', () => {
    it.each([
      ['ativas', 'ativas'],
      ['inativas', 'inativas'],
      ['todas', 'todas'],
    ] as const)('situacao "%s" vai na query como situacao=%s', async (situacao, esperado) => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarTabelasFaixas({ situacao })

      expect([...chamadas[0].url.searchParams.entries()]).toEqual([['situacao', esperado]])
    })

    it('combina com a filial e o dashboard', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarTabelasFaixas({ filial: '101', dashboard: 3, situacao: 'ativas' })

      const parametros = chamadas[0].url.searchParams
      expect(parametros.get('filial')).toBe('101')
      expect(parametros.get('dashboard')).toBe('3')
      expect(parametros.get('situacao')).toBe('ativas')
    })

    it('sem situacao informada, a query não leva situacao', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarTabelasFaixas({ filial: '101' })

      expect(chamadas[0].url.searchParams.has('situacao')).toBe(false)
    })
  })

  describe('cadastro da faixa geral e conflitos', () => {
    it('faixa geral: POST com "filial": "todas"; devolve a tabela geral gravada', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoFaixasApi(TABELA_GERAL_SUPERVISORES_API), 201),
      })

      const tabela = await criarTabelaFaixas({ dashboard: 3, filial: 'todas', descricao: 'Régua única', faixas: [{ de: 0, ate: 2000, aliquota: 1 }] })

      expect(corpoDaChamada(chamadas[0])).toEqual({
        dashboard: 3,
        filial: 'todas',
        descricao: 'Régua única',
        faixas: [{ de: 0, ate: 2000, aliquota: 1 }],
      })
      expect(tabela).toMatchObject({ id: 5, geral: true, filial: null, situacao: 'ativa' })
    })

    it('400 de conflito: ApiError com a mensagem da API e o corpo com "conflitos" em dados', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(CONFLITO, 400) })

      const erro = await criarTabelaFaixas({ dashboard: 2, filial: '101', descricao: null, faixas: [{ de: 0, ate: 1, aliquota: 0 }] }).catch(
        (e: unknown) => e,
      )

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: CONFLITO.mensagem })
      expect((erro as ApiError).dados).toMatchObject({ conflitos: CONFLITO.conflitos })
    })
  })

  describe('alterarSituacaoTabelaFaixas(id, { ativa, motivo }) — inativar e reativar', () => {
    const INATIVAR: AlteracaoSituacaoFaixas = { ativa: false, motivo: 'passou a valer faixa por filial' }
    const REATIVAR: AlteracaoSituacaoFaixas = { ativa: true, motivo: 'voltou a valer a régua geral' }

    it('inativar: PUT /api/ped/faixas/{id}/situacao com { ativa: false, motivo }, JSON e o token; devolve a tabela atualizada', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/7/situacao`]: () => respostaJson(respostaGravacaoFaixasApi(TABELA_GERAL_GERENTES_INATIVA_API)),
      })

      const tabela = await alterarSituacaoTabelaFaixas(7, INATIVAR)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/7/situacao`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(corpoDaChamada(chamadas[0])).toEqual({ ativa: false, motivo: 'passou a valer faixa por filial' })
      expect(tabela).toEqual(GERAL_GERENTES_INATIVA)
    })

    it('reativar: corpo { ativa: true, motivo }', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/6/situacao`]: () => respostaJson({ ...TABELA_COMERCIAL_100_INATIVA_API, situacao: 'ativa' }),
      })

      const tabela = await alterarSituacaoTabelaFaixas(6, REATIVAR)

      expect(corpoDaChamada(chamadas[0])).toEqual({ ativa: true, motivo: 'voltou a valer a régua geral' })
      expect(tabela).toMatchObject({ id: 6, situacao: 'ativa' })
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'Situação alterada.' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['tabela incompleta', () => respostaJson({ tabela: { id: 7 } })],
    ])('resposta 2xx com %s resolve null, sem erro (foi gravado)', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/7/situacao`]: resposta })

      await expect(alterarSituacaoTabelaFaixas(7, INATIVAR)).resolves.toBeNull()
    })

    it('400 de conflito na reativação: ApiError com a mensagem da API e "conflitos" em dados', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/7/situacao`]: () => respostaJson(CONFLITO, 400) })

      const erro = await alterarSituacaoTabelaFaixas(7, REATIVAR).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: CONFLITO.mensagem })
      expect((erro as ApiError).dados).toMatchObject({ conflitos: CONFLITO.conflitos })
    })

    it('400 sem conflitos (ex.: motivo ausente) e 403 chegam como ApiError com a mensagem da API; falha de rede, com a mensagem de conexão', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/7/situacao`]: () => respostaErro(400, 'Informe o motivo.') })
      await expect(alterarSituacaoTabelaFaixas(7, INATIVAR)).rejects.toMatchObject({ status: 400, mensagem: 'Informe o motivo.' })

      simularApi(fetchFalso, { [`PUT ${ROTA}/7/situacao`]: () => respostaErro(403, 'Somente o Admin altera a faixa geral.') })
      await expect(alterarSituacaoTabelaFaixas(7, INATIVAR)).rejects.toMatchObject({ status: 403, mensagem: 'Somente o Admin altera a faixa geral.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(alterarSituacaoTabelaFaixas(7, INATIVAR)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
