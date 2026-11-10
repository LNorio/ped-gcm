import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  INDICADOR_TICKET_MEDIO_API,
  indicadoresComMetaPendenteApi,
  respostaSituacaoApi,
  rotaListarIndicadoresComMetaPendente,
} from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

/**
 * F6.10 — Filtro "Meta pendente por filial" no hook (API (26).md, `situacao=meta_filial_pendente`:
 * indicadores **ativos** com ao menos uma filial em "filiais sem meta").
 * - `setSituacao('meta_filial_pendente')` consulta na hora com a situação na query;
 * - as ações confirmadas pela API seguem a mesma regra local das demais situações: o item que deixa
 *   de corresponder ao filtro (ex.: inativado) sai da lista, sem nova consulta.
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.10 — useIndicadores: filtro "Meta pendente por filial"', () => {
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

  async function montar() {
    const lista = indicadoresComMetaPendenteApi()
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadoresComMetaPendente(() => lista),
      [`PUT ${ROTA}/8/situacao`]: () => respostaJson(respostaSituacaoApi({ ...INDICADOR_TICKET_MEDIO_API, ativo: false }, [])),
    })
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('setSituacao("meta_filial_pendente") consulta na hora com situacao=meta_filial_pendente e expõe só os pendentes', async () => {
    const { result, chamadas } = await montar()

    act(() => {
      result.current.setSituacao('meta_filial_pendente')
    })

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(gets(chamadas)[1].url.searchParams.get('situacao')).toBe('meta_filial_pendente')
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([8]))
    expect(result.current.filtros.situacao).toBe('meta_filial_pendente')
  })

  it('com o filtro aplicado, inativar o indicador pendente o tira da lista sem nova consulta', async () => {
    const { result, chamadas } = await montar()
    act(() => {
      result.current.setSituacao('meta_filial_pendente')
    })
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([8]))
    const consultasAntes = gets(chamadas).length

    await act(async () => {
      await result.current.alterarSituacao(8, false)
    })

    expect(result.current.indicadores).toEqual([])
    expect(gets(chamadas)).toHaveLength(consultasAntes)
  })
})
