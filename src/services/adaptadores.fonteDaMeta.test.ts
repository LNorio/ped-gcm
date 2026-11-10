import { describe, expect, it } from 'vitest'
import {
  ENTRADA_INTEGRACAO_DADO_FATURAMENTO,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_ERRO_API,
  INDICADOR_META_SEM_META_NO_MES_API,
  SAIDA_INTEGRACAO_DADO_FATURAMENTO,
  URL_INTEGRACAO_DADO_FATURAMENTO,
  tarefaMetaApi,
  type IndicadorApiFalso,
} from '../test/indicadoresFalsos'
import type { NovoIndicador } from '../types/dominio'
import { type IndicadorApi, paraCorpoNovoIndicador, paraIndicador } from './adaptadores'

/**
 * F6.11 — Contrato final da meta via API (`docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md`,
 * seções 2.1 e 2.4, confirmado em `CONFIRMACAO-FRONT-meta-via-api.md` — 10/11/2026).
 *
 * `paraIndicador` (só nos indicadores com `origem da meta = terceiro`; nos de meta manual os quatro
 * campos ficam `undefined`, para não mudar os indicadores atuais):
 * - `fonteDaMeta` ← `"fonte da meta"` (`dado_externo` | `integracao`); ausente/`null` → `integracao`
 *   (comportamento anterior da F6.11: meta via integração do indicador);
 * - `situacaoDaMetaViaApi` ← `"situacao da meta via api"`; ausente → `null`;
 * - `tarefaBitrix` ← `tarefa` (`{ titulo, status, "id bitrix" }`, mesmo formato do dado externo; número
 *   em texto só com dígitos vira número; `"id bitrix"` `null` = aguardando envio); ausente → `null`;
 * - `integracaoDoDadoExterno` ← `"integracao do dado externo"` (só a fonte `dado_externo`, Admin);
 *   ausente → `null`; sempre `null` na fonte `integracao`.
 *
 * `paraCorpoNovoIndicador` com `origemDaMeta: 'terceiro'`: `"fonte da meta"` = `fonteDaMeta`
 * (ausente → `integracao`), `"meta editavel": false`, sem meta.
 */
