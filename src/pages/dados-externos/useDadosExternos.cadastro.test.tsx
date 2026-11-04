import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { definirToken, limparToken } from '../../services/sessao'
import { corpoDaChamada, respostaErro, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import {
  DADO_FATURAMENTO_API,
  dadosExternosApi,
  respostaCriacaoApi,
  rotaListarDadosExternos,
  type DadoExternoApiFalso,
} from '../../test/dadosExternosFalsos'
import type { NovoDadoExterno } from '../../types/dominio'
import { useDadosExternos } from './useDadosExternos'

const ROTA = '/api/ped/dados-externos-cadastro'

const NOVO: NovoDadoExterno = {
  nome: 'Novos clientes',
  idTipo: 1,
  sistemaOrigem: 'senior_erp',
  tipoValor: 'numeral',
  referencia: 'filial',
  coleta: 'diaria',
  diaDaColeta: null,
  sentidoCalculo: 'soma',
  janelaRetroativa: 1,
  comentarios: null,
  campoCalculo: null,
  identificador: 'novos_clientes',
  observacao: null,
}

describe('F5.4 — useDadosExternos.criar (cadastro de dado externo)', () => {
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
  const posts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'POST' && c.caminho === ROTA)

  function simular(aoCriar?: () => Response) {
    let lista = dadosExternosApi()
    const criado: DadoExternoApiFalso = { ...DADO_FATURAMENTO_API, id: 20, nome: 'Novos clientes', identificador: 'NOVOS_CLIENTES' }
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`POST ${ROTA}`]: () => {
        if (aoCriar) return aoCriar()
        lista = [...lista, criado]
        return respostaJson(respostaCriacaoApi(criado, null), 201)
      },
    })
    return chamadas
  }

  it('criar faz o POST, recarrega a lista e resolve com { dadoExterno, tarefa }', async () => {
    const chamadas = simular()
    const { result } = renderHook(() => useDadosExternos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let resultado: Awaited<ReturnType<typeof result.current.criar>> | undefined
    await act(async () => {
      resultado = await result.current.criar(NOVO)
    })

    expect(posts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(posts(chamadas)[0])).toMatchObject({ nome: 'Novos clientes', identificador: 'NOVOS_CLIENTES' })
    expect(resultado?.dadoExterno).toMatchObject({ id: 20, nome: 'Novos clientes', situacao: 'ativo' })
    expect(resultado?.tarefa).toBeNull()
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.nome)).toContain('Novos clientes'))
  })

  /** POST que grava o novo dado na lista da API falsa, mas responde com `resposta()` (sem o dado completo). */
  function simularGravacaoSemDado(resposta: () => Response) {
    let lista = dadosExternosApi()
    const criado: DadoExternoApiFalso = { ...DADO_FATURAMENTO_API, id: 20, nome: 'Novos clientes', identificador: 'NOVOS_CLIENTES' }
    return simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarDadosExternos(() => lista),
      [`POST ${ROTA}`]: () => {
        lista = [...lista, criado]
        return resposta()
      },
    })
  }

  it.each<[string, () => Response]>([
    ['só { mensagem }', () => respostaJson({ mensagem: 'dado externo cadastrado' }, 201)],
    ['201 com corpo vazio', () => new Response('', { status: 201 })],
    ['dado incompleto ({ id, nome })', () => respostaJson({ id: 20, nome: 'Novos clientes' }, 201)],
  ])(
    'POST 2xx com %s: resolve { dadoExterno: null, tarefa: null }, recarrega a lista e não define erro',
    async (_caso, resposta) => {
      const chamadas = simularGravacaoSemDado(resposta)
      const { result } = renderHook(() => useDadosExternos())
      await waitFor(() => expect(result.current.carregando).toBe(false))

      let resultado: Awaited<ReturnType<typeof result.current.criar>> | undefined
      await act(async () => {
        resultado = await result.current.criar(NOVO)
      })

      expect(posts(chamadas)).toHaveLength(1)
      expect(resultado).toEqual({ dadoExterno: null, tarefa: null })
      await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
      await waitFor(() => expect(result.current.dadosExternos.map((d) => d.nome)).toContain('Novos clientes'))
      expect(result.current.erro).toBeNull()
    },
  )

  it('POST 2xx com só { mensagem, tarefa }: resolve dadoExterno null com a tarefa e recarrega a lista', async () => {
    const tarefa = { id: 1051, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Novos clientes', descricao: null }
    const chamadas = simularGravacaoSemDado(() => respostaJson({ mensagem: 'pedido enviado', tarefa }, 201))
    const { result } = renderHook(() => useDadosExternos())
    await waitFor(() => expect(result.current.carregando).toBe(false))

    let resultado: Awaited<ReturnType<typeof result.current.criar>> | undefined
    await act(async () => {
      resultado = await result.current.criar({ ...NOVO, identificador: null, campoCalculo: 'Novos clientes por filial.' })
    })

    expect(resultado).toEqual({ dadoExterno: null, tarefa })
    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    await waitFor(() => expect(result.current.dadosExternos.map((d) => d.nome)).toContain('Novos clientes'))
  })

  it('falha no POST rejeita com a ApiError original, sem recarregar nem alterar a lista ou o erro de carga', async () => {
    const chamadas = simular(() => respostaErro(400, 'A referência zona ainda não está disponível.'))
    const { result } = renderHook(() => useDadosExternos())
    await waitFor(() => expect(result.current.carregando).toBe(false))
    const antes = result.current.dadosExternos

    let erro: unknown
    await act(async () => {
      erro = await result.current.criar({ ...NOVO, referencia: 'zona' }).catch((e: unknown) => e)
    })

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro).toMatchObject({ status: 400, mensagem: 'A referência zona ainda não está disponível.' })
    expect(gets(chamadas)).toHaveLength(1)
    expect(result.current.dadosExternos).toEqual(antes)
    expect(result.current.erro).toBeNull()
  })
})
