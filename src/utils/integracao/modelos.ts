/**
 * Modelos do atalho "Inserir modelo" dos campos JSON da integração (F5.14), com 2 espaços de
 * indentação. Ambos são válidos pelo próprio motor de validação.
 */

/**
 * Exemplo de JSON de saída da integração do dado externo: lista com um item por filial (`filial`,
 * `valor`, `competencia`), conforme a seção 2.3 de `docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md`.
 */
export const MODELO_JSON_SAIDA = JSON.stringify(
  [
    { filial: '101', valor: '1500,00', competencia: '10/2026' },
    { filial: '102', valor: '980,50', competencia: '10/2026' },
  ],
  null,
  2,
)

/** Exemplo de JSON de saída da integração da meta do indicador: lista com `filial`, `meta` e `competencia`. */
export const MODELO_JSON_SAIDA_META = JSON.stringify(
  [
    { filial: '101', meta: '4600000', competencia: '10/2026' },
    { filial: '102', meta: '3200000', competencia: '10/2026' },
  ],
  null,
  2,
)

/** Exemplo de JSON de entrada do documento de requisito, com variáveis e expressões. */
export const MODELO_JSON_ENTRADA = JSON.stringify(
  {
    filial: '%filial%',
    competencia: '%competencia%',
    inicio: '%dataInicial% - 3m',
    fim: '%dataFinal%',
    dias: '%dataFinal% - %dataInicial% + 1',
  },
  null,
  2,
)
