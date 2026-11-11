import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  ENTRADA_META_VIA_API,
  INDICADOR_DEVOLUCOES_API,
  SAIDA_META_VIA_API,
  URL_META_VIA_API,
  indicadoresComMetaViaApiApi,
  integracaoMetaPendenteApi,
  respostaIndicadorApi,
  rotaListarIndicadoresComIntegracao,
  mapeamentoDoCorpoApi,
  type CorpoIntegracaoIndicadorApiFalso,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import type { IntegracaoDadoExterno } from '../../types/dominio'
import { useIndicadores } from './useIndicadores'

/**
 * F6.11 — Meta buscada via API no hook da aba Indicadores.
 * - `atualizarIntegracao(id, integracao)`: `PUT .../{id}/integracao` e recarga da lista com os filtros
 *   atuais (os alertas passam a vir da nova consulta); falha rejeita com a `ApiError` sem recarregar.
 * - `definirMeta(id, { origemDaMeta: 'terceiro', ... })`: depois do PUT, recarrega a lista (o indicador
 *   passa a ter a integração pendente e o alerta `integracaoPendente` vem da API).
 */
const ROTA = '/api/ped/indicadores-cadastro'
const SAIDA = JSON.stringify(SAIDA_META_VIA_API, null, 2)
const ENTRADA = JSON.stringify(ENTRADA_META_VIA_API, null, 2)

const INTEGRACAO: IntegracaoDadoExterno = {
  identificador: 'META_FATURAMENTO',
  url: URL_META_VIA_API,
  parametrosSaida: SAIDA,
  parametrosEntrada: ENTRADA,
  // Saída por "chave: tipo" (11/11/2026): mapeamento escolhido na modal.
  mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null },
}

