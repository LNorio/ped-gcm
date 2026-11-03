import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { NOMES_TIPOS_FIXOS, TIPOS_FIXOS_API, TIPO_LOGISTICA_API, TIPO_MARKETING_API, tiposApi } from '../test/tiposFalsos'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { definirToken, limparToken } from './sessao'
import { ORIGEM_FIXO, ORIGEM_PERSONALIZADO, TIPOS_FIXOS, atualizarTipo, criarTipo, excluirTipo, listarTipos } from './tiposService'

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

    it('converte cada item para TipoApontamento (camelCase) mantendo a ordem da API', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson([TIPOS_FIXOS_API[0], TIPO_LOGISTICA_API, TIPO_MARKETING_API]),
      })

      const tipos = await listarTipos()

      expect(tipos).toEqual([
        { id: 1, nome: 'Comercial', origem: 'Fixo', quantidadeUsuarios: 3, quantidadeApontamentos: 7 },
        { id: 8, nome: 'Logística', origem: 'Personalizado', quantidadeUsuarios: 2, quantidadeApontamentos: 0 },
        { id: 9, nome: 'Marketing', origem: 'Personalizado', quantidadeUsuarios: 1, quantidadeApontamentos: 3 },
      ])
    })

    it('devolve os 9 tipos da lista padrão (7 fixos e 2 personalizados)', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      })

      const tipos = await listarTipos()

      expect(tipos).toHaveLength(9)
      expect(tipos.filter((tipo) => tipo.origem === 'Fixo').map((tipo) => tipo.nome)).toEqual([...NOMES_TIPOS_FIXOS])
      expect(tipos.filter((tipo) => tipo.origem === 'Personalizado').map((tipo) => tipo.nome)).toEqual([
        'Logística',
        'Marketing',
      ])
    })

    it('ignora o campo "usuarios" (devolvido só ao Admin) e trata quantidades ausentes como 0', async () => {
      simularApi(fetchFalso, {
        'GET /api/ped/tipos-apontamento': () =>
          respostaJson([
            {
              id: 1,
              nome: 'Comercial',
              origem: 'Fixo',
              usuarios: [{ id: 12, nome: 'Fulano' }],
            },
          ]),
      })

      const tipos = await listarTipos()

      expect(tipos).toEqual([{ id: 1, nome: 'Comercial', origem: 'Fixo', quantidadeUsuarios: 0, quantidadeApontamentos: 0 }])
      expect(tipos[0]).not.toHaveProperty('usuarios')
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

  describe('criarTipo({ nome, usuarios })', () => {
    it('faz POST /api/ped/tipos-apontamento com { nome, usuarios } em JSON', async () => {
      const chamadas = simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () =>
          respostaJson(
            { id: 10, nome: 'Logística', origem: 'Personalizado', 'quantidade usuarios': 2, 'quantidade apontamentos': 0 },
            201,
          ),
      })

      await criarTipo({ nome: 'Logística', usuarios: [12, 15] })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento')
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({ nome: 'Logística', usuarios: [12, 15] })
    })

    it('devolve o tipo criado convertido para o domínio (camelCase, quantidades ausentes como 0)', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () =>
          respostaJson({ id: 10, nome: 'Logística', origem: 'Personalizado', 'quantidade usuarios': 2 }, 201),
      })

      await expect(criarTipo({ nome: 'Logística', usuarios: [12, 15] })).resolves.toEqual({
        id: 10,
        nome: 'Logística',
        origem: 'Personalizado',
        quantidadeUsuarios: 2,
        quantidadeApontamentos: 0,
      })
    })

    it('resposta 2xx fora do formato (objeto sem id/nome/origem) rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaJson({ mensagem: 'Tipo criado.' }, 201),
      })

      const erro = await criarTipo({ nome: 'Logística', usuarios: [12] }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta 201 com corpo vazio rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => new Response('', { status: 201 }),
      })

      await expect(criarTipo({ nome: 'Logística', usuarios: [12] })).rejects.toMatchObject({
        mensagem: MENSAGEM_RESPOSTA_INVALIDA,
      })
    })

    it('400 (nome duplicado ou sem usuários) rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'POST /api/ped/tipos-apontamento': () => respostaErro(400, 'Já existe um tipo com este nome.'),
      })

      await expect(criarTipo({ nome: 'comercial', usuarios: [12] })).rejects.toMatchObject({
        status: 400,
        mensagem: 'Já existe um tipo com este nome.',
      })
    })
  })

  describe('atualizarTipo(id, { usuarios })', () => {
    it('faz PUT /api/ped/tipos-apontamento/{id} com { usuarios } em JSON', async () => {
      const chamadas = simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () =>
          respostaJson({
            id: 4,
            nome: 'Tecnologia da Informação',
            origem: 'Fixo',
            'quantidade usuarios': 3,
            'quantidade apontamentos': 2,
          }),
      })

      await atualizarTipo(4, { usuarios: [12, 15, 20] })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('PUT')
      expect(chamadas[0].caminho).toBe('/api/ped/tipos-apontamento/4')
      expect(cabecalhoDaChamada(chamadas[0], 'Content-Type')).toBe('application/json')
      expect(corpoDaChamada(chamadas[0])).toEqual({ usuarios: [12, 15, 20] })
    })

    it('devolve o tipo atualizado convertido para o domínio', async () => {
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () =>
          respostaJson({
            id: 4,
            nome: 'Tecnologia da Informação',
            origem: 'Fixo',
            'quantidade usuarios': 3,
            'quantidade apontamentos': 2,
          }),
      })

      await expect(atualizarTipo(4, { usuarios: [12, 15, 20] })).resolves.toEqual({
        id: 4,
        nome: 'Tecnologia da Informação',
        origem: 'Fixo',
        quantidadeUsuarios: 3,
        quantidadeApontamentos: 2,
      })
    })

    it('resposta 2xx fora do formato rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaJson({ mensagem: 'Tipo atualizado.' }),
      })

      const erro = await atualizarTipo(4, { usuarios: [12] }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('resposta 200 com corpo vazio rejeita com ApiError de resposta inválida', async () => {
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => new Response('', { status: 200 }),
      })

      await expect(atualizarTipo(4, { usuarios: [12] })).rejects.toMatchObject({ mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })

    it('403 rejeita com ApiError e a mensagem da API', async () => {
      simularApi(fetchFalso, {
        'PUT /api/ped/tipos-apontamento/4': () => respostaErro(403, 'Apenas o administrador pode alterar tipos.'),
      })

      await expect(atualizarTipo(4, { usuarios: [12] })).rejects.toMatchObject({
        status: 403,
        mensagem: 'Apenas o administrador pode alterar tipos.',
      })
    })
  })
})
