import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  TABELA_COMERCIAL_101_API,
  TABELA_EXCLUIDO_101_API,
  TABELA_GERENTES_100_API,
  respostaGravacaoFaixasApi,
  tabelasFaixasApi,
} from '../test/faixasFalsos'
import type { NovaTabelaFaixas, TabelaFaixas } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import {
  alterarFaixas,
  criarTabelaFaixas,
  listarTabelasFaixas,
  obterTabelaFaixas,
  type AlteracaoFaixas,
} from './faixasService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/faixas'

/** Tabela 1 (PED Comercial · Filial 101) convertida para o domínio. */
const COMERCIAL_101: TabelaFaixas = {
  id: 1,
  idDashboard: 1,
  dashboard: 'PED Comercial',
  dashboardExcluido: false,
  filial: '101',
  nomeFilial: 'CAMPO GRANDE',
  descricao: 'Resultado operacional',
  versaoVigente: 2,
  dataDaVersao: '2026-10-20 15:30:00',
  autorDaVersao: 'Ana Costa',
  quantidadeDeFaixas: 3,
  faixas: [
    { de: 0, ate: 1000, aliquota: 0 },
    { de: 1000.01, ate: 2000, aliquota: 1.5 },
    { de: 2000.01, ate: 5000, aliquota: 3 },
  ],
}

const NOVA: NovaTabelaFaixas = {
  dashboard: 2,
  filial: '101',
  descricao: 'Resultado operacional',
  faixas: [
    { de: 0, ate: 1000, aliquota: 0 },
    { de: 1000.01, ate: 2000, aliquota: 1.5 },
  ],
}

const ALTERACAO: AlteracaoFaixas = {
  motivo: 'Reajuste do trimestre',
  faixas: [
    { de: 0, ate: 1000, aliquota: 0 },
    { de: 1000.01, ate: 2000, aliquota: 1.5 },
    { de: 2000.01, ate: 5000, aliquota: 3.5 },
  ],
}

