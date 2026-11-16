import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { inicioAdminApi, inicioPreenchedorApi, inicioValidadorApi } from '../test/inicioFalsos'
import { ROTULOS_RESUMO_INICIO } from '../types/dominio'
import { obterInicio } from './inicioService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/inicio'

/**
 * F11.3 — Rótulos do resumo do Início escolhidos pelo front (decisão de 16/11/2026).
 *
 * O servidor real manda o `rotulo` do resumo sem acentos (ex.: "Dados externos em construcao pela TI",
 * "Lancamentos pendentes no periodo") e não vai corrigir na origem. O front escolhe o rótulo pela `chave`:
 * - `ROTULOS_RESUMO_INICIO` (`src/types/dominio.ts`): tabela `chave → rótulo em pt-BR` das chaves conhecidas;
 * - `obterInicio` (`src/services/inicioService.ts`) devolve em `resumo[].rotulo` o texto da tabela quando a
 *   chave é conhecida; chave desconhecida mantém o `rotulo` da API como veio. A `chave` e o `valor` não mudam.
 */
describe('F11.3 — Rótulos do resumo do Início pela chave', () => {
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

  describe('tabela ROTULOS_RESUMO_INICIO', () => {
    it('tem exatamente as 9 chaves conhecidas, com o texto correto em pt-BR', () => {
      expect(ROTULOS_RESUMO_INICIO).toEqual({
        'apontamentos ativos': 'Apontamentos ativos',
        'dados externos ativos': 'Dados externos ativos',
        'total de indicadores': 'Total de indicadores',
        'dados externos em construcao': 'Dados externos em construção pela TI',
        'lancamentos pendentes': 'Lançamentos pendentes no período',
        'dashboards com meus apontamentos': 'Dashboards com meus apontamentos',
        'meus dados externos em construcao': 'Meus dados externos em construção pela TI',
        'dashboards ativos': 'Dashboards ativos',
        'apontamentos dos meus tipos': 'Apontamentos dos meus tipos',
      })
    })
  })

  describe('conversão em obterInicio', () => {
    it('Admin: rótulos sem acento da API viram o texto da tabela; chave e valor não mudam', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi()) })

      const inicio = await obterInicio()

      expect(inicio.resumo).toEqual([
        { chave: 'apontamentos ativos', rotulo: 'Apontamentos ativos', valor: 12 },
        { chave: 'dados externos ativos', rotulo: 'Dados externos ativos', valor: 5 },
        { chave: 'total de indicadores', rotulo: 'Total de indicadores', valor: 8 },
        { chave: 'dados externos em construcao', rotulo: 'Dados externos em construção pela TI', valor: 2 },
        { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 1234 },
      ])
    })

    it('Validador: "Meus dados externos em construção pela TI" e "Lançamentos pendentes no período"', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioValidadorApi()) })

      const inicio = await obterInicio()

      expect(inicio.resumo.map((item) => item.rotulo)).toEqual([
        'Apontamentos ativos',
        'Dashboards com meus apontamentos',
        'Meus dados externos em construção pela TI',
        'Dashboards ativos',
        'Lançamentos pendentes no período',
      ])
    })

    it('chave conhecida: o rótulo da tabela vale mesmo que a API mande outro texto', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            inicioPreenchedorApi({
              resumo: [{ chave: 'lancamentos pendentes', rotulo: 'LANCAMENTOS PENDENTES', valor: 7 }],
            }),
          ),
      })

      const inicio = await obterInicio('101')

      expect(inicio.resumo).toEqual([
        { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 7 },
      ])
    })

    it('chave desconhecida: mantém o rótulo da API como veio', async () => {
      simularApi(fetchFalso, {
        [`GET ${ROTA}`]: () =>
          respostaJson(
            inicioAdminApi({
              resumo: [
                { chave: 'nova metrica do servidor', rotulo: 'Nova metrica do servidor', valor: 4 },
                { chave: 'apontamentos ativos', rotulo: 'Apontamentos ativos', valor: 12 },
              ],
            }),
          ),
      })

      const inicio = await obterInicio()

      expect(inicio.resumo).toEqual([
        { chave: 'nova metrica do servidor', rotulo: 'Nova metrica do servidor', valor: 4 },
        { chave: 'apontamentos ativos', rotulo: 'Apontamentos ativos', valor: 12 },
      ])
    })

    it.each(['constructor', 'toString', '__proto__'])(
      'chave "%s" (nome de propriedade herdada) é desconhecida: mantém o rótulo da API',
      async (chave) => {
        simularApi(fetchFalso, {
          [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi({ resumo: [{ chave, rotulo: 'Rotulo da API', valor: 1 }] })),
        })

        const inicio = await obterInicio()

        expect(inicio.resumo).toEqual([{ chave, rotulo: 'Rotulo da API', valor: 1 }])
      },
    )
  })
})
