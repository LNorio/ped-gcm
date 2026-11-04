import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  DADO_CHAMADOS_API,
  DADO_DEVOLUCOES_API,
  DADO_FATURAMENTO_API,
  DADO_VOLUME_API,
  dadosExternosApi,
  identificadoresApi,
  respostaConclusaoApi,
  respostaCriacaoApi,
  respostaDadosExternosApi,
} from '../test/dadosExternosFalsos'
import type { NovoDadoExterno } from '../types/dominio'
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
    it('as situações do filtro são todas, ativos, inativos, construcao e problemas, nesta ordem (valores da API)', () => {
      expect(SITUACOES_FILTRO_DADO_EXTERNO).toEqual(['todas', 'ativos', 'inativos', 'construcao', 'problemas'])
    })

    it('os rótulos em pt-BR são Todas, Ativos, Inativos, Em construção e Com problemas', () => {
      expect(ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO).toEqual({
        todas: 'Todas',
        ativos: 'Ativos',
        inativos: 'Inativos',
        construcao: 'Em construção',
        problemas: 'Com problemas',
      })
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
      })
      expect(dados[1].situacao).toBe('em_construcao')
      expect(dados[1].identificador).toBeNull()
      expect(dados[1].tarefaBitrix).toEqual({
        id: 1044,
        status: 'aguardando_envio',
        titulo: '[PED] Construir dado externo: Devoluções de venda',
      })
    })

    it('aceita também a resposta como lista pura (sem a chave "dados externos")', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson([DADO_VOLUME_API]) })

      const dados = await listarDadosExternos()

      expect(dados.map((d) => d.nome)).toEqual(['Volume de vendas'])
      expect(dados[0].indicadores).toEqual([
        { id: 5, nome: 'Volume mensal' },
        { id: 6, nome: 'Crescimento de vendas' },
      ])
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

  describe('concluirConstrucao(id, identificador)', () => {
    it('PUT .../{id}/concluir com { identificador } em maiúsculas e sem espaços nas pontas', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(concluido, null)),
      })

      await concluirConstrucao(3, '  devolucoes ')

      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/3/concluir`)
      expect(corpoDaChamada(chamadas[0])).toEqual({ identificador: 'DEVOLUCOES' })
    })

    it('devolve o dado ativado e o indicador criado automaticamente', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson(respostaConclusaoApi(concluido, { id: 30, nome: 'Devoluções de venda' })),
      })

      const resultado = await concluirConstrucao(3, 'DEVOLUCOES')

      expect(resultado.dadoExterno.situacao).toBe('ativo')
      expect(resultado.dadoExterno.identificador).toBe('DEVOLUCOES')
      expect(resultado.indicadorCriado).toEqual({ id: 30, nome: 'Devoluções de venda' })
    })

    it('"indicador criado" null ou ausente → indicadorCriado null', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ 'dado externo': concluido }) })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).resolves.toMatchObject({ indicadorCriado: null })
    })

    it('aceita também o dado na raiz com "indicador criado" ao lado', async () => {
      const concluido = { ...DADO_DEVOLUCOES_API, situacao: 'ativo' as const, identificador: 'DEVOLUCOES' }
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ ...concluido, 'indicador criado': { id: 31, nome: 'Devoluções de venda' } }),
      })

      const resultado = await concluirConstrucao(3, 'DEVOLUCOES')

      expect(resultado.dadoExterno.id).toBe(3)
      expect(resultado.indicadorCriado).toEqual({ id: 31, nome: 'Devoluções de venda' })
    })

    it('400 da API (identificador inválido) chega como ApiError com a mensagem', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaErro(400, 'Identificador inválido.') })

      await expect(concluirConstrucao(3, 'X Y')).rejects.toMatchObject({ status: 400, mensagem: 'Identificador inválido.' })
    })

    it('resposta 2xx fora do formato vira ApiError "resposta inválida"', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/3/concluir`]: () => respostaJson({ ok: true }) })

      await expect(concluirConstrucao(3, 'DEVOLUCOES')).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
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
      expect(resultado.situacao).toBe('inativo')
      expect(resultado.situacaoAlteradaPor).toBe('Beltrano')
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

    it('resposta 2xx fora do formato vira ApiError "resposta inválida"', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/1/situacao`]: () => respostaJson({ ok: true }) })

      await expect(alterarSituacaoDadoExterno(1, false)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
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
