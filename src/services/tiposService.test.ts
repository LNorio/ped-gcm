import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import {
  NOMES_TIPOS_FIXOS,
  TIPOS_FIXOS_API,
  TIPO_LOGISTICA_API,
  TIPO_MARKETING_API,
  respostaRealTiposApi,
  tipoDominio,
  tiposApi,
  tiposApiPreenchedor,
} from '../test/tiposFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { definirToken, limparToken } from './sessao'
import { ORIGEM_FIXO, ORIGEM_PERSONALIZADO, TIPOS_FIXOS, atualizarTipo, criarTipo, excluirTipo, listarTipos } from './tiposService'

/** Tipo devolvido pela API após gravar (mesmo formato do GET, visão de Admin/Validador). */
const COMPRAS_GRAVADO_API = {
  id: 10,
  nome: 'Compras',
  origem: 'Personalizado',
  'quantidade usuarios': 38,
  'quantidade apontamentos': 0,
  grupos: [
    { id: 4, nome: 'DEF_OPERADOR DE CAIXA' },
    { id: 7, nome: 'DEF_GERENTE DE LOJA' },
  ],
  usuarios: [{ id: 12, nome: 'Fulano' }],
}

const COMPRAS_GRAVADO = {
  id: 10,
  nome: 'Compras',
  origem: 'Personalizado',
  quantidadeUsuarios: 38,
  quantidadeApontamentos: 0,
  grupos: [
    { id: 4, nome: 'DEF_OPERADOR DE CAIXA' },
    { id: 7, nome: 'DEF_GERENTE DE LOJA' },
  ],
  usuarios: [{ id: 12, nome: 'Fulano' }],
}

const TI_GRAVADO_API = {
  id: 4,
  nome: 'Tecnologia da Informação',
  origem: 'Fixo',
  'quantidade usuarios': 3,
  'quantidade apontamentos': 2,
  grupos: [{ id: 4, nome: 'DEF_OPERADOR DE CAIXA' }],
  usuarios: [{ id: 20, nome: 'Beltrano' }],
}

