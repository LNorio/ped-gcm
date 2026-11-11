import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  DADO_DEVOLUCOES_API,
  type DadoExternoApiFalso,
  dadosExternosApi,
  respostaConclusaoApi,
  rotaListarDadosExternos,
} from '../../test/dadosExternosFalsos'
import type { IntegracaoDadoExterno } from '../../types/dominio'
import { useDadosExternos } from './useDadosExternos'

const ROTA = '/api/ped/dados-externos-cadastro'
const URL_CONSULTA = 'https://ti.exemplo.com.br/api/devolucoes'
/** Saída por "chave: tipo" (11/11/2026). */
const SAIDA = '{ "codfil": "string", "vlrLiq": "number" }'
const ENTRADA = '{ "filial": "%filial%" }'

/** Integração informada na modal (contrato de 09/11/2026: os quatro campos vão no PUT). */
function integracao(identificador: string): IntegracaoDadoExterno {
  return {
    identificador,
    url: URL_CONSULTA,
    parametrosSaida: SAIDA,
    parametrosEntrada: ENTRADA,
    mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null },
  }
}
const CONCLUIDO = {
  ...DADO_DEVOLUCOES_API,
  situacao: 'ativo' as const,
  'situacao descricao': 'Ativo',
  identificador: 'DEVOLUCOES',
  'coleta disponivel': true,
}

describe('F5.7 — useDadosExternos.concluir (concluir construção — RF-28)', () => {
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

  function simular(aoConcluir: () => Response = () => respostaJson(respostaConclusaoApi(CONCLUIDO, { id: 30, nome: 'Devoluções de venda' }))) {
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDadosExternos(dadosExternosApi),
      [`PUT ${ROTA}/3/concluir`]: aoConcluir,
    })
  }

  async function montar(chamadas: ChamadaRegistrada[]) {
    const resultado = renderHook(() => useDadosExternos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('concluir(id, integracao) faz o PUT com os quatro campos, troca o item na lista sem nova consulta e resolve com { dadoExterno, indicadorCriado }', async () => {
    const { result, chamadas } = await montar(simular())

    let resposta: Awaited<ReturnType<typeof result.current.concluir>> | undefined
    await act(async () => {
      resposta = await result.current.concluir(3, integracao('devolucoes'))
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.caminho).toBe(`${ROTA}/3/concluir`)
    expect(corpoDaChamada(put)).toEqual({
      identificador: 'DEVOLUCOES',
      url: URL_CONSULTA,
      'parametros de saida': SAIDA,
      'parametros de entrada': ENTRADA,
      'campo da filial': 'codfil',
      'campo do valor': 'vlrLiq',
    })
    expect(resposta?.indicadorCriado).toEqual({ id: 30, nome: 'Devoluções de venda' })
    expect(resposta?.dadoExterno).toMatchObject({ id: 3, situacao: 'ativo', identificador: 'DEVOLUCOES' })
    const item = result.current.dadosExternos.find((d) => d.id === 3)
    expect(item).toMatchObject({ situacao: 'ativo', identificador: 'DEVOLUCOES' })
    expect(result.current.dadosExternos).toHaveLength(6)
    expect(gets(chamadas)).toHaveLength(1)
  })

  it('com o filtro "Em construção", o dado concluído sai da lista na hora', async () => {
    const { result, chamadas } = await montar(simular())
    act(() => {
      result.current.setSituacao('construcao')
    })
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.id)).toEqual([3, 4]))

    await act(async () => {
      await result.current.concluir(3, integracao('DEVOLUCOES'))
    })

    expect(result.current.dadosExternos.map((d) => d.id)).toEqual([4])
    expect(gets(chamadas)).toHaveLength(2)
  })

  it('falha rejeita com a ApiError original sem alterar a lista nem o erro de carga', async () => {
    const { result } = await montar(simular(() => respostaErro(400, 'Identificador sem coleta cadastrada.')))
    const antes = result.current.dadosExternos

    let erro: unknown
    await act(async () => {
      erro = await result.current.concluir(3, integracao('XPTO')).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'Identificador sem coleta cadastrada.' })
    expect(result.current.dadosExternos).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})

describe('F5.7 — useDadosExternos.concluir com 2xx sem o dado na resposta (resolve null)', () => {
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

  /** API com estado: o PUT conclui o dado 3 na lista do GET, mas responde com `resposta`. */
  function simularConclusaoSemItem(resposta: () => Response) {
    let lista = dadosExternosApi()
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`PUT ${ROTA}/3/concluir`]: (init) => {
        const { identificador } = JSON.parse(String(init?.body)) as { identificador: string }
        lista = lista.map((d): DadoExternoApiFalso =>
          d.id === 3 ? { ...d, situacao: 'ativo', 'situacao descricao': 'Ativo', identificador, 'coleta disponivel': true } : d,
        )
        return resposta()
      },
    })
  }

  async function montar(resposta: () => Response) {
    const chamadas = simularConclusaoSemItem(resposta)
    const resultado = renderHook(() => useDadosExternos())
    await waitFor(() => expect(resultado.result.current.carregando).toBe(false))
    return { ...resultado, chamadas }
  }

  it('resposta 2xx só com { mensagem } resolve null, sem erro', async () => {
    const { result } = await montar(() => respostaJson({ mensagem: 'Construção concluída.' }))

    let valor: unknown = 'nao chamado'
    await act(async () => {
      valor = await result.current.concluir(3, integracao('devolucoes'))
    })

    expect(valor).toBeNull()
    expect(result.current.erro).toBeNull()
  })

  it('com null, recarrega a lista: nova consulta e o dado aparece ativo, com o identificador gravado', async () => {
    const { result, chamadas } = await montar(() => respostaJson({ mensagem: 'Construção concluída.' }))
    expect(gets(chamadas)).toHaveLength(1)

    await act(async () => {
      await result.current.concluir(3, integracao('devolucoes'))
    })

    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.dadosExternos.find((d) => d.id === 3)).toMatchObject({ situacao: 'ativo', identificador: 'DEVOLUCOES' })
    expect(result.current.erro).toBeNull()
  })

  it('200 com corpo vazio resolve null, sem erro, e recarrega a lista', async () => {
    const { result, chamadas } = await montar(() => new Response('', { status: 200 }))

    let valor: unknown = 'nao chamado'
    await act(async () => {
      valor = await result.current.concluir(3, integracao('DEVOLUCOES'))
    })

    expect(valor).toBeNull()
    expect(gets(chamadas)).toHaveLength(2)
    expect(result.current.dadosExternos.find((d) => d.id === 3)).toMatchObject({ situacao: 'ativo' })
  })

  it('com o filtro "Em construção", a recarga tira da lista o dado concluído', async () => {
    const { result } = await montar(() => respostaJson({ mensagem: 'Construção concluída.' }))
    act(() => {
      result.current.setSituacao('construcao')
    })
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.id)).toEqual([3, 4]))

    await act(async () => {
      await result.current.concluir(3, integracao('DEVOLUCOES'))
    })

    expect(result.current.dadosExternos.map((d) => d.id)).toEqual([4])
  })

  it('erro 400 rejeita com ApiError e não recarrega a lista', async () => {
    const { result, chamadas } = await montar(() => respostaErro(400, 'Identificador sem coleta cadastrada.'))

    let erro: unknown
    await act(async () => {
      erro = await result.current.concluir(3, integracao('XPTO')).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'Identificador sem coleta cadastrada.' })
    expect(gets(chamadas)).toHaveLength(1)
  })
})