describe('F6.11 — useIndicadores: integração da meta via API', () => {
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

  interface Opcoes {
    aoAtualizar?: () => Response
    aoDefinir?: () => Response
  }

  /** API com estado: o PUT .../integracao grava a integração e tira a pendência; o PUT .../meta (terceiro) deixa a integração pendente. */
  function simular(opcoes: Opcoes = {}) {
    let lista = indicadoresComMetaViaApiApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarIndicadoresComIntegracao(() => lista),
      [`PUT ${ROTA}/10/integracao`]: (init) => {
        if (opcoes.aoAtualizar) return opcoes.aoAtualizar()
        const corpo = JSON.parse(String(init?.body)) as CorpoIntegracaoIndicadorApiFalso
        lista = lista.map(
          (i): IndicadorApiFalso =>
            i.id === 10
              ? {
                  ...i,
                  identificador: corpo.identificador,
                  url: corpo.url,
                  'parametros de saida': JSON.parse(corpo['parametros de saida']) as unknown,
                  'parametros de entrada': JSON.parse(corpo['parametros de entrada']) as unknown,
                  'mapeamento da saida': mapeamentoDoCorpoApi(corpo),
                  'integracao pendente': false,
                }
              : i,
        )
        return respostaJson({ mensagem: 'integracao atualizada', 'variaveis usadas': ['competencia', 'empresas'] })
      },
      [`PUT ${ROTA}/4/meta`]: () => {
        if (opcoes.aoDefinir) return opcoes.aoDefinir()
        const atualizado: IndicadorApiFalso = {
          ...INDICADOR_DEVOLUCOES_API,
          sentido: 'maior_melhor',
          'sentido descricao': 'Maior é melhor',
          'meta a definir': false,
          'origem da meta': 'terceiro',
          ...integracaoMetaPendenteApi(),
        }
        lista = lista.map((i) => (i.id === 4 ? atualizado : i))
        return respostaJson(respostaIndicadorApi(atualizado))
      },
    })
  }

  async function montar(chamadas: ChamadaRegistrada[]) {
    const resultado = renderHook(() => useIndicadores())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('a listagem traz alertas.integracaoPendente vindo da API', async () => {
    const { result } = await montar(simular())

    expect(result.current.alertas.integracaoPendente).toBe(1)
    expect(result.current.indicadores.find((i) => i.id === 10)?.integracao?.pendente).toBe(true)
  })

  it('atualizarIntegracao faz PUT .../{id}/integracao e recarrega a lista (a pendência e o alerta somem)', async () => {
    const { result, chamadas } = await montar(simular())
    const consultasAntes = gets(chamadas).length

    await act(async () => {
      await result.current.atualizarIntegracao(10, INTEGRACAO)
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.caminho).toBe(`${ROTA}/10/integracao`)
    expect(corpoDaChamada(put)).toEqual({
      identificador: 'META_FATURAMENTO',
      url: URL_META_VIA_API,
      'parametros de saida': SAIDA,
      'parametros de entrada': ENTRADA,
      'campo da filial': 'codfil',
      'campo da meta': 'metVlr',
    })
    expect(gets(chamadas).length).toBe(consultasAntes + 1)
    expect(result.current.indicadores.find((i) => i.id === 10)?.integracao).toMatchObject({
      pendente: false,
      url: URL_META_VIA_API,
      mapeamentoSaida: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null },
    })
    expect(result.current.alertas.integracaoPendente).toBe(0)
  })

  it('atualizarIntegracao recarrega com os filtros atuais', async () => {
    const { result, chamadas } = await montar(simular())
    act(() => {
      result.current.setSituacao('ativos')
    })
    await waitFor(() => expect(gets(chamadas).at(-1)?.url.searchParams.get('situacao')).toBe('ativos'))
    await waitFor(() => expect(result.current.carregando).toBe(false))

    await act(async () => {
      await result.current.atualizarIntegracao(10, INTEGRACAO)
    })

    expect(gets(chamadas).at(-1)?.url.searchParams.get('situacao')).toBe('ativos')
  })

  it('falha (400) rejeita com a ApiError original, sem recarregar nem mexer no erro de carga', async () => {
    const { result, chamadas } = await montar(
      simular({ aoAtualizar: () => respostaJson({ mensagem: 'integracao invalida', erros: [{ campo: 'url', mensagem: 'url invalida' }] }, 400) }),
    )
    const consultasAntes = gets(chamadas).length

    let falha: unknown
    await act(async () => {
      falha = await result.current.atualizarIntegracao(10, INTEGRACAO).catch((e: unknown) => e)
    })

    expect(falha).toBeInstanceOf(ApiError)
    expect(falha).toMatchObject({ status: 400, mensagem: 'integracao invalida' })
    expect(gets(chamadas).length).toBe(consultasAntes)
    expect(result.current.erro).toBeNull()
    expect(result.current.indicadores.find((i) => i.id === 10)?.integracao?.pendente).toBe(true)
  })

  it('falha 500 rejeita com a ApiError', async () => {
    const { result } = await montar(simular({ aoAtualizar: () => respostaErro(500) }))

    let falha: unknown
    await act(async () => {
      falha = await result.current.atualizarIntegracao(10, INTEGRACAO).catch((e: unknown) => e)
    })

    expect(falha).toMatchObject({ status: 500 })
  })

  it('definirMeta com origemDaMeta "terceiro" envia o corpo da meta via API e recarrega a lista (alerta integracaoPendente da API)', async () => {
    const { result, chamadas } = await montar(simular())
    const consultasAntes = gets(chamadas).length
    expect(result.current.alertas.integracaoPendente).toBe(1)

    await act(async () => {
      await result.current.definirMeta(4, { origemDaMeta: 'terceiro', sentido: 'maior_melhor', metaEditavel: false })
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(corpoDaChamada(put)).toEqual({ 'origem da meta': 'terceiro', 'fonte da meta': 'integracao', sentido: 'maior_melhor', 'meta editavel': false })
    expect(gets(chamadas).length).toBe(consultasAntes + 1)
    expect(result.current.indicadores.find((i) => i.id === 4)).toMatchObject({
      origemDaMeta: 'terceiro',
      metaADefinir: false,
      integracao: { pendente: true },
    })
    expect(result.current.alertas.integracaoPendente).toBe(2)
    expect(result.current.alertas.aguardandoMeta).toBe(0)
  })
})
