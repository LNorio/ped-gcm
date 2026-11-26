import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import { tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { useTipos } from './useTipos'

const DEPARTAMENTO_PESSOAL_API: TipoApontamentoApiFalso = {
  id: 8,
  nome: 'Departamento Pessoal',
  origem: 'Personalizado',
  'quantidade usuarios': 3,
  'quantidade apontamentos': 0,
  grupos: [{ id: 4, nome: 'DEF_OPERADOR DE CAIXA' }],
  usuarios: [],
}

describe('F3.4 — Cadastro de tipo personalizado: releitura do acesso depois de criar (useTipos.criar)', () => {
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

  /** API com estado: o POST acrescenta "Departamento Pessoal" à lista; `rotaPost` substitui a resposta. */
  function simular(rotaPost?: RotaFalsa) {
    let lista: TipoApontamentoApiFalso[] = tiposApi()
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(lista),
      'POST /api/ped/tipos-apontamento': (init, url) => {
        if (rotaPost) return rotaPost(init, url)
        lista = [...lista, { ...DEPARTAMENTO_PESSOAL_API }]
        return respostaJson(DEPARTAMENTO_PESSOAL_API, 201)
      },
    })
    const posts = () => chamadas.filter((c) => c.metodo === 'POST')
    return { chamadas, posts }
  }

  function renderizarComSessao(recarregarAcesso: () => Promise<void> = vi.fn().mockResolvedValue(undefined)) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProvedorSessaoFalso sessao={{ recarregarAcesso }}>{children}</ProvedorSessaoFalso>
    )
    const hook = renderHook(() => useTipos(), { wrapper })
    return { ...hook, recarregarAcesso }
  }

  it('POST com sucesso chama recarregarAcesso() da sessão uma vez, depois do POST', async () => {
    const { posts } = simular()
    const postsNaChamada: number[] = []
    const recarregarAcesso = vi.fn(async () => {
      postsNaChamada.push(posts().length)
    })
    const { result } = renderizarComSessao(recarregarAcesso)
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(recarregarAcesso).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.criar({ nome: 'Departamento Pessoal', grupos: [4], usuarios: [] })
    })

    await waitFor(() => expect(recarregarAcesso).toHaveBeenCalledTimes(1))
    expect(recarregarAcesso).toHaveBeenCalledWith()
    expect(postsNaChamada).toEqual([1])
  })

  it('POST 2xx só com { mensagem } ("2xx = gravado") também chama recarregarAcesso()', async () => {
    const { posts } = simular(() => respostaJson({ mensagem: 'tipo cadastrado' }, 201))
    const recarregarAcesso = vi.fn().mockResolvedValue(undefined)
    const { result } = renderizarComSessao(recarregarAcesso)
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.criar({ nome: 'Departamento Pessoal', grupos: [4], usuarios: [] })
    })

    expect(posts()).toHaveLength(1)
    await waitFor(() => expect(recarregarAcesso).toHaveBeenCalledTimes(1))
  })

  it.each([
    ['400 da API', () => respostaErro(400, 'informe ao menos um grupo ou usuario')],
    ['403 da API', () => respostaErro(403, 'Sem permissão.')],
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as Array<[string, RotaFalsa]>)('%s no POST: rejeita e não chama recarregarAcesso()', async (_caso, falha) => {
    simular(falha)
    const recarregarAcesso = vi.fn().mockResolvedValue(undefined)
    const { result } = renderizarComSessao(recarregarAcesso)
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let rejeitou = false
    await act(async () => {
      await result.current.criar({ nome: 'Departamento Pessoal', grupos: [4], usuarios: [] }).catch(() => {
        rejeitou = true
      })
    })

    expect(rejeitou).toBe(true)
    expect(recarregarAcesso).not.toHaveBeenCalled()
  })

  it('sem SessaoProvider (hook isolado), criar continua funcionando: POST, recarga da lista e resolve sem erro', async () => {
    simular()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let erro: unknown = null
    await act(async () => {
      await result.current.criar({ nome: 'Departamento Pessoal', grupos: [4], usuarios: [] }).catch((e: unknown) => {
        erro = e
      })
    })

    expect(erro).toBeNull()
    await waitFor(() => expect(result.current.tipos).toHaveLength(10))
  })
})
