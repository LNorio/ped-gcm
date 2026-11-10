import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import {
  INDICADOR_DEVOLUCOES_API,
  INDICADOR_TICKET_MEDIO_API,
  indicadoresComMetasPorFilialApi,
  respostaIndicadorApi,
  respostaSituacaoApi,
  rotaListarIndicadoresComMetas,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

/**
 * F6.10 — Meta por filial no hook da aba: o alerta `metaPendentePorFilial` vem da API e é ajustado
 * localmente pelas ações (como os demais alertas): conta indicadores **ativos** com alguma filial sem meta.
 * Lista: padrão (7) + Ticket médio (ativo, 2 filiais sem meta) + Margem bruta (metas completas).
 */
const ROTA = '/api/ped/indicadores-cadastro'

/** Devoluções (automático) com a meta definida só para a filial 101: 100 e 102 ficam pendentes. */
const DEVOLUCOES_COM_META_NA_101: IndicadorApiFalso = {
  ...INDICADOR_DEVOLUCOES_API,
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  'meta a definir': false,
  'origem da meta': 'manual',
  'metas por filial': [
    { filial: '100', 'nome filial': 'MATRIZ', meta: null },
    { filial: '101', 'nome filial': 'CAMPO GRANDE', meta: 2500 },
    { filial: '102', 'nome filial': 'DOURADOS', meta: null },
  ],
  'filiais sem meta': ['100', '102'],
}

describe('F6.10 — useIndicadores: alerta de meta pendente por filial', () => {
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

  function simular() {
    const lista = indicadoresComMetasPorFilialApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadoresComMetas(() => lista),
      [`PUT ${ROTA}/4/meta`]: () => respostaJson(respostaIndicadorApi(DEVOLUCOES_COM_META_NA_101)),
      [`PUT ${ROTA}/8/situacao`]: () => respostaJson(respostaSituacaoApi({ ...INDICADOR_TICKET_MEDIO_API, ativo: false }, [])),
      [`DELETE ${ROTA}/8`]: () => new Response(null, { status: 204 }),
    })
  }

  async function montar() {
    simular()
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return resultado
  }

  it('expõe metaPendentePorFilial vindo da API junto dos demais alertas', async () => {
    const { result } = await montar()

    expect(result.current.alertas).toEqual({ aguardandoMeta: 1, comComponenteDesativado: 3, metaPendentePorFilial: 1 })
    expect(result.current.indicadores.find((i) => i.id === 8)).toMatchObject({ filiaisSemMeta: ['101', '102'] })
  })

  it('definir a meta só para uma filial (outras pendentes) incrementa metaPendentePorFilial e zera "aguardando meta"', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.definirMeta(4, { sentido: 'maior_melhor', metaEditavel: false, metasPorFilial: [{ filial: '101', meta: 2500 }] })
    })

    expect(result.current.alertas).toEqual({ aguardandoMeta: 0, comComponenteDesativado: 3, metaPendentePorFilial: 2 })
    expect(result.current.indicadores.find((i) => i.id === 4)).toMatchObject({ filiaisSemMeta: ['100', '102'] })
  })

  it('inativar o indicador com filiais sem meta decrementa metaPendentePorFilial (só ativos contam)', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.alterarSituacao(8, false)
    })

    expect(result.current.alertas.metaPendentePorFilial).toBe(0)
  })

  it('excluir o indicador com filiais sem meta decrementa metaPendentePorFilial', async () => {
    const { result } = await montar()

    await act(async () => {
      await result.current.excluir(8)
    })

    expect(result.current.alertas.metaPendentePorFilial).toBe(0)
  })
})
