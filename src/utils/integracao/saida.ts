/**
 * Parâmetros de saída da integração (F5.14): a estrutura de **um item** da resposta da consulta.
 *
 * Desde 11/11/2026 (saída por "chave: tipo", opção B — `docs/propostas-backend/FRONT-saida-chave-tipo.md`)
 * a saída é um **objeto** `{ "campo": "tipo" }`, com os tipos `string`, `number`, `date` ou `boolean`
 * (exatos, em minúsculas). A resposta real continua sendo uma lista com todas as filiais; o objeto só
 * declara os campos de cada item. Desde 11/11/2026 (saída sem mapeamento —
 * `RESPOSTA-FRONT-saida-sem-mapeamento.md`) a saída só mostra ao back-end a saída esperada do web service:
 * não há mapeamento na modal, e esta é a única validação da saída (ela não vai mais ao `validar`).
 *
 * A lista (formato antigo, com valores ou marcadores) não é mais aceita na modal: a TI reescreve no
 * formato novo (decisão do usuário de 11/11/2026).
 */

import { analisarJson, type ValorJson } from './json'

export type TipoCampoSaida = 'string' | 'number' | 'date' | 'boolean'

export const TIPOS_CAMPO_SAIDA: readonly TipoCampoSaida[] = ['string', 'number', 'date', 'boolean']

/** Campo de valor da integração: `valor` (dado externo) ou `meta` (indicador). */
export type CampoValorSaida = 'valor' | 'meta'

export interface CampoSaida {
  nome: string
  tipo: TipoCampoSaida
}

/**
 * - `vazio`: texto vazio ou só com espaços (nada aparece);
 * - `valido`: campos do objeto e o resumo (ex.: `3 campos: codemp (string), codfil (string), vlrLiq (number)`);
 * - `invalido`: mensagem com linha, coluna e explicação, ou o motivo de a estrutura não ser aceita.
 */
export type ResultadoSaida =
  | { estado: 'vazio' }
  | { estado: 'valido'; campos: CampoSaida[]; resumo: string }
  | { estado: 'invalido'; mensagem: string }

export const MENSAGEM_FORMATO_ANTIGO_SAIDA = 'Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.'
const MENSAGEM_SAIDA_VAZIA = 'A saída precisa descrever ao menos um campo, ex.: { "codfil": "string", "vlrLiq": "number" }'
const MENSAGEM_NAO_OBJETO = 'A saída deve ser um objeto { "campo": "tipo" }'

function ehObjetoJson(valor: ValorJson): valor is { [chave: string]: ValorJson } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function ehTipoCampoSaida(valor: ValorJson): valor is TipoCampoSaida {
  return typeof valor === 'string' && (TIPOS_CAMPO_SAIDA as readonly string[]).includes(valor)
}

/** Resumo no formato do back-end: `N campos: a (string), b (number)` (singular `1 campo: ...`). */
export function resumoDosCampos(campos: readonly CampoSaida[]): string {
  const quantidade = campos.length === 1 ? '1 campo' : `${campos.length} campos`
  return `${quantidade}: ${campos.map(({ nome, tipo }) => `${nome} (${tipo})`).join(', ')}`
}

/**
 * Valida o JSON de saída (`{ "campo": "tipo" }`). `campoValor` é mantido na assinatura: a regra da saída
 * é a mesma no dado externo e no indicador.
 */
export function validarSaida(texto: string, _campoValor: CampoValorSaida): ResultadoSaida {
  if (texto.trim() === '') return { estado: 'vazio' }
  const analise = analisarJson(texto)
  if (!analise.ok) return { estado: 'invalido', mensagem: analise.erro.mensagem }

  const objeto = analise.valor
  if (Array.isArray(objeto)) return { estado: 'invalido', mensagem: MENSAGEM_FORMATO_ANTIGO_SAIDA }
  if (!ehObjetoJson(objeto)) return { estado: 'invalido', mensagem: MENSAGEM_NAO_OBJETO }

  const entradas = Object.entries(objeto)
  if (entradas.length === 0) return { estado: 'invalido', mensagem: MENSAGEM_SAIDA_VAZIA }

  const campos: CampoSaida[] = []
  for (const [nome, tipo] of entradas) {
    if (!ehTipoCampoSaida(tipo)) {
      return {
        estado: 'invalido',
        mensagem: `O campo "${nome}" da saída tem tipo ${JSON.stringify(tipo)}; use string, number, date ou boolean`,
      }
    }
    campos.push({ nome, tipo })
  }
  return { estado: 'valido', campos, resumo: resumoDosCampos(campos) }
}
