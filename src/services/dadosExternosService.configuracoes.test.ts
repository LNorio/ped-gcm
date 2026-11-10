import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DADO_COBERTURA_API,
  DADO_FATURAMENTO_API,
  ENTRADA_FATURAMENTO_API,
  SAIDA_FATURAMENTO_API,
  SAIDA_VOLUME_API,
  URL_FATURAMENTO,
  comIntegracaoApi,
  dadosExternosAdminApi,
  respostaDadosExternosApi,
} from '../test/dadosExternosFalsos'
import type { IntegracaoDadoExterno } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { atualizarIntegracao, errosDaIntegracao, listarDadosExternos } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro'
const SAIDA = JSON.stringify(SAIDA_FATURAMENTO_API, null, 2)
const ENTRADA = JSON.stringify(ENTRADA_FATURAMENTO_API, null, 2)

function integracao(sobrescrever: Partial<IntegracaoDadoExterno> = {}): IntegracaoDadoExterno {
  return { identificador: 'FATURAMENTO', url: URL_FATURAMENTO, parametrosSaida: SAIDA, parametrosEntrada: ENTRADA, ...sobrescrever }
}

/**
 * Configurações da integração (F5.16), contrato de 09/11/2026 (`FRONT-integracao-dado-externo.md`):
 * - `PUT /api/ped/dados-externos-cadastro/{id}/integracao` com o mesmo corpo do concluir; resposta
 *   `{ mensagem: "integracao atualizada", "variaveis usadas": [...] }` (2xx = gravado);
 * - na listagem, só o Admin recebe `url`, `parametros de saida`, `parametros de entrada`,
 *   `variaveis usadas`, `integracao pendente`, `integracao alterada em` e `integracao alterada por`.
 */
describe('F5.16 — Serviço: atualizarIntegracao(id, integracao) (botão Configurações)', () => {
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

  const RESPOSTA_OK = { mensagem: 'integracao atualizada', 'variaveis usadas': ['dataFinal', 'dataInicial', 'filial'] }

  it('PUT .../{id}/integracao com o token e os quatro campos (identificador em maiúsculas e sem espaços nas pontas, url sem espaços nas pontas, JSONs como digitados)', async () => {
    const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/1/integracao`]: () => respostaJson(RESPOSTA_OK) })

    await atualizarIntegracao(1, integracao({ identificador: ' faturamento ', url: `  ${URL_FATURAMENTO} ` }))

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].metodo).toBe('PUT')
    expect(chamadas[0].caminho).toBe(`${ROTA}/1/integracao`)
    expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    expect(corpoDaChamada(chamadas[0])).toEqual({
      identificador: 'FATURAMENTO',
      url: URL_FATURAMENTO,
      'parametros de saida': SAIDA,
      'parametros de entrada': ENTRADA,
    })
  })

  it('não usa a rota de conclusão (PUT .../concluir)', async () => {
    const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/1/integracao`]: () => respostaJson(RESPOSTA_OK) })

    await atualizarIntegracao(1, integracao())

    expect(chamadas.map((c) => c.caminho)).toEqual([`${ROTA}/1/integracao`])
  })

  it.each<[string, () => Response]>([
    ['resposta documentada { mensagem, "variaveis usadas" }', () => respostaJson(RESPOSTA_OK)],
    ['só { mensagem }', () => respostaJson({ mensagem: 'integracao atualizada' })],
    ['200 vazio', () => new Response('', { status: 200 })],
    ['204 sem corpo', () => new Response(null, { status: 204 })],
    ['corpo fora do formato (lista)', () => respostaJson([1, 2])],
  ])('2xx (%s) resolve sem valor e sem erro: a integração foi gravada', async (_nome, resposta) => {
    simularApi(fetchFalso, { [`PUT ${ROTA}/1/integracao`]: resposta })

    await expect(atualizarIntegracao(1, integracao())).resolves.toBeUndefined()
  })

  it('400 { mensagem, erros } rejeita com ApiError(400) e errosDaIntegracao lê os erros por campo', async () => {
    const corpo = {
      mensagem: 'integracao invalida: URL ...',
      erros: [
        { campo: 'url', mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)' },
        { campo: 'parametros de entrada', caminho: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero' },
      ],
    }
    simularApi(fetchFalso, { [`PUT ${ROTA}/1/integracao`]: () => respostaJson(corpo, 400) })

    const erro = await atualizarIntegracao(1, integracao({ url: 'ti.exemplo.com.br' })).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'integracao invalida: URL ...' })
    expect(errosDaIntegracao(erro).map((e) => [e.campo, e.mensagem])).toEqual([
      ['url', 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)'],
      ['parametros de entrada', 'divisao por zero'],
    ])
  })

  it('400 de dado em construção (só a mensagem) rejeita com a mensagem da API', async () => {
    simularApi(fetchFalso, {
      [`PUT ${ROTA}/3/integracao`]: () => respostaErro(400, 'dado em construcao: use concluir'),
    })

    await expect(atualizarIntegracao(3, integracao())).rejects.toMatchObject({ status: 400, mensagem: 'dado em construcao: use concluir' })
  })

  it('403, 404 e 500 são propagados como ApiError', async () => {
    simularApi(fetchFalso, { [`PUT ${ROTA}/1/integracao`]: () => respostaErro(403, 'Acesso negado.') })
    await expect(atualizarIntegracao(1, integracao())).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

    simularApi(fetchFalso, {})
    await expect(atualizarIntegracao(1, integracao())).rejects.toMatchObject({ status: 404 })

    simularApi(fetchFalso, { [`PUT ${ROTA}/1/integracao`]: () => respostaErro(500) })
    await expect(atualizarIntegracao(1, integracao())).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
  })

  it('falha de rede rejeita com ApiError status 0', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(atualizarIntegracao(1, integracao())).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
  })
})

