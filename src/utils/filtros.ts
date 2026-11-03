/**
 * Utilitários genéricos de filtro para listagens (F1.12 — RNF-09).
 *
 * Usados pelas telas de cadastro para busca textual e contagem por categoria, sem repetir a
 * normalização de acentos/maiúsculas em cada página.
 */

import { normalizarBusca } from './formato'

/**
 * Filtra `itens` pelo `termo` de busca, comparando com o texto (ou textos) devolvido por `obterTexto`.
 * Acentos, maiúsculas e espaços repetidos são ignorados; a comparação é por "contém".
 * Termo vazio (ou só espaços) devolve todos os itens, na ordem original.
 */
export function filtrarPorBusca<T>(itens: readonly T[], termo: string, obterTexto: (item: T) => string | readonly string[]): T[] {
  const termoNormalizado = normalizarBusca(termo)
  if (termoNormalizado === '') return [...itens]

  return itens.filter((item) => {
    const texto = obterTexto(item)
    const campos = typeof texto === 'string' ? [texto] : texto
    return campos.some((campo) => normalizarBusca(campo).includes(termoNormalizado))
  })
}

/** Conta os itens agrupados pela chave devolvida por `obterChave`; só chaves com ocorrência aparecem. */
export function contarPor<T, K extends string>(itens: readonly T[], obterChave: (item: T) => K): Partial<Record<K, number>> {
  const contagem: Partial<Record<K, number>> = {}
  for (const item of itens) {
    const chave = obterChave(item)
    contagem[chave] = (contagem[chave] ?? 0) + 1
  }
  return contagem
}
