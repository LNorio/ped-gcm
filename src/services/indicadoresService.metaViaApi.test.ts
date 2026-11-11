import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  ENTRADA_META_VIA_API,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  SAIDA_META_VIA_API,
  URL_META_VIA_API,
  alertasApi,
  alertasComIntegracaoPendenteApi,
  respostaIndicadorApi,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import type { IntegracaoDadoExterno } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { errosDaIntegracao } from './dadosExternosService'
import { atualizarIntegracaoIndicador, criarIndicador, definirMeta, listarIndicadores } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.11 — Meta buscada via API no serviço de indicadores (proposta de contrato, seção 5 de
 * `docs/propostas-backend/PROPOSTA-meta-por-filial.md`; o back-end implementa depois):
 * - POST e `PUT .../{id}/meta` com `origemDaMeta: 'terceiro'` → `"origem da meta": "terceiro"`, sem `meta`
 *   nem `metas por filial`, `"meta editavel": false` e, no contrato final (10/11/2026), `"fonte da meta"`
 *   (sem `fonteDaMeta` → `integracao`; ver `indicadoresService.fonteDaMeta.test.ts`);
 * - `atualizarIntegracaoIndicador(id, integracao)` → `PUT /api/ped/indicadores-cadastro/{id}/integracao`,
 *   mesmo corpo da integração do dado externo mais o mapeamento da saída (`campo da filial`, `campo da meta`,
 *   `campo da competencia` — 11/11/2026, ver `indicadoresService.saidaTipos.test.ts`); 2xx = gravado (resolve sem valor);
 * - listagem: campos da integração em `Indicador.integracao` (só com origem `terceiro`) e o alerta
 *   opcional `alertas["integracao pendente"]` → `alertas.integracaoPendente` (ausente → `undefined`,
 *   tratado como 0 pela tela).
 */
const ROTA = '/api/ped/indicadores-cadastro'
const SAIDA = JSON.stringify(SAIDA_META_VIA_API, null, 2)
const ENTRADA = JSON.stringify(ENTRADA_META_VIA_API, null, 2)

function integracao(sobrescrever: Partial<IntegracaoDadoExterno> = {}): IntegracaoDadoExterno {
  return {
    identificador: 'META_MARGEM',
    url: URL_META_VIA_API,
    parametrosSaida: SAIDA,
    parametrosEntrada: ENTRADA,
    // Saída por "chave: tipo" (11/11/2026): mapeamento da saída escolhido na modal.
    mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null },
    ...sobrescrever,
  }
}

