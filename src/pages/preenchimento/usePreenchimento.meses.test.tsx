import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../../services/sessao'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { respostaErro, respostaJson, simularApi, type ChamadaRegistrada, type RotaFalsa } from '../../test/apiFalsa'
import { mesesPreenchimentoApi, telaMesFechadoApi, telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import { usePreenchimento } from './usePreenchimento'

const ROTA_TELA = '/api/ped/preenchimento'
const ROTA_MESES = '/api/ped/preenchimento/meses'

/**
 * Mês de competência e ano no hook (F9.3 — RF-61, RF-62):
 * - `ano` começa no ano do período aberto (`tela.periodoAberto`) e `meses` traz os 12 meses desse ano
 *   (`listarMesesPreenchimento(ano, filial)`); `mesSelecionado` é o mês da tela (`AAAA-MM-01`);
 * - `selecionarMes('AAAA-MM-01')` consulta a tela daquele mês (`mes_de_referencia=AAAA-MM`);
 * - `mudarAno(ano)` consulta só os meses do ano (a tela continua a do mês selecionado);
 * - `irParaPeriodoAberto()` volta à tela do mês aberto e ao ano dele.
 * Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.3 — usePreenchimento (meses, ano e troca do mês de competência)', () => {
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

  /** Tela por mês: sem mês ou outubro → aberta; outro mês → a tela fechada daquele mês. */
  const telaPorMes: RotaFalsa = (_init, url) => {
    const mes = url.searchParams.get('mes_de_referencia')
    if (mes === null || mes === '2026-10') return respostaJson(telaPreenchimentoApi())
    return respostaJson({ ...telaMesFechadoApi(), 'mes de referencia': `${mes}-01` })
  }

  const mesesPorAno: RotaFalsa = (_init, url) => {
    const ano = Number(url.searchParams.get('ano'))
    return respostaJson(ano === 2026 ? mesesPreenchimentoApi(2026, 10, 1) : mesesPreenchimentoApi(ano, 13))
  }

  function renderizar(rotas: Record<string, RotaFalsa> = {}) {
    const chamadas = simularApi(fetchFalso, { [`GET ${ROTA_TELA}`]: telaPorMes, [`GET ${ROTA_MESES}`]: mesesPorAno, ...rotas })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProvedorSessaoFalso sessao={{ acesso: acessoFalso(), filialSelecionada: FILIAIS[1] }}>{children}</ProvedorSessaoFalso>
    )
    const hook = renderHook(() => usePreenchimento(), { wrapper })
    return { ...hook, chamadas }
  }

  const gets = (chamadas: ChamadaRegistrada[], caminho: string) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === caminho)

  async function carregado() {
    const resultado = renderizar()
    await waitFor(() => expect(resultado.result.current.meses).toHaveLength(12))
    await waitFor(() => expect(resultado.result.current.tela).not.toBeNull())
    return resultado
  }

  it('carrega os 12 meses do ano do período aberto (2026) da filial, e o mês selecionado é o aberto', async () => {
    const { result, chamadas } = await carregado()

    expect(result.current.ano).toBe(2026)
    expect(gets(chamadas, ROTA_MESES)).toHaveLength(1)
    expect(gets(chamadas, ROTA_MESES)[0].url.searchParams.get('ano')).toBe('2026')
    expect(gets(chamadas, ROTA_MESES)[0].url.searchParams.get('filial')).toBe('101')
    expect(result.current.meses[9]).toEqual({ mes: 10, mesDeReferencia: '2026-10-01', situacao: 'aberto', pendentes: 1 })
    expect(result.current.meses[8].situacao).toBe('fechado')
    expect(result.current.meses[11].situacao).toBe('futuro')
    expect(result.current.mesSelecionado).toBe('2026-10-01')
  })

  it('selecionarMes consulta a tela do mês (mes_de_referencia=AAAA-MM) e passa a consulta', async () => {
    const { result, chamadas } = await carregado()

    act(() => result.current.selecionarMes('2026-09-01'))

    await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2026-09-01'))
    expect(gets(chamadas, ROTA_TELA).at(-1)?.url.searchParams.get('mes_de_referencia')).toBe('2026-09')
    expect(gets(chamadas, ROTA_TELA).at(-1)?.url.searchParams.get('filial')).toBe('101')
    expect(result.current.mesSelecionado).toBe('2026-09-01')
    expect(result.current.tela?.situacaoDoMes).toBe('fechado')
    expect(result.current.tela?.editavel).toBe(false)
  })

  it('mudarAno consulta os meses do novo ano, sem trocar a tela do mês selecionado', async () => {
    const { result, chamadas } = await carregado()
    const telasAntes = gets(chamadas, ROTA_TELA).length

    act(() => result.current.mudarAno(2025))

    await waitFor(() => expect(result.current.ano).toBe(2025))
    await waitFor(() => expect(gets(chamadas, ROTA_MESES).at(-1)?.url.searchParams.get('ano')).toBe('2025'))
    await waitFor(() => expect(result.current.meses.every((mes) => mes.situacao === 'fechado')).toBe(true))
    expect(result.current.meses[0].mesDeReferencia).toBe('2025-01-01')
    expect(gets(chamadas, ROTA_TELA)).toHaveLength(telasAntes)
    expect(result.current.tela?.mesDeReferencia).toBe('2026-10-01')
  })

  it('depois de mudar o ano, selecionar um mês daquele ano consulta a tela dele', async () => {
    const { result, chamadas } = await carregado()

    act(() => result.current.mudarAno(2025))
    await waitFor(() => expect(result.current.meses[0]?.mesDeReferencia).toBe('2025-01-01'))
    act(() => result.current.selecionarMes('2025-03-01'))

    await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2025-03-01'))
    expect(gets(chamadas, ROTA_TELA).at(-1)?.url.searchParams.get('mes_de_referencia')).toBe('2025-03')
  })

  it('irParaPeriodoAberto volta à tela do mês aberto e ao ano dele', async () => {
    const { result, chamadas } = await carregado()
    act(() => result.current.mudarAno(2025))
    await waitFor(() => expect(result.current.meses[0]?.mesDeReferencia).toBe('2025-01-01'))
    act(() => result.current.selecionarMes('2025-03-01'))
    await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2025-03-01'))

    act(() => result.current.irParaPeriodoAberto())

    await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2026-10-01'))
    await waitFor(() => expect(result.current.ano).toBe(2026))
    expect([null, '2026-10']).toContain(gets(chamadas, ROTA_TELA).at(-1)?.url.searchParams.get('mes_de_referencia'))
    await waitFor(() => expect(result.current.meses[9]?.situacao).toBe('aberto'))
    expect(result.current.mesSelecionado).toBe('2026-10-01')
  })

  it('erro ao consultar os meses: erroMeses com a mensagem, sem derrubar a tela', async () => {
    const { result } = renderizar({ [`GET ${ROTA_MESES}`]: () => respostaErro(500, 'Falha ao consultar os meses.') })

    await waitFor(() => expect(result.current.erroMeses).toBe('Falha ao consultar os meses.'))
    await waitFor(() => expect(result.current.tela).not.toBeNull())
    expect(result.current.erro).toBeNull()
    expect(result.current.meses).toEqual([])
  })

  // Revisão da F9 em 13/11/2026: o erro ao trocar de mês ou de ano não pode tirar do usuário o seletor
  // (o ano, os meses e o período aberto continuam disponíveis para escolher outro mês ou voltar).
  describe('erro ao trocar o mês ou o ano (o seletor continua disponível)', () => {
    const falhaSetembro: RotaFalsa = (init, url) =>
      url.searchParams.get('mes_de_referencia') === '2026-09' ? respostaErro(500, 'Falha ao consultar o preenchimento.') : telaPorMes(init, url)

    it('erro ao selecionar um mês: erro com a mensagem; ano, meses e período aberto continuam; mesSelecionado é o mês pedido', async () => {
      const { result } = renderizar({ [`GET ${ROTA_TELA}`]: falhaSetembro })
      await waitFor(() => expect(result.current.meses).toHaveLength(12))
      await waitFor(() => expect(result.current.tela).not.toBeNull())

      act(() => result.current.selecionarMes('2026-09-01'))

      await waitFor(() => expect(result.current.erro).toBe('Falha ao consultar o preenchimento.'))
      expect(result.current.carregando).toBe(false)
      expect(result.current.ano).toBe(2026)
      expect(result.current.meses).toHaveLength(12)
      expect(result.current.periodoAberto).toBe('2026-10-01')
      expect(result.current.mesSelecionado).toBe('2026-09-01')
    })

    it('depois do erro ao selecionar um mês, escolher outro mês consulta e mostra a tela dele', async () => {
      const { result } = renderizar({ [`GET ${ROTA_TELA}`]: falhaSetembro })
      await waitFor(() => expect(result.current.meses).toHaveLength(12))
      await waitFor(() => expect(result.current.tela).not.toBeNull())
      act(() => result.current.selecionarMes('2026-09-01'))
      await waitFor(() => expect(result.current.erro).not.toBeNull())

      act(() => result.current.selecionarMes('2026-08-01'))

      await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2026-08-01'))
      expect(result.current.erro).toBeNull()
      expect(result.current.mesSelecionado).toBe('2026-08-01')
    })

    it('depois do erro ao selecionar um mês, irParaPeriodoAberto volta à tela do mês aberto', async () => {
      const { result } = renderizar({ [`GET ${ROTA_TELA}`]: falhaSetembro })
      await waitFor(() => expect(result.current.meses).toHaveLength(12))
      await waitFor(() => expect(result.current.tela).not.toBeNull())
      act(() => result.current.selecionarMes('2026-09-01'))
      await waitFor(() => expect(result.current.erro).not.toBeNull())

      act(() => result.current.irParaPeriodoAberto())

      await waitFor(() => expect(result.current.tela?.mesDeReferencia).toBe('2026-10-01'))
      expect(result.current.erro).toBeNull()
      expect(result.current.mesSelecionado).toBe('2026-10-01')
    })

    it('erro ao mudar o ano: erroMeses com a mensagem, o ano é o pedido e a tela continua; recarregar consulta de novo os meses desse ano', async () => {
      let falhar = true
      const { result, chamadas } = renderizar({
        [`GET ${ROTA_MESES}`]: (init, url) =>
          falhar && url.searchParams.get('ano') === '2025' ? respostaErro(500, 'Falha ao consultar os meses.') : mesesPorAno(init, url),
      })
      await waitFor(() => expect(result.current.meses).toHaveLength(12))
      await waitFor(() => expect(result.current.tela).not.toBeNull())

      act(() => result.current.mudarAno(2025))

      await waitFor(() => expect(result.current.erroMeses).toBe('Falha ao consultar os meses.'))
      expect(result.current.ano).toBe(2025)
      expect(result.current.tela?.mesDeReferencia).toBe('2026-10-01')
      expect(result.current.erro).toBeNull()

      falhar = false
      await act(async () => {
        await result.current.recarregar()
      })

      await waitFor(() => expect(result.current.erroMeses).toBeNull())
      expect(gets(chamadas, ROTA_MESES).at(-1)?.url.searchParams.get('ano')).toBe('2025')
      expect(result.current.meses[0]?.mesDeReferencia).toBe('2025-01-01')
    })
  })
})
