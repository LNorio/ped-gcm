/**
 * Parâmetros de saída da integração (F5.14): a estrutura que a consulta devolve ao PED.
 *
 * Desde 10/11/2026 (contrato final da meta via API, seção 2.3 de
 * `docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md`) a saída **é uma lista** com um item por
 * filial: cada item é um objeto com `filial` e o campo de valor (`valor` na integração do dado externo,
 * `meta` na do indicador); `competencia` é opcional. O resumo descreve os campos do primeiro item.
 * Tipos com os nomes do back-end (iguais aos devolvidos por `POST /api/ped/integracao/validar` — F5.18):
 * `texto`, `numero` (sem acento), `booleano`, `nulo`, `lista`, `objeto`.
 */

import { analisarJson, type ValorJson } from './json'

export type TipoCampoSaida = 'texto' | 'numero' | 'booleano' | 'nulo' | 'lista' | 'objeto'

/** Campo de valor exigido em cada item: `valor` (dado externo) ou `meta` (indicador). */
export type CampoValorSaida = 'valor' | 'meta'

export interface CampoSaida {
  nome: string
  tipo: TipoCampoSaida
}

/**
 * - `vazio`: texto vazio ou só com espaços (nada aparece);
 * - `valido`: campos do primeiro item e o resumo (ex.: `3 campos: filial (texto), valor (texto), ...`);
 * - `invalido`: mensagem com linha, coluna e explicação, ou o motivo de a estrutura não ser aceita.
 */
export type ResultadoSaida =
  | { estado: 'vazio' }
  | { estado: 'valido'; campos: CampoSaida[]; resumo: string }
  | { estado: 'invalido'; mensagem: string }

const MENSAGEM_NAO_LISTA = 'A saída deve ser uma lista com um item por filial'

function ehObjetoJson(valor: ValorJson): valor is { [chave: string]: ValorJson } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function tipoDoValor(valor: ValorJson): TipoCampoSaida {
  if (valor === null) return 'nulo'
  if (Array.isArray(valor)) return 'lista'
  if (typeof valor === 'string') return 'texto'
  if (typeof valor === 'number') return 'numero'
  if (typeof valor === 'boolean') return 'booleano'
  return 'objeto'
}

/** Problema do item (posição a partir de 1), ou `null` quando o item é válido. */
function problemaDoItem(item: ValorJson, posicao: number, campoValor: CampoValorSaida): string | null {
  if (!ehObjetoJson(item)) return `Item ${posicao}: deve ser um objeto`
  const faltando = ['filial', campoValor].filter((campo) => !Object.hasOwn(item, campo))
  if (faltando.length === 0) return null
  if (faltando.length === 1) return `Item ${posicao}: falta o campo ${faltando[0]}`
  return `Item ${posicao}: faltam os campos ${faltando.join(' e ')}`
}

/** Valida o JSON de saída (lista, um item por filial) e descreve os campos do primeiro item. */
export function validarSaida(texto: string, campoValor: CampoValorSaida): ResultadoSaida {
  if (texto.trim() === '') return { estado: 'vazio' }
  const analise = analisarJson(texto)
  if (!analise.ok) return { estado: 'invalido', mensagem: analise.erro.mensagem }

  const lista = analise.valor
  if (!Array.isArray(lista)) return { estado: 'invalido', mensagem: MENSAGEM_NAO_LISTA }
  if (lista.length === 0) return { estado: 'invalido', mensagem: 'A lista está vazia' }

  for (const [indice, item] of lista.entries()) {
    const problema = problemaDoItem(item, indice + 1, campoValor)
    if (problema !== null) return { estado: 'invalido', mensagem: problema }
  }

  const primeiro = lista[0] as { [chave: string]: ValorJson }
  const campos = Object.entries(primeiro).map(([nome, valor]): CampoSaida => ({ nome, tipo: tipoDoValor(valor) }))
  const descricao = campos.map((campo) => `${campo.nome} (${campo.tipo})`).join(', ')
  const quantidade = campos.length === 1 ? '1 campo' : `${campos.length} campos`
  return { estado: 'valido', campos, resumo: `${quantidade}: ${descricao}` }
}