describe('F5.16 — Serviço: listarDadosExternos com os campos da integração (só Admin)', () => {
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

  function listar(lista: unknown[]) {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ 'dados externos': lista }) })
    return listarDadosExternos()
  }

  it('converte url, parâmetros (objetos), variáveis usadas, integração pendente e quem/quando alterou', async () => {
    const [faturamento] = await listar(dadosExternosAdminApi())

    expect(faturamento).toMatchObject({
      url: URL_FATURAMENTO,
      parametrosSaida: SAIDA_FATURAMENTO_API,
      parametrosEntrada: ENTRADA_FATURAMENTO_API,
      variaveisUsadas: ['dataFinal', 'dataInicial', 'filial'],
      integracaoPendente: false,
      integracaoAlteradaEm: '2026-11-09 10:00:00',
      integracaoAlteradaPor: 'Equipe TI',
    })
  })

  it('a lista do Admin converte os seis dados; pendentes (Cobertura e Chamados) com integracaoPendente true e sem URL', async () => {
    const dados = await listar(dadosExternosAdminApi())

    expect(dados.map((d) => [d.nome, d.integracaoPendente, d.url])).toEqual([
      ['Faturamento líquido', false, URL_FATURAMENTO],
      ['Cobertura de clientes', true, null],
      ['Devoluções de venda', false, null],
      ['Prazo médio de recebimento', false, null],
      ['Chamados atendidos no prazo', true, null],
      ['Volume de vendas', false, 'https://ti.exemplo.com.br/api/volume'],
    ])
    expect(dados[5].parametrosSaida).toEqual(SAIDA_VOLUME_API)
    expect(dados[1]).toMatchObject({ parametrosSaida: null, parametrosEntrada: null, variaveisUsadas: [] })
  })

  it('sem os campos (Validador e Preenchedor): url, parâmetros e datas null, variáveis [] e integracaoPendente false', async () => {
    const [dado] = await listar([DADO_FATURAMENTO_API])

    expect(dado).toMatchObject({
      url: null,
      parametrosSaida: null,
      parametrosEntrada: null,
      variaveisUsadas: [],
      integracaoPendente: false,
      integracaoAlteradaEm: null,
      integracaoAlteradaPor: null,
    })
  })

  it('"variaveis usadas" null vira []', async () => {
    const [dado] = await listar([comIntegracaoApi(DADO_COBERTURA_API, { 'variaveis usadas': null as unknown as string[] })])

    expect(dado.variaveisUsadas).toEqual([])
  })

  it('a lista pura (sem "dados externos") também traz os campos', async () => {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(dadosExternosAdminApi()) })

    const dados = await listarDadosExternos()

    expect(dados[0].url).toBe(URL_FATURAMENTO)
  })

  describe('campos da integração fora do formato rejeitam a lista com ApiError(200, "Resposta inválida do servidor.")', () => {
    it.each<[string, Record<string, unknown>]>([
      ['url que não é texto', { url: 123 }],
      ['"integracao pendente" que não é booleano', { 'integracao pendente': 'sim' }],
      ['"variaveis usadas" com item que não é texto', { 'variaveis usadas': ['filial', 3] }],
      ['"variaveis usadas" que não é lista', { 'variaveis usadas': 'filial' }],
      ['"integracao alterada em" que não é texto', { 'integracao alterada em': 20261109 }],
      ['"integracao alterada por" que não é texto', { 'integracao alterada por': { nome: 'TI' } }],
    ])('%s', async (_nome, campos) => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([{ ...DADO_FATURAMENTO_API, ...campos } as never])),
      })

      const erro = await listarDadosExternos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })
})
