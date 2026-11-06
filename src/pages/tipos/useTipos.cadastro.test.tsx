import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { useTipos } from './useTipos'

/** Tipo que a API "grava" no POST. */
const COMPRAS_API: TipoApontamentoApiFalso = {
  id: 10,
  nome: 'Compras',
  origem: 'Personalizado',
  'quantidade usuarios': 37,
  'quantidade apontamentos': 0,
  grupos: [{ id: 4, nome: 'DEF_OPERADOR DE CAIXA' }],
  usuarios: [],
}

describe('F3.4 — useTipos.criar(dados) (cadastro de tipo personalizado)', () => {
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

  /**
   * API com estado: o POST acrescenta o tipo à lista devolvida pelo GET. `respostaPost` define o corpo
   * do 2xx (padrão: o tipo na raiz).
   */
  function simularApiComEstado(opcoes: { respostaPost?: () => Response; falhaPost?: () => Response | Promise<Response> } = {}) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'POST /api/ped/tipos-apontamento': () => {
        if (opcoes.falhaPost) return opcoes.falhaPost()
        lista = [...lista, { ...COMPRAS_API }]
        return opcoes.respostaPost ? opcoes.respostaPost() : respostaJson(COMPRAS_API, 201)
      },
    })
    const listagens = () => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/tipos-apontamento')
    const posts = () => chamadas.filter((c) => c.metodo === 'POST')
    return { chamadas, listagens, posts }
  }

  it('chama POST /api/ped/tipos-apontamento com { nome, grupos, usuarios } e o token da sessão', async () => {
    const { posts } = simularApiComEstado()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.criar({ nome: 'Compras', grupos: [4], usuarios: [12] })
    })

    expect(posts()).toHaveLength(1)
    expect(corpoDaChamada(posts()[0])).toEqual({ nome: 'Compras', grupos: [4], usuarios: [12] })
    expect(cabecalhoDaChamada(posts()[0], 'Authorization')).toBe('Bearer token-123')
  })

  it('com sucesso, recarrega a lista (novo GET) e o tipo criado passa a constar em tipos; resolve sem valor', async () => {
    const { listagens } = simularApiComEstado()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let retorno: unknown = 'nao-resolvido'
    await act(async () => {
      retorno = await result.current.criar({ nome: 'Compras', grupos: [4], usuarios: [] })
    })

    expect(retorno).toBeUndefined()
    await waitFor(() => expect(result.current.tipos).toHaveLength(10))
    expect(listagens()).toHaveLength(2)
    expect(result.current.tipos.at(-1)).toMatchObject({ id: 10, nome: 'Compras', grupos: [{ id: 4, nome: 'DEF_OPERADOR DE CAIXA' }] })
    expect(result.current.erro).toBeNull()
  })

  it('2xx sem tipo reconhecível ("2xx = gravado") também recarrega a lista, sem erro', async () => {
    const { listagens } = simularApiComEstado({ respostaPost: () => respostaJson({ mensagem: 'tipo cadastrado' }, 201) })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    await act(async () => {
      await result.current.criar({ nome: 'Compras', grupos: [4], usuarios: [] })
    })

    await waitFor(() => expect(result.current.tipos).toHaveLength(10))
    expect(listagens()).toHaveLength(2)
    expect(result.current.tipos.map((tipo) => tipo.nome)).toContain('Compras')
  })

  it('400 da API rejeita com a ApiError original, sem recarregar nem alterar tipos ou erro', async () => {
    const { listagens } = simularApiComEstado({
      falhaPost: () => respostaErro(400, 'informe ao menos um grupo ou usuario'),
    })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let erro: unknown
    await act(async () => {
      erro = await result.current.criar({ nome: 'Compras', grupos: [], usuarios: [] }).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'informe ao menos um grupo ou usuario' })
    expect(result.current.tipos).toHaveLength(9)
    expect(result.current.erro).toBeNull()
    expect(listagens()).toHaveLength(1)
  })

  it('falha de rede rejeita com ApiError status 0, sem alterar a lista', async () => {
    simularApiComEstado({ falhaPost: () => Promise.reject(new TypeError('Failed to fetch')) })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let erro: unknown
    await act(async () => {
      erro = await result.current.criar({ nome: 'Compras', grupos: [4], usuarios: [] }).catch((e: unknown) => e)
    })

    expect(erro).toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    expect(result.current.tipos).toHaveLength(9)
  })
})
