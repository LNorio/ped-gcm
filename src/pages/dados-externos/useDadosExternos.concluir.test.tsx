import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  DADO_DEVOLUCOES_API,
  dadosExternosApi,
  respostaConclusaoApi,
  rotaListarDadosExternos,
} from '../../test/dadosExternosFalsos'
import { useDadosExternos } from './useDadosExternos'

const ROTA = '/api/ped/dados-externos-cadastro'
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

  it('concluir(id, identificador) faz o PUT, troca o item na lista sem nova consulta e resolve com { dadoExterno, indicadorCriado }', async () => {
    const { result, chamadas } = await montar(simular())

    let resposta: Awaited<ReturnType<typeof result.current.concluir>> | undefined
    await act(async () => {
      resposta = await result.current.concluir(3, 'devolucoes')
    })

    const put = chamadas.find((c) => c.metodo === 'PUT')!
    expect(put.caminho).toBe(`${ROTA}/3/concluir`)
    expect(corpoDaChamada(put)).toEqual({ identificador: 'DEVOLUCOES' })
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
      await result.current.concluir(3, 'DEVOLUCOES')
    })

    expect(result.current.dadosExternos.map((d) => d.id)).toEqual([4])
    expect(gets(chamadas)).toHaveLength(2)
  })

  it('falha rejeita com a ApiError original sem alterar a lista nem o erro de carga', async () => {
    const { result } = await montar(simular(() => respostaErro(400, 'Identificador sem coleta cadastrada.')))
    const antes = result.current.dadosExternos

    let erro: unknown
    await act(async () => {
      erro = await result.current.concluir(3, 'XPTO').catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'Identificador sem coleta cadastrada.' })
    expect(result.current.dadosExternos).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})
