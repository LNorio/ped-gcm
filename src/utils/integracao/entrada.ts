/**
 * Parâmetros de entrada da integração (F5.14): JSON (objeto) cujos valores de texto podem ter
 * variáveis entre `%` e expressões (ver `expressoes.ts`).
 *
 * Desde 11/11/2026 (executor das integrações — `docs/backend/FRONT-meta-via-api-fase2.md`, seção 2.1) a
 * entrada é sempre SOAP (o front não tem seletor de `tipo de servico`; o back-end assume `soap`):
 * `{ "operacao": "...", "parametros": { ... } }` ou `{ "operacao": "...", "chamadas": [ { "parametros":
 * { ... } }, ... ] }`, com `operacao` só com letras (sem acento), números e `_`. Os erros de formato vêm
 * antes dos erros das expressões.
 *
 * A validação percorre objetos e listas aninhados na ordem do JSON. Cada valor de texto é resolvido
 * com os valores de exemplo; números, booleanos e nulos ficam iguais. O caminho de cada campo usa `.`
 * para objetos e `[i]` para listas (ex.: `parametros.periodo.fim`, `chamadas[0].parametros.x`).
 *
 * Aviso (seção 2.3): numa consulta que traz todas as filiais, `%filial%`, `%colaborador%` e `%zona%` não
 * têm valor; a entrada válida que usa alguma delas traz um aviso por variável (não bloqueia).
 */

import { analisarJson, type ValorJson } from './json'
import { type ContextoIntegracao, resolverTexto, variaveisDoTexto } from './expressoes'

/** Conta encontrada no JSON de entrada e seu resultado com os valores de exemplo. */
export interface CalculoEntrada {
  caminho: string
  expressao: string
  resultado: string
}

/**
 * - `vazio`: texto vazio ou só com espaços (nada aparece);
 * - `valido`: variáveis usadas (sem repetição, na ordem da primeira ocorrência), cálculos, a prévia do
 *   JSON resolvido (`JSON.stringify(resolvido, null, 2)`) e os avisos (ver `avisosDaEntrada`);
 * - `invalido`: todos os erros encontrados — primeiro os de formato SOAP, depois os das expressões, na
 *   ordem do JSON. Erro de campo no formato `Campo "<caminho>": <motivo> em "<expressão>"`.
 */
export type ResultadoEntrada =
  | { estado: 'vazio' }
  | { estado: 'valido'; variaveisUsadas: string[]; calculos: CalculoEntrada[]; previa: string; avisos: string[] }
  | { estado: 'invalido'; erros: string[] }

/** Variáveis sem valor numa consulta que traz todas as filiais (fase 2, seção 2.3). */
const VARIAVEIS_SEM_VALOR_NA_CONSULTA = ['filial', 'colaborador', 'zona']

const MENSAGEM_SEM_FORMATO_SOAP = 'A entrada deve ter "operacao" e "parametros" (ou "chamadas")'
const PADRAO_OPERACAO = /^[A-Za-z0-9_]+$/

function ehObjetoJson(valor: ValorJson): valor is { [chave: string]: ValorJson } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Avisos das variáveis usadas (nomes sem `%`) que não têm valor numa consulta que traz todas as filiais,
 * na ordem recebida e sem repetir. Usado também com as variáveis devolvidas pelo back-end (F5.18).
 */
export function avisosDaEntrada(variaveisUsadas: readonly string[]): string[] {
  const nomes = variaveisUsadas.filter(
    (nome, indice) => VARIAVEIS_SEM_VALOR_NA_CONSULTA.includes(nome) && variaveisUsadas.indexOf(nome) === indice,
  )
  return nomes.map((nome) => `%${nome}% não tem valor numa consulta que traz todas as filiais; use %empresas%.`)
}

/** Problemas da `operacao` (texto, não vazia, só letras, números e `_`). */
function errosDaOperacao(operacao: ValorJson): string[] {
  if (typeof operacao !== 'string') return ['"operacao" deve ser um texto']
  if (operacao.trim() === '') return ['"operacao" não pode ficar vazia']
  if (!PADRAO_OPERACAO.test(operacao)) return ['"operacao" só aceita letras, números e _']
  return []
}

