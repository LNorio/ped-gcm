import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mesesReais from '../../docs/backend/exemplos-reais/preenchimento-meses.json'
import telaReal from '../../docs/backend/exemplos-reais/preenchimento.json'
import { respostaJson, simularApi } from '../test/apiFalsa'
import type { MesPreenchimento, TelaPreenchimento } from '../types/dominio'
import { listarMesesPreenchimento, obterPreenchimento } from './preenchimentoService'
import { definirToken, limparToken } from './sessao'

/**
 * Garantia de contrato (F9.13*): o serviço do preenchimento converte, sem erro e com os valores certos,
 * as respostas reais do back-end salvas em `docs/backend/exemplos-reais/` (enviadas pelo usuário em
 * 16/11/2026; `preenchimento.json` foi resumido a alguns itens).
 *
 * - `preenchimento-meses.json`: envelope `{ filial, ano, "periodo aberto", meses }`, com cada mês em
 *   `{ mes: "AAAA-MM-DD", situacao, pendentes }`; o mês posterior ao aberto e anterior ao atual
 *   (2026-11) chega `fechado` e o futuro (2026-12), `futuro`.
 * - `preenchimento.json`: `"aberto por"` `null`, `"aberto em"` com fuso, `"lancado em"` em cada
 *   apontamento (tolerado, não exibido) e `indicadores` como lista de nomes.
 *
 * Os JSONs não podem ser alterados para fazer o teste passar: eles são a resposta real.
 */
const ROTA = '/api/ped/preenchimento'
const ROTA_MESES = '/api/ped/preenchimento/meses'

describe('F9.1 — Serviço do preenchimento: contrato com as respostas reais (F9.13*)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0))
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  describe('GET /api/ped/preenchimento/meses (preenchimento-meses.json)', () => {
    it('converte os 12 meses sem erro: janeiro a setembro fechados, outubro aberto com 10 pendentes, novembro fechado e dezembro futuro', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA_MESES}`]: () => respostaJson(mesesReais) })

      const meses = await listarMesesPreenchimento(2026, '100')

      expect(meses).toHaveLength(12)
      expect(meses.map((m) => m.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      expect(meses.map((m) => m.mesDeReferencia)).toEqual(
        Array.from({ length: 12 }, (_, indice) => `2026-${String(indice + 1).padStart(2, '0')}-01`),
      )
      expect(meses.map((m) => m.situacao)).toEqual([...Array<string>(9).fill('fechado'), 'aberto', 'fechado', 'futuro'])
      expect(meses[0]).toEqual<MesPreenchimento>({ mes: 1, mesDeReferencia: '2026-01-01', situacao: 'fechado', pendentes: null })
      expect(meses[9]).toEqual<MesPreenchimento>({ mes: 10, mesDeReferencia: '2026-10-01', situacao: 'aberto', pendentes: 10 })
      expect(meses[10]).toEqual<MesPreenchimento>({ mes: 11, mesDeReferencia: '2026-11-01', situacao: 'fechado', pendentes: null })
      expect(meses[11]).toEqual<MesPreenchimento>({ mes: 12, mesDeReferencia: '2026-12-01', situacao: 'futuro', pendentes: null })
    })
  })

  describe('GET /api/ped/preenchimento (preenchimento.json)', () => {
    it('converte a tela sem erro, com "aberto por" null, o fuso em "aberto em", "lancado em" tolerado e os indicadores pelos nomes', async () => {
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(telaReal) })

      await expect(obterPreenchimento({ filial: '100' })).resolves.toEqual<TelaPreenchimento>({
        filial: '100',
        nomeFilial: 'Filial 100',
        mesDeReferencia: '2026-10-01',
        situacaoDoMes: 'aberto',
        editavel: true,
        periodoAberto: '2026-10-01',
        abertoPor: null,
        abertoEm: '2026-10-30 15:06:23-04:00',
        progresso: { preenchidos: 0, total: 10 },
        tipos: [
          { id: 1, nome: 'Comercial', quantidade: 0, apontamentos: [] },
          {
            id: 7,
            nome: 'Contabilidade',
            quantidade: 1,
            apontamentos: [
              {
                id: 5,
                nome: 'teste',
                descricao: 'teste',
                tipoValor: 'porcentagem',
                situacao: 'pendente',
                valor: null,
                indicadores: [
                  { id: null, nome: 'teste 2' },
                  { id: null, nome: 'teste indicador' },
                  { id: null, nome: 'testes' },
                ],
                dashboards: [],
                imagensCongeladas: [],
              },
            ],
          },
          {
            id: 2,
            nome: 'Financeiro',
            quantidade: 1,
            apontamentos: [
              {
                id: 13,
                nome: 'Documento não fiscal',
                descricao: 'Documento não fiscal',
                tipoValor: 'booleano',
                situacao: 'pendente',
                valor: null,
                indicadores: [{ id: null, nome: 'Indicadores de Financeiro' }],
                dashboards: [],
                imagensCongeladas: [],
              },
            ],
          },
          {
            id: 4,
            nome: 'Tecnologia da Informação',
            quantidade: 1,
            apontamentos: [
              {
                id: 6,
                nome: 'teste 2',
                descricao: 'teste 2',
                tipoValor: 'numeral',
                situacao: 'pendente',
                valor: null,
                indicadores: [
                  { id: null, nome: 'teste 2' },
                  { id: null, nome: 'testes' },
                ],
                dashboards: [],
                imagensCongeladas: [],
              },
            ],
          },
        ],
      })
    })

    it('"lancado em" preenchido (com valor lançado) também é tolerado', async () => {
      const comLancamento = structuredClone(telaReal)
      const apontamento = comLancamento.tipos[1].apontamentos[0] as Record<string, unknown>
      apontamento['lancado em'] = '2026-10-31 09:12:00-04:00'
      apontamento.valor = 87.5
      apontamento.situacao = 'Preenchido'
      simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(comLancamento) })

      const tela = await obterPreenchimento({ filial: '100' })

      expect(tela.tipos[1].apontamentos[0]).toMatchObject({ id: 5, situacao: 'preenchido', valor: 87.5 })
    })
  })
})
