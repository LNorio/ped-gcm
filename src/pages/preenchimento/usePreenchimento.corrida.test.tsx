import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoPreenchimento } from '../../services/preenchimentoService'
import { definirToken, limparToken } from '../../services/sessao'
import type { Sessao } from '../../sessao/SessaoProvider'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { FILIAIS_API, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { mesesPreenchimentoApi, telaMesFechadoApi, telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usePreenchimento } from './usePreenchimento'

const ROTA_TELA = '/api/ped/preenchimento'
const ROTA_MESES = '/api/ped/preenchimento/meses'

/** Resposta controlada pelo teste: a rota fica pendente até `resolver()`. */
interface Pendente {
  promessa: Promise<Response>
  resolver: (resposta: Response) => void
}

function pendente(): Pendente {
  let resolver!: (resposta: Response) => void
  const promessa = new Promise<Response>((resolve) => {
    resolver = resolve
  })
  return { promessa, resolver }
}

/** Tela do mês aberto com a filial (e o nome) da consulta. */
function telaDaFilial(url: URL) {
  const filial = url.searchParams.get('filial') ?? '101'
  const nome = FILIAIS_API.find((item) => item.filial === filial)?.['nome filial'] ?? null
  return telaPreenchimentoApi({ filial, 'nome filial': nome })
}

/** Deixa as promessas e os efeitos pendentes terminarem (só `Date` é simulado). */
async function esvaziarFila() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/**
 * Corridas no hook do Preenchimento (F9.6 — revisão da F9 em 13/11/2026). A tela exibida é sempre a da
 * filial do cabeçalho e do último mês/ano pedido:
 * - gravação: se a filial do cabeçalho muda enquanto o `PUT` está pendente, o sucesso do `PUT` não
 *   recarrega a filial antiga (nem a tela, nem os meses): continua a tela da filial nova, com os meses
 *   carregados; a recarga depois do `PUT` só acontece se a filial ainda for a mesma;
 * - respostas atrasadas: na troca de filial, de mês ou de ano, a resposta da consulta antiga que chega
 *   depois da nova é descartada.
 * Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.6 — usePreenchimento (corridas: gravação e respostas atrasadas)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  let sessao: Partial<Sessao>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    sessao = { acesso: admin(), filialSelecionada: FILIAIS[1] }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function admin() {
    return acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
  }

  function renderizar(rotas: Record<string, RotaFalsa>) {
    const chamadas = simularApi(fetchFalso, {
      [`GET ${ROTA_TELA}`]: (_init, url) => respostaJson(telaDaFilial(url)),
      [`GET ${ROTA_MESES}`]: () => respostaJson(mesesPreenchimentoApi()),
      ...rotas,
    })
    const wrapper = ({ children }: { children: ReactNode }) => <ProvedorSessaoFalso sessao={sessao}>{children}</ProvedorSessaoFalso>
    const hook = renderHook(() => usePreenchimento(), { wrapper })
    return { ...hook, chamadas }
  }

  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)
  const puts = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'PUT' && c.caminho === ROTA_TELA)

  describe('gravação com troca de filial durante o PUT', () => {
    it('o sucesso do PUT não recarrega a filial antiga: a tela é a da filial nova e os meses carregam', async () => {
      const put = pendente()
      const { result, rerender, chamadas } = renderizar({ [`PUT ${ROTA_TELA}`]: () => put.promessa })
      await waitFor(() => expect(result.current.tela?.filial).toBe('101'))
      await waitFor(() => expect(result.current.meses).toHaveLength(12))

      let gravacao!: Promise<ResultadoPreenchimento>
      act(() => {
        gravacao = result.current.salvar([{ idApontamento: 7, valor: true }])
      })
      await waitFor(() => expect(puts(chamadas)).toHaveLength(1))

      sessao = { acesso: admin(), filialSelecionada: FILIAIS[2] }
      rerender()
      await waitFor(() => expect(result.current.tela?.filial).toBe('102'))
      await waitFor(() => expect(result.current.meses).toHaveLength(12))
      const chamadasAntes = chamadas.length

      let resultado: unknown
      await act(async () => {
        put.resolver(respostaJson({ mensagem: 'preenchimento salvo', lancados: 1, corrigidos: 0 }))
        resultado = await gravacao
      })
      await esvaziarFila()

      expect(resultado).toEqual({ mensagem: 'preenchimento salvo', lancados: 1, corrigidos: 0 })
      const depois = chamadas.slice(chamadasAntes).filter((c) => c.metodo === 'GET')
      expect(depois.filter((c) => c.url.searchParams.get('filial') === '101')).toHaveLength(0)
      expect(result.current.codigoFilial).toBe('102')
      expect(result.current.tela?.filial).toBe('102')
      expect(result.current.tela?.nomeFilial).toBe('DOURADOS')
      expect(result.current.meses).toHaveLength(12)
      expect(result.current.carregando).toBe(false)
      expect(result.current.carregandoMeses).toBe(false)
      expect(result.current.erro).toBeNull()
    })

    it('com a mesma filial, o sucesso do PUT recarrega a tela e os meses dela', async () => {
      const put = pendente()
      const { result, chamadas } = renderizar({ [`PUT ${ROTA_TELA}`]: () => put.promessa })
      await waitFor(() => expect(result.current.tela?.filial).toBe('101'))
      await waitFor(() => expect(result.current.meses).toHaveLength(12))
      const telasAntes = gets(chamadas, ROTA_TELA).length
      const mesesAntes = gets(chamadas, ROTA_MESES).length

      await act(async () => {
        const gravacao = result.current.salvar([{ idApontamento: 7, valor: true }])
        put.resolver(respostaJson({ mensagem: 'preenchimento salvo', lancados: 1, corrigidos: 0 }))
        await gravacao
      })

      await waitFor(() => expect(gets(chamadas, ROTA_TELA)).toHaveLength(telasAntes + 1))
      await waitFor(() => expect(gets(chamadas, ROTA_MESES)).toHaveLength(mesesAntes + 1))
      expect(gets(chamadas, ROTA_TELA).at(-1)?.url.searchParams.get('filial')).toBe('101')
      expect(gets(chamadas, ROTA_MESES).at(-1)?.url.searchParams.get('filial')).toBe('101')
    })
  })

  describe('respostas atrasadas', () => {
    it('troca de filial: a resposta da filial nova chega primeiro e a da antiga, depois; a antiga é descartada', async () => {
      const telaAntiga = pendente()
      const { result, rerender } = renderizar({
        [`GET ${ROTA_TELA}`]: (_init, url) =>
          url.searchParams.get('filial') === '101' ? telaAntiga.promessa : respostaJson(telaDaFilial(url)),
      })
      await waitFor(() => expect(result.current.carregando).toBe(true))

      sessao = { acesso: admin(), filialSelecionada: FILIAIS[2] }
      rerender()
      await waitFor(() => expect(result.current.tela?.filial).toBe('102'))

      await act(async () => {
        telaAntiga.resolver(respostaJson(telaPreenchimentoApi({ filial: '101', 'nome filial': 'CAMPO GRANDE' })))
      })
      await esvaziarFila()

      expect(result.current.tela?.filial).toBe('102')
      expect(result.current.tela?.nomeFilial).toBe('DOURADOS')
      expect(result.current.carregando).toBe(false)
    })

    it('troca de mês: a resposta do mês novo chega primeiro e a do anterior, depois; a do anterior é descartada', async () => {
      const setembro = pendente()
      const agosto = pendente()
      const { result } = renderizar({
        [`GET ${ROTA_TELA}`]: (_init, url) => {
          const mes = url.searchParams.get('mes_de_referencia')
          if (mes === '2026-09') return setembro.promessa
          if (mes === '2026-08') return agosto.promessa
          return respostaJson(telaDaFilial(url))
        },
      })
      await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2026-10-01'))
      await waitFor(() => expect(result.current.meses).toHaveLength(12))

      act(() => result.current.selecionarMes('2026-09-01'))
      act(() => result.current.selecionarMes('2026-08-01'))
      await act(async () => {
        agosto.resolver(respostaJson({ ...telaMesFechadoApi(), 'mes de referencia': '2026-08-01' }))
      })
      await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2026-08-01'))

      await act(async () => {
        setembro.resolver(respostaJson(telaMesFechadoApi()))
      })
      await esvaziarFila()

      expect(result.current.tela?.mesDeReferencia).toBe('2026-08-01')
      expect(result.current.mesSelecionado).toBe('2026-08-01')
      expect(result.current.carregando).toBe(false)
    })

    it('troca de ano: os meses do ano novo chegam primeiro e os do anterior, depois; os do anterior são descartados', async () => {
      const meses2025 = pendente()
      const { result } = renderizar({
        [`GET ${ROTA_MESES}`]: (_init, url) => {
          const ano = Number(url.searchParams.get('ano'))
          if (ano === 2025) return meses2025.promessa
          return respostaJson(ano === 2026 ? mesesPreenchimentoApi() : mesesPreenchimentoApi(ano, 13))
        },
      })
      await waitFor(() => expect(result.current.meses).toHaveLength(12))

      act(() => result.current.mudarAno(2025))
      act(() => result.current.mudarAno(2024))
      await waitFor(() => expect(result.current.meses[0]?.mesDeReferencia).toBe('2024-01-01'))

      await act(async () => {
        meses2025.resolver(respostaJson(mesesPreenchimentoApi(2025, 13)))
      })
      await esvaziarFila()

      expect(result.current.ano).toBe(2024)
      expect(result.current.meses[0]?.mesDeReferencia).toBe('2024-01-01')
      expect(result.current.carregandoMeses).toBe(false)
    })
  })
})
