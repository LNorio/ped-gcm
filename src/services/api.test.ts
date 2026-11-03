import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ModuloApi = typeof import('./api')
type ModuloSessao = typeof import('./sessao')

let api: ModuloApi
let sessao: ModuloSessao

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function respostaTexto(texto: string, status: number): Response {
  return new Response(texto, { status, headers: { 'Content-Type': 'text/html' } })
}

function obterUrl(chamada: unknown[]): string {
  const entrada = chamada[0]
  if (entrada instanceof Request) return entrada.url
  return String(entrada)
}

function obterInit(chamada: unknown[]): RequestInit {
  return (chamada[1] ?? {}) as RequestInit
}

function obterCabecalho(chamada: unknown[], nome: string): string | null {
  const entrada = chamada[0]
  if (entrada instanceof Request) return entrada.headers.get(nome)
  return new Headers(obterInit(chamada).headers).get(nome)
}

function obterMetodo(chamada: unknown[]): string {
  const entrada = chamada[0]
  if (entrada instanceof Request) return entrada.method
  return (obterInit(chamada).method ?? 'GET').toUpperCase()
}

async function obterCorpo(chamada: unknown[]): Promise<string | null> {
  const entrada = chamada[0]
  if (entrada instanceof Request) return entrada.text()
  const corpo = obterInit(chamada).body
  return corpo == null ? null : String(corpo)
}

