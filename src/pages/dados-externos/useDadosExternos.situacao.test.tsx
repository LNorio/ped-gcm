import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { dadosExternosApi, rotaListarDadosExternos, type DadoExternoApiFalso } from '../../test/dadosExternosFalsos'
import { useDadosExternos } from './useDadosExternos'

const ROTA = '/api/ped/dados-externos-cadastro'

describe('F5.8 — useDadosExternos.alterarSituacao (ativar/desativar — RF-30)', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)

  function simular(falha?: () => Response) {
    const rotaSituacao = (id: number) => (init: RequestInit | undefined) => {
      if (falha) return falha()
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      const atual = dadosExternosApi().find((d) => d.id === id)!
      const atualizado: DadoExternoApiFalso = {
        ...atual,
        situacao: ativo ? 'ativo' : 'inativo',
        'situacao descricao': ativo ? 'Ativo' : 'Inativo',
        'situacao alterada em': '2026-11-04 10:30:00',
        'situacao alterada por': 'Beltrano',
      }
      return respostaJson(atualizado)
    }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDadosExternos(dadosExternosApi),
      [`PUT ${ROTA}/1/situacao`]: rotaSituacao(1),
      [`PUT ${ROTA}/2/situacao`]: rotaSituacao(2),
    })
  }

  async function montar(chamadas: ChamadaRegistrada[]) {
    const resultado = renderHook(() => useDadosExternos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('desativar faz PUT { ativo: false } e troca o item pela resposta, sem nova consulta', async () => {
    const { result, chamadas } = await montar(simular())

    let atualizado: Awaited<ReturnType<typeof result.current.alterarSituacao>> | undefined
    await act(async () => {
      atualizado = await result.current.alterarSituacao(1, false)
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.caminho).toBe(`${ROTA}/1/situacao`)
    expect(corpoDaChamada(put)).toEqual({ ativo: false })
    expect(atualizado).toMatchObject({ id: 1, situacao: 'inativo', situacaoAlteradaPor: 'Beltrano' })
    expect(result.current.dadosExternos.find((d) => d.id === 1)).toMatchObject({
      situacao: 'inativo',
      situacaoAlteradaEm: '2026-11-04 10:30:00',
    })
    expect(result.current.dadosExternos).toHaveLength(6)
    expect(gets(chamadas)).toHaveLength(1)
  })

  it('com o filtro "Ativos", o dado desativado sai da lista na hora', async () => {
    const { result } = await montar(simular())
    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.id)).toEqual([1, 5, 6]))

    await act(async () => {
      await result.current.alterarSituacao(1, false)
    })

    expect(result.current.dadosExternos.map((d) => d.id)).toEqual([5, 6])
  })

  it('com o filtro "Com problemas", o dado ativado sai da lista na hora', async () => {
    const { result } = await montar(simular())
    act(() => {
      result.current.setSituacao('problemas')
    })
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.id)).toEqual([2]))

    await act(async () => {
      await result.current.alterarSituacao(2, true)
    })

    expect(result.current.dadosExternos).toEqual([])
  })

  it('falha rejeita com a ApiError original sem alterar a lista', async () => {
    const { result } = await montar(simular(() => respostaErro(403, 'Apenas Admin e Validador alteram a situação.')))
    const antes = result.current.dadosExternos

    let erro: unknown
    await act(async () => {
      erro = await result.current.alterarSituacao(1, false).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 403 })
    expect(result.current.dadosExternos).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})
