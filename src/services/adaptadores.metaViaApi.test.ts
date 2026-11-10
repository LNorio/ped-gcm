import { describe, expect, it } from 'vitest'
import {
  ENTRADA_META_VIA_API,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  SAIDA_META_VIA_API,
  URL_META_VIA_API,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import type { NovoIndicador } from '../types/dominio'
import { type IndicadorApi, paraCorpoNovoIndicador, paraIndicador } from './adaptadores'

/**
 * F6.11 — Meta buscada via API (proposta de contrato, seção 5 de
 * `docs/propostas-backend/PROPOSTA-meta-por-filial.md`):
 * - listagem (Admin): `identificador`, `url`, `parametros de saida`, `parametros de entrada`,
 *   `variaveis usadas`, `integracao pendente`, `integracao alterada em/por`. No domínio, esses campos
 *   ficam agrupados em `Indicador.integracao`, presente **só** quando `origem da meta = terceiro`
 *   (ausente/`undefined` nos indicadores de meta manual — por isso os indicadores atuais não mudam);
 * - cadastro com "Buscar metas via API": `NovoIndicador.origemDaMeta = 'terceiro'` → corpo com
 *   `"origem da meta": "terceiro"`, sem `meta` nem `metas por filial` e com `"meta editavel": false`.
 *   Contrato final (RESPOSTA-FINAL-meta-via-api.md, 10/11/2026): também `"fonte da meta"`, que sem
 *   `fonteDaMeta` assume `integracao` (ver `adaptadores.fonteDaMeta.test.ts`).
 */
describe('F6.11 — Meta via API: adaptadores (paraIndicador e paraCorpoNovoIndicador)', () => {
  describe('paraIndicador', () => {
    it('indicador com meta via API e integração configurada: origemDaMeta "terceiro" e integracao com os campos salvos', () => {
      const indicador = paraIndicador(INDICADOR_META_API_CONFIGURADO_API as IndicadorApi)

      expect(indicador.origemDaMeta).toBe('terceiro')
      expect(indicador.meta).toBeNull()
      expect(indicador.integracao).toEqual({
        identificador: 'META_MARGEM',
        url: URL_META_VIA_API,
        parametrosSaida: SAIDA_META_VIA_API,
        parametrosEntrada: ENTRADA_META_VIA_API,
        variaveisUsadas: ['competencia', 'filial'],
        pendente: false,
        alteradaEm: '2026-11-10 09:00:00',
        alteradaPor: 'Equipe TI',
      })
    })

    it('integração pendente: campos vazios (null / []) e pendente true', () => {
      const indicador = paraIndicador(INDICADOR_META_API_PENDENTE_API as IndicadorApi)

      expect(indicador.integracao).toEqual({
        identificador: null,
        url: null,
        parametrosSaida: null,
        parametrosEntrada: null,
        variaveisUsadas: [],
        pendente: true,
        alteradaEm: null,
        alteradaPor: null,
      })
    })

    it('origem "terceiro" sem os campos da integração (Validador, API atual): integracao com null, [] e pendente false', () => {
      const semCampos: IndicadorApiFalso = { ...INDICADOR_META_API_PENDENTE_API }
      delete semCampos.identificador
      delete semCampos.url
      delete semCampos['parametros de saida']
      delete semCampos['parametros de entrada']
      delete semCampos['variaveis usadas']
      delete semCampos['integracao pendente']
      delete semCampos['integracao alterada em']
      delete semCampos['integracao alterada por']

      const indicador = paraIndicador(semCampos as IndicadorApi)

      expect(indicador.integracao).toEqual({
        identificador: null,
        url: null,
        parametrosSaida: null,
        parametrosEntrada: null,
        variaveisUsadas: [],
        pendente: false,
        alteradaEm: null,
        alteradaPor: null,
      })
    })

    it('"variaveis usadas" null vira []', () => {
      const indicador = paraIndicador({ ...INDICADOR_META_API_CONFIGURADO_API, 'variaveis usadas': null } as IndicadorApi)

      expect(indicador.integracao?.variaveisUsadas).toEqual([])
    })

    it('indicador de meta manual não tem integracao (undefined), mesmo que a API traga campos da integração', () => {
      expect(paraIndicador(INDICADOR_COBERTURA_VISITAS_API as IndicadorApi).integracao).toBeUndefined()
      expect(
        paraIndicador({ ...INDICADOR_COBERTURA_VISITAS_API, url: URL_META_VIA_API, 'integracao pendente': true } as IndicadorApi)
          .integracao,
      ).toBeUndefined()
    })
  })

  describe('paraCorpoNovoIndicador', () => {
    it('origemDaMeta "terceiro" com dado externo: "origem da meta" terceiro, sem meta nem metas por filial e "meta editavel" false', () => {
      const dados: NovoIndicador = {
        nome: 'Atingimento de faturamento',
        descricao: null,
        origemDaMeta: 'terceiro',
        sentido: 'maior_melhor',
        metaEditavel: false,
        dadoExterno: 42,
      }

      const corpo = paraCorpoNovoIndicador(dados)

      expect(corpo).toEqual({
        nome: 'Atingimento de faturamento',
        descricao: null,
        'origem da meta': 'terceiro',
        'fonte da meta': 'integracao',
        sentido: 'maior_melhor',
        'meta editavel': false,
        'dado externo': 42,
      })
      expect(corpo).not.toHaveProperty('meta')
      expect(corpo).not.toHaveProperty('metas por filial')
    })

    it('origemDaMeta "terceiro" com apontamentos: mantém apontamentos e calculo', () => {
      const corpo = paraCorpoNovoIndicador({
        nome: 'Rotinas com meta da TI',
        descricao: 'Meta vinda da TI.',
        origemDaMeta: 'terceiro',
        sentido: 'menor_melhor',
        metaEditavel: false,
        apontamentos: [5, 7],
        calculo: 'media',
      })

      expect(corpo).toEqual({
        nome: 'Rotinas com meta da TI',
        descricao: 'Meta vinda da TI.',
        'origem da meta': 'terceiro',
        'fonte da meta': 'integracao',
        sentido: 'menor_melhor',
        'meta editavel': false,
        apontamentos: [5, 7],
        calculo: 'media',
      })
    })

    it('com origemDaMeta "terceiro", "meta editavel" vai sempre false e meta/metasPorFilial informados são ignorados', () => {
      const corpo = paraCorpoNovoIndicador({
        nome: 'Faturamento',
        descricao: null,
        origemDaMeta: 'terceiro',
        meta: 10,
        metasPorFilial: [{ filial: '100', meta: 5 }],
        sentido: 'maior_melhor',
        metaEditavel: true,
        dadoExterno: 1,
      })

      expect(corpo['meta editavel']).toBe(false)
      expect(corpo).not.toHaveProperty('meta')
      expect(corpo).not.toHaveProperty('metas por filial')
      expect(corpo['origem da meta']).toBe('terceiro')
    })

    it('sem origemDaMeta (meta digitada) continua com "origem da meta" manual e a meta', () => {
      const corpo = paraCorpoNovoIndicador({
        nome: 'Faturamento',
        descricao: null,
        meta: 1500.5,
        sentido: 'maior_melhor',
        metaEditavel: true,
        dadoExterno: 1,
      })

      expect(corpo).toMatchObject({ 'origem da meta': 'manual', meta: 1500.5, 'meta editavel': true })
    })
  })
})
