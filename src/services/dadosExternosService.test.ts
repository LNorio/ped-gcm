import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DADO_CHAMADOS_API,
  DADO_DEVOLUCOES_API,
  DADO_FATURAMENTO_API,
  DADO_TAREFA_ENVIADA_API,
  DADO_TAREFA_SEM_NUMERO_API,
  DADO_VOLUME_API,
  dadosExternosApi,
  identificadoresApi,
  respostaConclusaoApi,
  respostaCriacaoApi,
  RESPOSTA_REAL_LISTAGEM_API,
  respostaDadosExternosApi,
  tarefaBitrixCriadaApi,
} from '../test/dadosExternosFalsos'
import type { IntegracaoDadoExterno, NovoDadoExterno } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import {
  ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO,
  SITUACOES_FILTRO_DADO_EXTERNO,
  alterarSituacaoDadoExterno,
  concluirConstrucao,
  criarDadoExterno,
  excluirDadoExterno,
  listarDadosExternos,
  listarIdentificadores,
  obterRealizado,
} from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/dados-externos-cadastro'

/** Integração informada ao concluir (contrato de 09/11/2026: os quatro campos são obrigatórios). */
function integracao(identificador: string): IntegracaoDadoExterno {
  return {
    identificador,
    url: 'https://ti.exemplo.com.br/api/consulta',
    parametrosSaida: '{ "valor": "0" }',
    parametrosEntrada: '{ "filial": "%filial%" }',
  }
}

const NOVO_ADMIN: NovoDadoExterno = {
  nome: 'Faturamento líquido',
  idTipo: 1,
  sistemaOrigem: 'senior_erp',
  tipoValor: 'numeral',
  referencia: 'filial',
  coleta: 'dia do mes',
  diaDaColeta: 15,
  sentidoCalculo: 'soma',
  janelaRetroativa: 3,
  comentarios: null,
  campoCalculo: null,
  identificador: 'faturamento',
  observacao: null,
}

const NOVO_SOLICITACAO: NovoDadoExterno = {
  nome: 'Devoluções de venda',
  idTipo: 1,
  sistemaOrigem: 'outro',
  tipoValor: 'numeral',
  referencia: 'filial',
  coleta: 'diaria',
  diaDaColeta: null,
  sentidoCalculo: 'ultimo',
  janelaRetroativa: null,
  comentarios: 'Sistema GLPI',
  campoCalculo: 'Soma do valor líquido das notas de devolução.',
  identificador: null,
  observacao: 'Urgente para o fechamento.',
}

