import { describe, expect, it } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import { dadosExternosParaDashboardApi } from '../../test/dashboardsFalsos'
import {
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_CONSULTADO_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_ERRO_API,
  INDICADOR_META_ERRO_CONSULTA_API,
  INDICADOR_META_SEM_META_NO_MES_API,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { motivoIndisponibilidade } from './regrasDashboard'

/**
 * F7.6 — Indicadores com meta via API no dashboard (contrato final: RESPOSTA-FINAL-meta-via-api.md,
 * seção 2.6, e CONFIRMACAO-FRONT-meta-via-api.md — 10/11/2026).
 *
 * `motivoIndisponibilidade` ganha, depois de "Meta a definir" e antes da regra RF-53, a regra da meta
 * via API: na fonte `integracao` o indicador só entra com a integração salva e meta no mês aberto
 * (situação `ok`); senão fica indisponível com o motivo:
 * - `integracao_pendente` (ou, sem a situação, `integracao.pendente`) → "Integração da meta pendente";
 * - `aguardando_consulta` → "Aguardando a primeira consulta da meta";
 * - `erro` → "Erro na consulta da meta".
 * A fonte `dado_externo` entra normalmente (`ok` ou `sem_meta_no_mes`: filial sem meta fica sem
 * atingimento).
 *
 * Executor das integrações (fase 2 — FRONT-meta-via-api-fase2.md e API (27).md, 11/11/2026): a fonte
 * `integracao` só entra no dashboard com meta no mês aberto. Decisão: **nenhuma regra local nova** —
 * situação `ok` continua disponível mesmo com `filiaisSemMeta` (inclusive todas as filiais do vínculo);
 * quem decide é o back-end, que recusa com 400 ("...ainda nao tem meta no mes aberto (a consulta nao
 * trouxe meta)..."), exibido no alerta do diálogo. A situação `erro` continua indisponível.
 */
const DADOS_EXTERNOS = dadosExternosParaDashboardApi().map(paraDadoExterno)
const motivo = (api: IndicadorApiFalso, tipo: Parameters<typeof motivoIndisponibilidade>[1] = 'cargos') =>
  motivoIndisponibilidade(paraIndicador(api), tipo, DADOS_EXTERNOS)

const PENDENTE = 'Integração da meta pendente'
const AGUARDANDO = 'Aguardando a primeira consulta da meta'
const ERRO = 'Erro na consulta da meta'

describe('F7.6 — motivoIndisponibilidade: indicadores com meta via API', () => {
  it.each<[string, IndicadorApiFalso, string]>([
    ['integracao_pendente', INDICADOR_META_API_PENDENTE_API, PENDENTE],
    ['aguardando_consulta', INDICADOR_META_AGUARDANDO_API, AGUARDANDO],
    ['erro', INDICADOR_META_ERRO_API, ERRO],
  ])('fonte integracao, situação %s → indisponível em qualquer vínculo', (_situacao, api, esperado) => {
    for (const tipo of ['', 'filiais', 'cargos', 'colaboradores'] as const) {
      expect(motivo(api, tipo)).toBe(esperado)
    }
  })

  it('fonte integracao, situação ok → disponível', () => {
    expect(motivo(INDICADOR_META_API_CONFIGURADO_API)).toBeNull()
  })

  it('fonte integracao sem a situação (API anterior): integracao.pendente → "Integração da meta pendente"; configurada → disponível', () => {
    expect(motivo({ ...INDICADOR_META_API_PENDENTE_API, 'situacao da meta via api': null })).toBe(PENDENTE)
    expect(motivo({ ...INDICADOR_META_API_CONFIGURADO_API, 'situacao da meta via api': null })).toBeNull()
  })

  it.each<[string, IndicadorApiFalso]>([
    ['ok', INDICADOR_META_DADO_EXTERNO_API],
    ['sem_meta_no_mes', INDICADOR_META_SEM_META_NO_MES_API],
  ])('fonte dado_externo, situação %s → disponível (entra normalmente)', (_situacao, api) => {
    expect(motivo(api)).toBeNull()
    expect(motivo(api, 'filiais')).toBeNull()
  })

  it('executor: fonte integracao consultada (ok) com filiais sem meta no mês aberto → disponível (sem regra local; o back-end decide)', () => {
    for (const tipo of ['', 'filiais', 'cargos', 'colaboradores'] as const) {
      expect(motivo(INDICADOR_META_CONSULTADO_API, tipo)).toBeNull()
    }
  })

  it('executor: fonte integracao ok sem meta em nenhuma das filiais (todas em filiais sem meta) → continua disponível', () => {
    const todasSemMeta: IndicadorApiFalso = { ...INDICADOR_META_CONSULTADO_API, 'filiais sem meta': ['100', '101', '102', '200', '305'] }

    expect(motivo(todasSemMeta, 'filiais')).toBeNull()
  })

  it('executor: fonte integracao com erro na última consulta (com data do último sucesso) → "Erro na consulta da meta"', () => {
    expect(motivo(INDICADOR_META_ERRO_CONSULTA_API)).toBe(ERRO)
  })

  it('prioridade: inativo e componente desativado vêm antes do motivo da meta via API', () => {
    expect(motivo({ ...INDICADOR_META_AGUARDANDO_API, ativo: false })).toBe('Indicador inativo')
    expect(motivo({ ...INDICADOR_META_AGUARDANDO_API, 'componentes desativados': true })).toBe('Componente desativado')
  })

  it('prioridade: o motivo da meta via API vem antes da regra RF-53 (dado externo por Zona de venda em dashboard por filiais)', () => {
    const porZona: IndicadorApiFalso = {
      ...INDICADOR_META_API_PENDENTE_API,
      composicao: { tipo: 'dado_externo', itens: [{ id: 20, nome: 'Vendas por zona (dado externo)', ativo: true }] },
    }

    expect(motivo(porZona, 'filiais')).toBe(PENDENTE)
  })
})
