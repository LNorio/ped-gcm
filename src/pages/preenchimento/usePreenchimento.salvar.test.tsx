import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/api'
import { errosDoPreenchimento } from '../../services/preenchimentoService'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { corpoDaChamada, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { mesesPreenchimentoApi, telaMesFechadoApi, telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usePreenchimento } from './usePreenchimento'

const ROTA_TELA = '/api/ped/preenchimento'
const ROTA_MESES = '/api/ped/preenchimento/meses'

/**
 * Gravação no hook (F9.6/F9.7 — RF-66 a RF-68): `salvar(itens)` envia num único
 * `PUT /api/ped/preenchimento` a filial e o mês da tela (dia 01) com os itens recebidos (valores já
 * convertidos; `motivo` só na correção); no sucesso, resolve com `{ mensagem, lancados, corrigidos }` e
 * recarrega a tela e os meses (pendentes). Na falha, rejeita com a `ApiError` original (os erros por
 * item ficam em `dados`, lidos por `errosDoPreenchimento`), sem recarregar e sem mexer na tela.
 */
describe('F9.6 — usePreenchimento (salvar lançamentos e correções em lote)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  async function carregado(rotas: Record<string, RotaFalsa> = {}) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA_TELA}`]: (_init, url) =>
        respostaJson(url.searchParams.get('mes_de_referencia') === '2026-09' ? telaMesFechadoApi() : telaPreenchimentoApi()),
      [`GET ${ROTA_MESES}`]: () => respostaJson(mesesPreenchimentoApi()),
      [`PUT ${ROTA_TELA}`]: () => respostaJson({ mensagem: 'preenchimento salvo', lancados: 2, corrigidos: 0 }),
      ...rotas,
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProvedorSessaoFalso sessao={{ acesso: acessoFalso(), filialSelecionada: FILIAIS[1] }}>{children}</ProvedorSessaoFalso>
    )
    const hook = renderHook(() => usePreenchimento(), { wrapper })
    await waitFor(() => expect(hook.result.current.tela).not.toBeNull())
    await waitFor(() => expect(hook.result.current.meses).toHaveLength(12))
    return { ...hook, chamadas }
  }

  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT' && c.caminho === ROTA_TELA)
  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)

  it('lançamento em lote: um único PUT com filial, mês (AAAA-MM-01) e os itens na ordem recebida', async () => {
    const { result, chamadas } = await carregado()

    await act(async () => {
      await result.current.salvar([
        { idApontamento: 7, valor: true },
        { idApontamento: 11, valor: 42.5 },
      ])
    })

    expect(puts(chamadas)).toHaveLength(1)
    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      filial: '101',
      'mes de referencia': '2026-10-01',
      itens: [
        { 'id apontamento': 7, valor: true },
        { 'id apontamento': 11, valor: 42.5 },
      ],
    })
  })

  it('correção: envia o item com o motivo', async () => {
    const { result, chamadas } = await carregado({
      [`PUT ${ROTA_TELA}`]: () => respostaJson({ mensagem: 'preenchimento salvo', lancados: 0, corrigidos: 1 }),
    })

    await act(async () => {
      await result.current.salvar([{ idApontamento: 9, valor: 85.5, motivo: 'digitação errada' }])
    })

    expect(corpoDaChamada(puts(chamadas)[0])).toEqual({
      filial: '101',
      'mes de referencia': '2026-10-01',
      itens: [{ 'id apontamento': 9, valor: 85.5, motivo: 'digitação errada' }],
    })
  })

  it('sucesso: resolve com mensagem, lançados e corrigidos', async () => {
    const { result } = await carregado()

    let resultado: unknown
    await act(async () => {
      resultado = await result.current.salvar([{ idApontamento: 7, valor: false }])
    })

    expect(resultado).toEqual({ mensagem: 'preenchimento salvo', lancados: 2, corrigidos: 0 })
  })

  it('sucesso: recarrega a tela (mesmo mês) e os meses', async () => {
    const { result, chamadas } = await carregado()
    const telasAntes = gets(chamadas, ROTA_TELA).length
    const mesesAntes = gets(chamadas, ROTA_MESES).length

    await act(async () => {
      await result.current.salvar([{ idApontamento: 7, valor: true }])
    })

    await waitFor(() => expect(gets(chamadas, ROTA_TELA)).toHaveLength(telasAntes + 1))
    await waitFor(() => expect(gets(chamadas, ROTA_MESES)).toHaveLength(mesesAntes + 1))
    expect(gets(chamadas, ROTA_TELA).at(-1)?.url.searchParams.get('filial')).toBe('101')
  })

  it('falha (400 com erros por item): rejeita com a ApiError original, sem recarregar e sem mexer na tela', async () => {
    const { result, chamadas } = await carregado({
      [`PUT ${ROTA_TELA}`]: () =>
        respostaJson({ mensagem: 'Lote recusado: nenhum item foi gravado.', erros: [{ 'id apontamento': 7, mensagem: 'Valor inválido.' }] }, 400),
    })
    const telasAntes = gets(chamadas, ROTA_TELA).length
    const telaAntes = result.current.tela

    let falha: unknown
    await act(async () => {
      await result.current.salvar([{ idApontamento: 7, valor: true }]).catch((erro: unknown) => {
        falha = erro
      })
    })

    expect(falha).toBeInstanceOf(ApiError)
    expect((falha as ApiError).status).toBe(400)
    expect((falha as ApiError).mensagem).toBe('Lote recusado: nenhum item foi gravado.')
    expect(errosDoPreenchimento(falha)).toEqual([{ idApontamento: 7, mensagem: 'Valor inválido.' }])
    expect(gets(chamadas, ROTA_TELA)).toHaveLength(telasAntes)
    expect(result.current.tela).toBe(telaAntes)
    expect(result.current.erro).toBeNull()
  })
})
