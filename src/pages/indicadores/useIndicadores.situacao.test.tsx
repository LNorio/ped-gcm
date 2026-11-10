import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { indicadoresApi, respostaSituacaoApi, rotaListarIndicadores, type IndicadorApiFalso } from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.6 — useIndicadores.alterarSituacao (inativar/reativar — RF-38)', () => {
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
    let lista = indicadoresApi()
    const rotaSituacao = (id: number) => (init: RequestInit | undefined) => {
      if (falha) return falha()
      const { ativo } = JSON.parse(String(init?.body)) as { ativo: boolean }
      const atual = lista.find((i) => i.id === id)!
      const atualizado: IndicadorApiFalso = {
        ...atual,
        ativo,
        'situacao alterada em': '2026-11-05 10:30:00',
        'situacao alterada por': 'Beltrano',
      }
      lista = lista.map((i) => (i.id === id ? atualizado : i))
      return respostaJson(respostaSituacaoApi(atualizado))
    }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      [`PUT ${ROTA}/3/situacao`]: rotaSituacao(3),
      [`PUT ${ROTA}/4/situacao`]: rotaSituacao(4),
      [`PUT ${ROTA}/5/situacao`]: rotaSituacao(5),
      [`PUT ${ROTA}/6/situacao`]: rotaSituacao(6),
    })
  }

  async function montar(chamadas: ChamadaRegistrada[]) {
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('inativar faz PUT { ativo: false }, resolve { indicador, dashboardsAfetados } e troca o item pela resposta, sem nova consulta', async () => {
    const { result, chamadas } = await montar(simular())

    let resultado: Awaited<ReturnType<typeof result.current.alterarSituacao>> | undefined
    await act(async () => {
      resultado = await result.current.alterarSituacao(3, false)
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.caminho).toBe(`${ROTA}/3/situacao`)
    expect(corpoDaChamada(put)).toEqual({ ativo: false })
    expect(resultado?.indicador).toMatchObject({ id: 3, ativo: false, situacaoAlteradaPor: 'Beltrano' })
    expect(resultado?.dashboardsAfetados).toEqual([
      { id: 1, nome: 'PED Comercial', pontosBase: 60 },
      { id: 2, nome: 'PED Gerentes', pontosBase: 30 },
    ])
    expect(result.current.indicadores.find((i) => i.id === 3)).toMatchObject({ ativo: false, situacaoAlteradaEm: '2026-11-05 10:30:00' })
    expect(result.current.indicadores).toHaveLength(7)
    expect(gets(chamadas)).toHaveLength(1)
  })

  it('reativar envia { ativo: true } e troca o item', async () => {
    const { result, chamadas } = await montar(simular())

    await act(async () => {
      await result.current.alterarSituacao(5, true)
    })

    expect(corpoDaChamada(chamadas.find((c) => c.metodo === 'PUT')!)).toEqual({ ativo: true })
    expect(result.current.indicadores.find((i) => i.id === 5)?.ativo).toBe(true)
  })

  it('com o filtro "Ativos", o indicador inativado sai da lista na hora', async () => {
    const { result } = await montar(simular())
    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([1, 2, 3, 4, 6, 7]))

    await act(async () => {
      await result.current.alterarSituacao(3, false)
    })

    expect(result.current.indicadores.map((i) => i.id)).toEqual([1, 2, 4, 6, 7])
  })

  it('com o filtro "Inativos", o indicador reativado sai da lista na hora', async () => {
    const { result } = await montar(simular())
    act(() => {
      result.current.setSituacao('inativos')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([5]))

    await act(async () => {
      await result.current.alterarSituacao(5, true)
    })

    expect(result.current.indicadores).toEqual([])
  })

  it('com o filtro "Com problemas", inativar um indicador com componente desativado o tira da lista', async () => {
    const { result } = await montar(simular())
    act(() => {
      result.current.setSituacao('problemas')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([2, 6, 7]))

    await act(async () => {
      await result.current.alterarSituacao(6, false)
    })

    expect(result.current.indicadores.map((i) => i.id)).toEqual([2, 7])
  })

  it('com o filtro "Aguardando meta", inativar o automático sem meta o tira da lista', async () => {
    const { result } = await montar(simular())
    act(() => {
      result.current.setSituacao('meta')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([4]))

    await act(async () => {
      await result.current.alterarSituacao(4, false)
    })

    expect(result.current.indicadores).toEqual([])
  })

  it('os alertas acompanham a situação: inativar quem tem componente desativado ou meta a definir decrementa; reativar incrementa', async () => {
    const { result } = await montar(simular())
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3, metaPendentePorFilial: 0 })

    await act(async () => {
      await result.current.alterarSituacao(6, false)
    })
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 2, metaPendentePorFilial: 0 })

    await act(async () => {
      await result.current.alterarSituacao(4, false)
    })
    expect(result.current.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 2, metaPendentePorFilial: 0 })

    await act(async () => {
      await result.current.alterarSituacao(6, true)
    })
    expect(result.current.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 3, metaPendentePorFilial: 0 })
  })

  it('inativar um indicador sem problema nem meta pendente não muda os alertas', async () => {
    const { result } = await montar(simular())

    await act(async () => {
      await result.current.alterarSituacao(3, false)
    })

    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3, metaPendentePorFilial: 0 })
  })

  it('resposta 2xx sem o indicador (só { mensagem }): resolve { indicador: null, dashboardsAfetados: [] } e recarrega a lista', async () => {
    let lista = indicadoresApi()
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      [`PUT ${ROTA}/3/situacao`]: () => {
        lista = lista.map((i) => (i.id === 3 ? { ...i, ativo: false } : i))
        return respostaJson({ mensagem: 'situação alterada' })
      },
    })
    const { result } = await montar(chamadas)

    let resultado: Awaited<ReturnType<typeof result.current.alterarSituacao>> | undefined
    await act(async () => {
      resultado = await result.current.alterarSituacao(3, false)
    })

    expect(resultado).toEqual({ indicador: null, dashboardsAfetados: [] })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    await waitFor(() => expect(result.current.indicadores.find((i) => i.id === 3)?.ativo).toBe(false))
    expect(result.current.erro).toBeNull()
  })

  it('falha rejeita com a ApiError original sem alterar a lista nem os alertas', async () => {
    const { result } = await montar(simular(() => respostaErro(403, 'Apenas Admin e Validador alteram a situação.')))
    const antes = result.current.indicadores

    let erro: unknown
    await act(async () => {
      erro = await result.current.alterarSituacao(6, false).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 403 })
    expect(result.current.indicadores).toEqual(antes)
    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3, metaPendentePorFilial: 0 })
    expect(result.current.erro).toBeNull()
  })
})