describe('F8.1 — Serviço de faixas: listagem, detalhe, cadastro e alteração (RF-41 a RF-44)', () => {
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

  describe('listarTabelasFaixas(filtros?) — RF-41', () => {
    it('sem filtros faz GET /api/ped/faixas sem query, com JSON e o token da sessão', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(tabelasFaixasApi()) })

      await listarTabelasFaixas()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('envia filial e dashboard na query quando informados', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarTabelasFaixas({ filial: '101', dashboard: 3 })

      const parametros = chamadas[0].url.searchParams
      expect(parametros.get('filial')).toBe('101')
      expect(parametros.get('dashboard')).toBe('3')
      expect([...parametros.keys()].sort()).toEqual(['dashboard', 'filial'])
    })

    it('filial "todas", vazia ou undefined e dashboard undefined não entram na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarTabelasFaixas({ filial: 'todas' })
      await listarTabelasFaixas({ filial: '' })
      await listarTabelasFaixas({ filial: undefined, dashboard: undefined })

      for (const chamada of chamadas) expect(chamada.url.search).toBe('')
    })

    it('lista pura: devolve cada tabela convertida para o domínio (camelCase), na ordem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(tabelasFaixasApi()) })

      const tabelas = await listarTabelasFaixas()

      expect(tabelas.map((t) => t.id)).toEqual([1, 2, 3, 4])
      expect(tabelas[0]).toEqual(COMERCIAL_101)
      expect(tabelas[3]).toMatchObject({ dashboard: 'PED Antigo', dashboardExcluido: true, versaoVigente: 3, descricao: 'Régua 2025' })
      expect(tabelas[1]).toMatchObject({ descricao: null, quantidadeDeFaixas: 2 })
    })

    it('aceita também a lista dentro de { tabelas }', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ tabelas: [TABELA_GERENTES_100_API] }) })

      const tabelas = await listarTabelasFaixas()

      expect(tabelas).toHaveLength(1)
      expect(tabelas[0]).toMatchObject({ id: 3, dashboard: 'PED Gerentes', filial: '100', nomeFilial: 'MATRIZ' })
    })

    it('filial numérica vira texto; valores das faixas em texto decimal ("1000.00") viram número', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            {
              ...TABELA_GERENTES_100_API,
              filial: 100,
              faixas: [
                { de: '0.00', ate: '1000.00', aliquota: '0.50' },
                { de: '1000.01', ate: '3000', aliquota: '1' },
              ],
            },
          ]),
      })

      const [tabela] = await listarTabelasFaixas()

      expect(tabela.filial).toBe('100')
      expect(tabela.faixas).toEqual([
        { de: 0, ate: 1000, aliquota: 0.5 },
        { de: 1000.01, ate: 3000, aliquota: 1 },
      ])
    })

    it('campos opcionais ausentes: descrição, data e autor null, "dashboard excluido" false, faixas [] e quantidade da lista', async () => {
      const minimo = {
        id: 9,
        'id dashboard': 2,
        dashboard: 'PED Gerentes',
        filial: '102',
        'nome filial': 'DOURADOS',
        'versao vigente': 1,
      }
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([minimo]) })

      const [tabela] = await listarTabelasFaixas()

      expect(tabela).toEqual({
        id: 9,
        idDashboard: 2,
        dashboard: 'PED Gerentes',
        dashboardExcluido: false,
        filial: '102',
        nomeFilial: 'DOURADOS',
        descricao: null,
        versaoVigente: 1,
        dataDaVersao: null,
        autorDaVersao: null,
        quantidadeDeFaixas: 0,
        faixas: [],
      })
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await expect(listarTabelasFaixas()).resolves.toEqual([])
    })

    it.each([
      ['um objeto sem a lista', { mensagem: 'ok' }],
      ['um texto', 'nada'],
      ['null', null],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await listarTabelasFaixas().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it.each([
      ['sem id', { ...TABELA_COMERCIAL_101_API, id: undefined }],
      ['sem "id dashboard"', { ...TABELA_COMERCIAL_101_API, 'id dashboard': undefined }],
      ['sem dashboard', { ...TABELA_COMERCIAL_101_API, dashboard: undefined }],
      ['sem filial', { ...TABELA_COMERCIAL_101_API, filial: undefined }],
      ['sem "nome filial"', { ...TABELA_COMERCIAL_101_API, 'nome filial': undefined }],
      ['sem "versao vigente"', { ...TABELA_COMERCIAL_101_API, 'versao vigente': undefined }],
      ['com "versao vigente" em texto', { ...TABELA_COMERCIAL_101_API, 'versao vigente': 'v2' }],
      ['com faixas fora de lista', { ...TABELA_COMERCIAL_101_API, faixas: 'nenhuma' }],
      ['com faixa sem alíquota', { ...TABELA_COMERCIAL_101_API, faixas: [{ de: 0, ate: 1000 }] }],
      ['com faixa de valor não numérico', { ...TABELA_COMERCIAL_101_API, faixas: [{ de: 'zero', ate: 1000, aliquota: 0 }] }],
      ['com valor no formato pt-BR ("1.000,00")', { ...TABELA_COMERCIAL_101_API, faixas: [{ de: 0, ate: '1.000,00', aliquota: 0 }] }],
      ['com "dashboard excluido" em texto', { ...TABELA_COMERCIAL_101_API, 'dashboard excluido': 'sim' }],
    ])('item %s rejeita a resposta inteira com ApiError "resposta inválida"', async (_caso, item) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([TABELA_GERENTES_100_API, item]) })

      await expect(listarTabelasFaixas()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 (Validador fora da própria filial — A-04; Preenchedor) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })

      await expect(listarTabelasFaixas({ filial: '102' })).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })

    it('500 sem mensagem usa a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500) })

      await expect(listarTabelasFaixas()).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede vira ApiError "Não foi possível conectar ao servidor."', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarTabelasFaixas()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterTabelaFaixas(id) — tabela com as faixas vigentes', () => {
    it('GET /api/ped/faixas/{id} com o token e devolve a tabela convertida', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(TABELA_COMERCIAL_101_API) })

      const tabela = await obterTabelaFaixas(1)

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(tabela).toEqual(COMERCIAL_101)
    })

    it.each([
      ['{ tabela }', { tabela: TABELA_EXCLUIDO_101_API }],
      ['{ faixa }', { faixa: TABELA_EXCLUIDO_101_API }],
    ])('aceita a tabela dentro de %s', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/4`]: () => respostaJson(corpo) })

      await expect(obterTabelaFaixas(4)).resolves.toMatchObject({ id: 4, dashboardExcluido: true })
    })

    it.each([
      ['só { mensagem }', { mensagem: 'ok' }],
      ['tabela incompleta', { tabela: { id: 1 } }],
      ['uma lista', [TABELA_COMERCIAL_101_API]],
    ])('resposta com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(corpo) })

      await expect(obterTabelaFaixas(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('404 chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/99`]: () => respostaErro(404, 'Tabela de faixas não encontrada.') })

      await expect(obterTabelaFaixas(99)).rejects.toMatchObject({ status: 404, mensagem: 'Tabela de faixas não encontrada.' })
    })
  })

  describe('criarTabelaFaixas(dados) — RF-42; 2xx significa gravado', () => {
    it('POST /api/ped/faixas com dashboard, filial, descrição e faixas numéricas; devolve a tabela gravada', async () => {
      const gravada = { ...TABELA_GERENTES_100_API, id: 7, filial: '101', 'nome filial': 'CAMPO GRANDE', faixas: NOVA.faixas }
      const chamadas = simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoFaixasApi(gravada), 201) })

      const tabela = await criarTabelaFaixas(NOVA)

      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        dashboard: 2,
        filial: '101',
        descricao: 'Resultado operacional',
        faixas: [
          { de: 0, ate: 1000, aliquota: 0 },
          { de: 1000.01, ate: 2000, aliquota: 1.5 },
        ],
      })
      expect(tabela).toMatchObject({ id: 7, filial: '101', versaoVigente: 1, faixas: NOVA.faixas })
    })

    it('descrição ausente vai como null', async () => {
      const chamadas = simularApi(fetchFalso, { [`POST ${ROTA}`]: () => new Response(null, { status: 201 }) })

      await criarTabelaFaixas({ ...NOVA, descricao: null })

      expect(corpoDaChamada(chamadas[0])).toMatchObject({ descricao: null })
    })

    it.each([
      ['a tabela na raiz', () => respostaJson(TABELA_GERENTES_100_API, 201)],
      ['{ faixa }', () => respostaJson({ faixa: TABELA_GERENTES_100_API }, 201)],
      ['{ tabela, mensagem }', () => respostaJson({ tabela: TABELA_GERENTES_100_API, mensagem: 'Tabela cadastrada.' }, 201)],
    ])('aceita %s', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: resposta })

      await expect(criarTabelaFaixas(NOVA)).resolves.toMatchObject({ id: 3, dashboard: 'PED Gerentes' })
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'Tabela de faixas cadastrada.' }, 201)],
      ['só { id }', () => respostaJson({ id: 20 }, 201)],
      ['201 com corpo vazio', () => new Response('', { status: 201 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['uma lista', () => respostaJson([TABELA_GERENTES_100_API], 201)],
      ['um texto solto', () => respostaJson('ok', 201)],
      ['tabela incompleta', () => respostaJson({ tabela: { id: 20, dashboard: 'X' } }, 201)],
    ])('resposta 2xx com %s resolve null, sem erro (foi gravado)', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: resposta })

      await expect(criarTabelaFaixas(NOVA)).resolves.toBeNull()
    })

    it('400 (tabela já existe, validação das linhas) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaErro(400, 'Já existe uma tabela de faixas para este dashboard nesta filial.'),
      })

      const erro = await criarTabelaFaixas(NOVA).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'Já existe uma tabela de faixas para este dashboard nesta filial.' })
    })

    it('403 e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(criarTabelaFaixas(NOVA)).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(criarTabelaFaixas(NOVA)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('alterarFaixas(id, { motivo, faixas }) — RF-44 (nova versão); 2xx significa gravado', () => {
    it('PUT /api/ped/faixas/{id} com { motivo, faixas } e devolve a tabela na nova versão', async () => {
      const alterada = { ...TABELA_COMERCIAL_101_API, 'versao vigente': 3, faixas: ALTERACAO.faixas }
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/1`]: () => respostaJson(respostaGravacaoFaixasApi(alterada)) })

      const tabela = await alterarFaixas(1, ALTERACAO)

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        motivo: 'Reajuste do trimestre',
        faixas: [
          { de: 0, ate: 1000, aliquota: 0 },
          { de: 1000.01, ate: 2000, aliquota: 1.5 },
          { de: 2000.01, ate: 5000, aliquota: 3.5 },
        ],
      })
      expect(tabela).toMatchObject({ id: 1, versaoVigente: 3, faixas: ALTERACAO.faixas })
    })

    it('aceita a tabela na raiz ou em { faixa }', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1`]: () => respostaJson(TABELA_COMERCIAL_101_API) })
      await expect(alterarFaixas(1, ALTERACAO)).resolves.toMatchObject({ id: 1 })

      simularApi(fetchFalso, { [`PUT ${ROTA}/1`]: () => respostaJson({ faixa: TABELA_COMERCIAL_101_API }) })
      await expect(alterarFaixas(1, ALTERACAO)).resolves.toMatchObject({ id: 1 })
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'Nova versão gravada.' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['tabela incompleta', () => respostaJson({ tabela: { id: 1, 'versao vigente': 3 } })],
    ])('resposta 2xx com %s resolve null, sem erro (foi gravado)', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1`]: resposta })

      await expect(alterarFaixas(1, ALTERACAO)).resolves.toBeNull()
    })

    it('400 (motivo ausente, faixas iguais às vigentes) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1`]: () => respostaErro(400, 'As faixas são iguais às da versão vigente.') })

      await expect(alterarFaixas(1, ALTERACAO)).rejects.toMatchObject({ status: 400, mensagem: 'As faixas são iguais às da versão vigente.' })
    })

    it('403 (Validador em outra filial — A-04) e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/2`]: () => respostaErro(403, 'Acesso negado à filial.') })
      await expect(alterarFaixas(2, ALTERACAO)).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado à filial.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(alterarFaixas(1, ALTERACAO)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
