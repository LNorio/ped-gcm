import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fechamentosReais from '../../docs/backend/exemplos-reais/fechamentos.json'
import imagensReais from '../../docs/backend/exemplos-reais/imagens.json'
import { respostaJson, simularApi } from '../test/apiFalsa'
import type { Fechamento } from '../types/dominio'
import { listarFechamentos } from './fechamentosService'
import { listarImagens } from './imagensService'
import { definirToken, limparToken } from './sessao'

/**
 * Garantia de contrato (F10.1): os serviços da aba Fechamentos convertem, sem erro e com os valores
 * certos, as respostas reais do back-end salvas em `docs/backend/exemplos-reais/` (enviadas pelo usuário
 * em 16/11/2026). Motivo: contra o servidor real, a aba mostrava "Resposta inválida do servidor.".
 *
 * - `fechamentos.json` (`GET /api/ped/fechamentos`): "indicadores com problema" e "unidades sem tabela
 *   de faixas" chegam como **contagens numéricas** (0), não como listas; "periodo atual" "11/2026".
 * - `imagens.json` (`GET /api/ped/imagens`): lista vazia.
 *
 * Os JSONs não podem ser alterados para fazer o teste passar: eles são a resposta real.
 */
describe('F10.1 — Serviços dos fechamentos: contrato com as respostas reais', () => {
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

  describe('GET /api/ped/fechamentos (fechamentos.json)', () => {
    it('converte a linha do PED sem erro, com as contagens 0 de indicadores com problema e de unidades sem tabela de faixas', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/fechamentos': () => respostaJson(fechamentosReais) })

      await expect(listarFechamentos()).resolves.toEqual<Fechamento[]>([
        {
          id: 2,
          nome: 'PED',
          tipoVinculo: 'cargos',
          itensVinculados: ['Consultor de Vendas Balcão'],
          periodicidade: 'mensal',
          periodoAtual: '11/2026',
          situacaoDoPeriodo: 'aberto',
          unidadesDeImagem: 60,
          unidadesEncerradas: 0,
          unidadesComPendencias: 60,
          progresso: { preenchidos: 0, total: 420 },
          indicadoresComProblema: [],
          quantidadeIndicadoresComProblema: 0,
          unidadesSemTabelaDeFaixas: [],
          quantidadeUnidadesSemTabelaDeFaixas: 0,
        },
      ])
    })

    it('com contagens diferentes de 0 no mesmo formato, as quantidades são as do número e as listas ficam vazias', async () => {
      const [linha] = fechamentosReais
      simularApi(fetchFalso, {
        'GET /api/ped/fechamentos': () =>
          respostaJson([{ ...linha, 'indicadores com problema': 2, 'unidades sem tabela de faixas': 5 }]),
      })

      const [fechamento] = await listarFechamentos()

      expect(fechamento.quantidadeIndicadoresComProblema).toBe(2)
      expect(fechamento.quantidadeUnidadesSemTabelaDeFaixas).toBe(5)
      expect(fechamento.indicadoresComProblema).toEqual([])
      expect(fechamento.unidadesSemTabelaDeFaixas).toEqual([])
    })
  })

  describe('GET /api/ped/imagens (imagens.json)', () => {
    it('lista vazia resolve [] sem erro', async () => {
      simularApi(fetchFalso, { 'GET /api/ped/imagens': () => respostaJson(imagensReais) })

      await expect(listarImagens()).resolves.toEqual([])
    })
  })
})
