import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DASHBOARD_COMERCIAL_API,
  DASHBOARD_FINANCEIRO_API,
  DASHBOARD_GERENTES_API,
  DASHBOARD_SUPERVISORES_API,
  RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API,
  RESPOSTA_REAL_LISTAGEM_DASHBOARDS_TAREFA_ENVIADA_API,
  dashboardsApi,
  detalheDashboardApi,
  previaTarefaApi,
  respostaRealDetalheDashboardApi,
  respostaGravacaoApi,
  tarefaBitrixGravacaoApi,
  tarefaGravacaoApi,
} from '../test/dashboardsFalsos'
import type { DadosDashboard } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import {
  ROTULOS_SITUACAO_FILTRO_DASHBOARD,
  SITUACOES_FILTRO_DASHBOARD,
  atualizarDashboard,
  criarDashboard,
  listarDashboards,
  obterDashboard,
  obterPreviaTarefa,
} from './dashboardsService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dashboards'

/** Corpo do exemplo de cadastro da API (fase 6). */
const NOVO: DadosDashboard = {
  nome: 'PED Comercial',
  periodicidade: 'trimestral',
  pontuacaoBaseMaxima: 100,
  tipoVinculo: 'filiais',
  itensVinculados: ['101', '201'],
  indicadores: [
    { idIndicador: 12, pontosBase: 40 },
    { idIndicador: 15, pontosBase: 60 },
  ],
  indicadorBaseDaFaixa: 20,
  formulaDePontuacao: 'texto livre, construído pela TI',
  observacaoParaTi: 'opcional',
}

const CORPO_NOVO = {
  nome: 'PED Comercial',
  periodicidade: 'trimestral',
  'pontuacao base maxima': 100,
  'tipo de vinculo': 'filiais',
  'itens vinculados': ['101', '201'],
  indicadores: [
    { 'id indicador': 12, 'pontos base': 40 },
    { 'id indicador': 15, 'pontos base': 60 },
  ],
  'indicador base da faixa': 20,
  'formula de pontuacao': 'texto livre, construído pela TI',
  'observacao para ti': 'opcional',
}

/** PED Comercial convertido para o domínio. */
const COMERCIAL = {
  id: 1,
  nome: 'PED Comercial',
  situacao: 'ativo',
  situacaoDescricao: 'Ativo',
  tarefaBitrix: { id: 31, status: 'concluida', titulo: '[PED] Construir dashboard: PED Comercial' },
  tipoVinculo: 'filiais',
  itensVinculados: ['100', '101', '102'],
  unidadesDeImagem: 3,
  periodicidade: 'trimestral',
  periodoAtual: '4º tri/2026',
  quantidadeDeIndicadores: 2,
  pontos: { soma: 100, maximo: 100 },
  alertas: [],
  cadastradoEm: '2026-09-01 10:00:00',
  ultimaAlteracao: '2026-10-20 15:30:00',
}

