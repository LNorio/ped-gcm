import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  INDICADOR_META_API_PENDENTE_API,
  META_VIA_API_COMPLETA,
  indicadoresComFonteDaMetaApi,
  respostaIndicadorApi,
  rotaListarIndicadoresComFonteDaMeta,
  tarefaMetaApi,
  type MetaViaApiDisponivelApiFalsa,
} from '../../test/indicadoresFalsos'
import { useIndicadores } from './useIndicadores'

/**
 * F6.11 — Contrato final da meta via API no hook da aba Indicadores (RESPOSTA-FINAL-meta-via-api.md,
 * seção 2.4 — 10/11/2026).
 * - `metaViaApi`: o `"meta via api"` do topo da última listagem (`{ dadoExterno, integracao }`); `null`
 *   antes da primeira resposta e quando a API não traz o campo.
 * - `setSituacao('integracao_pendente')` consulta na hora com `situacao=integracao_pendente` e expõe só
 *   os indicadores da fonte `integracao` com a integração pendente.
 * - `criar` resolve com o indicador da resposta, inclusive a `tarefaBitrix` (fonte `integracao`).
 */
const ROTA = '/api/ped/indicadores-cadastro'

describe('F6.11 — useIndicadores: fonte da meta, "meta via api" e filtro de integração pendente', () => {
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

  function simular(metaViaApi?: MetaViaApiDisponivelApiFalsa | null) {
    let lista = indicadoresComFonteDaMetaApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadoresComFonteDaMeta(() => lista, metaViaApi),
      [`POST ${ROTA}`]: () => {
        const criado = {
          ...INDICADOR_META_API_PENDENTE_API,
          id: 30,
          nome: 'Atingimento de faturamento',
          tarefa: tarefaMetaApi('[PED] Integração da meta: Atingimento de faturamento', 4600),
        }
        lista = [...lista, criado]
        return respostaJson(respostaIndicadorApi(criado), 201)
      },
    })
  }

  async function montar(chamadas: ChamadaRegistrada[]) {
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('metaViaApi traz o "meta via api" do topo da listagem (fase 1: integracao false)', async () => {
    const { result } = await montar(simular())

    expect(result.current.metaViaApi).toEqual({ dadoExterno: true, integracao: false })
  })

  it('metaViaApi acompanha a resposta mais recente', async () => {
    const { result } = await montar(simular(META_VIA_API_COMPLETA))

    expect(result.current.metaViaApi).toEqual({ dadoExterno: true, integracao: true })
  })

  it('sem "meta via api" na resposta, metaViaApi é null', async () => {
    const { result } = await montar(simular(null))

    expect(result.current.metaViaApi).toBeNull()
  })

  it('os indicadores trazem fonteDaMeta e situacaoDaMetaViaApi', async () => {
    const { result } = await montar(simular())

    expect(result.current.indicadores.find((i) => i.id === 12)).toMatchObject({ fonteDaMeta: 'dado_externo', situacaoDaMetaViaApi: 'ok' })
    expect(result.current.indicadores.find((i) => i.id === 14)).toMatchObject({
      fonteDaMeta: 'integracao',
      situacaoDaMetaViaApi: 'aguardando_consulta',
    })
  })

  it('setSituacao("integracao_pendente") consulta na hora com situacao=integracao_pendente e expõe só os da fonte integracao pendentes', async () => {
    const { result, chamadas } = await montar(simular())

    act(() => {
      result.current.setSituacao('integracao_pendente')
    })

    await waitFor(() => expect(gets(chamadas).at(-1)?.url.searchParams.get('situacao')).toBe('integracao_pendente'))
    await waitFor(() => expect(result.current.indicadores.map((i) => i.id)).toEqual([10]))
    expect(result.current.filtros.situacao).toBe('integracao_pendente')
  })

  it('criar (fonte integracao) resolve com o indicador e a tarefa do Bitrix da resposta', async () => {
    const { result } = await montar(simular())

    let criado: Awaited<ReturnType<typeof result.current.criar>> = null
    await act(async () => {
      criado = await result.current.criar({
        nome: 'Atingimento de faturamento',
        descricao: null,
        origemDaMeta: 'terceiro',
        fonteDaMeta: 'integracao',
        sentido: 'maior_melhor',
        metaEditavel: false,
        dadoExterno: 1,
      })
    })

    expect(criado).toMatchObject({ id: 30, fonteDaMeta: 'integracao', tarefaBitrix: { id: 4600 } })
  })
})
