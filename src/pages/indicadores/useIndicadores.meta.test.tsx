import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  INDICADOR_DEVOLUCOES_API,
  indicadoresApi,
  respostaIndicadorApi,
  rotaListarIndicadores,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

const ROTA = '/api/ped/indicadores-cadastro'

const COM_META: IndicadorApiFalso = {
  ...INDICADOR_DEVOLUCOES_API,
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  meta: 2500,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': true,
}

describe('F6.5 — useIndicadores.definirMeta (meta do indicador automático — RF-36)', () => {
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

  function simular(aoDefinir: () => Response = () => respostaJson(respostaIndicadorApi(COM_META))) {
    let lista = indicadoresApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      [`PUT ${ROTA}/4/meta`]: () => {
        lista = lista.map((i) => (i.id === 4 ? COM_META : i))
        return aoDefinir()
      },
    })
  }

  async function montar(chamadas: ChamadaRegistrada[]) {
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('definirMeta faz PUT .../{id}/meta e troca o item pela resposta, sem nova consulta', async () => {
    const { result, chamadas } = await montar(simular())

    let atualizado: Awaited<ReturnType<typeof result.current.definirMeta>> | undefined
    await act(async () => {
      atualizado = await result.current.definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.caminho).toBe(`${ROTA}/4/meta`)
    expect(corpoDaChamada(put)).toEqual({ meta: 2500, sentido: 'maior_melhor', 'meta editavel': true })
    expect(atualizado).toMatchObject({ id: 4, meta: 2500, metaADefinir: false, metaEditavel: true })
    expect(result.current.indicadores.find((i) => i.id === 4)).toMatchObject({ meta: 2500, sentido: 'maior_melhor', metaADefinir: false })
    expect(result.current.indicadores).toHaveLength(7)
    expect(gets(chamadas)).toHaveLength(1)
  })

  it('o alerta "aguardando meta" é decrementado localmente ao definir a meta', async () => {
    const { result } = await montar(simular())
    expect(result.current.alertas.aguardandoMeta).toBe(1)

    await act(async () => {
      await result.current.definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })
    })

    expect(result.current.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 3, metaPendentePorFilial: 0 })
  })

  it('com o filtro "Aguardando meta", o indicador com meta definida sai da lista na hora', async () => {
    const { result } = await montar(simular())
    act(() => {
      result.current.setSituacao('meta')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([4]))

    await act(async () => {
      await result.current.definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })
    })

    expect(result.current.indicadores).toEqual([])
  })

  it('resposta 2xx sem o indicador (só { mensagem }): resolve null e recarrega a lista', async () => {
    const { result, chamadas } = await montar(simular(() => respostaJson({ mensagem: 'meta definida' })))

    let atualizado: unknown = 'nao-resolvido'
    await act(async () => {
      atualizado = await result.current.definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true })
    })

    expect(atualizado).toBeNull()
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    await waitFor(() => expect(result.current.indicadores.find((i) => i.id === 4)).toMatchObject({ meta: 2500, metaADefinir: false }))
    expect(result.current.alertas.aguardandoMeta).toBe(0)
    expect(result.current.erro).toBeNull()
  })

  it('falha (400: meta já definida) rejeita com a ApiError original sem alterar a lista nem os alertas', async () => {
    const { result } = await montar(simular(() => respostaErro(400, 'A meta deste indicador já foi definida.')))
    const antes = result.current.indicadores

    let erro: unknown
    await act(async () => {
      erro = await result.current.definirMeta(4, { meta: 2500, sentido: 'maior_melhor', metaEditavel: true }).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'A meta deste indicador já foi definida.' })
    expect(result.current.indicadores).toEqual(antes)
    expect(result.current.alertas.aguardandoMeta).toBe(1)
    expect(result.current.erro).toBeNull()
  })
})