describe('F3.1 — Serviço de tipos de apontamento', () => {
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

  describe('TIPOS_FIXOS', () => {
    it('contém exatamente os 7 tipos fixos da plataforma, na ordem da API', () => {
      expect(TIPOS_FIXOS).toEqual([...NOMES_TIPOS_FIXOS])
    })
  })

  describe('ORIGEM_FIXO e ORIGEM_PERSONALIZADO', () => {
    it('são os dois valores de origem devolvidos pela API ("Fixo" e "Personalizado")', () => {
      expect(ORIGEM_FIXO).toBe('Fixo')
      expect(ORIGEM_PERSONALIZADO).toBe('Personalizado')
    })

    it('batem com a origem dos tipos convertidos pelo serviço', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      })

      const tipos = await listarTipos()

      expect(tipos.filter((tipo) => tipo.origem === ORIGEM_FIXO)).toHaveLength(7)
      expect(tipos.filter((tipo) => tipo.origem === ORIGEM_PERSONALIZADO)).toHaveLength(2)
      expect(tipos.every((tipo) => tipo.origem === ORIGEM_FIXO || tipo.origem === ORIGEM_PERSONALIZADO)).toBe(true)
    })
  })

  describe('listarTipos()', () => {
    it('faz GET /api/ped/tipos-apontamento pedindo JSON com o token da sessão', async () => {
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      })

      await listarTipos()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('GET')
      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento')
      expect(chamadas[0].url.search).toBe('')
      expect(cabecalhoDaChamada(chamadas[0], 'Accept')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(chamadas[0].init?.body).toBeUndefined()
    })

    it('converte cada item para TipoApontamento (camelCase), com os grupos e usuários vinculados, mantendo a ordem da API', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([TIPOS_FIXOS_API[0], TIPO_LOGISTICA_API, TIPO_MARKETING_API]),
      })

      const tipos = await listarTipos()

      expect(tipos).toEqual([
        {
          id: 1,
          nome: 'Comercial',
          origem: 'Fixo',
          quantidadeUsuarios: 3,
          quantidadeApontamentos: 7,
          grupos: [
            { id: 4, nome: 'DEF_OPERADOR DE CAIXA' },
            { id: 7, nome: 'DEF_GERENTE DE LOJA' },
          ],
          usuarios: [{ id: 12, nome: 'Fulano' }],
        },
        {
          id: 8,
          nome: 'Logística',
          origem: 'Personalizado',
          quantidadeUsuarios: 2,
          quantidadeApontamentos: 0,
          grupos: [{ id: 11, nome: 'DEF_SUPERVISÃO LOGÍSTICA' }],
          usuarios: [{ id: 12, nome: 'Fulano' }],
        },
        {
          id: 9,
          nome: 'Marketing',
          origem: 'Personalizado',
          quantidadeUsuarios: 1,
          quantidadeApontamentos: 3,
          grupos: [{ id: 4, nome: 'DEF_OPERADOR DE CAIXA' }],
          usuarios: [],
        },
      ])
    })

    it('devolve os 9 tipos da lista padrão (7 fixos e 2 personalizados)', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      })

      const tipos = await listarTipos()

      expect(tipos).toHaveLength(9)
      expect(tipos).toEqual(tiposApi().map(tipoDominio))
      expect(tipos.filter((tipo) => tipo.origem === 'Fixo').map((tipo) => tipo.nome)).toEqual([...NOMES_TIPOS_FIXOS])
      expect(tipos.filter((tipo) => tipo.origem === 'Personalizado').map((tipo) => tipo.nome)).toEqual([
        'Logística',
        'Marketing',
      ])
    })

    it('listas vazias de grupos e usuários continuam [] (tipo sem vínculo)', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([TIPOS_FIXOS_API[2]]),
      })

      const [tipo] = await listarTipos()

      expect(tipo.grupos).toEqual([])
      expect(tipo.usuarios).toEqual([])
    })

    it('para o Preenchedor, "grupos" e "usuarios" null viram null (não lista vazia)', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApiPreenchedor().slice(0, 1)),
      })

      const tipos = await listarTipos()

      expect(tipos).toEqual([
        {
          id: 1,
          nome: 'Comercial',
          origem: 'Fixo',
          quantidadeUsuarios: 3,
          quantidadeApontamentos: 7,
          grupos: null,
          usuarios: null,
        },
      ])
    })

    it('"grupos" e "usuarios" ausentes viram null e quantidades ausentes viram 0', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([{ id: 1, nome: 'Comercial', origem: 'Fixo' }]),
      })

      const tipos = await listarTipos()

      expect(tipos).toEqual([
        {
          id: 1,
          nome: 'Comercial',
          origem: 'Fixo',
          quantidadeUsuarios: 0,
          quantidadeApontamentos: 0,
          grupos: null,
          usuarios: null,
        },
      ])
    })

    it('mantém só id e nome de cada grupo e usuário (campos extras são descartados)', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () =>
          respostaJson([
            {
              ...TIPO_MARKETING_API,
              grupos: [{ id: 4, nome: 'DEF_OPERADOR DE CAIXA', 'quantidade usuarios': 37 }],
              usuarios: [{ id: 12, nome: 'Fulano', cargo: 'Gerente de Loja' }],
            },
          ]),
      })

      const [tipo] = await listarTipos()

      expect(tipo.grupos).toEqual([{ id: 4, nome: 'DEF_OPERADOR DE CAIXA' }])
      expect(tipo.usuarios).toEqual([{ id: 12, nome: 'Fulano' }])
    })

    it('lista vazia resolve []', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([]),
      })

      await expect(listarTipos()).resolves.toEqual([])
    })

    it('resposta 200 que não é uma lista (objeto) rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson({ mensagem: 'ok' }),
      })

      const erro = await listarTipos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta 200 com corpo vazio rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => new Response('', { status: 200 }),
      })

      await expect(listarTipos()).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('lista com um item fora do formato (sem nome) rejeita com ApiError(200, resposta inválida), sem ignorar o item', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () =>
          respostaJson([TIPOS_FIXOS_API[0], { id: 8, origem: 'Personalizado', 'quantidade usuarios': 2 }]),
      })

      const erro = await listarTipos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('lista com item nulo ou com id em texto rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([null, TIPO_LOGISTICA_API]),
      })
      await expect(listarTipos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })

      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([{ ...TIPO_LOGISTICA_API, id: '8' }]),
      })
      await expect(listarTipos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 com mensagem rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaErro(403, 'Usuário sem acesso ao PED.'),
      })

      const erro = await listarTipos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 403, mensagem: 'Usuário sem acesso ao PED.' })
    })

    it('500 sem mensagem rejeita com a mensagem padrão do status', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaErro(500),
      })

      await expect(listarTipos()).rejects.toMatchObject({ status: 500, mensagem: mensagemPadraoPorStatus(500) })
    })

    it('falha de rede rejeita com ApiError status 0 e a mensagem padrão de conexão', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(listarTipos()).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('excluirTipo(id)', () => {
    it('faz DELETE /api/ped/tipos-apontamento/{id} sem corpo, com o token da sessão, e resolve sem valor em 204', async () => {
      const chamadas = simularApi(fetchFalso, {
        'DELETE /api/ped/tipos-apontamento/8': () => new Response(null, { status: 204 }),
      })

      await expect(excluirTipo(8)).resolves.toBeUndefined()

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('DELETE')
      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento/8')
      expect(chamadas[0].init?.body).toBeUndefined()
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('resolve também quando a API responde 200 com um JSON de confirmação', async () => {
      simularApi(fetchFalso, {
        'DELETE /api/ped/tipos-apontamento/8': () => respostaJson({ mensagem: 'Tipo excluído.' }),
      })

      await expect(excluirTipo(8)).resolves.toBeUndefined()
    })

    it('usa o id informado na URL (não confunde ids diferentes)', async () => {
      const chamadas = simularApi(fetchFalso, {
        'DELETE /api/ped/tipos-apontamento/123': () => new Response(null, { status: 204 }),
      })

      await excluirTipo(123)

      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento/123')
    })

    it('400 (tipo fixo ou com apontamentos) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'DELETE /api/ped/tipos-apontamento/9': () => respostaErro(400, 'Tipo possui apontamentos vinculados.'),
      })

      const erro = await excluirTipo(9).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'Tipo possui apontamentos vinculados.' })
    })

    it('403 (perfil sem permissão na API) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'DELETE /api/ped/tipos-apontamento/8': () => respostaErro(403, 'Apenas o administrador pode excluir tipos.'),
      })

      await expect(excluirTipo(8)).rejects.toMatchObject({
        status: 403,
        mensagem: 'Apenas o administrador pode excluir tipos.',
      })
    })

    it('403 sem mensagem rejeita com a mensagem padrão do status', async () => {
      simularApi(fetchFalso, {
        'DELETE /api/ped/tipos-apontamento/8': () => respostaErro(403),
      })

      await expect(excluirTipo(8)).rejects.toMatchObject({ status: 403, mensagem: mensagemPadraoPorStatus(403) })
    })

    it('404 (tipo inexistente) rejeita com ApiError 404', async () => {
      simularApi(fetchFalso, {
        'DELETE /api/ped/tipos-apontamento/999': () => respostaErro(404, 'Tipo não encontrado.'),
      })

      await expect(excluirTipo(999)).rejects.toMatchObject({ status: 404, mensagem: 'Tipo não encontrado.' })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(excluirTipo(8)).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('criarTipo({ nome, grupos, usuarios }) — A-02', () => {
    it('faz POST /api/ped/tipos-apontamento com { nome, grupos, usuarios } em JSON e o token da sessão', async () => {
      const chamadas = simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson(COMPRAS_GRAVADO_API, 201),
      })

      await criarTipo({ nome: 'Compras', grupos: [4, 7], usuarios: [12] })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento')
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({ nome: 'Compras', grupos: [4, 7], usuarios: [12] })
    })

    it('envia as duas listas mesmo quando uma delas está vazia (só grupos ou só usuários)', async () => {
      const chamadas = simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson(COMPRAS_GRAVADO_API, 201),
      })

      await criarTipo({ nome: 'Compras', grupos: [4], usuarios: [] })
      await criarTipo({ nome: 'Vendas', grupos: [], usuarios: [12, 20] })

      expect(corpoDaChamada(chamadas[0])).toEqual({ nome: 'Compras', grupos: [4], usuarios: [] })
      expect(corpoDaChamada(chamadas[1])).toEqual({ nome: 'Vendas', grupos: [], usuarios: [12, 20] })
    })

    it('2xx com o tipo na raiz devolve o tipo convertido (com grupos e usuários)', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson(COMPRAS_GRAVADO_API, 201),
      })

      await expect(criarTipo({ nome: 'Compras', grupos: [4, 7], usuarios: [12] })).resolves.toEqual(COMPRAS_GRAVADO)
    })

    it('2xx com o tipo no envelope { tipo } (com ou sem mensagem) devolve o tipo convertido', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson({ mensagem: 'tipo cadastrado', tipo: COMPRAS_GRAVADO_API }, 201),
      })
      await expect(criarTipo({ nome: 'Compras', grupos: [4, 7], usuarios: [12] })).resolves.toEqual(COMPRAS_GRAVADO)

      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson({ tipo: COMPRAS_GRAVADO_API }, 201),
      })
      await expect(criarTipo({ nome: 'Compras', grupos: [4, 7], usuarios: [12] })).resolves.toEqual(COMPRAS_GRAVADO)
    })

    it.each([
      ['corpo vazio', () => new Response('', { status: 201 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['só { mensagem }', () => respostaJson({ mensagem: 'tipo cadastrado' }, 201)],
      ['só { id }', () => respostaJson({ id: 10 }, 201)],
      ['tipo incompleto (sem origem)', () => respostaJson({ id: 10, nome: 'Compras' }, 201)],
    ])('2xx sem tipo reconhecível (%s) resolve null — "2xx = gravado", sem erro', async (_caso, resposta) => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': resposta,
      })

      await expect(criarTipo({ nome: 'Compras', grupos: [4], usuarios: [] })).resolves.toBeNull()
    })

    it('400 "informe ao menos um grupo ou usuario" rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaErro(400, 'informe ao menos um grupo ou usuario'),
      })

      const erro = await criarTipo({ nome: 'Compras', grupos: [], usuarios: [] }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 400, mensagem: 'informe ao menos um grupo ou usuario' })
    })

    it('400 (nome duplicado) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaErro(400, 'Já existe um tipo com este nome.'),
      })

      await expect(criarTipo({ nome: 'comercial', grupos: [4], usuarios: [] })).rejects.toMatchObject({
        status: 400,
        mensagem: 'Já existe um tipo com este nome.',
      })
    })

    it('403 e falha de rede rejeitam com ApiError', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaErro(403, 'Sem permissão.'),
      })
      await expect(criarTipo({ nome: 'Compras', grupos: [4], usuarios: [] })).rejects.toMatchObject({
        status: 403,
        mensagem: 'Sem permissão.',
      })

      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(criarTipo({ nome: 'Compras', grupos: [4], usuarios: [] })).rejects.toMatchObject({
        status: 0,
        mensagem: MENSAGEM_SEM_CONEXAO,
      })
    })
  })

  describe('atualizarTipo(id, { grupos?, usuarios? }) — A-02', () => {
    it('só grupos: faz PUT /api/ped/tipos-apontamento/{id} com { grupos } (sem a chave usuarios)', async () => {
      const chamadas = simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaJson(TI_GRAVADO_API),
      })

      await atualizarTipo(4, { grupos: [4] })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento/4')
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      const corpo = corpoDaChamada(chamadas[0])
      expect(corpo).toEqual({ grupos: [4] })
      expect(corpo).not.toHaveProperty('usuarios')
    })

    it('só usuários: envia { usuarios } (sem a chave grupos)', async () => {
      const chamadas = simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaJson(TI_GRAVADO_API),
      })

      await atualizarTipo(4, { usuarios: [20, 21] })

      const corpo = corpoDaChamada(chamadas[0])
      expect(corpo).toEqual({ usuarios: [20, 21] })
      expect(corpo).not.toHaveProperty('grupos')
    })

    it('as duas listas: envia { grupos, usuarios }; lista vazia é enviada como []', async () => {
      const chamadas = simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/8': () => respostaJson(TI_GRAVADO_API),
      })

      await atualizarTipo(8, { grupos: [11, 4], usuarios: [] })

      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento/8')
      expect(corpoDaChamada(chamadas[0])).toEqual({ grupos: [11, 4], usuarios: [] })
    })

    it('2xx com o tipo na raiz ou em { tipo } devolve o tipo convertido', async () => {
      const esperado = {
        id: 4,
        nome: 'Tecnologia da Informação',
        origem: 'Fixo',
        quantidadeUsuarios: 3,
        quantidadeApontamentos: 2,
        grupos: [{ id: 4, nome: 'DEF_OPERADOR DE CAIXA' }],
        usuarios: [{ id: 20, nome: 'Beltrano' }],
      }
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaJson(TI_GRAVADO_API),
      })
      await expect(atualizarTipo(4, { grupos: [4] })).resolves.toEqual(esperado)

      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaJson({ mensagem: 'tipo atualizado', tipo: TI_GRAVADO_API }),
      })
      await expect(atualizarTipo(4, { grupos: [4] })).resolves.toEqual(esperado)
    })

    it.each([
      ['corpo vazio', () => new Response('', { status: 200 })],
      ['204 sem corpo', () => new Response(null, { status: 204 })],
      ['só { mensagem }', () => respostaJson({ mensagem: 'tipo atualizado' })],
      ['tipo incompleto (sem nome)', () => respostaJson({ id: 4, origem: 'Fixo' })],
    ])('2xx sem tipo reconhecível (%s) resolve null — "2xx = gravado", sem erro', async (_caso, resposta) => {
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': resposta,
      })

      await expect(atualizarTipo(4, { grupos: [4] })).resolves.toBeNull()
    })

    it('400, 403 e 404 rejeitam com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaErro(400, 'grupo inexistente'),
      })
      await expect(atualizarTipo(4, { grupos: [99] })).rejects.toMatchObject({ status: 400, mensagem: 'grupo inexistente' })

      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaErro(403, 'Sem permissão.'),
      })
      await expect(atualizarTipo(4, { grupos: [4] })).rejects.toMatchObject({ status: 403, mensagem: 'Sem permissão.' })

      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/999': () => respostaErro(404, 'Tipo não encontrado.'),
      })
      const erro = await atualizarTipo(999, { usuarios: [12] }).catch((e: unknown) => e)
      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 404, mensagem: 'Tipo não encontrado.' })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(atualizarTipo(4, { grupos: [4] })).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })

  describe('usuários vinculados com a chave "id colaborador" (resposta real da API, 06/11/2026)', () => {
    const PREENCHEDOR = { id: 985, nome: 'Preenchedor' }

    it('listarTipos() aceita a resposta real completa (7 tipos fixos) e converte "id colaborador" em id', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson(respostaRealTiposApi()),
      })

      const tipos = await listarTipos()

      expect(tipos).toEqual(
        NOMES_TIPOS_FIXOS.map((nome, indice) => ({
          id: indice + 1,
          nome,
          origem: 'Fixo',
          quantidadeUsuarios: 1,
          quantidadeApontamentos: nome === 'Tecnologia da Informação' ? 1 : 0,
          grupos: [],
          usuarios: [PREENCHEDOR],
        })),
      )
    })

    it('o usuário convertido tem só id e nome (a chave "id colaborador" não vai para o domínio)', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson(respostaRealTiposApi().slice(0, 1)),
      })

      const [tipo] = await listarTipos()

      expect(tipo.usuarios).toEqual([PREENCHEDOR])
      expect(tipo.usuarios?.[0]).not.toHaveProperty('id colaborador')
      expect(Object.keys(tipo.usuarios?.[0] ?? {}).sort()).toEqual(['id', 'nome'])
    })

    it('lista mista: usuários com id e com "id colaborador" no mesmo tipo são todos aceitos, na ordem da API', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () =>
          respostaJson([
            {
              ...TIPO_LOGISTICA_API,
              usuarios: [
                { id: 12, nome: 'Fulano' },
                { 'id colaborador': 985, nome: 'Preenchedor' },
                { 'id colaborador': 30, nome: 'Maria Souza' },
              ],
            },
          ]),
      })

      const [tipo] = await listarTipos()

      expect(tipo.usuarios).toEqual([
        { id: 12, nome: 'Fulano' },
        PREENCHEDOR,
        { id: 30, nome: 'Maria Souza' },
      ])
      expect(tipo.grupos).toEqual([{ id: 11, nome: 'DEF_SUPERVISÃO LOGÍSTICA' }])
    })

    it('tipos com usuários em formatos diferentes na mesma lista também são aceitos', async () => {
      const [comercialReal] = respostaRealTiposApi()
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([comercialReal, TIPO_LOGISTICA_API]),
      })

      const tipos = await listarTipos()

      expect(tipos.map((tipo) => tipo.usuarios)).toEqual([[PREENCHEDOR], [{ id: 12, nome: 'Fulano' }]])
    })

    it.each([
      ['"id colaborador" em texto', { 'id colaborador': '985', nome: 'Preenchedor' }],
      ['"id colaborador" sem nome', { 'id colaborador': 985 }],
      ['"id colaborador" com nome não textual', { 'id colaborador': 985, nome: 985 }],
      ['"id colaborador" nulo', { 'id colaborador': null, nome: 'Preenchedor' }],
      ['sem nenhum dos dois ids', { nome: 'Preenchedor' }],
    ])('usuário inválido (%s) rejeita a lista com ApiError(200, resposta inválida)', async (_caso, usuario) => {
      const [comercialReal] = respostaRealTiposApi()
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([{ ...comercialReal, usuarios: [usuario] }]),
      })

      const erro = await listarTipos().catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('grupos continuam exigindo { id, nome }: grupo com "id colaborador" em vez de id rejeita a lista', async () => {
      const [comercialReal] = respostaRealTiposApi()
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () =>
          respostaJson([{ ...comercialReal, grupos: [{ 'id colaborador': 4, nome: 'DEF_OPERADOR DE CAIXA' }] }]),
      })

      await expect(listarTipos()).rejects.toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('criarTipo: tipo gravado com usuários em "id colaborador" (na raiz ou em { tipo }) é reconhecido e convertido', async () => {
      const gravadoApi = {
        ...COMPRAS_GRAVADO_API,
        usuarios: [{ 'id colaborador': 985, nome: 'Preenchedor' }],
      }
      const esperado = { ...COMPRAS_GRAVADO, usuarios: [PREENCHEDOR] }

      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson(gravadoApi, 201),
      })
      await expect(criarTipo({ nome: 'Compras', grupos: [4, 7], usuarios: [985] })).resolves.toEqual(esperado)

      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson({ mensagem: 'tipo criado', tipo: gravadoApi }, 201),
      })
      await expect(criarTipo({ nome: 'Compras', grupos: [4, 7], usuarios: [985] })).resolves.toEqual(esperado)
    })

    it('atualizarTipo: tipo gravado com usuários em "id colaborador" (na raiz ou em { tipo }) é reconhecido e convertido', async () => {
      const [comercialReal] = respostaRealTiposApi()
      const esperado = {
        id: 1,
        nome: 'Comercial',
        origem: 'Fixo',
        quantidadeUsuarios: 1,
        quantidadeApontamentos: 0,
        grupos: [],
        usuarios: [PREENCHEDOR],
      }

      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/1': () => respostaJson(comercialReal),
      })
      await expect(atualizarTipo(1, { usuarios: [985] })).resolves.toEqual(esperado)

      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/1': () => respostaJson({ mensagem: 'tipo atualizado', tipo: comercialReal }),
      })
      await expect(atualizarTipo(1, { usuarios: [985] })).resolves.toEqual(esperado)
    })

    it('POST/PUT com usuário em "id colaborador" inválido (texto) não é reconhecido como tipo: resolve null', async () => {
      const [comercialReal] = respostaRealTiposApi()
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/1': () =>
          respostaJson({ ...comercialReal, usuarios: [{ 'id colaborador': '985', nome: 'Preenchedor' }] }),
      })

      await expect(atualizarTipo(1, { usuarios: [985] })).resolves.toBeNull()
    })
  })
})
