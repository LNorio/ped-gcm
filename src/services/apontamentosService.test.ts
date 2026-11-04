import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_CONCILIACAO_API,
  APONTAMENTO_ROTEIRO_API,
  APONTAMENTO_TREINAMENTOS_API,
  apontamentosApi,
  respostaApontamentosApi,
} from '../test/apontamentosFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import {
  ROTULOS_SITUACAO_FILTRO,
  SITUACOES_FILTRO,
  alterarSituacao,
  criarApontamento,
  excluirApontamento,
  listarApontamentos,
} from './apontamentosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/apontamentos'

describe('F4.1 — Serviço de apontamentos', () => {
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

  describe('SITUACOES_FILTRO e ROTULOS_SITUACAO_FILTRO', () => {
    it('as situações do filtro são todas, ativos, inativos e problemas, nesta ordem (valores da API)', () => {
      expect(SITUACOES_FILTRO).toEqual(['todas', 'ativos', 'inativos', 'problemas'])
    })

    it('os rótulos em pt-BR são Todas, Ativos, Inativos e Com problemas', () => {
      expect(ROTULOS_SITUACAO_FILTRO).toEqual({
        todas: 'Todas',
        ativos: 'Ativos',
        inativos: 'Inativos',
        problemas: 'Com problemas',
      })
    })
  })

  describe('listarApontamentos(filtros?)', () => {
    it('sem filtros faz GET /api/ped/apontamentos sem query, pedindo JSON com o token da sessão', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      await listarApontamentos()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(chamadas[0].init?.body).toBeUndefined()
    })

    it('envia busca, situacao e tipo na query quando informados', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      await listarApontamentos({ busca: 'visitas', situacao: 'ativos', tipo: 1 })

      const parametros = chamadas[0].url.searchParams
      expect(parametros.get('busca')).toBe('visitas')
      expect(parametros.get('situacao')).toBe('ativos')
      expect(parametros.get('tipo')).toBe('1')
      expect([...parametros.keys()].sort()).toEqual(['busca', 'situacao', 'tipo'])
    })

    it('envia só os parâmetros informados: apenas busca', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      await listarApontamentos({ busca: 'conciliação' })

      expect([...chamadas[0].url.searchParams.keys()]).toEqual(['busca'])
      expect(chamadas[0].url.searchParams.get('busca')).toBe('conciliação')
    })

    it('envia só os parâmetros informados: apenas situacao', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      await listarApontamentos({ situacao: 'problemas' })

      expect([...chamadas[0].url.searchParams.keys()]).toEqual(['situacao'])
      expect(chamadas[0].url.searchParams.get('situacao')).toBe('problemas')
    })

    it('envia só os parâmetros informados: apenas tipo', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      await listarApontamentos({ tipo: 4 })

      expect([...chamadas[0].url.searchParams.keys()]).toEqual(['tipo'])
      expect(chamadas[0].url.searchParams.get('tipo')).toBe('4')
    })

    it('busca vazia ou só com espaços não entra na query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      await listarApontamentos({ busca: '' })
      await listarApontamentos({ busca: '   ' })

      expect(chamadas[0].url.searchParams.has('busca')).toBe(false)
      expect(chamadas[1].url.searchParams.has('busca')).toBe(false)
    })

    it('filtros com valores undefined são omitidos da query', async () => {
      const chamadas = simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      await listarApontamentos({ busca: undefined, situacao: undefined, tipo: undefined })

      expect(chamadas[0].url.search).toBe('')
    })

    it('converte cada apontamento para o domínio (camelCase) mantendo a ordem da API', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi([APONTAMENTO_ROTEIRO_API, APONTAMENTO_CONCILIACAO_API])),
      })

      const { apontamentos } = await listarApontamentos()

      expect(apontamentos).toEqual([
        {
          id: 1,
          nome: 'Roteiro de visitas elaborado',
          descricao: 'Percentual de vendedores com roteiro semanal entregue.',
          ativo: true,
          idTipo: 1,
          tipo: 'Comercial',
          tipoValor: 'porcentagem',
          indicadores: [{ id: 1, nome: 'Cobertura de visitas' }],
          vinculadoADashboard: true,
          desativadoMasUsadoEmIndicadorAtivo: false,
          cadastradoEm: '2026-10-02 09:15:00',
          cadastradoPor: 'Maria Souza',
          situacaoAlteradaEm: null,
          situacaoAlteradaPor: null,
        },
        {
          id: 2,
          nome: 'Conciliação bancária concluída',
          descricao: 'Conciliação de todas as contas fechada até o dia 5.',
          ativo: false,
          idTipo: 2,
          tipo: 'Financeiro',
          tipoValor: 'booleano',
          indicadores: [{ id: 2, nome: 'Rotinas financeiras em dia' }],
          vinculadoADashboard: false,
          desativadoMasUsadoEmIndicadorAtivo: true,
          cadastradoEm: '2026-09-15 14:30:00',
          cadastradoPor: 'João Lima',
          situacaoAlteradaEm: '2026-10-20 11:05:00',
          situacaoAlteradaPor: 'Ana Costa',
        },
      ])
    })

    it('devolve a contagem por tipo convertida ({ id, nome, quantidade }) na ordem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(respostaApontamentosApi()) })

      const { contagemPorTipo } = await listarApontamentos()

      expect(contagemPorTipo).toEqual([
        { id: 1, nome: 'Comercial', quantidade: 2 },
        { id: 2, nome: 'Financeiro', quantidade: 1 },
        { id: 3, nome: 'Recursos Humanos', quantidade: 1 },
        { id: 4, nome: 'Tecnologia da Informação', quantidade: 1 },
      ])
    })

    it('a contagem por tipo vem da resposta, mesmo quando difere da lista (filtro de tipo aplicado pela API)', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson({
            apontamentos: [APONTAMENTO_CHAMADOS_API],
            'contagem por tipo': [
              { id: 1, nome: 'Comercial', quantidade: 2 },
              { id: 4, nome: 'Tecnologia da Informação', quantidade: 1 },
            ],
          }),
      })

      const resultado = await listarApontamentos({ tipo: 4 })

      expect(resultado.apontamentos.map((a) => a.id)).toEqual([4])
      expect(resultado.contagemPorTipo).toEqual([
        { id: 1, nome: 'Comercial', quantidade: 2 },
        { id: 4, nome: 'Tecnologia da Informação', quantidade: 1 },
      ])
    })

    it('lista vazia resolve apontamentos [] e contagem []', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ apontamentos: [], 'contagem por tipo': [] }) })

      await expect(listarApontamentos()).resolves.toEqual({ apontamentos: [], contagemPorTipo: [] })
    })

    it('"contagem por tipo" ausente na resposta vira contagem [] (a lista continua válida)', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ apontamentos: [APONTAMENTO_CHAMADOS_API] }) })

      const resultado = await listarApontamentos()

      expect(resultado.apontamentos).toHaveLength(1)
      expect(resultado.contagemPorTipo).toEqual([])
    })

    it('resposta 200 sem a lista "apontamentos" (objeto sem a chave) rejeita com ApiError(200, resposta inválida)', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson({ mensagem: 'ok' }) })

      const erro = await listarApontamentos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta 200 que é uma lista solta (formato antigo) rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(apontamentosApi()) })

      await expect(listarApontamentos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta 200 com corpo vazio rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => new Response('', { status: 200 }) })

      await expect(listarApontamentos()).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('item com tipo de valor desconhecido rejeita com ApiError(200, resposta inválida), sem ignorar o item', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson({
            apontamentos: [APONTAMENTO_ROTEIRO_API, { ...APONTAMENTO_CHAMADOS_API, 'tipo de valor': 'Texto' }],
            'contagem por tipo': [],
          }),
      })

      const erro = await listarApontamentos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('item nulo ou sem id numérico rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ apontamentos: [null, APONTAMENTO_ROTEIRO_API], 'contagem por tipo': [] }),
      })
      await expect(listarApontamentos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })

      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () => respostaJson({ apontamentos: [{ ...APONTAMENTO_ROTEIRO_API, id: '1' }], 'contagem por tipo': [] }),
      })
      await expect(listarApontamentos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 com mensagem rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(403, 'Usuário sem acesso ao PED.') })

      const erro = await listarApontamentos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 403, mensagem: 'Usuário sem acesso ao PED.' })
    })

    it('500 sem mensagem rejeita com a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaErro(500) })

      await expect(listarApontamentos()).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede rejeita com ApiError status 0 e a mensagem padrão de conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarApontamentos()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('criarApontamento(dados)', () => {
    const RESPOSTA_CRIADO = {
      ...APONTAMENTO_CHAMADOS_API,
      id: 10,
      nome: 'Visitas a clientes novos',
      descricao: 'Clientes novos visitados no mês.',
      'id tipo': 1,
      tipo: 'Comercial',
      'tipo de valor': 'Numeral',
      indicadores: [],
      'cadastrado em': '2026-11-03 10:00:00',
      'cadastrado por': 'Fulano',
    }

    it('faz POST /api/ped/apontamentos com { nome, "id tipo", "tipo de valor", descricao } em JSON e o token', async () => {
      const chamadas = simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(RESPOSTA_CRIADO, 201) })

      await criarApontamento({
        nome: 'Visitas a clientes novos',
        idTipo: 1,
        tipoValor: 'numeral',
        descricao: 'Clientes novos visitados no mês.',
      })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({
        nome: 'Visitas a clientes novos',
        'id tipo': 1,
        'tipo de valor': 'numeral',
        descricao: 'Clientes novos visitados no mês.',
      })
    })

    it('descrição vazia, só com espaços ou ausente é enviada como null (paraCorpoNovoApontamento)', async () => {
      const chamadas = simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(RESPOSTA_CRIADO, 201) })

      await criarApontamento({ nome: 'Visitas', idTipo: 1, tipoValor: 'porcentagem', descricao: '   ' })
      await criarApontamento({ nome: 'Visitas', idTipo: 1, tipoValor: 'porcentagem' })

      expect(corpoDaChamada(chamadas[0])).toMatchObject({ descricao: null })
      expect(corpoDaChamada(chamadas[1])).toMatchObject({ descricao: null })
    })

    it('devolve o apontamento criado convertido para o domínio (nasce ativo)', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson(RESPOSTA_CRIADO, 201) })

      const criado = await criarApontamento({ nome: 'Visitas a clientes novos', idTipo: 1, tipoValor: 'numeral' })

      expect(criado).toEqual({
        id: 10,
        nome: 'Visitas a clientes novos',
        descricao: 'Clientes novos visitados no mês.',
        ativo: true,
        idTipo: 1,
        tipo: 'Comercial',
        tipoValor: 'numeral',
        indicadores: [],
        vinculadoADashboard: false,
        desativadoMasUsadoEmIndicadorAtivo: false,
        cadastradoEm: '2026-11-03 10:00:00',
        cadastradoPor: 'Fulano',
        situacaoAlteradaEm: null,
        situacaoAlteradaPor: null,
      })
    })

    it('resposta 2xx fora do formato (sem id/nome) rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaJson({ mensagem: 'Apontamento criado.' }, 201) })

      const erro = await criarApontamento({ nome: 'Visitas', idTipo: 1, tipoValor: 'numeral' }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta 201 com corpo vazio rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => new Response('', { status: 201 }) })

      await expect(criarApontamento({ nome: 'Visitas', idTipo: 1, tipoValor: 'numeral' })).rejects.toMatchObject({
        mensagem: MENSAGEM_RESPOSTA_INVALIDA,
      })
    })

    it('403 (Preenchedor em tipo que não é dele) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`POST ${ROTA}`]: () => respostaErro(403, 'Você só pode cadastrar apontamentos nos seus tipos.'),
      })

      await expect(criarApontamento({ nome: 'Visitas', idTipo: 2, tipoValor: 'numeral' })).rejects.toMatchObject({
        status: 403,
        mensagem: 'Você só pode cadastrar apontamentos nos seus tipos.',
      })
    })

    it('400 (dados inválidos) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, { [`POST ${ROTA}`]: () => respostaErro(400, 'O campo nome é obrigatório.') })

      await expect(criarApontamento({ nome: '', idTipo: 1, tipoValor: 'numeral' })).rejects.toMatchObject({
        status: 400,
        mensagem: 'O campo nome é obrigatório.',
      })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(criarApontamento({ nome: 'Visitas', idTipo: 1, tipoValor: 'numeral' })).rejects.toMatchObject({
        status: 0,
        mensagem: MENSAGEM_SEM_CONEXAO,
      })
    })
  })

  describe('alterarSituacao(id, ativo)', () => {
    const DESATIVADO = {
      ...APONTAMENTO_CHAMADOS_API,
      ativo: false,
      'situacao alterada em': '2026-11-03 11:20:00',
      'situacao alterada por': 'Fulano',
    }

    it('faz PUT /api/ped/apontamentos/{id}/situacao com { ativo: false } em JSON e o token', async () => {
      const chamadas = simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson(DESATIVADO) })

      await alterarSituacao(4, false)

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe(`${ROTA}/4/situacao`)
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: false })
    })

    it('ativar envia { ativo: true } e usa o id informado na URL', async () => {
      const chamadas = simularApi(fetchFalso, {
        [`PUT ${ROTA}/5/situacao`]: () => respostaJson({ ...APONTAMENTO_CONCILIACAO_API, id: 5, ativo: true }),
      })

      await alterarSituacao(5, true)

      expect(chamadas[0].caminho).toBe(`${ROTA}/5/situacao`)
      expect(corpoDaChamada(chamadas[0])).toEqual({ ativo: true })
    })

    it('devolve o apontamento atualizado convertido, com quem alterou e quando', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson(DESATIVADO) })

      const atualizado = await alterarSituacao(4, false)

      expect(atualizado).toMatchObject({
        id: 4,
        nome: 'Chamados resolvidos no prazo',
        ativo: false,
        situacaoAlteradaEm: '2026-11-03 11:20:00',
        situacaoAlteradaPor: 'Fulano',
      })
    })

    it('resposta 2xx fora do formato ou vazia rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => respostaJson({ mensagem: 'Situação alterada.' }) })
      await expect(alterarSituacao(4, false)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })

      simularApi(fetchFalso, { [`PUT ${ROTA}/4/situacao`]: () => new Response('', { status: 200 }) })
      await expect(alterarSituacao(4, false)).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 (Preenchedor) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        [`PUT ${ROTA}/4/situacao`]: () => respostaErro(403, 'Apenas Admin e Validador alteram a situação.'),
      })

      await expect(alterarSituacao(4, false)).rejects.toMatchObject({
        status: 403,
        mensagem: 'Apenas Admin e Validador alteram a situação.',
      })
    })

    it('404 (apontamento inexistente) rejeita com ApiError 404', async () => {
      simularApi(fetchFalso, { [`PUT ${ROTA}/999/situacao`]: () => respostaErro(404, 'Apontamento não encontrado.') })

      await expect(alterarSituacao(999, true)).rejects.toMatchObject({ status: 404, mensagem: 'Apontamento não encontrado.' })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(alterarSituacao(4, false)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('excluirApontamento(id)', () => {
    it('faz DELETE /api/ped/apontamentos/{id} sem corpo, com o token, e resolve sem valor em 204', async () => {
      const chamadas = simularApi(fetchFalso, { [`DELETE ${ROTA}/4`]: () => new Response(null, { status: 204 }) })

      await expect(excluirApontamento(4)).resolves.toBeUndefined()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('DELETE')
      expect(chamadas[0].caminho).toBe(`${ROTA}/4`)
      expect(chamadas[0].init?.body).toBeUndefined()
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('resolve também quando a API responde 200 com um JSON de confirmação', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/4`]: () => respostaJson({ mensagem: 'Apontamento excluído.' }) })

      await expect(excluirApontamento(4)).resolves.toBeUndefined()
    })

    it('usa o id informado na URL', async () => {
      const chamadas = simularApi(fetchFalso, { [`DELETE ${ROTA}/123`]: () => new Response(null, { status: 204 }) })

      await excluirApontamento(123)

      expect(chamadas[0].caminho).toBe(`${ROTA}/123`)
    })

    it('400 com { mensagem, indicadores } rejeita com ApiError 400, a mensagem da API e os indicadores em dados', async () => {
      simularApi(fetchFalso, {
        [`DELETE ${ROTA}/3`]: () =>
          respostaJson(
            {
              mensagem: 'Apontamento compõe indicadores e não pode ser excluído.',
              indicadores: APONTAMENTO_TREINAMENTOS_API.indicadores,
            },
            400,
          ),
      })

      const erro = await excluirApontamento(3).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({
        status: 400,
        mensagem: 'Apontamento compõe indicadores e não pode ser excluído.',
        dados: { indicadores: [{ id: 3, nome: 'Capacitação' }, { id: 4, nome: 'Desenvolvimento de equipe' }] },
      })
    })

    it('403 (Validador ou Preenchedor) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/4`]: () => respostaErro(403, 'Apenas o administrador exclui apontamentos.') })

      await expect(excluirApontamento(4)).rejects.toMatchObject({
        status: 403,
        mensagem: 'Apenas o administrador exclui apontamentos.',
      })
    })

    it('403 sem mensagem rejeita com a mensagem padrão do status', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/4`]: () => respostaErro(403) })

      await expect(excluirApontamento(4)).rejects.toMatchObject({ status: 403, mensagem: mensagemPadraoPorStatus(403) })
    })

    it('404 rejeita com ApiError 404', async () => {
      simularApi(fetchFalso, { [`DELETE ${ROTA}/999`]: () => respostaErro(404, 'Apontamento não encontrado.') })

      await expect(excluirApontamento(999)).rejects.toMatchObject({ status: 404, mensagem: 'Apontamento não encontrado.' })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(excluirApontamento(4)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
