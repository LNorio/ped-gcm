/**
 * Regras da meta via API do indicador (F6.11 e F7.6, contrato final — `RESPOSTA-FINAL-meta-via-api.md`),
 * usadas pela aba Indicadores (filtro, alertas locais, etiquetas e menu) e pelos dashboards
 * (indisponibilidade do indicador).
 */
import type { FonteMeta, Indicador, SituacaoMetaViaApi } from '../types/dominio'

/** Indicador com meta via API cuja fonte é a integração do indicador (fonte ausente = `integracao`). */
export function usaIntegracaoDoIndicador(indicador: Indicador): boolean {
  return indicador.origemDaMeta === 'terceiro' && indicador.fonteDaMeta !== 'dado_externo'
}

/** Indicador com meta via API vinda do próprio dado externo da composição. */
export function usaMetaDoDadoExterno(indicador: Indicador): boolean {
  return indicador.origemDaMeta === 'terceiro' && indicador.fonteDaMeta === 'dado_externo'
}

/**
 * Situação efetiva da meta via API: a informada pela API ou, sem ela (API anterior ao contrato final),
 * `integracao_pendente` quando `integracao.pendente` na fonte `integracao`. `null` = nada a sinalizar
 * (meta manual ou sem situação). `integracao_pendente` só vale na fonte `integracao`.
 */
export function situacaoDaMetaViaApi(indicador: Indicador): SituacaoMetaViaApi | null {
  if (indicador.origemDaMeta !== 'terceiro') return null
  const situacao = indicador.situacaoDaMetaViaApi ?? null
  if (situacao === null) {
    return usaIntegracaoDoIndicador(indicador) && indicador.integracao?.pendente === true ? 'integracao_pendente' : null
  }
  if (situacao === 'integracao_pendente' && !usaIntegracaoDoIndicador(indicador)) return null
  return situacao
}

/** Integração da meta pendente (filtro "Integração pendente (TI)" e alerta da aba). */
export function integracaoDaMetaPendente(indicador: Indicador): boolean {
  return situacaoDaMetaViaApi(indicador) === 'integracao_pendente'
}

/** Aviso da fonte `integracao` quando a consulta ainda não roda no back-end (fase 1). */
export const AVISO_CONSULTA_INTEGRACAO_INDISPONIVEL =
  'A consulta desta fonte ainda não está disponível. O indicador será cadastrado e a integração poderá ser configurada; a meta chegará quando a consulta for liberada.'

/**
 * Fonte da meta via API escolhida no cadastro e no "Definir meta": `dado_externo` só quando o dado
 * externo da composição fornece meta e "Meta vinda do dado externo" está marcado; senão `integracao`.
 */
export function fonteDaMetaEscolhida(dadoForneceMeta: boolean, metaDoDado: boolean): FonteMeta {
  return dadoForneceMeta && metaDoDado ? 'dado_externo' : 'integracao'
}