describe('F5.1 — Serviço de dados externos', () => {
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

  describe('SITUACOES_FILTRO_DADO_EXTERNO e rótulos', () => {
    it('as situações do filtro são todas, ativos, inativos, construcao, problemas e integracao_pendente, nesta ordem (valores da API; integracao_pendente desde 09/11/2026)', () => {
      expect(SITUACOES_FILTRO_DADO_EXTERNO).toEqual(['todas', 'ativos', 'inativos', 'construcao', 'problemas', 'integracao_pendente'])
    })

    it('os rótulos em pt-BR são Todas, Ativos, Inativos, Em construção, Com problemas e Integração pendente (TI)', () => {
      expect(ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO).toEqual({
        todas: 'Todas',
        ativos: 'Ativos',
        inativos: 'Inativos',
        construcao: 'Em construção',
        problemas: 'Com problemas',
        integracao_pendente: 'Integração pendente (TI)',
      })
    })

    it('situacao integracao_pendente vai na query como ?situacao=integracao_pendente', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([])) })

      await listarDadosExternos({ situacao: 'integracao_pendente' })

      expect(chamadas[0].url.searchParams.get('situacao')).toBe('integracao_pendente')
    })
  })

  describe('listarDadosExternos(filtros?)', () => {
    it('sem filtros faz GET /api/ped/dados-externos-cadastro sem query, com JSON e o token da sessão', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi()) })

      await listarDadosExternos()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('envia busca e situacao na query quando informadas', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi()) })

      await listarDadosExternos({ busca: 'faturamento', situacao: 'construcao' })

      const parametros = chamadas[0].url.searchParams
      expect(parametros.get('busca')).toBe('faturamento')
      expect(parametros.get('situacao')).toBe('construcao')
      expect([...parametros.keys()].sort()).toEqual(['busca', 'situacao'])
    })

    it('busca vazia ou só com espaços e filtros undefined não entram na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi()) })

      await listarDadosExternos({ busca: '   ' })
      await listarDadosExternos({ busca: undefined, situacao: undefined })

      expect(chamadas[0].url.search).toBe('')
      expect(chamadas[1].url.search).toBe('')
    })

    it('converte cada dado para o domínio (camelCase), mantendo a ordem da API', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([DADO_FATURAMENTO_API, DADO_DEVOLUCOES_API])),
      })

      const dados = await listarDadosExternos()

      expect(dados).toHaveLength(2)
      expect(dados[0]).toEqual({
        id: 1,
        nome: 'Faturamento líquido',
        idTipo: 1,
        tipo: 'Comercial',
        situacao: 'ativo',
        situacaoDescricao: 'Ativo',
        tarefaBitrix: null,
        sistemaOrigem: 'senior_erp',
        identificador: 'FATURAMENTO',
        campoCalculo: null,
        referencia: 'filial',
        coleta: 'dia do mes',
        diaDaColeta: 15,
        coletaDescricao: 'Todo dia 15 do mês',
        sentidoCalculo: 'soma',
        janelaRetroativa: 3,
        comentarios: null,
        tipoValor: 'numeral',
        coletaDisponivel: true,
        indicadores: [],
        cadastradoEm: '2026-10-05 09:00:00',
        cadastradoPor: 'Maria Souza',
        situacaoAlteradaEm: null,
        situacaoAlteradaPor: null,
        url: null,
        parametrosSaida: null,
        parametrosEntrada: null,
        variaveisUsadas: [],
        integracaoPendente: false,
        integracaoAlteradaEm: null,
        integracaoAlteradaPor: null,
        // Alteração de 10/11/2026: "fornece meta": true na listagem.
        forneceMeta: true,
      })
      expect(dados[1].situacao).toBe('em_construcao')
      expect(dados[1].identificador).toBeNull()
      expect(dados[1].tarefaBitrix).toEqual({
        id: 1044,
        status: 'enviada',
        titulo: '[PED] Construir dado externo: Devoluções de venda',
      })
    })

    it('aceita também a resposta como lista pura (sem a chave "dados externos")', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([DADO_VOLUME_API]) })

      const dados = await listarDadosExternos()

      expect(dados.map((d) => d.nome)).toEqual(['Volume de vendas'])
      expect(dados[0].indicadores).toEqual(['Volume mensal', 'Crescimento de vendas'])
    })

    it('resposta real da API com "indicadores" em texto converte os dois itens (indicadores como nomes)', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi(RESPOSTA_REAL_LISTAGEM_API)),
      })

      const dados = await listarDadosExternos()

      expect(dados).toHaveLength(2)
      expect(dados.map((d) => [d.id, d.nome, d.identificador, d.indicadores])).toEqual([
        [2, 'teste', 'TESTE', []],
        [3, 'teste 2', 'TESTE2', ['teste externo']],
      ])
    })

    it('dado em construção com "tarefa bitrix" sem número (id null) é convertido, com tarefaBitrix.id null, sem derrubar a lista', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([DADO_FATURAMENTO_API, DADO_TAREFA_SEM_NUMERO_API])),
      })

      const dados = await listarDadosExternos()

      expect(dados.map((d) => d.nome)).toEqual(['Faturamento líquido', 'Bonificações pagas'])
      expect(dados[1]).toEqual({
        id: 7,
        nome: 'Bonificações pagas',
        idTipo: 2,
        tipo: 'Financeiro',
        situacao: 'em_construcao',
        situacaoDescricao: 'Em construcao (TI)',
        tarefaBitrix: { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Bonificações pagas' },
        sistemaOrigem: 'senior_hcm',
        identificador: null,
        campoCalculo: 'Soma das bonificações pagas no mês, por colaborador.',
        referencia: 'colaborador',
        coleta: 'diaria',
        diaDaColeta: null,
        coletaDescricao: 'Diaria',
        sentidoCalculo: 'soma',
        janelaRetroativa: 1,
        comentarios: null,
        tipoValor: 'numeral',
        coletaDisponivel: false,
        indicadores: [],
        cadastradoEm: '2026-11-05 16:30:00-04:00',
        cadastradoPor: 'master',
        situacaoAlteradaEm: null,
        situacaoAlteradaPor: null,
        url: null,
        parametrosSaida: null,
        parametrosEntrada: null,
        variaveisUsadas: [],
        integracaoPendente: false,
        integracaoAlteradaEm: null,
        integracaoAlteradaPor: null,
        // "fornece meta" ausente → false.
        forneceMeta: false,
      })
    })

    it('dado em construção com o número da tarefa em texto ("328440") e status "enviada" é convertido, com tarefaBitrix.id numérico, sem derrubar a lista', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([DADO_FATURAMENTO_API, DADO_TAREFA_ENVIADA_API, DADO_CHAMADOS_API])),
      })

      const dados = await listarDadosExternos()

      expect(dados.map((d) => d.nome)).toEqual(['Faturamento líquido', 'Comissões pagas', 'Chamados atendidos no prazo'])
      expect(dados[1]).toMatchObject({
        id: 8,
        nome: 'Comissões pagas',
        situacao: 'em_construcao',
        tarefaBitrix: { id: 328440, status: 'enviada', titulo: '[PED] Construir dado externo: Comissões pagas' },
      })
      expect(typeof dados[1].tarefaBitrix?.id).toBe('number')
    })

    it('a lista pura (sem a chave "dados externos") com o número da tarefa em texto também é aceita', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([DADO_TAREFA_ENVIADA_API]) })

      const dados = await listarDadosExternos()

      expect(dados).toHaveLength(1)
      expect(dados[0].tarefaBitrix).toEqual({ id: 328440, status: 'enviada', titulo: '[PED] Construir dado externo: Comissões pagas' })
    })

    it.each<[string, string | number, number]>([
      ['número em texto', '9', 9],
      ['número em texto com espaços nas pontas', ' 328440 ', 328440],
      ['número em texto com zeros à esquerda', '0009', 9],
      ['número', 9, 9],
    ])('"tarefa bitrix".id como %s é aceito e convertido para número', async (_caso, id, esperado) => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            respostaDadosExternosApi([DADO_CHAMADOS_API, { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id, status: 'enviada', titulo: 'T' } }]),
          ),
      })

      const dados = await listarDadosExternos()

      expect(dados).toHaveLength(2)
      expect(dados[1].tarefaBitrix).toEqual({ id: esperado, status: 'enviada', titulo: 'T' })
    })

    /**
     * Alteração de 10/11/2026 (seção 2.5 de `RESPOSTA-FINAL-meta-via-api.md`): `"fornece meta"`
     * (todos os perfis) → `forneceMeta`; ausente ou null → false; valor não booleano rejeita a lista.
     */
    describe('"fornece meta" → forneceMeta', () => {
      it('converte true/false e trata ausente como false (Faturamento e Volume true, Cobertura false, Devoluções sem o campo)', async () => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi(dadosExternosApi())),
        })

        const dados = await listarDadosExternos()

        expect(dados.map((d) => [d.nome, d.forneceMeta])).toEqual([
          ['Faturamento líquido', true],
          ['Cobertura de clientes', false],
          ['Devoluções de venda', false],
          ['Prazo médio de recebimento', false],
          ['Chamados atendidos no prazo', false],
          ['Volume de vendas', true],
        ])
      })

      it('"fornece meta": null vira false', async () => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([{ ...DADO_FATURAMENTO_API, 'fornece meta': null as unknown as boolean }])),
        })

        const [dado] = await listarDadosExternos()

        expect(dado.forneceMeta).toBe(false)
      })

      it('a lista pura (sem "dados externos") também converte o campo', async () => {
        simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([DADO_VOLUME_API]) })

        const [dado] = await listarDadosExternos()

        expect(dado.forneceMeta).toBe(true)
      })

      it.each<[string, unknown]>([
        ['texto "sim"', 'sim'],
        ['texto "true"', 'true'],
        ['número 1', 1],
        ['objeto', { valor: true }],
      ])('"fornece meta" como %s rejeita a lista com ApiError(200, "Resposta inválida do servidor.")', async (_nome, valor) => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([DADO_CHAMADOS_API, { ...DADO_FATURAMENTO_API, 'fornece meta': valor } as never])),
        })

        const erro = await listarDadosExternos().catch((e: unknown) => e)

        expect(erro).toBeInstanceOf(ApiError)
        expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
      })
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([])) })

      await expect(listarDadosExternos()).resolves.toEqual([])
    })

    it.each([
      ['um objeto sem a lista', { mensagem: 'ok' }],
      ['um texto', 'nada'],
      ['null', null],
    ])('resposta 2xx com %s vira ApiError "resposta inválida"', async (_caso, corpo) => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(corpo) })

      const erro = await listarDadosExternos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it.each([
      ['sem id', (() => {
        const { id: _id, ...resto } = DADO_FATURAMENTO_API
        return resto
      })()],
      ['com situação desconhecida', { ...DADO_FATURAMENTO_API, situacao: 'pendente' }],
      ['com sistema de origem desconhecido', { ...DADO_FATURAMENTO_API, 'sistema de origem': 'sap' }],
      ['com referência desconhecida', { ...DADO_FATURAMENTO_API, referencia: 'empresa' }],
      ['com coleta desconhecida', { ...DADO_FATURAMENTO_API, coleta: 'semanal' }],
      ['com sentido do cálculo desconhecido', { ...DADO_FATURAMENTO_API, 'sentido do calculo': 'maximo' }],
      ['com tipo de valor desconhecido', { ...DADO_FATURAMENTO_API, 'tipo de valor': 'Texto' }],
      ['com indicador em forma de objeto { id, nome }', { ...DADO_FATURAMENTO_API, indicadores: [{ id: 5, nome: 'Volume mensal' }] }],
      ['com tarefa sem título', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: null, status: 'aguardando_envio' } }],
      ['com tarefa com título não textual', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: 9, status: 'aguardando_envio', titulo: 42 } }],
      ['com tarefa com número por extenso', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: 'nove', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto não numérico', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: 'abc', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto vazio', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: '', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto só com espaços', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: '   ', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto misturando dígitos e letras', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: '9a', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto decimal', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: '9.5', status: 'enviada', titulo: 'T' } }],
      ['com tarefa com id em texto negativo', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': { id: '-9', status: 'enviada', titulo: 'T' } }],
      ['com tarefa como texto solto', { ...DADO_TAREFA_SEM_NUMERO_API, 'tarefa bitrix': 'tarefa 9' }],
    ])('item %s rejeita a resposta inteira com ApiError "resposta inválida"', async (_caso, item) => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaDadosExternosApi([DADO_CHAMADOS_API, item as typeof DADO_CHAMADOS_API])),
      })

      await expect(listarDadosExternos()).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('erros HTTP chegam como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500, 'Falha ao consultar.') })

      await expect(listarDadosExternos()).rejects.toMatchObject({ status: 500, mensagem: 'Falha ao consultar.' })
    })

    it('falha de rede vira ApiError "Não foi possível conectar ao servidor."', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarDadosExternos()).rejects.toMatchObject({ mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('listarIdentificadores()', () => {
    it('faz GET .../identificadores e devolve { identificador, quantidade } na ordem da API', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()) })

      const lista = await listarIdentificadores()

      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(`${ROTA}/identificadores`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(lista).toEqual([
        { identificador: 'faturamento', quantidade: 1 },
        { identificador: 'cobertura', quantidade: 1 },
        { identificador: 'volume_vendas', quantidade: 2 },
        { identificador: 'novos_clientes', quantidade: 0 },
      ])
    })

    it('aceita também a lista dentro da chave "identificadores"', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/identificadores`]: () => respostaJson({ identificadores: [{ identificador: 'faturamento', quantidade: 3 }] }),
      })

      await expect(listarIdentificadores()).resolves.toEqual([{ identificador: 'faturamento', quantidade: 3 }])
    })

    it('resposta fora do formato (item sem identificador) vira ApiError "resposta inválida"', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/identificadores`]: () => respostaJson([{ quantidade: 1 }]) })

      await expect(listarIdentificadores()).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 (Preenchedor) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/identificadores`]: () => respostaErro(403, 'Acesso negado.') })

      await expect(listarIdentificadores()).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })
  })

  describe('criarDadoExterno(dados)', () => {
    it('Admin: POST com o corpo de paraCorpoNovoDadoExterno (chaves com espaço, identificador em maiúsculas)', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_FATURAMENTO_API, null), 201),
      })

      await criarDadoExterno(NOVO_ADMIN)

      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        nome: 'Faturamento líquido',
        'id tipo': 1,
        'sistema de origem': 'senior_erp',
        'tipo de valor': 'numeral',
        referencia: 'filial',
        coleta: 'dia do mes',
        'dia da coleta': 15,
        'sentido do calculo': 'soma',
        'janela retroativa': 3,
        comentarios: null,
        'campo calculo': null,
        identificador: 'FATURAMENTO',
        observacao: null,
      })
    })

    it('Admin: devolve o dado criado convertido e tarefa null', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_FATURAMENTO_API, null), 201) })

      const resultado = await criarDadoExterno(NOVO_ADMIN)

      expect(resultado.dadoExterno?.id).toBe(1)
      expect(resultado.dadoExterno?.situacao).toBe('ativo')
      expect(resultado.tarefa).toBeNull()
    })

    it('solicitação: envia campo calculo, comentarios e observacao, com identificador null', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, { titulo: 'x' }), 201),
      })

      await criarDadoExterno(NOVO_SOLICITACAO)

      expect(corpoDaChamada(chamadas[0])).toMatchObject({
        'sistema de origem': 'outro',
        comentarios: 'Sistema GLPI',
        'campo calculo': 'Soma do valor líquido das notas de devolução.',
        identificador: null,
        observacao: 'Urgente para o fechamento.',
        'dia da coleta': null,
        'janela retroativa': null,
      })
    })

    it('solicitação: devolve o dado em construção e a tarefa gerada (id, título, descrição e status)', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson(
            respostaCriacaoApi(DADO_DEVOLUCOES_API, {
              id: 1051,
              status: 'aguardando_envio',
              titulo: '[PED] Construir dado externo: Devoluções de venda',
              descricao: 'Sistema de origem: Senior ERP (Sapiens)',
            }),
            201,
          ),
      })

      const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

      expect(resultado.dadoExterno?.situacao).toBe('em_construcao')
      expect(resultado.tarefa).toEqual({
        id: 1051,
        status: 'aguardando_envio',
        titulo: '[PED] Construir dado externo: Devoluções de venda',
        descricao: 'Sistema de origem: Senior ERP (Sapiens)',
      })
    })

    it('tarefa sem id, status e descrição vira { id: null, status: null, descricao: null }', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, { titulo: '[PED] Construir dado externo: Devoluções de venda' }), 201),
      })

      const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

      expect(resultado.tarefa).toEqual({
        id: null,
        status: null,
        titulo: '[PED] Construir dado externo: Devoluções de venda',
        descricao: null,
      })
    })

    it('tarefa com o número em texto ("328440", com ou sem espaços nas pontas) traz o id convertido para número', async () => {
      for (const id of ['328440', ' 328440 ']) {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(
              respostaCriacaoApi(DADO_DEVOLUCOES_API, { id, status: 'enviada', titulo: '[PED] Construir dado externo: Devoluções de venda', descricao: 'D' }),
              201,
            ),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toEqual({ id: 328440, status: 'enviada', titulo: '[PED] Construir dado externo: Devoluções de venda', descricao: 'D' })
      }
    })

    it('tarefa com o número em texto não numérico vira tarefa null, mantendo o dado', async () => {
      for (const id of ['abc', '', '12a']) {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, { id, status: 'enviada', titulo: 'T', descricao: 'D' }), 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toBeNull()
        expect(resultado.dadoExterno).toMatchObject({ id: 3, nome: 'Devoluções de venda' })
      }
    })

    describe('tarefa no formato publicado em 06/11/2026 ({ titulo, descricao, status, "id bitrix" } — FRONT-tarefas-bitrix.md)', () => {
      it('resposta documentada (status "enviada", "id bitrix" "328169"): o número vem de "id bitrix", convertido para número', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(
              {
                mensagem: 'dado externo cadastrado; construcao pedida a TI',
                id: 42,
                situacao: 'em_construcao',
                tarefa: {
                  titulo: '[PED] Construir dado externo: Faturamento líquido',
                  descricao: 'Sistema de origem: ...\nCampo ou calculo: ...',
                  status: 'enviada',
                  'id bitrix': '328169',
                },
              },
              201,
            ),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toEqual({
          id: 328169,
          status: 'enviada',
          titulo: '[PED] Construir dado externo: Faturamento líquido',
          descricao: 'Sistema de origem: ...\nCampo ou calculo: ...',
        })
      })

      it.each<[string, number | string, number]>([
        ['texto numérico', '328169', 328169],
        ['texto numérico com espaços nas pontas', ' 328169 ', 328169],
        ['número', 328169, 328169],
      ])('"id bitrix" como %s vira o número da tarefa', async (_caso, idBitrix, esperado) => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, tarefaBitrixCriadaApi('T', idBitrix)), 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toEqual({ id: esperado, status: 'enviada', titulo: 'T', descricao: 'Descrição gerada pela API.' })
      })

      it('tarefa na fila (status "aguardando_envio", "id bitrix" null): id null e o status preservado', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, tarefaBitrixCriadaApi('T', null)), 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toEqual({ id: null, status: 'aguardando_envio', titulo: 'T', descricao: 'Descrição gerada pela API.' })
      })

      it('com "id bitrix" e "id" ao mesmo tempo, vale o "id bitrix"', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, { ...tarefaBitrixCriadaApi('T', '328169'), id: 7 }), 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa?.id).toBe(328169)
      })

      it('"id bitrix" null com "id" antigo presente: id null (o "id bitrix" informado prevalece)', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, { ...tarefaBitrixCriadaApi('T', null), id: 7 }), 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toEqual({ id: null, status: 'aguardando_envio', titulo: 'T', descricao: 'Descrição gerada pela API.' })
      })

      it('sem "id bitrix", o "id" do formato anterior continua aceito (compatibilidade)', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () =>
            respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, { id: '328440', status: 'enviada', titulo: 'T', descricao: 'D' }), 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toEqual({ id: 328440, status: 'enviada', titulo: 'T', descricao: 'D' })
      })

      it.each(['abc', '', '12a', '12.5', '-12'])('"id bitrix" em texto não numérico ("%s") deixa a tarefa null, mantendo o dado', async (idBitrix) => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_DEVOLUCOES_API, tarefaBitrixCriadaApi('T', idBitrix)), 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toBeNull()
        expect(resultado.dadoExterno).toMatchObject({ id: 3, nome: 'Devoluções de venda' })
      })

      it('Admin: "tarefa" null na resposta (cadastro já ativo, sem tarefa) resolve tarefa null', async () => {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_FATURAMENTO_API, null), 201),
        })

        const resultado = await criarDadoExterno(NOVO_ADMIN)

        expect(resultado.tarefa).toBeNull()
        expect(resultado.dadoExterno).toMatchObject({ id: 1, situacao: 'ativo' })
      })
    })

    it('dado criado com "tarefa bitrix" de número em texto: dadoExterno.tarefaBitrix.id vira número', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi(DADO_TAREFA_ENVIADA_API, null), 201) })

      const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

      expect(resultado.dadoExterno?.tarefaBitrix).toEqual({ id: 328440, status: 'enviada', titulo: '[PED] Construir dado externo: Comissões pagas' })
    })

    it('aceita também a resposta com o próprio dado na raiz e a chave "tarefa" ao lado', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson({ ...DADO_DEVOLUCOES_API, tarefa: { id: 7, titulo: 'T', descricao: 'D', status: 's' } }, 201),
      })

      const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

      expect(resultado.dadoExterno?.nome).toBe('Devoluções de venda')
      expect(resultado.tarefa).toEqual({ id: 7, titulo: 'T', descricao: 'D', status: 's' })
    })

    it('resposta 2xx só com { mensagem } resolve { dadoExterno: null, tarefa: null }, sem erro (o dado foi gravado)', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson({ mensagem: 'dado externo cadastrado' }, 201) })

      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('resposta 201 com corpo vazio resolve { dadoExterno: null, tarefa: null }, sem erro', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => new Response('', { status: 201 }) })

      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('resposta 204 sem corpo resolve { dadoExterno: null, tarefa: null }, sem erro', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => new Response(null, { status: 204 }) })

      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('resposta 2xx só com { id } ou com outro objeto sem dado reconhecível resolve dadoExterno null, sem erro', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson({ id: 20 }, 201) })
      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })

      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson({ ok: true }, 201) })
      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('dado externo incompleto na raiz (sem "id tipo", situação e coleta) resolve dadoExterno null, sem erro', async () => {
      const incompleto = { id: 20, nome: 'Novos clientes', identificador: 'NOVOS_CLIENTES' }
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(incompleto, 201) })

      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('envelope { mensagem, "dado externo" } com dado incompleto resolve dadoExterno null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson({ mensagem: 'dado externo cadastrado', 'dado externo': { id: 20, nome: 'Novos clientes' } }, 201),
      })

      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('dado externo com tipo de valor desconhecido resolve dadoExterno null, sem erro', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaJson(respostaCriacaoApi({ ...DADO_FATURAMENTO_API, 'tipo de valor': 'Moeda' as 'Numeral' }, null), 201),
      })

      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('resposta 2xx com lista ou texto solto resolve { dadoExterno: null, tarefa: null }, sem erro', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson([DADO_FATURAMENTO_API], 201) })
      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })

      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson('ok', 201) })
      await expect(criarDadoExterno(NOVO_ADMIN)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('tarefa na raiz sem o dado externo: dadoExterno null e a tarefa convertida', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () =>
          respostaJson(
            {
              mensagem: 'pedido enviado',
              tarefa: { id: 1051, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Bonificações', descricao: 'D' },
            },
            201,
          ),
      })

      await expect(criarDadoExterno(NOVO_SOLICITACAO)).resolves.toEqual({
        dadoExterno: null,
        tarefa: { id: 1051, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Bonificações', descricao: 'D' },
      })
    })

    it('tarefa fora do formato (sem título, título não textual ou texto solto) vira tarefa null, mantendo o dado', async () => {
      for (const tarefa of [{ id: 7 }, { id: 7, titulo: 42 }, 'tarefa criada', 1051]) {
        simularApi(fetchFalso, {
          [`POST ${ROTA}`]: () => respostaJson({ 'dado externo': DADO_DEVOLUCOES_API, tarefa }, 201),
        })

        const resultado = await criarDadoExterno(NOVO_SOLICITACAO)

        expect(resultado.tarefa).toBeNull()
        expect(resultado.dadoExterno).toMatchObject({ id: 3, nome: 'Devoluções de venda', situacao: 'em_construcao' })
      }
    })

    it('tarefa fora do formato sem o dado externo resolve { dadoExterno: null, tarefa: null }, sem erro', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson({ mensagem: 'ok', tarefa: { id: 7 } }, 201) })

      await expect(criarDadoExterno(NOVO_SOLICITACAO)).resolves.toEqual({ dadoExterno: null, tarefa: null })
    })

    it('500 rejeita com ApiError e a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(500) })

      const erro = await criarDadoExterno(NOVO_ADMIN).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(criarDadoExterno(NOVO_ADMIN)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })

    it('400 de referência ainda não liberada chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaErro(400, 'A referência colaborador ainda não está disponível.'),
      })

      await expect(criarDadoExterno({ ...NOVO_ADMIN, referencia: 'colaborador' })).rejects.toMatchObject({
        status: 400,
        mensagem: 'A referência colaborador ainda não está disponível.',
      })
    })
  })

  describe('concluirConstrucao(id, integracao)', () => {
    it('PUT .../{id}/concluir com os quatro campos da integração (identificador em maiúsculas e sem espaços nas pontas)', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(concluido, null)),
      })

      await concluirConstrucao(3, integracao('  devolucoes '))

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/3/concluir`)
      expect(corpoDaChamada(chamadas[0])).toEqual({
        identificador: 'DEVOLUCOES',
        url: 'https://ti.exemplo.com.br/api/consulta',
        'parametros de saida': '{ "valor": "0" }',
        'parametros de entrada': '{ "filial": "%filial%" }',
      })
    })

    it('devolve o dado ativado e o indicador criado automaticamente', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(concluido, { id: 30, nome: 'Devoluções de venda' })),
      })

      const resultado = await concluirConstrucao(3, integracao('DEVOLUCOES'))

      expect(resultado?.dadoExterno.situacao).toBe('ativo')
      expect(resultado?.dadoExterno.identificador).toBe('DEVOLUCOES')
      expect(resultado?.indicadorCriado).toEqual({ id: 30, nome: 'Devoluções de venda' })
    })

    it('"indicador criado" null ou ausente → indicadorCriado null', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ 'dado externo': concluido }) })

      await expect(concluirConstrucao(3, integracao('DEVOLUCOES'))).resolves.toMatchObject({ indicadorCriado: null })
    })

    it('aceita também o dado na raiz com "indicador criado" ao lado', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ ...concluido, 'indicador criado': { id: 31, nome: 'Devoluções de venda' } }),
      })

      const resultado = await concluirConstrucao(3, integracao('DEVOLUCOES'))

      expect(resultado?.dadoExterno.id).toBe(3)
      expect(resultado?.indicadorCriado).toEqual({ id: 31, nome: 'Devoluções de venda' })
    })

    it('400 da API (identificador inválido) chega como ApiError com a mensagem', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaErro(400, 'Identificador inválido.') })

      await expect(concluirConstrucao(3, integracao('X Y'))).rejects.toMatchObject({ status: 400, mensagem: 'Identificador inválido.' })
    })

  })

  describe('alterarSituacaoDadoExterno(id, ativo)', () => {
    it('PUT .../{id}/situacao com { ativo } e devolve o dado atualizado', async () => {
      const atualizado = {
        ...DADO_FATURAMENTO_API,
        situacao: 'inativo' as const,
        'situacao alterada em': '2026-11-04 10:00:00',
        'situacao alterada por': 'Beltrano',
      }
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => respostaJson(atualizado) })

      const resultado = await alterarSituacaoDadoExterno(1, false)

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1/situacao`)
      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: false })
      expect(resultado?.situacao).toBe('inativo')
      expect(resultado?.situacaoAlteradaPor).toBe('Beltrano')
    })

    it('ativar envia { ativo: true }', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/2/situacao`]: () => respostaJson(dadosExternosApi()[1]) })

      await alterarSituacaoDadoExterno(2, true)

      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: true })
    })

    it('aceita também o dado dentro da chave "dado externo"', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/1/situacao`]: () => respostaJson({ 'dado externo': { ...DADO_FATURAMENTO_API, situacao: 'inativo' } }),
      })

      await expect(alterarSituacaoDadoExterno(1, false)).resolves.toMatchObject({ id: 1, situacao: 'inativo' })
    })

    it('400 (dado em construção) chega como ApiError com a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/situacao`]: () => respostaErro(400, 'Dado em construção só muda pela conclusão.'),
      })

      await expect(alterarSituacaoDadoExterno(3, true)).rejects.toMatchObject({
        status: 400,
        mensagem: 'Dado em construção só muda pela conclusão.',
      })
    })

  })

  describe('excluirDadoExterno(id)', () => {
    it('DELETE .../{id} com o token; resolve sem valor em 204', async () => {
      const chamadas = simularApi(fetchFalso, { [`DELETE ${ROTA}/1`]: () => new Response(null, { status: 204 }) })

      await expect(excluirDadoExterno(1)).resolves.toBeUndefined()

      expect(chamadas[0].metodo).toBe('DELETE')
      expect(chamadas[0].caminho).toBe(`${ROTA}/1`)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('resolve sem valor em 200 com corpo', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/1`]: () => respostaJson({ mensagem: 'Excluído.' }) })

      await expect(excluirDadoExterno(1)).resolves.toBeUndefined()
    })

    it('400 (compõe ou já compôs indicador) chega como ApiError com a mensagem e dados.indicadores', async () => {
      simularApi(fetchFalso, {
        [`DELETE ${ROTA}/6`]: () =>
          respostaJson({ mensagem: 'O dado externo compõe indicadores.', indicadores: ['Volume mensal'] }, 400),
      })

      const erro = await excluirDadoExterno(6).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'O dado externo compõe indicadores.' })
      expect((erro as ApiError).dados).toMatchObject({ indicadores: ['Volume mensal'] })
    })
  })

  describe('obterRealizado(id, filtros?) — RN-05 (só serviço)', () => {
    const REALIZADO = {
      valor: 1500.5,
      'meses considerados': [
        { mes: '2026-10-01', valor: 1000 },
        { mes: '2026-09-01', valor: 500.5 },
      ],
      'janela retroativa': 3,
      'sentido do calculo': 'soma',
      'coleta disponivel': true,
    }

    it('GET .../{id}/realizado com filial e mes_de_referencia na query e converte a resposta', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1/realizado`]: () => respostaJson(REALIZADO) })

      const resultado = await obterRealizado(1, { filial: '101', mesDeReferencia: '2026-10-01' })

      expect(chamadas[0].caminho).toBe(`${ROTA}/1/realizado`)
      expect(chamadas[0].url.searchParams.get('filial')).toBe('101')
      expect(chamadas[0].url.searchParams.get('mes_de_referencia')).toBe('2026-10-01')
      expect(resultado).toEqual({
        valor: 1500.5,
        mesesConsiderados: [
          { mes: '2026-10-01', valor: 1000 },
          { mes: '2026-09-01', valor: 500.5 },
        ],
        janelaRetroativa: 3,
        sentidoCalculo: 'soma',
        coletaDisponivel: true,
      })
    })

    it('sem filtros não envia query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}/1/realizado`]: () => respostaJson(REALIZADO) })

      await obterRealizado(1)

      expect(chamadas[0].url.search).toBe('')
    })

    it('valor null (sem valores ou sem coleta) e meses ausentes → valor null e mesesConsiderados []', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}/1/realizado`]: () =>
          respostaJson({ valor: null, 'janela retroativa': null, 'sentido do calculo': 'ultimo', 'coleta disponivel': false }),
      })

      await expect(obterRealizado(1)).resolves.toEqual({
        valor: null,
        mesesConsiderados: [],
        janelaRetroativa: null,
        sentidoCalculo: 'ultimo',
        coletaDisponivel: false,
      })
    })

    it('resposta fora do formato (valor em texto) vira ApiError "resposta inválida"', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}/1/realizado`]: () => respostaJson({ ...REALIZADO, valor: 'muito' }) })

      await expect(obterRealizado(1)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })
})
