import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, MENSAGEM_SEM_CONEXAO } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../../test/apiFalsa'
import { TIPOS_FIXOS_API, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { useTipos } from './useTipos'

const COMERCIAL_API = TIPOS_FIXOS_API[0]

/** Comercial depois do PUT { grupos: [9] }: só os grupos mudam; usuários e demais campos ficam. */
const COMERCIAL_ATUALIZADO_API: TipoApontamentoApiFalso = {
  ...COMERCIAL_API,
  'quantidade usuarios': 2,
  grupos: [{ id: 9, nome: 'DEF_ANALISTA FINANCEIRO' }],
}

describe('F3.5 — useTipos.atualizar(id, dados) (edição dos vínculos de um tipo)', () => {
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

  /** API com estado: o PUT troca o tipo na lista do GET; `respostaPut` define o corpo do 2xx. */
  function simularApiComEstado(opcoes: { respostaPut?: () => Response; falhaPut?: () => Response | Promise<Response> } = {}) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      [`PUT /api/ped/tipos-apontamento/${COMERCIAL_API.id}`]: () => {
        if (opcoes.falhaPut) return opcoes.falhaPut()
        lista = lista.map((tipo) => (tipo.id === COMERCIAL_API.id ? { ...COMERCIAL_ATUALIZADO_API } : tipo))
        return opcoes.respostaPut ? opcoes.respostaPut() : respostaJson(COMERCIAL_ATUALIZADO_API)
      },
    })
    const listagens = () => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/tipos-apontamento')
    const puts = () => chamadas.filter((c) => c.metodo === 'PUT')
    return { listagens, puts }
  }

  it('chama PUT /api/ped/tipos-apontamento/{id} só com as listas informadas e o token da sessão', async () => {
    const { puts } = simularApiComEstado()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.atualizar(COMERCIAL_API.id, { grupos: [9] })
    })

    expect(puts()).toHaveLength(1)
    expect(puts()[0].caminho).toBe(`/api/ped/tipos-apontamento/${COMERCIAL_API.id}`)
    expect(corpoDaChamada(puts()[0])).toEqual({ grupos: [9] })
    expect(cabecalhoDaChamada(puts()[0], 'Authorization')).toBe('Bearer token-123')
  })

  it('com o tipo na resposta, substitui o item na mesma posição, sem novo GET, e resolve sem valor', async () => {
    const { listagens } = simularApiComEstado()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let retorno: unknown = 'nao-resolvido'
    await act(async () => {
      retorno = await result.current.atualizar(COMERCIAL_API.id, { grupos: [9] })
    })

    expect(retorno).toBeUndefined()
    expect(result.current.tipos).toHaveLength(9)
    expect(result.current.tipos[0]).toMatchObject({
      id: 1,
      nome: 'Comercial',
      grupos: [{ id: 9, nome: 'DEF_ANALISTA FINANCEIRO' }],
      usuarios: [{ id: 12, nome: 'Fulano' }],
    })
    expect(result.current.tipos[1].nome).toBe('Financeiro')
    expect(listagens()).toHaveLength(1)
  })

  it('2xx sem tipo reconhecível ("2xx = gravado") recarrega a lista e mostra o tipo como gravado no servidor', async () => {
    const { listagens } = simularApiComEstado({ respostaPut: () => respostaJson({ mensagem: 'tipo atualizado' }) })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    await act(async () => {
      await result.current.atualizar(COMERCIAL_API.id, { grupos: [9] })
    })

    await waitFor(() => expect(listagens()).toHaveLength(2))
    await waitFor(() => expect(result.current.tipos[0].grupos).toEqual([{ id: 9, nome: 'DEF_ANALISTA FINANCEIRO' }]))
    expect(result.current.erro).toBeNull()
  })

  it('erro da API rejeita com a ApiError original, sem alterar a lista nem o erro de carga', async () => {
    const { listagens } = simularApiComEstado({ falhaPut: () => respostaErro(403, 'Sem permissão.') })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))
    const antes = result.current.tipos

    let erro: unknown
    await act(async () => {
      erro = await result.current.atualizar(COMERCIAL_API.id, { grupos: [9] }).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 403, mensagem: 'Sem permissão.' })
    expect(result.current.tipos).toEqual(antes)
    expect(result.current.erro).toBeNull()
    expect(listagens()).toHaveLength(1)
  })

  it('falha de rede rejeita com ApiError status 0', async () => {
    simularApiComEstado({ falhaPut: () => Promise.reject(new TypeError('Failed to fetch')) })
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let erro: unknown
    await act(async () => {
      erro = await result.current.atualizar(COMERCIAL_API.id, { usuarios: [] }).catch((e: unknown) => e)
    })

    expect(erro).toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
  })
})