describe('F6.11 — Meta via API: serviço de indicadores', () => {
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

  function listar(lista: unknown[], alertas: unknown = alertasApi(lista as IndicadorApiFalso[])) {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ indicadores: lista, alertas }) })
    return listarIndicadores()
  }

  describe('listarIndicadores — campos da integração da meta', () => {
    it('converte a integração do indicador com meta via API (configurada e pendente)', async () => {
      const { indicadores } = await listar([INDICADOR_META_API_CONFIGURADO_API, INDICADOR_META_API_PENDENTE_API])

      expect(indicadores[0]).toMatchObject({
        id: 11,
        origemDaMeta: 'terceiro',
        meta: null,
        integracao: {
          identificador: 'META_MARGEM',
          url: URL_META_VIA_API,
          parametrosSaida: SAIDA_META_VIA_API,
          parametrosEntrada: ENTRADA_META_VIA_API,
          variaveisUsadas: ['competencia', 'empresas'],
          pendente: false,
          alteradaEm: '2026-11-10 09:00:00',
          alteradaPor: 'Equipe TI',
        },
      })
      expect(indicadores[1]).toMatchObject({ id: 10, integracao: { url: null, pendente: true } })
    })

    it('indicador de meta manual (API atual) continua válido e sem integracao', async () => {
      const { indicadores } = await listar([INDICADOR_COBERTURA_VISITAS_API])

      expect(indicadores[0].integracao).toBeUndefined()
    })

    it.each<[string, Partial<Record<string, unknown>>]>([
      ['url não textual', { url: 10 }],
      ['identificador não textual', { identificador: 5 }],
      ['"integracao pendente" não booleano', { 'integracao pendente': 'sim' }],
      ['"variaveis usadas" que não é lista', { 'variaveis usadas': 'filial' }],
      ['"variaveis usadas" com item não textual', { 'variaveis usadas': ['filial', 3] }],
      ['"integracao alterada em" não textual', { 'integracao alterada em': 20261110 }],
      ['"integracao alterada por" não textual', { 'integracao alterada por': { nome: 'TI' } }],
    ])('%s rejeita a lista com ApiError(200, resposta inválida)', async (_nome, campos) => {
      const erro = await listar([{ ...INDICADOR_META_API_CONFIGURADO_API, ...campos }]).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('alertas trazem integracaoPendente a partir de "integracao pendente"', async () => {
      const lista = [INDICADOR_META_API_PENDENTE_API, INDICADOR_META_API_CONFIGURADO_API]

      const { alertas } = await listar(lista, alertasComIntegracaoPendenteApi(lista))

      expect(alertas.integracaoPendente).toBe(1)
    })

    it('alertas sem "integracao pendente" (API atual): integracaoPendente fica undefined (a tela trata como 0)', async () => {
      const { alertas } = await listar([INDICADOR_COBERTURA_VISITAS_API])

      expect(alertas.integracaoPendente).toBeUndefined()
    })

    it('"integracao pendente" null nos alertas também fica undefined', async () => {
      const { alertas } = await listar([INDICADOR_COBERTURA_VISITAS_API], {
        ...alertasApi([INDICADOR_COBERTURA_VISITAS_API]),
        'integracao pendente': null,
      })

      expect(alertas.integracaoPendente).toBeUndefined()
    })

    it('"integracao pendente" não numérico nos alertas rejeita a resposta', async () => {
      const erro = await listar([INDICADOR_COBERTURA_VISITAS_API], {
        ...alertasApi([INDICADOR_COBERTURA_VISITAS_API]),
        'integracao pendente': '1',
      }).catch((e: unknown) => e)

      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('criarIndicador com origemDaMeta "terceiro"', () => {
    it('POST com "origem da meta" terceiro, sem meta nem metas por filial e "meta editavel" false', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaIndicadorApi(INDICADOR_META_API_PENDENTE_API), 201),
      })

      const criado = await criarIndicador({
        nome: 'Atingimento de faturamento',
        descricao: null,
        origemDaMeta: 'terceiro',
        sentido: 'maior_melhor',
        metaEditavel: false,
        dadoExterno: 42,
      })

      const corpo = corpoDaChamada(chamadas[0])
      expect(corpo).toEqual({
        nome: 'Atingimento de faturamento',
        descricao: null,
        'origem da meta': 'terceiro',
        'fonte da meta': 'integracao',
        sentido: 'maior_melhor',
        'meta editavel': false,
        'dado externo': 42,
      })
      expect(corpo).not.toHaveProperty('meta')
      expect(corpo).not.toHaveProperty('metas por filial')
      expect(criado).toMatchObject({ id: 10, origemDaMeta: 'terceiro', integracao: { pendente: true } })
    })
  })

  describe('definirMeta com origemDaMeta "terceiro"', () => {
    it('PUT .../{id}/meta com { "origem da meta": "terceiro", sentido, "meta editavel": false }, sem meta nem metas por filial', async () => {
      const atualizado: IndicadorApiFalso = { ...INDICADOR_DEVOLUCOES_API, ...INDICADOR_META_API_PENDENTE_API, id: 4 }
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/meta`]: () => respostaJson(respostaIndicadorApi(atualizado)),
      })

      await definirMeta(4, { origemDaMeta: 'terceiro', sentido: 'maior_melhor', metaEditavel: false })

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/4/meta`)
      expect(corpoDaChamada(chamadas[0])).toEqual({ 'origem da meta': 'terceiro', 'fonte da meta': 'integracao', sentido: 'maior_melhor', 'meta editavel': false })
    })

    it('com origemDaMeta "terceiro", "meta editavel" vai false mesmo que metaEditavel venha true, e meta é ignorada', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/4/meta`]: () => new Response(null, { status: 204 }) })

      await definirMeta(4, { origemDaMeta: 'terceiro', meta: 10, sentido: 'menor_melhor', metaEditavel: true })

      expect(corpoDaChamada(chamadas[0])).toEqual({ 'origem da meta': 'terceiro', 'fonte da meta': 'integracao', sentido: 'menor_melhor', 'meta editavel': false })
    })
  })

  describe('atualizarIntegracaoIndicador(id, integracao)', () => {
    const RESPOSTA_OK = { mensagem: 'integracao atualizada', 'variaveis usadas': ['competencia', 'empresas'] }

    it('PUT /api/ped/indicadores-cadastro/{id}/integracao com o token, os quatro campos (identificador em maiúsculas e sem espaços nas pontas, url sem espaços nas pontas, JSONs como digitados) e o mapeamento da saída', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: () => respostaJson(RESPOSTA_OK) })

      await atualizarIntegracaoIndicador(11, integracao({ identificador: ' meta_margem ', url: `  ${URL_META_VIA_API} ` }))

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/11/integracao`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        identificador: 'META_MARGEM',
        url: URL_META_VIA_API,
        'parametros de saida': SAIDA,
        'parametros de entrada': ENTRADA,
        'campo da filial': 'codfil',
        'campo da meta': 'metVlr',
      })
    })

    it('não usa a rota de integração do dado externo', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: () => respostaJson(RESPOSTA_OK) })

      await atualizarIntegracaoIndicador(11, integracao())

      expect(chamadas.map((c) => c.caminho)).toEqual([`${ROTA}/11/integracao`])
    })

    it.each<[string, () => Response]>([
      ['resposta documentada { mensagem, "variaveis usadas" }', () => respostaJson(RESPOSTA_OK)],
      ['só { mensagem }', () => respostaJson({ mensagem: 'integracao atualizada' })],
      ['200 vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['corpo fora do formato (lista)', () => respostaJson([1, 2])],
    ])('2xx (%s) resolve sem valor e sem erro: a integração foi gravada', async (_nome, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: resposta })

      await expect(atualizarIntegracaoIndicador(11, integracao())).resolves.toBeUndefined()
    })

    it('400 { mensagem, erros } rejeita com ApiError(400) e errosDaIntegracao lê os erros por campo', async () => {
      const corpo = {
        mensagem: 'integracao invalida: URL ...',
        erros: [
          { campo: 'url', mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)' },
          { campo: 'parametros de entrada', caminho: 'competencia', expressao: '5 / 0', mensagem: 'divisao por zero' },
        ],
      }
      simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: () => respostaJson(corpo, 400) })

      const erro = await atualizarIntegracaoIndicador(11, integracao({ url: 'ti.exemplo.com.br' })).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'integracao invalida: URL ...' })
      expect(errosDaIntegracao(erro).map((e) => [e.campo, e.mensagem])).toEqual([
        ['url', 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)'],
        ['parametros de entrada', 'divisao por zero'],
      ])
    })

    it('400 de indicador com meta manual (só a mensagem) rejeita com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/1/integracao`]: () => respostaErro(400, 'indicador nao busca a meta via API'),
      })

      await expect(atualizarIntegracaoIndicador(1, integracao())).rejects.toMatchObject({
        status: 400,
        mensagem: 'indicador nao busca a meta via API',
      })
    })

    it('403, 404 e 500 são propagados como ApiError', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(atualizarIntegracaoIndicador(11, integracao())).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      simularApi(fetchFalso, {})
      await expect(atualizarIntegracaoIndicador(11, integracao())).rejects.toMatchObject({ status: 404 })

      simularApi(fetchFalso, { [`PUT ${ROTA}/11/integracao`]: () => respostaErro(500) })
      await expect(atualizarIntegracaoIndicador(11, integracao())).rejects.toMatchObject({
        status: 500,
        mensagem: mensagemPadraoPorStatus(500),
      })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(atualizarIntegracaoIndicador(11, integracao())).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
