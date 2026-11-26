import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import { TIPOS_FIXOS_API, tiposApi, type TipoApontamentoApiFalso } from '../../test/tiposFalsos'
import { useTipos } from './useTipos'

const COMERCIAL_API = TIPOS_FIXOS_API[0]
const COMERCIAL_ATUALIZADO_API: TipoApontamentoApiFalso = {
  ...COMERCIAL_API,
  'quantidade usuarios': 2,
  grupos: [{ id: 9, nome: 'DEF_ANALISTA FINANCEIRO' }],
}

describe('F3.5 — Edição dos vínculos de um tipo: releitura do acesso depois de atualizar (useTipos.atualizar)', () => {
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

  function simular(rotaPut: RotaFalsa = () => respostaJson(COMERCIAL_ATUALIZADO_API)) {
    const chamadas = simularApi(fetchFalso, {
      'GET /api/ped/tipos-apontamento': () => respostaJson(tiposApi()),
      [`PUT /api/ped/tipos-apontamento/${COMERCIAL_API.id}`]: rotaPut,
    })
    const puts = () => chamadas.filter((c) => c.metodo === 'PUT')
    return { chamadas, puts }
  }

  function renderizarComSessao(recarregarAcesso: () => Promise<void> = vi.fn().mockResolvedValue(undefined)) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProvedorSessaoFalso sessao={{ recarregarAcesso }}>{children}</ProvedorSessaoFalso>
    )
    const hook = renderHook(() => useTipos(), { wrapper })
    return { ...hook, recarregarAcesso }
  }

  it('PUT com o tipo na resposta: chama recarregarAcesso() uma vez, depois do PUT', async () => {
    const { puts } = simular()
    const putsNaChamada: number[] = []
    const recarregarAcesso = vi.fn(async () => {
      putsNaChamada.push(puts().length)
    })
    const { result } = renderizarComSessao(recarregarAcesso)
    await waitFor(() => expect(result.current.carregando).toBe(false))
    expect(recarregarAcesso).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.atualizar(COMERCIAL_API.id, { usuarios: [12, 30] })
    })

    await waitFor(() => expect(recarregarAcesso).toHaveBeenCalledTimes(1))
    expect(putsNaChamada).toEqual([1])
  })

  it('PUT 2xx sem o tipo ("2xx = gravado", lista recarregada) também chama recarregarAcesso()', async () => {
    simular(() => respostaJson({ mensagem: 'tipo atualizado' }))
    const recarregarAcesso = vi.fn().mockResolvedValue(undefined)
    const { result } = renderizarComSessao(recarregarAcesso)
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.atualizar(COMERCIAL_API.id, { grupos: [9] })
    })

    await waitFor(() => expect(recarregarAcesso).toHaveBeenCalledTimes(1))
  })

  it.each([
    ['400 da API', () => respostaErro(400, 'informe ao menos um grupo ou usuario')],
    ['403 da API', () => respostaErro(403, 'Sem permissão.')],
    ['falha de rede', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as Array<[string, RotaFalsa]>)('%s no PUT: rejeita e não chama recarregarAcesso()', async (_caso, falha) => {
    simular(falha)
    const recarregarAcesso = vi.fn().mockResolvedValue(undefined)
    const { result } = renderizarComSessao(recarregarAcesso)
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let rejeitou = false
    await act(async () => {
      await result.current.atualizar(COMERCIAL_API.id, { grupos: [9] }).catch(() => {
        rejeitou = true
      })
    })

    expect(rejeitou).toBe(true)
    expect(recarregarAcesso).not.toHaveBeenCalled()
  })

  it('sem SessaoProvider (hook isolado), atualizar continua funcionando e resolve sem erro', async () => {
    simular()
    const { result } = renderHook(() => useTipos())
    await waitFor(() => expect(result.current.tipos).toHaveLength(9))

    let erro: unknown = null
    await act(async () => {
      await result.current.atualizar(COMERCIAL_API.id, { grupos: [9] }).catch((e: unknown) => {
        erro = e
      })
    })

    expect(erro).toBeNull()
    expect(result.current.tipos[0].grupos).toEqual([{ id: 9, nome: 'DEF_ANALISTA FINANCEIRO' }])
  })
})