describe('F6.11 — Meta via API, contrato final: adaptadores (fonte da meta, situação, tarefa)', () => {
  const converter = (api: IndicadorApiFalso) => paraIndicador(api as IndicadorApi)

  describe('paraIndicador', () => {
    it('fonte dado_externo: fonteDaMeta, situação ok, sem tarefa e a integração do dado externo (só leitura)', () => {
      const indicador = converter(INDICADOR_META_DADO_EXTERNO_API)

      expect(indicador.origemDaMeta).toBe('terceiro')
      expect(indicador.fonteDaMeta).toBe('dado_externo')
      expect(indicador.situacaoDaMetaViaApi).toBe('ok')
      expect(indicador.tarefaBitrix).toBeNull()
      expect(indicador.integracaoDoDadoExterno).toEqual({
        identificador: 'FATURAMENTO',
        url: URL_INTEGRACAO_DADO_FATURAMENTO,
        parametrosSaida: SAIDA_INTEGRACAO_DADO_FATURAMENTO,
        parametrosEntrada: ENTRADA_INTEGRACAO_DADO_FATURAMENTO,
      })
      expect(indicador.meta).toBeNull()
      expect(indicador.metaADefinir).toBe(false)
    })

    it('fonte dado_externo sem meta no mês: situação sem_meta_no_mes e as filiais sem meta', () => {
      const indicador = converter(INDICADOR_META_SEM_META_NO_MES_API)

      expect(indicador.situacaoDaMetaViaApi).toBe('sem_meta_no_mes')
      expect(indicador.filiaisSemMeta).toEqual(['101', '102'])
    })

    it.each([
      ['integracao_pendente', INDICADOR_META_API_PENDENTE_API],
      ['ok', INDICADOR_META_API_CONFIGURADO_API],
      ['aguardando_consulta', INDICADOR_META_AGUARDANDO_API],
      ['erro', INDICADOR_META_ERRO_API],
    ] as const)('fonte integracao: situação %s e integracaoDoDadoExterno null', (situacao, api) => {
      const indicador = converter(api)

      expect(indicador.fonteDaMeta).toBe('integracao')
      expect(indicador.situacaoDaMetaViaApi).toBe(situacao)
      expect(indicador.integracaoDoDadoExterno).toBeNull()
    })

    it('tarefa aguardando envio ("id bitrix" null): { id: null, status, titulo }', () => {
      expect(converter(INDICADOR_META_API_PENDENTE_API).tarefaBitrix).toEqual({
        id: null,
        status: 'aguardando_envio',
        titulo: '[PED] Integração da meta: Faturamento com meta da TI',
      })
    })

    it('tarefa enviada: "id bitrix" número ou texto só com dígitos vira número', () => {
      expect(converter(INDICADOR_META_AGUARDANDO_API).tarefaBitrix).toEqual({
        id: 4521,
        status: 'aberta',
        titulo: '[PED] Integração da meta: Novos clientes com meta da TI',
      })
      expect(converter(INDICADOR_META_ERRO_API).tarefaBitrix).toMatchObject({ id: 4522, status: 'concluida' })
    })

    it('sem "fonte da meta" (indicador terceiro anterior ao contrato final): fonteDaMeta integracao, situação e tarefa null', () => {
      const semCampos: IndicadorApiFalso = { ...INDICADOR_META_API_PENDENTE_API }
      delete semCampos['fonte da meta']
      delete semCampos['situacao da meta via api']
      delete semCampos.tarefa

      const indicador = converter(semCampos)

      expect(indicador.fonteDaMeta).toBe('integracao')
      expect(indicador.situacaoDaMetaViaApi).toBeNull()
      expect(indicador.tarefaBitrix).toBeNull()
      expect(indicador.integracaoDoDadoExterno).toBeNull()
    })

    it('"fonte da meta" null também vira integracao', () => {
      expect(converter({ ...INDICADOR_META_API_PENDENTE_API, 'fonte da meta': null }).fonteDaMeta).toBe('integracao')
    })

    it('fonte dado_externo sem "integracao do dado externo" (Validador): integracaoDoDadoExterno null', () => {
      const semIntegracao: IndicadorApiFalso = { ...INDICADOR_META_DADO_EXTERNO_API }
      delete semIntegracao['integracao do dado externo']

      expect(converter(semIntegracao).integracaoDoDadoExterno).toBeNull()
    })

    it('fonte integracao: "integracao do dado externo" recebida por engano é ignorada (null)', () => {
      const indicador = converter({
        ...INDICADOR_META_API_CONFIGURADO_API,
        'integracao do dado externo': INDICADOR_META_DADO_EXTERNO_API['integracao do dado externo'],
      })

      expect(indicador.integracaoDoDadoExterno).toBeNull()
    })

    it('indicador de meta manual: fonteDaMeta, situacaoDaMetaViaApi, tarefaBitrix e integracaoDoDadoExterno ficam undefined', () => {
      const indicador = converter({
        ...INDICADOR_COBERTURA_VISITAS_API,
        'fonte da meta': null,
        'situacao da meta via api': null,
        tarefa: tarefaMetaApi('qualquer'),
      })

      expect(indicador.fonteDaMeta).toBeUndefined()
      expect(indicador.situacaoDaMetaViaApi).toBeUndefined()
      expect(indicador.tarefaBitrix).toBeUndefined()
      expect(indicador.integracaoDoDadoExterno).toBeUndefined()
    })
  })

  describe('paraCorpoNovoIndicador', () => {
    const BASE: NovoIndicador = {
      nome: 'Faturamento com meta do ERP',
      descricao: null,
      origemDaMeta: 'terceiro',
      sentido: 'maior_melhor',
      metaEditavel: false,
      dadoExterno: 1,
    }

    it('fonteDaMeta dado_externo: "fonte da meta" dado_externo, "meta editavel" false, sem meta', () => {
      const corpo = paraCorpoNovoIndicador({ ...BASE, fonteDaMeta: 'dado_externo' })

      expect(corpo).toEqual({
        nome: 'Faturamento com meta do ERP',
        descricao: null,
        'origem da meta': 'terceiro',
        'fonte da meta': 'dado_externo',
        sentido: 'maior_melhor',
        'meta editavel': false,
        'dado externo': 1,
      })
    })

    it('fonteDaMeta integracao com apontamentos: "fonte da meta" integracao, apontamentos e calculo', () => {
      const corpo = paraCorpoNovoIndicador({
        nome: 'Novos clientes com meta da TI',
        descricao: null,
        origemDaMeta: 'terceiro',
        fonteDaMeta: 'integracao',
        sentido: 'maior_melhor',
        metaEditavel: false,
        apontamentos: [6],
        calculo: 'soma',
      })

      expect(corpo).toEqual({
        nome: 'Novos clientes com meta da TI',
        descricao: null,
        'origem da meta': 'terceiro',
        'fonte da meta': 'integracao',
        sentido: 'maior_melhor',
        'meta editavel': false,
        apontamentos: [6],
        calculo: 'soma',
      })
    })

    it('origemDaMeta terceiro sem fonteDaMeta: "fonte da meta" integracao', () => {
      expect(paraCorpoNovoIndicador(BASE)['fonte da meta']).toBe('integracao')
    })

    it('meta manual (sem origemDaMeta): sem "fonte da meta", mesmo que fonteDaMeta seja informada', () => {
      const corpo = paraCorpoNovoIndicador({
        nome: 'Faturamento',
        descricao: null,
        fonteDaMeta: 'dado_externo',
        meta: 10,
        sentido: 'maior_melhor',
        metaEditavel: true,
        dadoExterno: 1,
      })

      expect(corpo).not.toHaveProperty('fonte da meta')
      expect(corpo).toMatchObject({ 'origem da meta': 'manual', meta: 10 })
    })
  })
})