describe('F7.1 — Serviço de dashboards: listagem, detalhe, prévia, cadastro e edição', () => {
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

  describe('SITUACOES_FILTRO_DASHBOARD e rótulos', () => {
    it('as situações do filtro são todas, ativos, inativos, construcao e problemas, nesta ordem (valores da API)', () => {
      expect(SITUACOES_FILTRO_DASHBOARD).toEqual(['todas', 'ativos', 'inativos', 'construcao', 'problemas'])
    })

    it('os rótulos em pt-BR seguem o RF-47', () => {
      expect(ROTULOS_SITUACAO_FILTRO_DASHBOARD).toEqual({
        todas: 'Todas',
        ativos: 'Ativos',
        inativos: 'Inativos',
        construcao: 'Em construção/modificação (TI)',
        problemas: 'Com problemas',
      })
    })
  })

  describe('listarDashboards(filtros?) — RF-47', () => {
    it('sem filtros faz GET /api/ped/dashboards sem query, com JSON e o token da sessão', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(dashboardsApi()) })

      await listarDashboards()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('envia busca e situacao na query quando informadas', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarDashboards({ busca: 'faturamento', situacao: 'construcao' })

      const parametros = chamadas[0].url.searchParams
      expect(parametros.get('busca')).toBe('faturamento')
      expect(parametros.get('situacao')).toBe('construcao')
      expect([...parametros.keys()].sort()).toEqual(['busca', 'situacao'])
    })

    it('situação "todas", busca vazia ou só com espaços e filtros undefined não entram na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await listarDashboards({ busca: '   ', situacao: 'todas' })
      await listarDashboards({ busca: undefined, situacao: undefined })

      expect(chamadas[0].url.search).toBe('')
      expect(chamadas[1].url.search).toBe('')
    })

    it('lista pura: devolve cada dashboard convertido para o domínio (camelCase), na ordem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(dashboardsApi()) })

      const dashboards = await listarDashboards()

      expect(dashboards.map((d) => d.nome)).toEqual(['PED Comercial', 'PED Gerentes', 'PED Supervisores', 'PED Logística', 'PED Financeiro'])
      expect(dashboards[0]).toEqual(COMERCIAL)
      expect(dashboards[1].alertas).toEqual([
        { indicador: 'Custo de frete por entrega', motivo: 'Todos os apontamentos estão desativados', pontosAfetados: 20 },
      ])
      expect(dashboards[4]).toMatchObject({ situacao: 'inativo', tarefaBitrix: null, pontos: { soma: 90.5, maximo: 90.5 }, ultimaAlteracao: null })
    })

    it('ids de colaborador numéricos em "itens vinculados" viram texto', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([DASHBOARD_SUPERVISORES_API]) })

      const [supervisores] = await listarDashboards()

      expect(supervisores.tipoVinculo).toBe('colaboradores')
      expect(supervisores.itensVinculados).toEqual(['16', '11'])
      expect(supervisores.situacao).toBe('em_construcao')
    })

    it('aceita também a lista dentro de { dashboards }', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ dashboards: [DASHBOARD_GERENTES_API] }) })

      const dashboards = await listarDashboards()

      expect(dashboards).toHaveLength(1)
      expect(dashboards[0]).toMatchObject({ id: 2, nome: 'PED Gerentes', tipoVinculo: 'cargos', itensVinculados: ['Gerente de Loja'] })
    })

    it('campos opcionais ausentes viram os padrões do adaptador (sem tarefa, sem alertas, contagens zeradas)', async () => {
      const minimo = {
        id: 9,
        nome: 'PED Mínimo',
        situacao: 'ativo',
        'tipo de vinculo': 'filiais',
        periodicidade: 'mensal',
        'periodo atual': '11/2026',
      }
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([minimo]) })

      const [dashboard] = await listarDashboards()

      expect(dashboard).toEqual({
        id: 9,
        nome: 'PED Mínimo',
        situacao: 'ativo',
        situacaoDescricao: '',
        tarefaBitrix: null,
        tipoVinculo: 'filiais',
        itensVinculados: [],
        unidadesDeImagem: 0,
        periodicidade: 'mensal',
        periodoAtual: '11/2026',
        quantidadeDeIndicadores: 0,
        pontos: { soma: 0, maximo: 0 },
        alertas: [],
        cadastradoEm: null,
        ultimaAlteracao: null,
      })
    })

    it('resposta real da API com "tarefa bitrix" sem número (id null) converte o item, com tarefaBitrix.id null', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API) })

      const dashboards = await listarDashboards()

      expect(dashboards).toEqual([
        {
          id: 1,
          nome: 'teste',
          situacao: 'em_construcao',
          situacaoDescricao: 'Em construcao (TI)',
          tarefaBitrix: { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: teste' },
          tipoVinculo: 'filiais',
          itensVinculados: ['100 - Filial 100'],
          unidadesDeImagem: 1,
          periodicidade: 'mensal',
          periodoAtual: '11/2026',
          quantidadeDeIndicadores: 2,
          pontos: { soma: 100, maximo: 100 },
          alertas: [],
          cadastradoEm: '2026-11-05 16:28:43-04:00',
          ultimaAlteracao: '2026-11-05 16:28:43-04:00',
        },
      ])
    })

    it('resposta real da API (06/11/2026) com o número da tarefa em texto ("328439") e status "enviada": converte o item, com tarefaBitrix.id numérico 328439', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(RESPOSTA_REAL_LISTAGEM_DASHBOARDS_TAREFA_ENVIADA_API) })

      const dashboards = await listarDashboards()

      expect(dashboards).toEqual([
        {
          id: 1,
          nome: 'teste',
          situacao: 'em_construcao',
          situacaoDescricao: 'Em construcao (TI)',
          tarefaBitrix: { id: 328439, status: 'enviada', titulo: '[PED] Construir dashboard: teste' },
          tipoVinculo: 'filiais',
          itensVinculados: ['100 - Filial 100'],
          unidadesDeImagem: 1,
          periodicidade: 'mensal',
          periodoAtual: '11/2026',
          quantidadeDeIndicadores: 3,
          pontos: { soma: 100, maximo: 100 },
          alertas: [],
          cadastradoEm: '2026-11-05 16:28:43-04:00',
          ultimaAlteracao: '2026-11-05 16:52:42-04:00',
        },
      ])
      expect(typeof dashboards[0].tarefaBitrix?.id).toBe('number')
    })

    it.each<[string, string | number, number]>([
      ['número em texto', '31', 31],
      ['número em texto com espaços nas pontas', ' 328439 ', 328439],
      ['número em texto com zeros à esquerda', '0031', 31],
      ['número', 31, 31],
    ])('"tarefa bitrix".id como %s é aceito e convertido para número', async (_caso, id, esperado) => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([DASHBOARD_GERENTES_API, { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id, status: 'enviada', titulo: 'T' } }]),
      })

      const dashboards = await listarDashboards()

      expect(dashboards.map((d) => d.nome)).toEqual(['PED Gerentes', 'PED Comercial'])
      expect(dashboards[1].tarefaBitrix).toEqual({ id: esperado, status: 'enviada', titulo: 'T' })
    })

    it('tarefa com número em texto no meio da lista não derruba os demais itens', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            DASHBOARD_COMERCIAL_API,
            { ...DASHBOARD_SUPERVISORES_API, 'tarefa bitrix': { id: '40', status: 'enviada', titulo: '[PED] Construir dashboard: PED Supervisores' } },
            DASHBOARD_GERENTES_API,
          ]),
      })

      const dashboards = await listarDashboards()

      expect(dashboards.map((d) => d.nome)).toEqual(['PED Comercial', 'PED Supervisores', 'PED Gerentes'])
      expect(dashboards[0].tarefaBitrix?.id).toBe(31)
      expect(dashboards[1].tarefaBitrix).toEqual({ id: 40, status: 'enviada', titulo: '[PED] Construir dashboard: PED Supervisores' })
    })

    it('tarefa sem número no meio da lista não derruba os demais itens', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson([
            DASHBOARD_COMERCIAL_API,
            { ...DASHBOARD_SUPERVISORES_API, 'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: PED Supervisores' } },
          ]),
      })

      const dashboards = await listarDashboards()

      expect(dashboards.map((d) => d.nome)).toEqual(['PED Comercial', 'PED Supervisores'])
      expect(dashboards[0].tarefaBitrix?.id).toBe(31)
      expect(dashboards[1].tarefaBitrix).toEqual({ id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: PED Supervisores' })
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([]) })

      await expect(listarDashboards()).resolves.toEqual([])
    })

    it.each([
      ['um objeto sem a lista', { mensagem: 'ok' }],
      ['um texto', 'nada'],
      ['null', null],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await listarDashboards().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it.each([
      ['sem id', { ...DASHBOARD_COMERCIAL_API, id: undefined }],
      ['sem nome', { ...DASHBOARD_COMERCIAL_API, nome: undefined }],
      ['com situação desconhecida', { ...DASHBOARD_COMERCIAL_API, situacao: 'pausado' }],
      ['com tipo de vínculo desconhecido', { ...DASHBOARD_COMERCIAL_API, 'tipo de vinculo': 'zonas' }],
      ['com periodicidade desconhecida', { ...DASHBOARD_COMERCIAL_API, periodicidade: 'quinzenal' }],
      ['sem período atual', { ...DASHBOARD_COMERCIAL_API, 'periodo atual': undefined }],
      ['com pontos em texto', { ...DASHBOARD_COMERCIAL_API, pontos: { soma: '100', maximo: 100 } }],
      ['com alerta sem pontos afetados', { ...DASHBOARD_COMERCIAL_API, alertas: [{ indicador: 'X', motivo: 'Y' }] }],
      ['com tarefa sem título', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: 1, status: 'concluida' } }],
      ['com tarefa sem número e sem título', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: null, status: 'aguardando_envio' } }],
      ['com tarefa com título não textual', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: 42 } }],
      ['com tarefa com número por extenso', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: 'trinta e um', status: 'concluida', titulo: 'T' } }],
      ['com tarefa com id em texto não numérico', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: 'abc', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto vazio', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: '', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto só com espaços', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: '   ', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto misturando dígitos e letras', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: '31a', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto decimal', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: '31.5', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto negativo', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': { id: '-31', status: 'enviada', titulo: 'T' } }],
      ['com tarefa como texto solto', { ...DASHBOARD_COMERCIAL_API, 'tarefa bitrix': 'tarefa 31' }],
    ])('item %s rejeita a resposta inteira com ApiError "resposta inválida"', async (_caso, item) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([DASHBOARD_GERENTES_API, item]) })

      await expect(listarDashboards()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 (Preenchedor) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })

      await expect(listarDashboards()).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })

    it('500 sem mensagem usa a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500) })

      await expect(listarDashboards()).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede vira ApiError "Não foi possível conectar ao servidor."', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarDashboards()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('obterDashboard(id) — detalhe com pesos, base da faixa e fórmula', () => {
    it('GET /api/ped/dashboards/{id} e devolve o detalhe convertido (campos da listagem + os do detalhe, com os códigos de "vinculos")', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(detalheDashboardApi(DASHBOARD_COMERCIAL_API)) })

      const detalhe = await obterDashboard(1)

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(detalhe).toEqual({
        ...COMERCIAL,
        codigosVinculados: ['100', '101', '102'],
        pontuacaoBaseMaxima: 100,
        indicadorBaseDaFaixa: 3,
        formulaDePontuacao: 'Soma ponderada dos atingimentos, limitada a 120% por indicador.',
        observacaoParaTi: null,
        indicadores: [
          { id: 1, nome: 'Cobertura de visitas', pontosBase: 40, ativo: true, problema: null },
          { id: 3, nome: 'Faturamento líquido mensal', pontosBase: 60, ativo: true, problema: null },
        ],
        periodo: { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' },
      })
    })

    it('converte o problema do indicador (texto) e pontos com decimais', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/5`]: () => respostaJson(detalheDashboardApi(DASHBOARD_FINANCEIRO_API)) })

      const detalhe = await obterDashboard(5)

      expect(detalhe.pontuacaoBaseMaxima).toBe(90.5)
      expect(detalhe.indicadores).toEqual([
        { id: 2, nome: 'Rotinas financeiras em dia', pontosBase: 50.5, ativo: true, problema: null },
        { id: 5, nome: 'Capacitação', pontosBase: 40, ativo: false, problema: 'Indicador inativo' },
      ])
    })

    it('aceita o detalhe dentro de { dashboard }, o indicador base como objeto { id, nome }, o problema como { mensagem } e "id indicador" no lugar de "id"', async () => {
      const detalhe = detalheDashboardApi(DASHBOARD_GERENTES_API)
      simularApi(fetchFalso, {
        [`GET ${ROTA}/2`]: () =>
          respostaJson({
            dashboard: {
              ...detalhe,
              'indicador base da faixa': { id: 3, nome: 'Faturamento líquido mensal' },
              indicadores: [
                { 'id indicador': 3, nome: 'Faturamento líquido mensal', 'pontos base': 30, ativo: true, problema: null },
                { 'id indicador': 6, nome: 'Custo de frete por entrega', 'pontos base': 20, ativo: true, problema: { tipo: 'x', mensagem: 'Todos os apontamentos estão desativados' } },
              ],
            },
          }),
      })

      const convertido = await obterDashboard(2)

      expect(convertido.indicadorBaseDaFaixa).toBe(3)
      expect(convertido.observacaoParaTi).toBe('Usar a mesma régua do PED Comercial.')
      expect(convertido.indicadores).toEqual([
        { id: 3, nome: 'Faturamento líquido mensal', pontosBase: 30, ativo: true, problema: null },
        { id: 6, nome: 'Custo de frete por entrega', pontosBase: 20, ativo: true, problema: 'Todos os apontamentos estão desativados' },
      ])
    })

    it('detalhe com "tarefa bitrix" sem número (id null) é aceito e mantém tarefaBitrix.id null', async () => {
      const [real] = RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API
      simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(detalheDashboardApi(real)) })

      const detalhe = await obterDashboard(1)

      expect(detalhe).toMatchObject({
        id: 1,
        nome: 'teste',
        situacao: 'em_construcao',
        tarefaBitrix: { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: teste' },
        itensVinculados: ['100 - Filial 100'],
      })
    })

    it('detalhe com o número da tarefa em texto ("328439", status "enviada") é aceito e converte tarefaBitrix.id para número', async () => {
      const [real] = RESPOSTA_REAL_LISTAGEM_DASHBOARDS_TAREFA_ENVIADA_API
      simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(detalheDashboardApi(real)) })

      const detalhe = await obterDashboard(1)

      expect(detalhe).toMatchObject({
        id: 1,
        nome: 'teste',
        situacao: 'em_construcao',
        tarefaBitrix: { id: 328439, status: 'enviada', titulo: '[PED] Construir dashboard: teste' },
      })
    })

    it('detalhe com o número da tarefa em texto não numérico vira ApiError "resposta inválida"', async () => {
      const [real] = RESPOSTA_REAL_LISTAGEM_DASHBOARDS_TAREFA_ENVIADA_API
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1`]: () =>
          respostaJson(detalheDashboardApi({ ...real, 'tarefa bitrix': { id: 'abc', status: 'enviada', titulo: '[PED] Construir dashboard: teste' } })),
      })

      await expect(obterDashboard(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    describe('códigos dos itens vinculados (chave "vinculos") — o que o POST/PUT espera', () => {
      it('resposta real: "itens vinculados" traz o rótulo e "vinculos" o código; codigosVinculados ["100"] e itensVinculados continua com o rótulo', async () => {
        simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(respostaRealDetalheDashboardApi()) })

        const detalhe = await obterDashboard(1)

        expect(detalhe.codigosVinculados).toEqual(['100'])
        expect(detalhe.itensVinculados).toEqual(['100 - Filial 100'])
        expect(detalhe).toMatchObject({
          id: 1,
          nome: 'teste',
          tipoVinculo: 'filiais',
          pontuacaoBaseMaxima: 100,
          indicadorBaseDaFaixa: 1,
          formulaDePontuacao: 'teste indicador',
          observacaoParaTi: 'teste',
          periodo: { codigo: '11/2026', inicio: '2026-11-01', fim: '2026-11-30' },
          indicadores: [
            { id: 3, nome: 'teste 2', pontosBase: 50, ativo: true, problema: null },
            { id: 1, nome: 'teste indicador', pontosBase: 30, ativo: true, problema: null },
            { id: 4, nome: 'testes', pontosBase: 20, ativo: true, problema: null },
          ],
        })
      })

      it('filiais: código numérico vira texto, na ordem da API', async () => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}/1`]: () => respostaJson({ ...respostaRealDetalheDashboardApi(), vinculos: [{ filial: 102 }, { filial: '100' }] }),
        })

        const detalhe = await obterDashboard(1)

        expect(detalhe.codigosVinculados).toEqual(['102', '100'])
      })

      it('cargos: lê a chave "cargo"', async () => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}/5`]: () =>
            respostaJson({ ...detalheDashboardApi(DASHBOARD_FINANCEIRO_API), vinculos: [{ cargo: 'Vendedor' }, { cargo: 'Supervisor Comercial' }] }),
        })

        const detalhe = await obterDashboard(5)

        expect(detalhe.tipoVinculo).toBe('cargos')
        expect(detalhe.codigosVinculados).toEqual(['Vendedor', 'Supervisor Comercial'])
      })

      it('colaboradores: lê a chave "id colaborador" (número vira texto)', async () => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}/3`]: () => respostaJson({ ...detalheDashboardApi(DASHBOARD_SUPERVISORES_API), vinculos: [{ 'id colaborador': 7 }] }),
        })

        const detalhe = await obterDashboard(3)

        expect(detalhe.tipoVinculo).toBe('colaboradores')
        expect(detalhe.codigosVinculados).toEqual(['7'])
      })

      it('colaboradores: também aceita a chave "id" (número vira texto)', async () => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}/3`]: () => respostaJson({ ...detalheDashboardApi(DASHBOARD_SUPERVISORES_API), vinculos: [{ id: 7 }] }),
        })

        const detalhe = await obterDashboard(3)

        expect(detalhe.codigosVinculados).toEqual(['7'])
      })

      it('sem a chave "vinculos": codigosVinculados vazio', async () => {
        const { vinculos: _vinculos, ...semVinculos } = respostaRealDetalheDashboardApi()
        simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(semVinculos) })

        const detalhe = await obterDashboard(1)

        expect(detalhe.codigosVinculados).toEqual([])
        expect(detalhe.itensVinculados).toEqual(['100 - Filial 100'])
      })

      it.each([
        ['item sem a chave do tipo (filiais com { cargo })', [{ cargo: 'Vendedor' }]],
        ['item vazio', [{}]],
        ['item em texto solto', ['100']],
        ['filial com valor booleano', [{ filial: true }]],
        ['filial nula', [{ filial: null }]],
        ['"vinculos" fora de lista', { filial: '100' }],
      ])('"vinculos" com %s vira ApiError "resposta inválida"', async (_caso, vinculos) => {
        simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson({ ...respostaRealDetalheDashboardApi(), vinculos }) })

        await expect(obterDashboard(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
      })
    })

    it('sem período, sem base da faixa e sem fórmula: periodo null, indicadorBaseDaFaixa null e fórmula vazia', async () => {
      const { periodo: _periodo, ...semPeriodo } = detalheDashboardApi(DASHBOARD_COMERCIAL_API)
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1`]: () => respostaJson({ ...semPeriodo, 'indicador base da faixa': null, 'formula de pontuacao': null }),
      })

      const detalhe = await obterDashboard(1)

      expect(detalhe.periodo).toBeNull()
      expect(detalhe.indicadorBaseDaFaixa).toBeNull()
      expect(detalhe.formulaDePontuacao).toBe('')
    })

    it.each([
      ['sem "pontuacao base maxima"', { ...detalheDashboardApi(DASHBOARD_COMERCIAL_API), 'pontuacao base maxima': undefined }],
      ['com indicador sem pontos base', { ...detalheDashboardApi(DASHBOARD_COMERCIAL_API), indicadores: [{ id: 1, nome: 'Cobertura de visitas' }] }],
      ['com indicadores fora de lista', { ...detalheDashboardApi(DASHBOARD_COMERCIAL_API), indicadores: 'nenhum' }],
      ['só { mensagem }', { mensagem: 'ok' }],
    ])('detalhe %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1`]: () => respostaJson(corpo) })

      await expect(obterDashboard(1)).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('404 chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/99`]: () => respostaErro(404, 'Dashboard não encontrado.') })

      await expect(obterDashboard(99)).rejects.toMatchObject({ status: 404, mensagem: 'Dashboard não encontrado.' })
    })
  })

  describe('obterPreviaTarefa(dados) — RF-55 (não grava nada)', () => {
    it('POST /api/ped/dashboards/previa-tarefa com o mesmo corpo do cadastro e devolve { titulo, descricao }', async () => {
      const chamadas = simularApi(fetchFalso, { [`POST ${ROTA}/previa-tarefa`]: () => respostaJson(previaTarefaApi('PED Comercial')) })

      const previa = await obterPreviaTarefa(NOVO)

      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(`${ROTA}/previa-tarefa`)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual(CORPO_NOVO)
      expect(previa).toEqual(previaTarefaApi('PED Comercial'))
    })

    it('aceita a prévia dentro de { tarefa }', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}/previa-tarefa`]: () => respostaJson({ tarefa: previaTarefaApi('PED Comercial') }) })

      await expect(obterPreviaTarefa(NOVO)).resolves.toEqual(previaTarefaApi('PED Comercial'))
    })

    it.each([
      ['sem título', { descricao: 'x' }],
      ['sem descrição', { titulo: '[PED] Construir dashboard: X' }],
      ['vazia', {}],
      ['lista', [previaTarefaApi('X')]],
    ])('prévia %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`POST ${ROTA}/previa-tarefa`]: () => respostaJson(corpo) })

      await expect(obterPreviaTarefa(NOVO)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('400 (soma dos pontos diferente da máxima) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}/previa-tarefa`]: () => respostaErro(400, 'A soma dos pontos base deve ser 100. Faltam 10.'),
      })

      await expect(obterPreviaTarefa(NOVO)).rejects.toMatchObject({ status: 400, mensagem: 'A soma dos pontos base deve ser 100. Faltam 10.' })
    })
  })

  describe('criarDashboard(dados) — RF-55; 2xx significa gravado', () => {
    it('POST /api/ped/dashboards com o corpo de paraCorpoDashboard e devolve { dashboard, tarefa } convertidos', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaGravacaoApi('[PED] Construir dashboard: PED Supervisores')), 201),
      })

      const resultado = await criarDashboard(NOVO)

      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual(CORPO_NOVO)
      expect(resultado.dashboard).toMatchObject({ id: 3, nome: 'PED Supervisores', situacao: 'em_construcao' })
      expect(resultado.tarefa).toEqual({
        id: null,
        status: 'aguardando_envio',
        titulo: '[PED] Construir dashboard: PED Supervisores',
        descricao: 'Descrição gerada pela API.',
      })
    })

    it('tarefa com número (Bitrix24 integrado) traz o id', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaGravacaoApi('[PED] Construir dashboard: X', 50)), 201),
      })

      const { tarefa } = await criarDashboard(NOVO)

      expect(tarefa?.id).toBe(50)
    })

    it('tarefa com o número em texto ("328439", com ou sem espaços nas pontas) traz o id convertido para número', async () => {
      for (const id of ['328439', ' 328439 ']) {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, { ...tarefaGravacaoApi('[PED] Construir dashboard: X', id), status: 'enviada' }), 201),
        })

        const { tarefa } = await criarDashboard(NOVO)

        expect(tarefa).toEqual({ id: 328439, status: 'enviada', titulo: '[PED] Construir dashboard: X', descricao: 'Descrição gerada pela API.' })
      }
    })

    it('tarefa com o número em texto não numérico vira tarefa null mantendo o dashboard', async () => {
      for (const id of ['abc', '', '12a']) {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaGravacaoApi('[PED] Construir dashboard: X', id)), 201),
        })

        const resultado = await criarDashboard(NOVO)

        expect(resultado.dashboard?.id).toBe(3)
        expect(resultado.tarefa).toBeNull()
      }
    })

    describe('tarefa no formato publicado em 06/11/2026 ({ titulo, descricao, status, "id bitrix" } — FRONT-tarefas-bitrix.md)', () => {
      it.each<[string, number | string, number]>([
        ['texto numérico ("328169")', '328169', 328169],
        ['texto numérico com espaços nas pontas', ' 328169 ', 328169],
        ['número', 328169, 328169],
      ])('status "enviada" com "id bitrix" como %s: o número vem de "id bitrix"', async (_caso, idBitrix, esperado) => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaBitrixGravacaoApi('[PED] Construir dashboard: X', idBitrix)), 201),
        })

        const { tarefa } = await criarDashboard(NOVO)

        expect(tarefa).toEqual({ id: esperado, status: 'enviada', titulo: '[PED] Construir dashboard: X', descricao: 'Descrição gerada pela API.' })
      })

      it('tarefa na fila (status "aguardando_envio", "id bitrix" null): id null e o status preservado', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaBitrixGravacaoApi('[PED] Construir dashboard: X', null)), 201),
        })

        const { tarefa } = await criarDashboard(NOVO)

        expect(tarefa).toEqual({ id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: X', descricao: 'Descrição gerada pela API.' })
      })

      it('com "id bitrix" e "id" ao mesmo tempo, vale o "id bitrix"; "id bitrix" null prevalece sobre o "id" antigo', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, { ...tarefaBitrixGravacaoApi('T', '328169'), id: 50 }), 201),
        })
        expect((await criarDashboard(NOVO)).tarefa?.id).toBe(328169)

        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, { ...tarefaBitrixGravacaoApi('T', null), id: 50 }), 201),
        })
        expect((await criarDashboard(NOVO)).tarefa?.id).toBeNull()
      })

      it.each(['abc', '', '12a', '12.5', '-12'])('"id bitrix" em texto não numérico ("%s") deixa a tarefa null, mantendo o dashboard', async (idBitrix) => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaGravacaoApi(DASHBOARD_SUPERVISORES_API, tarefaBitrixGravacaoApi('T', idBitrix)), 201),
        })

        const resultado = await criarDashboard(NOVO)

        expect(resultado.dashboard?.id).toBe(3)
        expect(resultado.tarefa).toBeNull()
      })
    })

    it('aceita o dashboard na raiz com "tarefa" ao lado', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson({ ...DASHBOARD_SUPERVISORES_API, tarefa: tarefaGravacaoApi('[PED] Construir dashboard: X') }, 201),
      })

      const resultado = await criarDashboard(NOVO)

      expect(resultado.dashboard?.id).toBe(3)
      expect(resultado.tarefa?.titulo).toBe('[PED] Construir dashboard: X')
    })

    it('tarefa fora do formato (sem título, texto) vira null mantendo o dashboard', async () => {
      for (const tarefa of [{ id: 1 }, 'tarefa criada']) {
        simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson({ dashboard: DASHBOARD_SUPERVISORES_API, tarefa }, 201) })

        const resultado = await criarDashboard(NOVO)

        expect(resultado.dashboard?.id).toBe(3)
        expect(resultado.tarefa).toBeNull()
      }
    })

    it('só { mensagem, tarefa }: dashboard null e a tarefa convertida', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson({ mensagem: 'Dashboard cadastrado.', tarefa: tarefaGravacaoApi('[PED] Construir dashboard: X') }, 201),
      })

      const resultado = await criarDashboard(NOVO)

      expect(resultado.dashboard).toBeNull()
      expect(resultado.tarefa?.titulo).toBe('[PED] Construir dashboard: X')
    })

    it.each<[string, () => Response]>([
      ['só { mensagem }', () => respostaJson({ mensagem: 'Dashboard cadastrado.' }, 201)],
      ['só { id }', () => respostaJson({ id: 20 }, 201)],
      ['201 com corpo vazio', () => new Response('', { status: 201 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['uma lista', () => respostaJson([DASHBOARD_COMERCIAL_API], 201)],
      ['um texto solto', () => respostaJson('ok', 201)],
      ['dashboard incompleto', () => respostaJson({ dashboard: { id: 20, nome: 'Novo' } }, 201)],
    ])('resposta 2xx com %s resolve { dashboard: null, tarefa: null }, sem erro (foi gravado)', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: resposta })

      await expect(criarDashboard(NOVO)).resolves.toEqual({ dashboard: null, tarefa: null })
    })

    it('400 (indicador inelegível, soma diferente) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(400, 'O indicador Capacitação está inativo.') })

      const erro = await criarDashboard(NOVO).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'O indicador Capacitação está inativo.' })
    })

    it('403 e falha de rede chegam como ApiError', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(403, 'Acesso negado.') })
      await expect(criarDashboard(NOVO)).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(criarDashboard(NOVO)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('atualizarDashboard(id, dados) — RF-56; 2xx significa gravado', () => {
    it('PUT /api/ped/dashboards/{id} com o corpo e "enviar tarefa ti": true; devolve { dashboard, tarefa }', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/2`]: () =>
          respostaJson(
            respostaGravacaoApi({ ...DASHBOARD_GERENTES_API, situacao: 'em_modificacao' }, tarefaGravacaoApi('[PED] Modificar dashboard: PED Gerentes')),
          ),
      })

      const resultado = await atualizarDashboard(2, { ...NOVO, enviarTarefaTi: true })

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/2`)
      expect(corpoDaChamada(chamadas[0])).toEqual({ ...CORPO_NOVO, 'enviar tarefa ti': true })
      expect(resultado.dashboard).toMatchObject({ id: 2, situacao: 'em_modificacao' })
      expect(resultado.tarefa?.titulo).toBe('[PED] Modificar dashboard: PED Gerentes')
    })

    it('tarefa de modificação com o número em texto ("328441") traz o id convertido para número', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/2`]: () =>
          respostaJson(
            respostaGravacaoApi(
              { ...DASHBOARD_GERENTES_API, situacao: 'em_modificacao' },
              { ...tarefaGravacaoApi('[PED] Modificar dashboard: PED Gerentes', '328441'), status: 'enviada' },
            ),
          ),
      })

      const { tarefa } = await atualizarDashboard(2, { ...NOVO, enviarTarefaTi: true })

      expect(tarefa).toEqual({ id: 328441, status: 'enviada', titulo: '[PED] Modificar dashboard: PED Gerentes', descricao: 'Descrição gerada pela API.' })
    })

    it('tarefa de modificação no formato de 06/11/2026: "id bitrix" "328441" (enviada) vira o número; "id bitrix" null (aguardando_envio) vira id null', async () => {
      const gerentes = { ...DASHBOARD_GERENTES_API, situacao: 'em_modificacao' as const }
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/2`]: () => respostaJson(respostaGravacaoApi(gerentes, tarefaBitrixGravacaoApi('[PED] Modificar dashboard: PED Gerentes', '328441'))),
      })
      expect((await atualizarDashboard(2, { ...NOVO, enviarTarefaTi: true })).tarefa).toEqual({
        id: 328441,
        status: 'enviada',
        titulo: '[PED] Modificar dashboard: PED Gerentes',
        descricao: 'Descrição gerada pela API.',
      })

      simularApi(fetchFalso, {
        [`PUT ${ROTA}/2`]: () => respostaJson(respostaGravacaoApi(gerentes, tarefaBitrixGravacaoApi('[PED] Modificar dashboard: PED Gerentes', null))),
      })
      expect((await atualizarDashboard(2, { ...NOVO, enviarTarefaTi: true })).tarefa).toEqual({
        id: null,
        status: 'aguardando_envio',
        titulo: '[PED] Modificar dashboard: PED Gerentes',
        descricao: 'Descrição gerada pela API.',
      })
    })

    it('"enviar tarefa ti": false é enviado quando informado; sem tarefa na resposta, tarefa null', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/2`]: () => respostaJson({ dashboard: DASHBOARD_GERENTES_API }) })

      const resultado = await atualizarDashboard(2, { ...NOVO, enviarTarefaTi: false })

      expect(corpoDaChamada(chamadas[0])).toEqual({ ...CORPO_NOVO, 'enviar tarefa ti': false })
      expect(resultado).toEqual({ dashboard: expect.objectContaining({ id: 2 }), tarefa: null })
    })

    it.each<[string, () => Response]>([
      ['só { mensagem } ("nenhuma alteracao")', () => respostaJson({ mensagem: 'nenhuma alteracao' })],
      ['200 com corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
    ])('resposta 2xx com %s resolve { dashboard: null, tarefa: null }', async (_caso, resposta) => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/2`]: resposta })

      await expect(atualizarDashboard(2, NOVO)).resolves.toEqual({ dashboard: null, tarefa: null })
    })

    it('400 (tarefa de modificação em dashboard em construção) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3`]: () => respostaErro(400, 'Não é possível enviar tarefa de modificação a um dashboard em construção.'),
      })

      await expect(atualizarDashboard(3, { ...NOVO, enviarTarefaTi: true })).rejects.toMatchObject({
        status: 400,
        mensagem: 'Não é possível enviar tarefa de modificação a um dashboard em construção.',
      })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(atualizarDashboard(2, NOVO)).rejects.toMatchObject({ status: 0 })
    })
  })
})
