import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { type DadoExternoApiFalso, dadosExternosAdminApi, rotaListarDadosExternos } from '../../test/dadosExternosFalsos'
import type { IntegracaoDadoExterno } from '../../types/dominio'
import { useDadosExternos } from './useDadosExternos'

const ROTA = '/api/ped/dados-externos-cadastro'
const URL_NOVA = 'https://ti.exemplo.com.br/api/cobertura'
const SAIDA = '{ "valor": "0" }'
const ENTRADA = '{ "filial": "%filial%" }'

const INTEGRACAO: IntegracaoDadoExterno = {
  identificador: 'COBERTURA',
  url: URL_NOVA,
  parametrosSaida: SAIDA,
  parametrosEntrada: ENTRADA,
}

/**
 * `useDadosExternos.atualizarIntegracao(id, integracao)` (F5.16, botão Configurações): PUT
 * `.../{id}/integracao` e recarga da lista (a resposta não traz o dado). Não muda a situação.
 * Falha rejeita com a `ApiError` original, sem recarregar e sem mexer no `erro` de carga.
 */
describe('F5.16 — useDadosExternos.atualizarIntegracao (Configurações da integração)', () => {
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

  /** API com estado: o PUT grava a integração da Cobertura (id 2) na lista do GET. */
  function simular(resposta?: () => Response) {
    let lista = dadosExternosAdminApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`PUT ${ROTA}/2/integracao`]: (init) => {
        if (resposta) return resposta()
        const corpo = JSON.parse(String(init?.body)) as { url: string }
        lista = lista.map(
          (d): DadoExternoApiFalso =>
            d.id === 2 ? { ...d, url: corpo.url, 'integracao pendente': false, 'parametros de saida': { valor: '0' } } : d,
        )
        return respostaJson({ mensagem: 'integracao atualizada', 'variaveis usadas': ['filial'] })
      },
    })
  }

  async function montar(chamadas: ChamadaRegistrada[]) {
    const resultado = renderHook(() => useDadosExternos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('faz o PUT .../{id}/integracao com os quatro campos, resolve sem valor e recarrega a lista', async () => {
    const { result, chamadas } = await montar(simular())
    expect(gets(chamadas)).toHaveLength(1)

    let valor: unknown = 'nao chamado'
    await act(async () => {
      valor = await result.current.atualizarIntegracao(2, INTEGRACAO)
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.caminho).toBe(`${ROTA}/2/integracao`)
    expect(corpoDaChamada(put)).toEqual({
      identificador: 'COBERTURA',
      url: URL_NOVA,
      'parametros de saida': SAIDA,
      'parametros de entrada': ENTRADA,
    })
    expect(valor).toBeUndefined()
    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.dadosExternos.find((d) => d.id === 2)).toMatchObject({
      url: URL_NOVA,
      integracaoPendente: false,
      situacao: 'inativo',
    })
    expect(result.current.erro).toBeNull()
  })

  it('a recarga usa os filtros atuais (ex.: "Integração pendente (TI)" tira da lista o dado configurado)', async () => {
    const { result, chamadas } = await montar(simular())
    act(() => {
      result.current.setSituacao('integracao_pendente')
    })
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.id)).toEqual([2, 5]))

    await act(async () => {
      await result.current.atualizarIntegracao(2, INTEGRACAO)
    })

    expect(gets(chamadas).at(-1)?.url.searchParams.get('situacao')).toBe('integracao_pendente')
    expect(result.current.dadosExternos.map((d) => d.id)).toEqual([5])
  })

  it('falha (400 com erros) rejeita com a ApiError original, sem recarregar e sem mudar a lista nem o erro de carga', async () => {
    const corpo = { mensagem: 'integracao invalida: URL ...', erros: [{ campo: 'url', mensagem: 'URL invalida' }] }
    const { result, chamadas } = await montar(simular(() => respostaJson(corpo, 400)))
    const antes = result.current.dadosExternos

    let erro: unknown
    await act(async () => {
      erro = await result.current.atualizarIntegracao(2, INTEGRACAO).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'integracao invalida: URL ...', dados: corpo })
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.dadosExternos).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})
