import { describe, expect, it } from 'vitest'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_MARGEM_API,
  INDICADOR_TICKET_MEDIO_API,
} from '../test/indicadoresFalsos'
import type { NovoIndicador } from '../types/dominio'
import { type IndicadorApi, paraCorpoNovoIndicador, paraIndicador } from './adaptadores'

/**
 * F6.10 — Meta por filial (proposta de contrato; ver `src/test/indicadoresFalsos.ts`):
 * - listagem: `"metas por filial": [{ filial, "nome filial"?, meta: number | null }]` e
 *   `"filiais sem meta": [códigos]`; sem `"filiais sem meta"`, as pendentes vêm dos itens com `meta: null`;
 * - cadastro: `"metas por filial": [{ filial, meta }]` no lugar de `"meta"`.
 */
describe('F6.10 — Meta por filial: adaptadores (paraIndicador e paraCorpoNovoIndicador)', () => {
  describe('paraIndicador', () => {
    it('converte "metas por filial" (filial, nome filial e meta) e "filiais sem meta"', () => {
      const indicador = paraIndicador(INDICADOR_TICKET_MEDIO_API as IndicadorApi)

      expect(indicador.meta).toBeNull()
      expect(indicador.metasPorFilial).toEqual([
        { filial: '100', nomeFilial: 'MATRIZ', meta: 1500.5 },
        { filial: '101', nomeFilial: 'CAMPO GRANDE', meta: null },
        { filial: '102', nomeFilial: 'DOURADOS', meta: null },
      ])
      expect(indicador.filiaisSemMeta).toEqual(['101', '102'])
    })

    it('metas por filial completas: "filiais sem meta" vazia', () => {
      const indicador = paraIndicador(INDICADOR_MARGEM_API as IndicadorApi)

      expect(indicador.metasPorFilial.map((item) => item.meta)).toEqual([30, 32.5, 28])
      expect(indicador.filiaisSemMeta).toEqual([])
    })

    it('sem os campos novos (API atual): metasPorFilial e filiaisSemMeta vazias', () => {
      const indicador = paraIndicador(INDICADOR_COBERTURA_VISITAS_API as IndicadorApi)

      expect(indicador.meta).toBe(85)
      expect(indicador.metasPorFilial).toEqual([])
      expect(indicador.filiaisSemMeta).toEqual([])
    })

    it('campos novos nulos viram listas vazias', () => {
      const indicador = paraIndicador({
        ...INDICADOR_COBERTURA_VISITAS_API,
        'metas por filial': null,
        'filiais sem meta': null,
      } as unknown as IndicadorApi)

      expect(indicador.metasPorFilial).toEqual([])
      expect(indicador.filiaisSemMeta).toEqual([])
    })

    it('sem "filiais sem meta", as pendentes são derivadas dos itens de "metas por filial" com meta nula ou ausente, na ordem da lista', () => {
      const indicador = paraIndicador({
        ...INDICADOR_TICKET_MEDIO_API,
        'metas por filial': [
          { filial: '100', 'nome filial': 'MATRIZ', meta: null },
          { filial: '101', 'nome filial': 'CAMPO GRANDE', meta: 10 },
          { filial: '102' },
        ],
        'filiais sem meta': undefined,
      } as unknown as IndicadorApi)

      expect(indicador.filiaisSemMeta).toEqual(['100', '102'])
      expect(indicador.metasPorFilial).toEqual([
        { filial: '100', nomeFilial: 'MATRIZ', meta: null },
        { filial: '101', nomeFilial: 'CAMPO GRANDE', meta: 10 },
        { filial: '102', nomeFilial: null, meta: null },
      ])
    })

    it('"filiais sem meta" informada prevalece sobre a derivação (inclui filial fora de "metas por filial")', () => {
      const indicador = paraIndicador({
        ...INDICADOR_TICKET_MEDIO_API,
        'metas por filial': [{ filial: '100', 'nome filial': 'MATRIZ', meta: 1500.5 }],
        'filiais sem meta': ['101', '102'],
      } as unknown as IndicadorApi)

      expect(indicador.filiaisSemMeta).toEqual(['101', '102'])
    })

    it('código de filial numérico vira texto (em "metas por filial" e "filiais sem meta")', () => {
      const indicador = paraIndicador({
        ...INDICADOR_TICKET_MEDIO_API,
        'metas por filial': [
          { filial: 100, 'nome filial': 'MATRIZ', meta: 1500.5 },
          { filial: 101, 'nome filial': 'CAMPO GRANDE', meta: null },
        ],
        'filiais sem meta': [101],
      } as unknown as IndicadorApi)

      expect(indicador.metasPorFilial.map((item) => item.filial)).toEqual(['100', '101'])
      expect(indicador.filiaisSemMeta).toEqual(['101'])
    })
  })

  describe('paraCorpoNovoIndicador', () => {
    const BASE = {
      nome: 'Ticket médio por filial',
      descricao: null,
      sentido: 'maior_melhor',
      metaEditavel: false,
      calculo: 'soma',
      apontamentos: [6],
    } as const

    it('com meta única (replicar para todas as filiais): envia "meta" e não envia "metas por filial"', () => {
      const corpo = paraCorpoNovoIndicador({ ...BASE, meta: 1500.5 } as NovoIndicador)

      expect(corpo).toEqual({
        nome: 'Ticket médio por filial',
        descricao: null,
        'origem da meta': 'manual',
        meta: 1500.5,
        sentido: 'maior_melhor',
        'meta editavel': false,
        calculo: 'soma',
        apontamentos: [6],
      })
      expect(corpo).not.toHaveProperty('metas por filial')
    })

    it('com metas por filial: envia "metas por filial" [{ filial, meta }] na ordem recebida e não envia "meta"', () => {
      const corpo = paraCorpoNovoIndicador({
        ...BASE,
        metasPorFilial: [
          { filial: '100', meta: 1500.5 },
          { filial: '102', meta: 900 },
        ],
      } as NovoIndicador)

      expect(corpo).toEqual({
        nome: 'Ticket médio por filial',
        descricao: null,
        'origem da meta': 'manual',
        'metas por filial': [
          { filial: '100', meta: 1500.5 },
          { filial: '102', meta: 900 },
        ],
        sentido: 'maior_melhor',
        'meta editavel': false,
        calculo: 'soma',
        apontamentos: [6],
      })
      expect(corpo).not.toHaveProperty('meta')
    })

    it('com metas por filial e dado externo: mantém "dado externo" sem "apontamentos" nem "calculo"', () => {
      const corpo = paraCorpoNovoIndicador({
        nome: 'Margem bruta por filial',
        descricao: null,
        sentido: 'maior_melhor',
        metaEditavel: true,
        dadoExterno: 1,
        metasPorFilial: [{ filial: '101', meta: 32.5 }],
      } as NovoIndicador)

      expect(corpo).toEqual({
        nome: 'Margem bruta por filial',
        descricao: null,
        'origem da meta': 'manual',
        'metas por filial': [{ filial: '101', meta: 32.5 }],
        sentido: 'maior_melhor',
        'meta editavel': true,
        'dado externo': 1,
      })
    })
  })
})
