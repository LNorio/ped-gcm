import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  INDICADOR_CAPACITACAO_API,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_CUSTO_FRETE_API,
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_FATURAMENTO_API,
  INDICADOR_ROTINAS_API,
  historicoMetasApi,
  respostaIndicadorApi,
  respostaIndicadoresApi,
  respostaSituacaoApi,
} from '../test/indicadoresFalsos'
import type { NovoIndicador } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import {
  ROTULOS_SITUACAO_FILTRO_INDICADOR,
  SITUACOES_FILTRO_INDICADOR,
  alterarSituacaoIndicador,
  criarIndicador,
  definirMeta,
  excluirIndicador,
  listarHistoricoMetas,
  listarIndicadores,
} from './indicadoresService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/indicadores-cadastro'

const NOVO_POR_APONTAMENTOS: NovoIndicador = {
  nome: 'Positivação da carteira',
  descricao: null,
  meta: 1500.5,
  sentido: 'maior_melhor',
  calculo: 'media',
  metaEditavel: true,
  apontamentos: [5, 7],
}

const NOVO_POR_DADO_EXTERNO: NovoIndicador = {
  nome: 'Faturamento líquido mensal',
  descricao: 'Faturamento líquido coletado do ERP.',
  meta: 100,
  sentido: 'menor_melhor',
  metaEditavel: false,
  dadoExterno: 1,
}

