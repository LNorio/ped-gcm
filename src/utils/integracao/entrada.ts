/**
 * Parâmetros de entrada da integração (F5.14): JSON (objeto) cujos valores de texto podem ter
 * variáveis entre `%` e expressões (ver `expressoes.ts`).
 *
 * A validação percorre objetos e listas aninhados na ordem do JSON. Cada valor de texto é resolvido
 * com os valores de exemplo; números, booleanos e nulos ficam iguais. O caminho de cada campo usa `.`
 * para objetos e `[i]` para listas (ex.: `periodo.fim`, `lista[0]`).
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
 * - `valido`: variáveis usadas (sem repetição, na ordem da primeira ocorrência), cálculos e a prévia do
 *   JSON resolvido (`JSON.stringify(resolvido, null, 2)`);
 * - `invalido`: todos os erros encontrados, na ordem do JSON. Erro de campo no formato
 *   `Campo "<caminho>": <motivo> em "<expressão>"`.
 */
export type ResultadoEntrada =
  | { estado: 'vazio' }
  | { estado: 'valido'; variaveisUsadas: string[]; calculos: CalculoEntrada[]; previa: string }
  | { estado: 'invalido'; erros: string[] }

function ehObjetoJson(valor: ValorJson): valor is { [chave: string]: ValorJson } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
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

/** Valida o JSON de entrada e monta a prévia resolvida com os valores de exemplo. */
export function validarEntrada(texto: string, contexto: ContextoIntegracao): ResultadoEntrada {
  if (texto.trim() === '') return { estado: 'vazio' }
  const analise = analisarJson(texto)
  if (!analise.ok) return { estado: 'invalido', erros: [analise.erro.mensagem] }
  if (!ehObjetoJson(analise.valor)) return { estado: 'invalido', erros: ['O JSON de entrada deve ser um objeto'] }

  const acumulado: Acumulado = { variaveisUsadas: [], calculos: [], erros: [] }
  const resolvido = resolverValor(analise.valor, '', contexto, acumulado)
  if (acumulado.erros.length > 0) return { estado: 'invalido', erros: acumulado.erros }
  return {
    estado: 'valido',
    variaveisUsadas: acumulado.variaveisUsadas,
    calculos: acumulado.calculos,
    previa: JSON.stringify(resolvido, null, 2),
  }
}