describe('F1.2 — Cliente HTTP da API', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', undefined)
    api = await import('./api')
    sessao = await import('./sessao')
    sessao.limparToken()
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('URL base', () => {
    it('usa "/api" como base quando VITE_API_URL não está definida', async () => {
      fetchSpy.mockResolvedValue(respostaJson([]))

      await api.apiFetch('/ped/filiais')

      expect(obterUrl(fetchSpy.mock.calls[0])).toBe('/api/ped/filiais')
    })

    it('usa "/api" como base quando VITE_API_URL está vazia', async () => {
      vi.resetModules()
      vi.stubEnv('VITE_API_URL', '')
      const apiVazia = await import('./api')
      fetchSpy.mockResolvedValue(respostaJson([]))

      await apiVazia.apiFetch('/ped/filiais')

      expect(obterUrl(fetchSpy.mock.calls[0])).toBe('/api/ped/filiais')
    })

    it('prefixa o caminho com VITE_API_URL quando definida', async () => {
      vi.resetModules()
      vi.stubEnv('VITE_API_URL', 'http://192.168.7.18:8080/api')
      const apiProducao = await import('./api')
      fetchSpy.mockResolvedValue(respostaJson([]))

      await apiProducao.apiFetch('/ped/filiais')

      expect(obterUrl(fetchSpy.mock.calls[0])).toBe('http://192.168.7.18:8080/api/ped/filiais')
    })

    it('não duplica a barra entre a base e o caminho', async () => {
      vi.resetModules()
      vi.stubEnv('VITE_API_URL', 'http://servidor/api/')
      const apiBarra = await import('./api')
      fetchSpy.mockResolvedValue(respostaJson([]))

      await apiBarra.apiFetch('ped/filiais')

      expect(obterUrl(fetchSpy.mock.calls[0])).toBe('http://servidor/api/ped/filiais')
    })

    it('monta a query string com os parâmetros informados e omite os nulos e indefinidos', async () => {
      fetchSpy.mockResolvedValue(respostaJson({}))

      await api.apiFetch('/ped/dados-externos', {
        query: { mes_de_referencia: '2026-09-01', filial: undefined, indicador: 'cobertura', pagina: null },
      })

      const url = new URL(obterUrl(fetchSpy.mock.calls[0]), 'http://localhost')
      expect(url.pathname).toBe('/api/ped/dados-externos')
      expect(url.searchParams.get('mes_de_referencia')).toBe('2026-09-01')
      expect(url.searchParams.get('indicador')).toBe('cobertura')
      expect(url.searchParams.has('filial')).toBe(false)
      expect(url.searchParams.has('pagina')).toBe(false)
    })
  })

  describe('requisição', () => {
    it('faz GET por padrão e pede JSON', async () => {
      fetchSpy.mockResolvedValue(respostaJson([]))

      await api.apiFetch('/ped/filiais')

      expect(obterMetodo(fetchSpy.mock.calls[0])).toBe('GET')
      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Accept')).toBe('application/json')
    })

    it('não envia Authorization quando não há token', async () => {
      fetchSpy.mockResolvedValue(respostaJson([]))

      await api.apiFetch('/ped/filiais')

      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Authorization')).toBeNull()
    })

    it('envia Authorization: Bearer com o token da sessão', async () => {
      sessao.definirToken('token-123')
      fetchSpy.mockResolvedValue(respostaJson([]))

      await api.apiFetch('/ped/filiais')

      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Authorization')).toBe('Bearer token-123')
    })

    it('serializa o corpo como JSON e informa o Content-Type', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ id: 1 }, 201))

      await api.apiFetch('/ped/apontamentos', {
        method: 'POST',
        body: { nome: 'Visitas', 'id tipo': 1, 'tipo de valor': 'numeral' },
      })

      expect(obterMetodo(fetchSpy.mock.calls[0])).toBe('POST')
      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Content-Type')).toBe('application/json')
      expect(JSON.parse((await obterCorpo(fetchSpy.mock.calls[0])) ?? '')).toEqual({
        nome: 'Visitas',
        'id tipo': 1,
        'tipo de valor': 'numeral',
      })
    })

    it('devolve o JSON da resposta tipado', async () => {
      const filiais = [{ filial: '100', 'nome filial': 'Filial 100', empresa: '1' }]
      fetchSpy.mockResolvedValue(respostaJson(filiais))

      const resultado = await api.apiFetch<typeof filiais>('/ped/filiais')

      expect(resultado).toEqual(filiais)
    })
  })

  describe('ApiError', () => {
    it('é um Error com name "ApiError", status e mensagem', () => {
      const erro = new api.ApiError(404, 'filial nao encontrada')

      expect(erro).toBeInstanceOf(Error)
      expect(erro).toBeInstanceOf(api.ApiError)
      expect(erro.name).toBe('ApiError')
      expect(erro.status).toBe(404)
      expect(erro.mensagem).toBe('filial nao encontrada')
      expect(erro.message).toBe('filial nao encontrada')
    })
  })

  describe('erros da API', () => {
    it('lança ApiError com a mensagem do JSON {"mensagem"} em 400', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ mensagem: 'nome ja cadastrado' }, 400))

      const promessa = api.apiFetch('/ped/apontamentos', { method: 'POST', body: {} })

      await expect(promessa).rejects.toBeInstanceOf(api.ApiError)
      await expect(promessa).rejects.toMatchObject({ status: 400, mensagem: 'nome ja cadastrado' })
    })

    it('guarda o corpo completo da resposta de erro em "dados"', async () => {
      const corpo = { mensagem: 'apontamento compoe indicador', indicadores: ['Cobertura', 'Mix premium'] }
      fetchSpy.mockResolvedValue(respostaJson(corpo, 400))

      await expect(api.apiFetch('/ped/apontamentos/5', { method: 'DELETE' })).rejects.toMatchObject({
        status: 400,
        dados: corpo,
      })
    })

    it('lança ApiError 404 com a mensagem da API', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ mensagem: 'filial nao encontrada' }, 404))

      await expect(api.apiFetch('/ped/inicio', { query: { filial: '999' } })).rejects.toMatchObject({
        status: 404,
        mensagem: 'filial nao encontrada',
      })
    })

    it('lança ApiError 403 com a mensagem da API', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ mensagem: 'sem permissao' }, 403))

      await expect(api.apiFetch('/ped/sincronizar-erp', { method: 'POST' })).rejects.toMatchObject({
        status: 403,
        mensagem: 'sem permissao',
      })
    })

    it('lança ApiError 500 com a mensagem da API', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ mensagem: 'falha ao consultar o ERP' }, 500))

      await expect(api.apiFetch('/ped/dados-externos')).rejects.toMatchObject({
        status: 500,
        mensagem: 'falha ao consultar o ERP',
      })
    })

    it.each([
      [400, 'Dados inválidos. Verifique as informações e tente novamente.'],
      [401, 'Sua sessão expirou. Entre novamente.'],
      [403, 'Você não tem permissão para esta ação.'],
      [404, 'Registro não encontrado.'],
      [500, 'Erro interno do servidor. Tente novamente mais tarde.'],
    ])('usa mensagem padrão em pt-BR quando o corpo do %i não traz "mensagem"', async (status, mensagem) => {
      fetchSpy.mockResolvedValue(respostaTexto('<html>erro</html>', status))

      await expect(api.apiFetch('/ped/filiais')).rejects.toMatchObject({ status, mensagem })
    })

    it('usa mensagem padrão quando o JSON de erro não tem a chave "mensagem"', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ erro: 'x' }, 404))

      await expect(api.apiFetch('/ped/filiais')).rejects.toMatchObject({
        status: 404,
        mensagem: 'Registro não encontrado.',
      })
    })

    it('usa mensagem genérica com o status para códigos não previstos', async () => {
      fetchSpy.mockResolvedValue(respostaTexto('', 502))

      await expect(api.apiFetch('/ped/filiais')).rejects.toMatchObject({
        status: 502,
        mensagem: 'Erro inesperado (502).',
      })
    })

    it('converte falha de rede em ApiError com status 0 e mensagem de conexão', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))

      const promessa = api.apiFetch('/ped/filiais')

      await expect(promessa).rejects.toBeInstanceOf(api.ApiError)
      await expect(promessa).rejects.toMatchObject({
        status: 0,
        mensagem: 'Não foi possível conectar ao servidor.',
      })
    })
  })

  describe('métodos, corpo e cabeçalhos', () => {
    it('envia method PUT explícito ao fetch', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ ok: true }))

      await api.apiFetch('/ped/metas', { method: 'PUT', body: { meta: 10 } })

      expect(obterMetodo(fetchSpy.mock.calls[0])).toBe('PUT')
    })

    it('envia method DELETE explícito ao fetch', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))

      await api.apiFetch('/ped/apontamentos/5', { method: 'DELETE' })

      expect(obterMetodo(fetchSpy.mock.calls[0])).toBe('DELETE')
    })

    it('envia FormData como está, sem Content-Type: application/json', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ ok: true }, 201))
      const formulario = new FormData()
      formulario.append('arquivo', 'conteudo')

      await api.apiFetch('/ped/importar', { method: 'POST', body: formulario })

      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Content-Type')).not.toBe('application/json')
      expect(obterInit(fetchSpy.mock.calls[0]).body).toBe(formulario)
    })

    it('envia corpo string como está, sem Content-Type: application/json', async () => {
      fetchSpy.mockResolvedValue(respostaJson({ ok: true }))

      await api.apiFetch('/ped/texto', { method: 'POST', body: 'a=1&b=2' })

      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Content-Type')).toBeNull()
      expect(await obterCorpo(fetchSpy.mock.calls[0])).toBe('a=1&b=2')
    })

    it('preserva cabeçalhos extras informados junto com os padrões', async () => {
      sessao.definirToken('token-abc')
      fetchSpy.mockResolvedValue(respostaJson([]))

      await api.apiFetch('/ped/filiais', { headers: { 'X-Requisicao': 'rastreio-1', 'Accept-Language': 'pt-BR' } })

      expect(obterCabecalho(fetchSpy.mock.calls[0], 'X-Requisicao')).toBe('rastreio-1')
      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Accept-Language')).toBe('pt-BR')
      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Accept')).toBe('application/json')
      expect(obterCabecalho(fetchSpy.mock.calls[0], 'Authorization')).toBe('Bearer token-abc')
    })
  })

  describe('respostas sem corpo e corpos inválidos', () => {
    it('resolve undefined em 204 No Content', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 204 }))

      await expect(api.apiFetch('/ped/apontamentos/5', { method: 'DELETE' })).resolves.toBeUndefined()
    })

    it('resolve undefined em 200 com corpo vazio', async () => {
      fetchSpy.mockResolvedValue(new Response('', { status: 200 }))

      await expect(api.apiFetch('/ped/sincronizar-erp', { method: 'POST' })).resolves.toBeUndefined()
    })

    it('resolve undefined em 201 com corpo vazio', async () => {
      fetchSpy.mockResolvedValue(new Response('', { status: 201 }))

      await expect(api.apiFetch('/ped/apontamentos', { method: 'POST', body: { nome: 'X' } })).resolves.toBeUndefined()
    })

    it('rejeita com ApiError "Resposta inválida do servidor." quando a resposta 2xx não é JSON (ex.: HTML)', async () => {
      fetchSpy.mockResolvedValue(respostaTexto('<html><body>Página do proxy</body></html>', 200))

      const promessa = api.apiFetch('/ped/filiais')

      await expect(promessa).rejects.toBeInstanceOf(api.ApiError)
      await expect(promessa).rejects.not.toBeInstanceOf(SyntaxError)
      await expect(promessa).rejects.toMatchObject({
        status: 200,
        mensagem: 'Resposta inválida do servidor.',
      })
    })

    it('corpo de erro não-JSON (text/html) usa a mensagem padrão do status e deixa "dados" indefinido', async () => {
      fetchSpy.mockResolvedValue(respostaTexto('<html>Bad Gateway</html>', 500))

      const promessa = api.apiFetch('/ped/filiais')

      await expect(promessa).rejects.toBeInstanceOf(api.ApiError)
      const erro = (await promessa.catch((e: unknown) => e)) as InstanceType<typeof api.ApiError>
      expect(erro.status).toBe(500)
      expect(erro.mensagem).toBe('Erro interno do servidor. Tente novamente mais tarde.')
      expect(erro.dados).toBeUndefined()
    })
  })

  describe('cancelamento (AbortSignal)', () => {
    it('repassa o AbortError do fetch sem convertê-lo em ApiError', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError')
      fetchSpy.mockRejectedValue(abortError)
      const controlador = new AbortController()

      const promessa = api.apiFetch('/ped/filiais', { signal: controlador.signal })

      await expect(promessa).rejects.toBe(abortError)
      await expect(promessa).rejects.not.toBeInstanceOf(api.ApiError)
    })

    it('encaminha o signal informado ao fetch', async () => {
      fetchSpy.mockResolvedValue(respostaJson([]))
      const controlador = new AbortController()

      await api.apiFetch('/ped/filiais', { signal: controlador.signal })

      expect(obterInit(fetchSpy.mock.calls[0]).signal).toBe(controlador.signal)
    })
  })

  describe('sessão expirada (401)', () => {
    it('dispara o evento "sessao-expirada" em window quando a requisição autenticada recebe 401', async () => {
      const ouvinte = vi.fn()
      window.addEventListener('sessao-expirada', ouvinte)
      sessao.definirToken('token-vencido')
      fetchSpy.mockResolvedValue(respostaJson({ mensagem: 'Unauthenticated.' }, 401))

      await expect(api.apiFetch('/ped/acesso')).rejects.toMatchObject({ status: 401, mensagem: 'Unauthenticated.' })

      expect(ouvinte).toHaveBeenCalledTimes(1)
      window.removeEventListener('sessao-expirada', ouvinte)
    })

    it('expõe o nome do evento em EVENTO_SESSAO_EXPIRADA', () => {
      expect(api.EVENTO_SESSAO_EXPIRADA).toBe('sessao-expirada')
    })

    it('não dispara o evento em 401 de requisição sem token (ex.: login recusado)', async () => {
      const ouvinte = vi.fn()
      window.addEventListener('sessao-expirada', ouvinte)
      fetchSpy.mockResolvedValue(respostaJson({ mensagem: 'usuario ou senha invalidos' }, 401))

      await expect(
        api.apiFetch('/valida-usuario', { method: 'POST', body: { usuario: 'a', senha: 'b' } }),
      ).rejects.toMatchObject({ status: 401, mensagem: 'usuario ou senha invalidos' })

      expect(ouvinte).not.toHaveBeenCalled()
      window.removeEventListener('sessao-expirada', ouvinte)
    })

    it('não dispara o evento em outros erros', async () => {
      const ouvinte = vi.fn()
      window.addEventListener('sessao-expirada', ouvinte)
      sessao.definirToken('token')
      fetchSpy.mockResolvedValue(respostaJson({ mensagem: 'sem permissao' }, 403))

      await expect(api.apiFetch('/ped/usuarios')).rejects.toMatchObject({ status: 403 })

      expect(ouvinte).not.toHaveBeenCalled()
      window.removeEventListener('sessao-expirada', ouvinte)
    })
  })
})