describe('F6.1 — Serviço de indicadores', () => {
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

  describe('SITUACOES_FILTRO_INDICADOR e rótulos', () => {
    it('as situações do filtro são todas, ativos, inativos, meta e problemas, nesta ordem (valores da API)', () => {
      expect(SITUACOES_FILTRO_INDICADOR).toEqual(['todas', 'ativos', 'inativos', 'meta', 'problemas'])
    })

    it('os rótulos em pt-BR são Todas, Ativos, Inativos, Aguardando meta e Com problemas', () => {
      expect(ROTULOS_SITUACAO_FILTRO_INDICADOR).toEqual({
        todas: 'Todas',
        ativos: 'Ativos',
        inativos: 'Inativos',
        meta: 'Aguardando meta',
        problemas: 'Com problemas',
      })
    })
  })

  describe('listarIndicadores(filtros?)', () => {
    it('sem filtros faz GET /api/ped/indicadores-cadastro sem query, com JSON e o token da sessão', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi()) })

      await listarIndicadores()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('envia busca e situacao na query quando informadas', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi()) })

      await listarIndicadores({ busca: 'cobertura', situacao: 'meta' })

      const parametros = chamadas[0].url.searchParams
      expect(parametros.get('busca')).toBe('cobertura')
      expect(parametros.get('situacao')).toBe('meta')
      expect([...parametros.keys()].sort()).toEqual(['busca', 'situacao'])
    })

    it('situação "todas", busca vazia ou só com espaços e filtros undefined não entram na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi()) })

      await listarIndicadores({ busca: '   ', situacao: 'todas' })
      await listarIndicadores({ busca: undefined, situacao: undefined })

      expect(chamadas[0].url.search).toBe('')
      expect(chamadas[1].url.search).toBe('')
    })

    it('devolve { indicadores, alertas } com cada indicador convertido para o domínio (camelCase), na ordem da API', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi([INDICADOR_COBERTURA_VISITAS_API, INDICADOR_DEVOLUCOES_API])),
      })

      const resultado = await listarIndicadores()

      expect(resultado.indicadores).toHaveLength(2)
      expect(resultado.indicadores[0]).toEqual({
        id: 1,
        nome: 'Cobertura de visitas',
        descricao: 'Percentual de vendedores com roteiro e positivação em dia.',
        ativo: true,
        composicao: {
          tipo: 'apontamentos',
          itens: [
            { id: 1, nome: 'Roteiro de visitas elaborado', ativo: true },
            { id: 6, nome: 'Positivação de clientes', ativo: true },
          ],
        },
        tipos: ['Comercial'],
        sentido: 'maior_melhor',
        calculo: 'media',
        meta: 85,
        metaADefinir: false,
        origemDaMeta: 'manual',
        metaEditavel: false,
        criadoAutomaticamente: false,
        componentesDesativados: false,
        problema: null,
        dashboards: [{ id: 1, nome: 'PED Comercial', pontosBase: 40 }],
        vinculadoADashboard: true,
        cadastradoEm: '2026-10-02 09:30:00',
        cadastradoPor: 'Maria Souza',
        situacaoAlteradaEm: null,
        situacaoAlteradaPor: null,
      })
      expect(resultado.indicadores[1]).toMatchObject({
        id: 4,
        criadoAutomaticamente: true,
        metaADefinir: true,
        sentido: null,
        calculo: null,
        meta: null,
        origemDaMeta: null,
        composicao: { tipo: 'dado_externo', itens: [{ id: 3, nome: 'Devoluções (dado externo)', ativo: true }] },
      })
    })

    it('alertas convertidos: aguardandoMeta e comComponenteDesativado (contam só indicadores ativos)', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi()) })

      const { alertas } = await listarIndicadores()

      expect(alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3 })
    })

    it('problema e situação alterada são convertidos', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi([INDICADOR_CUSTO_FRETE_API, INDICADOR_CAPACITACAO_API])),
      })

      const { indicadores } = await listarIndicadores()

      expect(indicadores[0]).toMatchObject({
        sentido: 'menor_melhor',
        componentesDesativados: true,
        problema: { tipo: 'todos_apontamentos_desativados', mensagem: 'Todos os apontamentos estão desativados; o indicador fica sem resultado.' },
        dashboards: [{ id: 2, nome: 'PED Gerentes', pontosBase: 20 }],
      })
      expect(indicadores[1]).toMatchObject({
        ativo: false,
        situacaoAlteradaEm: '2026-10-20 11:05:00',
        situacaoAlteradaPor: 'Ana Costa',
      })
    })

    it('alertas ausentes na resposta viram zeros, sem erro', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ indicadores: [INDICADOR_ROTINAS_API] }) })

      const resultado = await listarIndicadores()

      expect(resultado.indicadores).toHaveLength(1)
      expect(resultado.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 0 })
    })

    it('lista vazia resolve { indicadores: [], alertas zerados }', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi([])) })

      await expect(listarIndicadores()).resolves.toEqual({
        indicadores: [],
        alertas: { aguardandoMeta: 0, comComponenteDesativado: 0 },
      })
    })

    it.each([
      ['um objeto sem a lista', { mensagem: 'ok' }],
      ['uma lista pura (sem o envelope { indicadores, alertas })', [INDICADOR_ROTINAS_API]],
      ['um texto', 'nada'],
      ['null', null],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await listarIndicadores().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it.each([
      [
        'sem id',
        (() => {
          const { id: _id, ...resto } = INDICADOR_COBERTURA_VISITAS_API
          return resto
        })(),
      ],
      ['com ativo não booleano', { ...INDICADOR_COBERTURA_VISITAS_API, ativo: 'sim' }],
      ['sem composição', { ...INDICADOR_COBERTURA_VISITAS_API, composicao: undefined }],
      ['com tipo de composição desconhecido', { ...INDICADOR_COBERTURA_VISITAS_API, composicao: { tipo: 'misto', itens: [] } }],
      [
        'com item da composição sem nome',
        { ...INDICADOR_COBERTURA_VISITAS_API, composicao: { tipo: 'apontamentos', itens: [{ id: 1, ativo: true }] } },
      ],
      ['com sentido desconhecido', { ...INDICADOR_COBERTURA_VISITAS_API, sentido: 'igual_melhor' }],
      ['com cálculo desconhecido', { ...INDICADOR_COBERTURA_VISITAS_API, calculo: 'maximo' }],
      ['com meta em texto', { ...INDICADOR_COBERTURA_VISITAS_API, meta: '85' }],
      ['com dashboard sem pontos base', { ...INDICADOR_COBERTURA_VISITAS_API, dashboards: [{ id: 1, nome: 'PED Comercial' }] }],
    ])('item %s rejeita a resposta inteira com ApiError "resposta inválida"', async (_caso, item) => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaIndicadoresApi([INDICADOR_ROTINAS_API, item as typeof INDICADOR_ROTINAS_API])),
      })

      await expect(listarIndicadores()).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 (Preenchedor) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })

      await expect(listarIndicadores()).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })

    it('500 sem mensagem usa a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500) })

      await expect(listarIndicadores()).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede vira ApiError "Não foi possível conectar ao servidor."', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarIndicadores()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('criarIndicador(dados) — 2xx significa gravado', () => {
    it('composição por apontamentos: POST com o corpo de paraCorpoNovoIndicador (origem manual, calculo e apontamentos)', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaIndicadorApi(INDICADOR_COBERTURA_VISITAS_API), 201),
      })

      await criarIndicador(NOVO_POR_APONTAMENTOS)

      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        nome: 'Positivação da carteira',
        descricao: null,
        'origem da meta': 'manual',
        meta: 1500.5,
        sentido: 'maior_melhor',
        'meta editavel': true,
        calculo: 'media',
        apontamentos: [5, 7],
      })
    })

    it('composição por dado externo: corpo com "dado externo", sem calculo nem apontamentos', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaIndicadorApi(INDICADOR_FATURAMENTO_API), 201),
      })

      await criarIndicador(NOVO_POR_DADO_EXTERNO)

      const corpo = corpoDaChamada(chamadas[0]) as Record<string, unknown>
      expect(corpo).toEqual({
        nome: 'Faturamento líquido mensal',
        descricao: 'Faturamento líquido coletado do ERP.',
        'origem da meta': 'manual',
        meta: 100,
        sentido: 'menor_melhor',
        'meta editavel': false,
        'dado externo': 1,
      })
      expect(corpo).not.toHaveProperty('calculo')
      expect(corpo).not.toHaveProperty('apontamentos')
    })

    it('resposta { indicador } devolve o indicador convertido', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(respostaIndicadorApi(INDICADOR_COBERTURA_VISITAS_API), 201) })

      const criado = await criarIndicador(NOVO_POR_APONTAMENTOS)

      expect(criado).toMatchObject({ id: 1, nome: 'Cobertura de visitas', calculo: 'media', vinculadoADashboard: true })
    })

    it('aceita também o indicador na raiz da resposta, com ou sem mensagem ao lado', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson({ ...INDICADOR_FATURAMENTO_API, mensagem: 'indicador cadastrado' }, 201) })

      const criado = await criarIndicador(NOVO_POR_DADO_EXTERNO)

      expect(criado).toMatchObject({ id: 3, nome: 'Faturamento líquido mensal', composicao: { tipo: 'dado_externo' } })
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'indicador cadastrado' }, 201)],
      ['só { id }', () => respostaJson({ id: 20 }, 201)],
      ['201 com corpo vazio', () => new Response('', { status: 201 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['uma lista', () => respostaJson([INDICADOR_ROTINAS_API], 201)],
      ['um texto solto', () => respostaJson('ok', 201)],
      ['indicador incompleto na raiz', () => respostaJson({ id: 20, nome: 'Novo' }, 201)],
      ['envelope { indicador } incompleto', () => respostaJson({ mensagem: 'ok', indicador: { id: 20, nome: 'Novo' } }, 201)],
      ['indicador com sentido desconhecido', () => respostaJson(respostaIndicadorApi({ ...INDICADOR_ROTINAS_API, sentido: 'x' as 'maior_melhor' }), 201)],
    ])('resposta 2xx com %s resolve null, sem erro (o indicador foi gravado)', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: resposta })

      await expect(criarIndicador(NOVO_POR_APONTAMENTOS)).resolves.toBeNull()
    })

    it('400 (composição inválida: os dois tipos juntos, ou nenhum) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(400, 'Informe apontamentos ou um dado externo, nunca os dois.') })

      const erro = await criarIndicador({ ...NOVO_POR_APONTAMENTOS, dadoExterno: 1 }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'Informe apontamentos ou um dado externo, nunca os dois.' })
    })

    it('403 (Preenchedor) e 500 chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(criarIndicador(NOVO_POR_APONTAMENTOS)).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(500) })
      await expect(criarIndicador(NOVO_POR_APONTAMENTOS)).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(criarIndicador(NOVO_POR_APONTAMENTOS)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('definirMeta(id, dados) — RF-36; 2xx significa gravado', () => {
    const COM_META = {
      ...INDICADOR_DEVOLUCOES_API,
      sentido: 'maior_melhor' as const,
      'sentido descricao': 'Maior é melhor',
      meta: 2500,
      'meta a definir': false,
      'origem da meta': 'manual' as const,
      'meta editavel no preenchimento': true,
    }

    it('PUT .../{id}/meta com { meta, sentido, "meta editavel" } e devolve o indicador convertido', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/4/meta`]: () => respostaJson(respostaIndicadorApi(COM_META)) })

      const atualizado = await definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/4/meta`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({ meta: 2500, sentido: 'maior_melhor', 'meta editavel': true })
      expect(atualizado).toMatchObject({ id: 4, meta: 2500, sentido: 'maior_melhor', metaADefinir: false, metaEditavel: true })
    })

    it('meta decimal é enviada como número (ex.: 12,5 lido pelo formulário → 12.5)', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/4/meta`]: () => respostaJson(respostaIndicadorApi(COM_META)) })

      await definirMeta(4, { meta: 12.5, sentido: 'menor_melhor', metaEditavel: false })

      expect(corpoDaChamada(chamadas[0])).toEqual({ meta: 12.5, sentido: 'menor_melhor', 'meta editavel': false })
    })

    it('aceita também o indicador na raiz da resposta', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/meta`]: () => respostaJson({ ...COM_META, mensagem: 'meta definida' }) })

      await expect(definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })).resolves.toMatchObject({ id: 4, meta: 2500 })
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'meta definida' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['indicador incompleto', () => respostaJson({ indicador: { id: 4 } })],
    ])('resposta 2xx com %s resolve null, sem erro', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/meta`]: resposta })

      await expect(definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })).resolves.toBeNull()
    })

    it('400 (meta já definida) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/meta`]: () => respostaErro(400, 'A meta deste indicador já foi definida.') })

      await expect(definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })).rejects.toMatchObject({
        status: 400,
        mensagem: 'A meta deste indicador já foi definida.',
      })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(definirMeta(4, { meta: 1, sentido: 'maior_melhor', metaEditavel: false })).rejects.toMatchObject({ status: 0 })
    })
  })

  describe('alterarSituacaoIndicador(id, ativo) — RF-38; 2xx significa gravado', () => {
    const INATIVADO = {
      ...INDICADOR_FATURAMENTO_API,
      ativo: false,
      'situacao alterada em': '2026-11-05 10:00:00',
      'situacao alterada por': 'Beltrano',
    }

    it('PUT .../{id}/situacao com { ativo: false } e devolve { indicador, dashboardsAfetados } convertidos', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/3/situacao`]: () => respostaJson(respostaSituacaoApi(INATIVADO)) })

      const resultado = await alterarSituacaoIndicador(3, false)

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/3/situacao`)
      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: false })
      expect(resultado.indicador).toMatchObject({ id: 3, ativo: false, situacaoAlteradaPor: 'Beltrano', situacaoAlteradaEm: '2026-11-05 10:00:00' })
      expect(resultado.dashboardsAfetados).toEqual([
        { id: 1, nome: 'PED Comercial', pontosBase: 60 },
        { id: 2, nome: 'PED Gerentes', pontosBase: 30 },
      ])
    })

    it('reativar envia { ativo: true }', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/5/situacao`]: () => respostaJson(respostaSituacaoApi({ ...INDICADOR_CAPACITACAO_API, ativo: true }, [])),
      })

      const resultado = await alterarSituacaoIndicador(5, true)

      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: true })
      expect(resultado.indicador?.ativo).toBe(true)
      expect(resultado.dashboardsAfetados).toEqual([])
    })

    it('aceita também o indicador na raiz com "dashboards afetados" ao lado', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/situacao`]: () => respostaJson({ ...INATIVADO, 'dashboards afetados': [{ id: 1, nome: 'PED Comercial', 'pontos base': 60 }] }),
      })

      const resultado = await alterarSituacaoIndicador(3, false)

      expect(resultado.indicador?.id).toBe(3)
      expect(resultado.dashboardsAfetados).toEqual([{ id: 1, nome: 'PED Comercial', pontosBase: 60 }])
    })

    it('"dashboards afetados" ausente (fase 4 da API) vira [] mantendo o indicador', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/situacao`]: () => respostaJson({ indicador: INATIVADO }) })

      const resultado = await alterarSituacaoIndicador(3, false)

      expect(resultado.indicador?.id).toBe(3)
      expect(resultado.dashboardsAfetados).toEqual([])
    })

    it('"dashboards afetados" fora do formato (texto, item sem pontos base) vira [], sem erro', async () => {
      for (const afetados of ['nenhum', [{ id: 1, nome: 'PED Comercial' }], [1, 2], { id: 1 }]) {
        simularApi(fetchFalso, { [`PUT ${ROTA}/3/situacao`]: () => respostaJson({ indicador: INATIVADO, 'dashboards afetados': afetados }) })

        const resultado = await alterarSituacaoIndicador(3, false)

        expect(resultado.indicador?.id).toBe(3)
        expect(resultado.dashboardsAfetados).toEqual([])
      }
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'situação alterada' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['indicador incompleto', () => respostaJson({ indicador: { id: 3, nome: 'Faturamento líquido mensal' } })],
    ])('resposta 2xx com %s resolve { indicador: null, dashboardsAfetados: [] }, sem erro', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/situacao`]: resposta })

      await expect(alterarSituacaoIndicador(3, false)).resolves.toEqual({ indicador: null, dashboardsAfetados: [] })
    })

    it('só { mensagem, "dashboards afetados" }: indicador null e os afetados convertidos', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/situacao`]: () =>
          respostaJson({ mensagem: 'inativado', 'dashboards afetados': [{ id: 2, nome: 'PED Gerentes', 'pontos base': 30 }] }),
      })

      await expect(alterarSituacaoIndicador(3, false)).resolves.toEqual({
        indicador: null,
        dashboardsAfetados: [{ id: 2, nome: 'PED Gerentes', pontosBase: 30 }],
      })
    })

    it('403 e 500 chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/situacao`]: () => respostaErro(403, 'Apenas Admin e Validador alteram a situação.') })
      await expect(alterarSituacaoIndicador(3, false)).rejects.toMatchObject({ status: 403, mensagem: 'Apenas Admin e Validador alteram a situação.' })

      simularApi(fetchFalso, { [`PUT ${ROTA}/3/situacao`]: () => respostaErro(500) })
      await expect(alterarSituacaoIndicador(3, false)).rejects.toMatchObject({ status: 500 })
    })
  })

  describe('excluirIndicador(id) — RF-37 (rota DELETE acordada na A-09)', () => {
    it('DELETE .../{id} com o token; resolve sem valor em 204', async () => {
      const chamadas = simularApi(fetchFalso, { [`DELETE ${ROTA}/2`]: () => new Response(null, { status: 204 }) })

      await expect(excluirIndicador(2)).resolves.toBeUndefined()

      expect(chamadas[0].metodo).toBe('DELETE')
      expect(chamadas[0].caminho).toBe(`${ROTA}/2`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('resolve sem valor em 200 com corpo', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/2`]: () => respostaJson({ mensagem: 'Excluído.' }) })

      await expect(excluirIndicador(2)).resolves.toBeUndefined()
    })

    it('400 (indicador que está ou já esteve vinculado a dashboard — RN-11) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`DELETE ${ROTA}/1`]: () => respostaJson({ mensagem: 'O indicador já foi vinculado a dashboard e não pode ser excluído.', dashboards: ['PED Comercial'] }, 400),
      })

      const erro = await excluirIndicador(1).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'O indicador já foi vinculado a dashboard e não pode ser excluído.' })
      expect((erro as ApiError).dados).toMatchObject({ dashboards: ['PED Comercial'] })
    })

    it('404 (rota ainda não publicada — A-09) chega como ApiError com a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/2`]: () => respostaErro(404) })

      await expect(excluirIndicador(2)).rejects.toMatchObject({ status: 404, mensagem: mensagemPadraoPorStatus(404) })
    })
  })

  describe('listarHistoricoMetas(id, filtros?) — RF-39', () => {
    it('GET .../{id}/metas-historico sem filial quando não informada ou "todas", e devolve a lista convertida na ordem da API', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/3/metas-historico`]: () => respostaJson(historicoMetasApi()) })

      const historico = await listarHistoricoMetas(3)
      await listarHistoricoMetas(3, { filial: 'todas' })

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/3/metas-historico`)
      expect(chamadas[0].url.search).toBe('')
      expect(chamadas[1].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(historico).toEqual([
        {
          data: '2026-10-28 09:12:00',
          filial: '101',
          mesDeReferencia: '2026-10-01',
          de: 1500000.5,
          para: 1600000,
          usuario: 'Ana Costa',
          motivo: 'Sazonalidade de outubro',
        },
        {
          data: '2026-10-15 16:40:00',
          filial: '102',
          mesDeReferencia: '2026-10-01',
          de: 1500000.5,
          para: 1200000,
          usuario: 'Beltrano',
          motivo: 'Reforma na loja',
        },
        {
          data: '2026-09-02 08:05:00',
          filial: '101',
          mesDeReferencia: '2026-09-01',
          de: null,
          para: 1450000,
          usuario: 'Maria Souza',
          motivo: 'Ajuste inicial',
        },
      ])
    })

    it('envia filial na query quando informada (código da filial)', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/3/metas-historico`]: () => respostaJson(historicoMetasApi()) })

      await listarHistoricoMetas(3, { filial: '101' })

      expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
      expect([...chamadas[0].url.searchParams.keys()]).toEqual(['filial'])
    })

    it('"de" ausente ou null vira null (primeiro ajuste) e filial numérica vira texto', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/3/metas-historico`]: () =>
          respostaJson([{ data: '2026-09-02 08:05:00', filial: 101, 'mes de referencia': '2026-09-01', para: 1450000, usuario: 'Maria Souza', motivo: 'Ajuste inicial' }]),
      })

      const historico = await listarHistoricoMetas(3)

      expect(historico).toEqual([
        { data: '2026-09-02 08:05:00', filial: '101', mesDeReferencia: '2026-09-01', de: null, para: 1450000, usuario: 'Maria Souza', motivo: 'Ajuste inicial' },
      ])
    })

    it('aceita também a lista dentro da chave "historico"', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/3/metas-historico`]: () => respostaJson({ historico: historicoMetasApi().slice(0, 1) }) })

      const historico = await listarHistoricoMetas(3)

      expect(historico).toHaveLength(1)
      expect(historico[0].usuario).toBe('Ana Costa')
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/3/metas-historico`]: () => respostaJson([]) })

      await expect(listarHistoricoMetas(3)).resolves.toEqual([])
    })

    it.each([
      ['sem "para"', { data: '2026-10-28 09:12:00', filial: '101', 'mes de referencia': '2026-10-01', de: 1, usuario: 'Ana', motivo: 'x' }],
      ['sem data', { filial: '101', 'mes de referencia': '2026-10-01', de: 1, para: 2, usuario: 'Ana', motivo: 'x' }],
      ['com "para" em texto', { data: '2026-10-28 09:12:00', filial: '101', 'mes de referencia': '2026-10-01', de: 1, para: 'dois', usuario: 'Ana', motivo: 'x' }],
    ])('item %s rejeita a resposta inteira com ApiError "resposta inválida"', async (_caso, item) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/3/metas-historico`]: () => respostaJson([historicoMetasApi()[0], item]) })

      await expect(listarHistoricoMetas(3)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta 2xx que não é lista nem { historico } vira ApiError "resposta inválida"', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/3/metas-historico`]: () => respostaJson({ mensagem: 'ok' }) })

      await expect(listarHistoricoMetas(3)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 (filial de outro usuário) e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/3/metas-historico`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(listarHistoricoMetas(3, { filial: '102' })).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(listarHistoricoMetas(3)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
