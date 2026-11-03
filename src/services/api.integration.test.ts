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

function cabecalho(chamada: unknown[], nome: string): string | null {
  const entrada = chamada[0]
  if (entrada instanceof Request) return entrada.headers.get(nome)
  return new Headers((chamada[1] as RequestInit | undefined)?.headers).get(nome)
}

describe('F1.2 — Cliente HTTP + sessão (integração)', () => {
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

  it('fluxo completo: login sem token, chamadas autenticadas com Bearer e sessão expirada ao receber 401', async () => {
    const ouvinteSessaoExpirada = vi.fn()
    window.addEventListener(api.EVENTO_SESSAO_EXPIRADA, ouvinteSessaoExpirada)

    // 1. Login: ainda não há token, então nenhum Authorization é enviado.
    fetchSpy.mockResolvedValueOnce(respostaJson({ token: 'abc123' }))
    const login = await api.apiFetch<{ token: string }>('/valida-usuario', {
      method: 'POST',
      body: { usuario: 'fulano', senha: 'segredo' },
    })
    expect(login.token).toBe('abc123')
    expect(cabecalho(fetchSpy.mock.calls[0], 'Authorization')).toBeNull()

    // 2. Com o token guardado, as chamadas seguintes vão autenticadas.
    sessao.definirToken(login.token)
    fetchSpy.mockResolvedValueOnce(
      respostaJson({
        'id colaborador': 12,
        nome: 'Fulano',
        perfil: 'preenchedor',
        tipos: [{ id: 1, nome: 'Comercial' }],
        'todas as filiais': false,
        filiais: [{ filial: '101', 'nome filial': 'CAMPO GRANDE' }],
        'periodo aberto': '2026-10-01',
      }),
    )
    const acesso = await api.apiFetch<{ perfil: string }>('/ped/acesso')
    expect(acesso.perfil).toBe('preenchedor')
    expect(cabecalho(fetchSpy.mock.calls[1], 'Authorization')).toBe('Bearer abc123')
    expect(ouvinteSessaoExpirada).not.toHaveBeenCalled()

    // 3. O token vence: a API responde 401, o cliente lança ApiError e avisa a aplicação.
    fetchSpy.mockResolvedValueOnce(respostaJson({ mensagem: 'Unauthenticated.' }, 401))
    await expect(api.apiFetch('/ped/apontamentos')).rejects.toMatchObject({
      status: 401,
      mensagem: 'Unauthenticated.',
    })
    expect(ouvinteSessaoExpirada).toHaveBeenCalledTimes(1)

    // 4. Ao limpar a sessão, as chamadas voltam a sair sem Authorization.
    sessao.limparToken()
    fetchSpy.mockResolvedValueOnce(respostaJson([]))
    await api.apiFetch('/ped/filiais')
    expect(cabecalho(fetchSpy.mock.calls[3], 'Authorization')).toBeNull()

    window.removeEventListener(api.EVENTO_SESSAO_EXPIRADA, ouvinteSessaoExpirada)
  })

  it('erro de validação da API chega à aplicação com a mensagem exibível ao usuário', async () => {
    sessao.definirToken('abc123')
    fetchSpy.mockResolvedValueOnce(
      respostaJson({ mensagem: 'a soma dos pontos base excede a pontuacao maxima em 10' }, 400),
    )

    let mensagemExibida = ''
    try {
      await api.apiFetch('/ped/dashboards', { method: 'POST', body: { nome: 'PED Comercial' } })
    } catch (erro) {
      mensagemExibida = erro instanceof api.ApiError ? erro.mensagem : 'Erro desconhecido'
    }

    expect(mensagemExibida).toBe('a soma dos pontos base excede a pontuacao maxima em 10')
  })

  it('exclusão com 204 e ação com 200 sem corpo: a aplicação segue sem resultado e sem erro', async () => {
    sessao.definirToken('abc123')

    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(api.apiFetch('/ped/apontamentos/5', { method: 'DELETE' })).resolves.toBeUndefined()

    fetchSpy.mockResolvedValueOnce(new Response('', { status: 200 }))
    await expect(api.apiFetch('/ped/sincronizar-erp', { method: 'POST' })).resolves.toBeUndefined()

    expect(cabecalho(fetchSpy.mock.calls[0], 'Authorization')).toBe('Bearer abc123')
    expect(cabecalho(fetchSpy.mock.calls[1], 'Authorization')).toBe('Bearer abc123')
  })

  it('proxy devolve HTML com status 200: a aplicação recebe ApiError com mensagem exibível, não um SyntaxError', async () => {
    sessao.definirToken('abc123')
    fetchSpy.mockResolvedValueOnce(
      new Response('<!doctype html><html><body>Servidor indisponível</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    )

    let mensagemExibida = ''
    try {
      await api.apiFetch('/ped/filiais')
    } catch (erro) {
      mensagemExibida = erro instanceof api.ApiError ? erro.mensagem : 'Erro desconhecido'
    }

    expect(mensagemExibida).toBe('Resposta inválida do servidor.')
  })

  it('servidor fora do ar: a aplicação recebe a mensagem de conexão em pt-BR', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(api.apiFetch('/ped/filiais')).rejects.toMatchObject({
      status: 0,
      mensagem: 'Não foi possível conectar ao servidor.',
    })
  })
})
