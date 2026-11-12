/**
 * Modelos do atalho "Inserir modelo" dos campos JSON da integração (F5.14), com 2 espaços de
 * indentação. Ambos são válidos pelo próprio motor de validação.
 */

/**
 * Exemplo genérico de JSON de saída da integração, para dado externo e indicador: objeto
 * `{ "campo": "tipo" }` que descreve um item da resposta. A saída é só referência para a equipe de
 * desenvolvimento e os nomes são livres (contrato final, 11/11/2026 — `docs/backend/FRONT-saida-chave-tipo (1).md`,
 * seção 5).
 */
export const MODELO_JSON_SAIDA = JSON.stringify({ codigo_filial: 'string', quantidade: 'number', data: 'date' }, null, 2)

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