/** Problemas da lista `chamadas`: lista não vazia de objetos, cada um com `parametros` objeto. */
function errosDasChamadas(chamadas: ValorJson): string[] {
  if (!Array.isArray(chamadas)) return ['"chamadas" deve ser uma lista']
  if (chamadas.length === 0) return ['"chamadas" não pode ficar vazia']
  const erros: string[] = []
  for (const [indice, chamada] of chamadas.entries()) {
    const posicao = indice + 1
    if (!ehObjetoJson(chamada)) erros.push(`Chamada ${posicao}: deve ser um objeto`)
    else if (!Object.hasOwn(chamada, 'parametros')) erros.push(`Chamada ${posicao}: falta "parametros"`)
    else if (!ehObjetoJson(chamada.parametros)) erros.push(`Chamada ${posicao}: "parametros" deve ser um objeto`)
  }
  return erros
}

/** Erros do formato SOAP da raiz (`operacao` e `parametros` ou `chamadas`). */
function errosDoFormato(raiz: { [chave: string]: ValorJson }): string[] {
  const temParametros = Object.hasOwn(raiz, 'parametros')
  const temChamadas = Object.hasOwn(raiz, 'chamadas')
  if (!Object.hasOwn(raiz, 'operacao') || (!temParametros && !temChamadas)) return [MENSAGEM_SEM_FORMATO_SOAP]
  const erros = errosDaOperacao(raiz.operacao)
  if (temParametros) {
    if (!ehObjetoJson(raiz.parametros)) erros.push('"parametros" deve ser um objeto')
  } else {
    erros.push(...errosDasChamadas(raiz.chamadas))
  }
  return erros
}

interface Acumulado {
  variaveisUsadas: string[]
  calculos: CalculoEntrada[]
  erros: string[]
}

function resolverValor(valor: ValorJson, caminho: string, contexto: ContextoIntegracao, acumulado: Acumulado): ValorJson {
  if (Array.isArray(valor)) {
    return valor.map((item, indice) => resolverValor(item, `${caminho}[${indice}]`, contexto, acumulado))
  }
  if (ehObjetoJson(valor)) {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, item]) => [
        chave,
        resolverValor(item, caminho === '' ? chave : `${caminho}.${chave}`, contexto, acumulado),
      ]),
    )
  }
  if (typeof valor !== 'string') return valor

  for (const nome of variaveisDoTexto(valor)) {
    if (!acumulado.variaveisUsadas.includes(nome)) acumulado.variaveisUsadas.push(nome)
  }
  const resultado = resolverTexto(valor, contexto)
  if (!resultado.ok) {
    for (const motivo of resultado.motivos) acumulado.erros.push(`Campo "${caminho}": ${motivo} em "${valor}"`)
    return valor
  }
  if (resultado.conta) acumulado.calculos.push({ caminho, expressao: valor, resultado: resultado.valor })
  return resultado.valor
}

/** Valida o JSON de entrada (formato SOAP e expressões) e monta a prévia resolvida com os valores de exemplo. */
export function validarEntrada(texto: string, contexto: ContextoIntegracao): ResultadoEntrada {
  if (texto.trim() === '') return { estado: 'vazio' }
  const analise = analisarJson(texto)
  if (!analise.ok) return { estado: 'invalido', erros: [analise.erro.mensagem] }
  if (!ehObjetoJson(analise.valor)) return { estado: 'invalido', erros: ['O JSON de entrada deve ser um objeto'] }

  const errosFormato = errosDoFormato(analise.valor)
  const acumulado: Acumulado = { variaveisUsadas: [], calculos: [], erros: [] }
  const resolvido = resolverValor(analise.valor, '', contexto, acumulado)
  const erros = [...errosFormato, ...acumulado.erros]
  if (erros.length > 0) return { estado: 'invalido', erros }
  return {
    estado: 'valido',
    variaveisUsadas: acumulado.variaveisUsadas,
    calculos: acumulado.calculos,
    previa: JSON.stringify(resolvido, null, 2),
    avisos: avisosDaEntrada(acumulado.variaveisUsadas),
  }
}
