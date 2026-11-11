import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DADO_FATURAMENTO_API,
  ENTRADA_FATURAMENTO_API,
  SAIDA_FATURAMENTO_API,
  URL_FATURAMENTO,
  comIntegracaoApi,
  dadosExternosAdminApi,
  respostaDadosExternosApi,
} from '../test/dadosExternosFalsos'
import { atualizarIntegracao, concluirConstrucao, listarDadosExternos } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro'

/**
 * F5.22 — Última consulta do dado externo (executor das integrações, 11/11/2026 —
 * `docs/backend/FRONT-meta-via-api-fase2.md`, seção 1, e `API (27).md`, "Executor das integrações"):
 * a listagem do Admin traz `"ultima consulta em"` (último **sucesso**, `"aaaa-mm-dd hh:mm:ss"`) e
 * `"erro da ultima consulta"` (texto). No domínio, `DadoExterno.ultimaConsultaEm: DataApi | null` e
 * `DadoExterno.erroUltimaConsulta: string | null`. Leitura tolerante (campos novos, não rejeitam a lista):
 * ausente, `null` ou não textual → `null`; erro vazio ou só com espaços → `null`.
 *
 * Também (`FRONT-meta-via-api-fase1.md`, item 2.4): a listagem do Admin devolve `"tipo de servico"`
 * (`"soap"` ou `"rest"`). O front não tem seletor e trata tudo como SOAP: o campo é aceito com qualquer
 * valor (ou ausente) sem rejeitar a lista e **não** é enviado no `PUT .../integracao` nem no
 * `PUT .../concluir` (o back-end assume `soap`).
 */
describe('F5.22 — Serviço: última consulta e tipo de serviço na listagem de dados externos', () => {
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
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi(lista as never)) })
    return listarDadosExternos()
  }

  it('converte "ultima consulta em" e "erro da ultima consulta" do Admin', async () => {
    const [dado] = await listar([
      comIntegracaoApi(DADO_FATURAMENTO_API, {
        url: URL_FATURAMENTO,
        'ultima consulta em': '2026-11-11 02:30:00',
        'erro da ultima consulta': 'valor ambiguo: 1.500 na filial 101',
      }),
    ])

    expect(dado.ultimaConsultaEm).toBe('2026-11-11 02:30:00')
    expect(dado.erroUltimaConsulta).toBe('valor ambiguo: 1.500 na filial 101')
  })

  it('consulta com sucesso e sem erro: data preenchida e erro null', async () => {
    const [dado] = await listar([
      comIntegracaoApi(DADO_FATURAMENTO_API, { 'ultima consulta em': '2026-11-11 02:30:00', 'erro da ultima consulta': null }),
    ])

    expect(dado).toMatchObject({ ultimaConsultaEm: '2026-11-11 02:30:00', erroUltimaConsulta: null })
  })

  it('nunca consultado com erro (a fonte falhou na primeira consulta): data null e o erro', async () => {
    const [dado] = await listar([
      comIntegracaoApi(DADO_FATURAMENTO_API, { 'ultima consulta em': null, 'erro da ultima consulta': 'use %empresas%' }),
    ])

    expect(dado).toMatchObject({ ultimaConsultaEm: null, erroUltimaConsulta: 'use %empresas%' })
  })

  it('sem os campos (Validador, Preenchedor ou antes do executor): os dois null', async () => {
    const dados = await listar(dadosExternosAdminApi())

    for (const dado of dados) {
      expect(dado.ultimaConsultaEm).toBeNull()
      expect(dado.erroUltimaConsulta).toBeNull()
    }
    const [validador] = await listar([DADO_FATURAMENTO_API])
    expect(validador).toMatchObject({ ultimaConsultaEm: null, erroUltimaConsulta: null })
  })

  it.each<[string, Record<string, unknown>]>([
    ['"ultima consulta em" numérica', { 'ultima consulta em': 20261111 }],
    ['"ultima consulta em" objeto', { 'ultima consulta em': { data: '2026-11-11' } }],
    ['"erro da ultima consulta" booleano', { 'erro da ultima consulta': true }],
    ['"erro da ultima consulta" vazio', { 'erro da ultima consulta': '' }],
    ['"erro da ultima consulta" só com espaços', { 'erro da ultima consulta': '   ' }],
  ])('%s não rejeita a lista e vira null', async (_nome, campos) => {
    const [dado] = await listar([comIntegracaoApi(DADO_FATURAMENTO_API, campos)])

    expect(dado.nome).toBe('Faturamento líquido')
    expect(dado.ultimaConsultaEm).toBeNull()
    expect(dado.erroUltimaConsulta).toBeNull()
  })

  it.each<[string, unknown]>([
    ['"soap"', 'soap'],
    ['"rest"', 'rest'],
    ['null', null],
    ['outro texto', 'graphql'],
    ['número', 1],
  ])('"tipo de servico" %s não rejeita a lista', async (_nome, tipo) => {
    const dados = await listar([comIntegracaoApi(DADO_FATURAMENTO_API, { url: URL_FATURAMENTO, 'tipo de servico': tipo })])

    expect(dados).toHaveLength(1)
    expect(dados[0]).toMatchObject({ nome: 'Faturamento líquido', url: URL_FATURAMENTO })
  })

  it('"tipo de servico" não é enviado no PUT .../integracao nem no PUT .../concluir', async () => {
    const chamadas = simularApi(fetchFalso, {
      [`PUT ${ROTA}/1/integracao`]: () => respostaJson({ mensagem: 'integracao atualizada' }),
      [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ mensagem: 'ok' }),
    })
    const integracao = {
      identificador: 'FATURAMENTO',
      url: URL_FATURAMENTO,
      parametrosSaida: JSON.stringify(SAIDA_FATURAMENTO_API),
      parametrosEntrada: JSON.stringify(ENTRADA_FATURAMENTO_API),
    }

    await atualizarIntegracao(1, integracao)
    await concluirConstrucao(3, integracao)

    for (const chamada of chamadas) {
      expect(corpoDaChamada(chamada)).not.toHaveProperty('tipo de servico')
      expect(Object.keys(corpoDaChamada(chamada) as object).sort()).toEqual(
        ['identificador', 'parametros de entrada', 'parametros de saida', 'url'].sort(),
      )
    }
  })
})
