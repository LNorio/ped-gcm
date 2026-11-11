/**
 * Modelos do atalho "Inserir modelo" dos campos JSON da integração (F5.14), com 2 espaços de
 * indentação. Ambos são válidos pelo próprio motor de validação.
 */

/**
 * Exemplo de JSON de saída da integração do dado externo: objeto `{ "campo": "tipo" }` que descreve um
 * item da resposta (saída por "chave: tipo", 11/11/2026 — `docs/propostas-backend/FRONT-saida-chave-tipo.md`).
 */
export const MODELO_JSON_SAIDA = JSON.stringify({ codfil: 'string', vlrLiq: 'number' }, null, 2)

/** Exemplo de JSON de saída da integração da meta do indicador (`{ "campo": "tipo" }`). */
export const MODELO_JSON_SAIDA_META = JSON.stringify({ codfil: 'string', metVlr: 'number' }, null, 2)

/**
 * Exemplo de JSON de entrada no formato SOAP `{ operacao, parametros }` (executor, 11/11/2026 —
 * `docs/backend/FRONT-meta-via-api-fase2.md`, seção 2.1).
 */
export const MODELO_JSON_ENTRADA = JSON.stringify(
  {
    operacao: 'NomeDaOperacao',
    parametros: { EDatIni: '%dataInicial%', EDatFim: '%dataFinal%', ECodEmp: '%empresas%' },
  },
  null,
  2,
)
