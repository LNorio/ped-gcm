import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { usuarioRapido } from '../test/usuario'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESSAO_EXPIRADA, apiFetch } from '../services/api'
import { limparToken, obterToken } from '../services/sessao'
import { FILIAIS_API, acessoApi, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { SessaoProvider, useSessao } from './SessaoProvider'

const MENSAGEM_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre novamente.'
const MENSAGEM_SEM_CONEXAO = 'Não foi possível conectar ao servidor.'
const MENSAGEM_ERRO_500 = 'Erro interno do servidor. Tente novamente mais tarde.'

/** Componente de apoio que expõe o estado da sessão e dispara as ações. */
function Consumidor() {
  const sessao = useSessao()
  const filial =
    sessao.filialSelecionada === 'todas'
      ? 'todas'
      : sessao.filialSelecionada === null
        ? ''
        : sessao.filialSelecionada.codigo
  return (
    <div>
      <output aria-label="Estado">{sessao.estado}</output>
      <output aria-label="Nome">{sessao.acesso?.nome ?? ''}</output>
      <output aria-label="Perfil">{sessao.acesso?.perfil ?? ''}</output>
      <output aria-label="Erro">{sessao.erro ?? ''}</output>
      <output aria-label="Filial">{filial}</output>
      <button
        type="button"
        onClick={() => {
          sessao.entrar('fulano', 'segredo').catch(() => {})
        }}
      >
        Entrar
      </button>
      <button type="button" onClick={() => sessao.sair()}>
        Sair
      </button>
      <button type="button" onClick={() => sessao.selecionarFilial('102')}>
        Escolher 102
      </button>
      <button type="button" onClick={() => sessao.selecionarFilial('todas')}>
        Escolher todas
      </button>
    </div>
  )
}

function renderizar() {
  return render(
    <SessaoProvider>
      <Consumidor />
    </SessaoProvider>,
  )
}

const estado = () => screen.getByRole('status', { name: 'Estado' })
const nome = () => screen.getByRole('status', { name: 'Nome' })
const erro = () => screen.getByRole('status', { name: 'Erro' })
const filial = () => screen.getByRole('status', { name: 'Filial' })

describe('F2.1 — Autenticação e sessão (SessaoProvider / useSessao)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('useSessao fora do SessaoProvider lança erro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useSessao())).toThrow(/SessaoProvider/)
  })

  describe('ao montar', () => {
    it('sem token salvo fica "anonimo", sem acesso e sem chamar a API', () => {
      renderizar()

      expect(estado()).toHaveTextContent('anonimo')
      expect(nome()).toHaveTextContent('')
      expect(erro()).toHaveTextContent('')
      expect(filial()).toHaveTextContent('')
      expect(fetchFalso).not.toHaveBeenCalled()
    })

    it('com token salvo começa "carregando", chama GET /api/ped/acesso e fica "autenticado"', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      const chamadas = simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      })

      renderizar()

      expect(estado()).toHaveTextContent('carregando')
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))
      expect(nome()).toHaveTextContent('Fulano')
      expect(screen.getByRole('status', { name: 'Perfil' })).toHaveTextContent('admin')
      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].caminho).toBe('/api/ped/acesso')
      expect(new Headers(chamadas[0].init?.headers).get('Authorization')).toBe('Bearer token-salvo')
    })

    it('com token salvo e perfil null fica "sem-acesso", mantendo o acesso devolvido', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: null, tipos: [], filiais: [] })),
      })

      renderizar()

      await waitFor(() => expect(estado()).toHaveTextContent('sem-acesso'))
      expect(nome()).toHaveTextContent('Fulano')
    })

    it('com token recusado (401) fica "anonimo" e limpa o token', async () => {
      sessionStorage.setItem('ped.token', 'token-vencido')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaErro(401),
      })

      renderizar()

      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('com 403 ao obter o acesso fica "anonimo" e limpa o token', async () => {
      sessionStorage.setItem('ped.token', 'token-sem-plataforma')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaErro(403, 'Usuário sem acesso à plataforma.'),
      })

      renderizar()

      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('com 403 ao obter o acesso expõe em erro a mensagem devolvida pela API', async () => {
      sessionStorage.setItem('ped.token', 'token-sem-plataforma')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaErro(403, 'Usuário sem acesso à plataforma.'),
      })

      renderizar()

      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(erro()).toHaveTextContent('Usuário sem acesso à plataforma.')
      expect(nome()).toHaveTextContent('')
    })

    it('com falha de rede (status 0) ao restaurar fica "anonimo", limpa o token e expõe a mensagem de conexão', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      renderizar()

      expect(estado()).toHaveTextContent('carregando')
      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(erro()).toHaveTextContent(MENSAGEM_SEM_CONEXAO)
      expect(nome()).toHaveTextContent('')
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('com erro 5xx ao restaurar fica "anonimo", limpa o token e expõe a mensagem padrão do status', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaErro(500),
      })

      renderizar()

      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(erro()).toHaveTextContent(MENSAGEM_ERRO_500)
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('com erro 5xx que traz {mensagem} no corpo expõe a mensagem da API', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaErro(503, 'Serviço em manutenção.'),
      })

      renderizar()

      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(erro()).toHaveTextContent('Serviço em manutenção.')
    })

    it('em <StrictMode> com token salvo termina "autenticado" sem erro e sem avisos no console', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      })

      render(
        <StrictMode>
          <SessaoProvider>
            <Consumidor />
          </SessaoProvider>
        </StrictMode>,
      )

      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))
      expect(nome()).toHaveTextContent('Fulano')
      expect(erro()).toHaveTextContent('')
      expect(filial()).toHaveTextContent('todas')
      expect(obterToken()).toBe('token-salvo')
      expect(consoleErro).not.toHaveBeenCalled()
    })

    it('desmontar enquanto obterAcesso está pendente não gera erro nem aviso de setState', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      sessionStorage.setItem('ped.token', 'token-salvo')
      let responder: (resposta: Response) => void = () => {}
      fetchFalso.mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            responder = resolve
          }),
      )
      const { unmount } = renderizar()
      expect(estado()).toHaveTextContent('carregando')

      unmount()
      await act(async () => {
        responder(respostaJson(acessoApi()))
        await Promise.resolve()
      })

      expect(consoleErro).not.toHaveBeenCalled()
      // Nada foi concluído pelo provider desmontado: o token salvo permanece intacto.
      expect(sessionStorage.getItem('ped.token')).toBe('token-salvo')
    })

    it('desmontar enquanto obterAcesso está pendente e a chamada falha depois não gera erro nem limpa o token', async () => {
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {})
      sessionStorage.setItem('ped.token', 'token-salvo')
      let falhar: (erro: unknown) => void = () => {}
      fetchFalso.mockImplementation(
        () =>
          new Promise<Response>((_resolve, reject) => {
            falhar = reject
          }),
      )
      const { unmount } = renderizar()

      unmount()
      await act(async () => {
        falhar(new TypeError('Failed to fetch'))
        await Promise.resolve()
      })

      expect(consoleErro).not.toHaveBeenCalled()
      expect(sessionStorage.getItem('ped.token')).toBe('token-salvo')
    })
  })

  describe('entrar', () => {
    it('com credenciais válidas guarda o token, obtém o acesso e fica "autenticado" sem erro', async () => {
      const user = usuarioRapido()
      const chamadas = simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
        'GET /api/ped/acesso': () => respostaJson(acessoApi()),
      })
      renderizar()

      await user.click(screen.getByRole('button', { name: 'Entrar' }))

      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))
      expect(nome()).toHaveTextContent('Fulano')
      expect(erro()).toHaveTextContent('')
      expect(obterToken()).toBe('token-123')
      expect(chamadas.map((chamada) => `${chamada.metodo} ${chamada.caminho}`)).toEqual([
        'POST /api/valida-usuario',
        'GET /api/ped/acesso',
      ])
      expect(new Headers(chamadas[1].init?.headers).get('Authorization')).toBe('Bearer token-123')
    })

    it('com credenciais inválidas rejeita com a mensagem da API, expõe a mensagem em erro e continua "anonimo"', async () => {
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaErro(401, 'Usuário ou senha inválidos.'),
      })
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })

      await act(async () => {
        await expect(result.current.entrar('fulano', 'errada')).rejects.toMatchObject({
          mensagem: 'Usuário ou senha inválidos.',
        })
      })

      expect(result.current.estado).toBe('anonimo')
      expect(result.current.erro).toBe('Usuário ou senha inválidos.')
      expect(result.current.acesso).toBeNull()
      expect(obterToken()).toBeNull()
    })

    it('com login válido mas perfil null fica "sem-acesso"', async () => {
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => respostaJson({ token: 'token-123' }),
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: null, tipos: [], filiais: [] })),
      })
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })

      await act(async () => {
        await result.current.entrar('fulano', 'segredo')
      })

      expect(result.current.estado).toBe('sem-acesso')
      expect(result.current.acesso?.perfil).toBeNull()
    })

    it('limpa o erro de uma tentativa anterior ao entrar com sucesso', async () => {
      let tentativas = 0
      simularApi(fetchFalso, {
        'POST /api/valida-usuario': () => {
          tentativas += 1
          return tentativas === 1 ? respostaErro(401, 'Usuário ou senha inválidos.') : respostaJson({ token: 'token-123' })
        },
        'GET /api/ped/acesso': () => respostaJson(acessoApi()),
      })
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })

      await act(async () => {
        await result.current.entrar('fulano', 'errada').catch(() => {})
      })
      expect(result.current.erro).toBe('Usuário ou senha inválidos.')

      await act(async () => {
        await result.current.entrar('fulano', 'segredo')
      })

      expect(result.current.erro).toBeNull()
      expect(result.current.estado).toBe('autenticado')
    })
  })

  describe('filial selecionada', () => {
    it('usuário com todas as filiais começa em "todas" e pode escolher uma filial ou voltar a "todas"', async () => {
      const user = usuarioRapido()
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
      })
      renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))

      expect(filial()).toHaveTextContent('todas')

      await user.click(screen.getByRole('button', { name: 'Escolher 102' }))
      expect(filial()).toHaveTextContent('102')

      await user.click(screen.getByRole('button', { name: 'Escolher todas' }))
      expect(filial()).toHaveTextContent('todas')
    })

    it('usuário com uma única filial começa nela', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ filiais: [FILIAIS_API[1]] })),
      })
      renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))

      expect(filial()).toHaveTextContent('101')
    })

    it('usuário com várias filiais (sem todas) começa na primeira da lista e pode trocar entre elas', async () => {
      const user = usuarioRapido()
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ filiais: [FILIAIS_API[1], FILIAIS_API[2]] })),
      })
      renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))

      expect(filial()).toHaveTextContent('101')

      await user.click(screen.getByRole('button', { name: 'Escolher 102' }))
      expect(filial()).toHaveTextContent('102')
    })

    it('selecionarFilial expõe o objeto Filial completo (código e nome)', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ filiais: [FILIAIS_API[1], FILIAIS_API[2]] })),
      })
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })
      await waitFor(() => expect(result.current.estado).toBe('autenticado'))

      act(() => result.current.selecionarFilial('102'))

      expect(result.current.filialSelecionada).toEqual({ codigo: '102', nome: 'DOURADOS', empresa: null })
    })

    it('selecionarFilial com código inexistente na lista do usuário mantém a filial atual', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi({ filiais: [FILIAIS_API[1], FILIAIS_API[2]] })),
      })
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })
      await waitFor(() => expect(result.current.estado).toBe('autenticado'))
      expect(result.current.filialSelecionada).toEqual({ codigo: '101', nome: 'CAMPO GRANDE', empresa: null })

      act(() => result.current.selecionarFilial('999'))

      expect(result.current.filialSelecionada).toEqual({ codigo: '101', nome: 'CAMPO GRANDE', empresa: null })
      expect(result.current.estado).toBe('autenticado')
    })

    it('selecionarFilial("todas") para usuário sem todas as filiais mantém a filial atual', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () =>
          respostaJson(acessoApi({ 'todas as filiais': false, filiais: [FILIAIS_API[1], FILIAIS_API[2]] })),
      })
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })
      await waitFor(() => expect(result.current.estado).toBe('autenticado'))

      act(() => result.current.selecionarFilial('todas'))

      expect(result.current.filialSelecionada).toEqual({ codigo: '101', nome: 'CAMPO GRANDE', empresa: null })
    })

    it('selecionarFilial sem acesso (sessão anônima) não altera nada', () => {
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })
      expect(result.current.estado).toBe('anonimo')

      act(() => result.current.selecionarFilial('101'))
      act(() => result.current.selecionarFilial('todas'))

      expect(result.current.filialSelecionada).toBeNull()
      expect(result.current.acesso).toBeNull()
      expect(result.current.estado).toBe('anonimo')
      expect(result.current.erro).toBeNull()
      expect(fetchFalso).not.toHaveBeenCalled()
    })
  })

  describe('sair e sessão expirada', () => {
    it('sair limpa o token (memória e sessionStorage), o acesso e a filial, e volta a "anonimo" sem erro', async () => {
      const user = usuarioRapido()
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi()),
      })
      renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))

      await user.click(screen.getByRole('button', { name: 'Sair' }))

      expect(estado()).toHaveTextContent('anonimo')
      expect(nome()).toHaveTextContent('')
      expect(filial()).toHaveTextContent('')
      expect(erro()).toHaveTextContent('')
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('evento "sessao-expirada" durante sessão autenticada encerra a sessão e expõe "Sua sessão expirou. Entre novamente." em erro', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi()),
      })
      renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))

      act(() => {
        window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
      })

      expect(estado()).toHaveTextContent('anonimo')
      expect(nome()).toHaveTextContent('')
      expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
      expect(obterToken()).toBeNull()
      expect(sessionStorage.getItem('ped.token')).toBeNull()
    })

    it('um 401 em chamada autenticada (apiFetch) encerra a sessão pelo evento do cliente HTTP', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi()),
        'GET /api/ped/tipos-apontamento': () => respostaErro(401),
      })
      renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))

      await act(async () => {
        await apiFetch('/ped/tipos-apontamento').catch(() => {})
      })

      await waitFor(() => expect(estado()).toHaveTextContent('anonimo'))
      expect(erro()).toHaveTextContent(MENSAGEM_SESSAO_EXPIRADA)
    })

    it('um 401 tardio (evento "sessao-expirada") depois de sair deliberadamente não expõe "Sua sessão expirou"', async () => {
      const user = usuarioRapido()
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi()),
      })
      renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))

      await user.click(screen.getByRole('button', { name: 'Sair' }))
      expect(estado()).toHaveTextContent('anonimo')

      act(() => {
        window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
      })

      expect(estado()).toHaveTextContent('anonimo')
      expect(erro()).toHaveTextContent('')
      expect(obterToken()).toBeNull()
    })

    it('o evento "sessao-expirada" com a sessão já anônima (nunca autenticada) mantém erro nulo', () => {
      const { result } = renderHook(() => useSessao(), { wrapper: SessaoProvider })
      expect(result.current.estado).toBe('anonimo')

      act(() => {
        window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
      })

      expect(result.current.estado).toBe('anonimo')
      expect(result.current.erro).toBeNull()
    })

    it('deixa de ouvir o evento ao desmontar', async () => {
      sessionStorage.setItem('ped.token', 'token-salvo')
      simularApi(fetchFalso, {
        'GET /api/ped/acesso': () => respostaJson(acessoApi()),
      })
      const { unmount } = renderizar()
      await waitFor(() => expect(estado()).toHaveTextContent('autenticado'))
      const removerOuvinte = vi.spyOn(window, 'removeEventListener')

      unmount()

      expect(removerOuvinte).toHaveBeenCalledWith(EVENTO_SESSAO_EXPIRADA, expect.any(Function))
    })
  })
})
