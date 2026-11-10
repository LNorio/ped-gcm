import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  INDICADOR_TICKET_MEDIO_API,
  aplicarMetasPendentesApi,
  indicadoresComMetaPendenteApi,
  respostaErrosPorFilial,
  respostaMetasPendentesApi,
  rotaListarIndicadoresComMetaPendente,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

/**
 * F6.12 — "Definir metas pendentes" no hook da aba:
 * `definirMetasPendentes(id, metas: MetaDaFilial[]): Promise<ResultadoMetasPendentes>` faz o
 * `PUT .../{id}/metas-filiais` e, depois de qualquer 2xx, recarrega a lista com os filtros atuais
 * (as filiais sem meta e os alertas vêm da API). Falhas rejeitam com a `ApiError` original, sem
 * recarregar e sem mexer no `erro` de carga.
 * Lista: padrão (7) + Ticket médio (id 8; 101 e 102 pendentes) + Margem bruta (completa).
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.12 — useIndicadores: definir metas pendentes', () => {
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

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET')
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT')

  async function montar(aoDefinir?: () => Response) {
    let lista: IndicadorApiFalso[] = indicadoresComMetaPendenteApi()
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadoresComMetaPendente(() => lista),
      [`PUT ${ROTA}/8/metas-filiais`]: (init) => {
        if (aoDefinir) return aoDefinir()
        const corpo = JSON.parse(String(init?.body)) as { 'metas por filial': { filial: string; meta: number }[] }
        lista = lista.map((i) => (i.id === 8 ? aplicarMetasPendentesApi(i, corpo['metas por filial']) : i))
        const ticket = lista.find((i) => i.id === 8)!
        return respostaJson(respostaMetasPendentesApi(corpo['metas por filial'].map((m) => m.filial), ticket['filiais sem meta'] ?? []))
      },
    })
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('faz o PUT com as metas, recarrega a lista e devolve o resultado da API', async () => {
    const { result, chamadas } = await montar()
    expect(result.current.alertas.metaPendentePorFilial).toBe(1)

    let resultado: unknown
    await act(async () => {
      resultado = await result.current.definirMetasPendentes(8, [{ filial: '101', meta: 980 }])
    })

    expect(puts(chamadas)).toHaveLength(1)
    expect(puts(chamadas)[0].caminho).toBe(`${ROTA}/8/metas-filiais`)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({ 'metas por filial': [{ filial: '101', meta: 980 }] })
    expect(resultado).toEqual({ filiaisDefinidas: ['101'], filiaisSemMeta: ['102'] })
    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.indicadores.find((i) => i.id === 8)).toMatchObject({ filiaisSemMeta: ['102'] })
    expect(result.current.alertas.metaPendentePorFilial).toBe(1)
  })

  it('ao definir todas as pendentes, a recarga zera a pendência do indicador e o alerta', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.definirMetasPendentes(8, [
        { filial: '101', meta: 980 },
        { filial: '102', meta: 1200.5 },
      ])
    })

    expect(result.current.indicadores.find((i) => i.id === 8)).toMatchObject({ filiaisSemMeta: [] })
    expect(result.current.alertas.metaPendentePorFilial).toBe(0)
  })

  it('recarrega com os filtros atuais (situacao=meta_filial_pendente): o indicador completo sai da lista', async () => {
    const { result, chamadas } = await montar()
    act(() => {
      result.current.setSituacao('meta_filial_pendente')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([8]))

    await act(async () => {
      await result.current.definirMetasPendentes(8, [
        { filial: '101', meta: 980 },
        { filial: '102', meta: 1200.5 },
      ])
    })

    expect(gets(chamadas).at(-1)!.url.searchParams.get('situacao')).toBe('meta_filial_pendente')
    expect(result.current.indicadores).toEqual([])
  })

  it('2xx sem corpo também recarrega a lista', async () => {
    const { result, chamadas } = await montar(() => new Response(null, { status: 204 }))

    await act(async () => {
      await result.current.definirMetasPendentes(8, [{ filial: '101', meta: 980 }])
    })

    expect(gets(chamadas)).toHaveLength(2)
  })

  it.each([
    ['400 com erros por filial', () => respostaErrosPorFilial([{ filial: '101', mensagem: 'a filial 101 ja tem meta' }]), 400],
    ['404', () => respostaErro(404, 'indicador nao encontrado'), 404],
    ['403', () => respostaErro(403, 'sem permissao'), 403],
  ])('falha (%s): rejeita com a ApiError, sem recarregar e sem mexer no erro de carga', async (_caso, resposta, status) => {
    const { result, chamadas } = await montar(resposta)
    const idsAntes = result.current.indicadores.map((i) => i.id)

    let falha: unknown
    await act(async () => {
      falha = await result.current.definirMetasPendentes(8, [{ filial: '101', meta: 980 }]).catch((erro: unknown) => erro)
    })

    expect(falha).toBeInstanceOf(ApiError)
    expect(falha).toMatchObject({ status })
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.erro).toBeNull()
    expect(result.current.indicadores.map((i) => i.id)).toEqual(idsAntes)
    expect(result.current.indicadores.find((i) => i.id === 8)).toMatchObject({ filiaisSemMeta: INDICADOR_TICKET_MEDIO_API['filiais sem meta'] })
  })
})
