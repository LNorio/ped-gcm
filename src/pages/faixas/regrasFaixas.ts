/**
 * Regras da aba Faixas (F8.2, F8.3, F8.4 — RF-41, RF-43, RF-44, RNF-03).
 *
 * - `nomeTabelaFaixas`: nome exibido da tabela, "{dashboard} · Filial {filial}" (sem a descrição).
 * - Linhas editáveis (De, Até e Alíquota em texto pt-BR) e a validação que as converte em faixas
 *   numéricas, lendo com `lerDecimal` (vírgula decimal, ponto de milhar: "2.000" = 2000).
 */
import type { Faixa, TabelaFaixas } from '../../types/dominio'
import { formatarNumero, lerDecimal } from '../../utils/formato'

/** Nome da tabela exibido na aba: "{dashboard} · Filial {filial}". */
export function nomeTabelaFaixas(tabela: Pick<TabelaFaixas, 'dashboard' | 'filial'>): string {
  return `${tabela.dashboard} · Filial ${tabela.filial}`
}

/** Linha do editor de faixas, com os valores como digitados (pt-BR). */
export interface LinhaFaixaEditavel {
  de: string
  ate: string
  aliquota: string
}

export type ResultadoValidacaoFaixas = { erro: null; faixas: Faixa[] } | { erro: string; faixas: null }

export function linhaFaixaVazia(): LinhaFaixaEditavel {
  return { de: '', ate: '', aliquota: '' }
}

function falha(erro: string): ResultadoValidacaoFaixas {
  return { erro, faixas: null }
}

/**
 * Valida as linhas na ordem exibida e devolve as faixas numéricas, ou a mensagem da primeira linha
 * com problema (RF-43). Lacunas entre faixas são permitidas; cada faixa deve começar acima do "Até"
 * da anterior.
 */
export function validarLinhasFaixas(linhas: LinhaFaixaEditavel[]): ResultadoValidacaoFaixas {
  if (linhas.length === 0) return falha('Adicione ao menos uma faixa.')

  const faixas: Faixa[] = []
  for (const [indice, linha] of linhas.entries()) {
    const n = indice + 1
    if (linha.de.trim() === '' || linha.ate.trim() === '' || linha.aliquota.trim() === '') {
      return falha(`Preencha De, Até e Alíquota da faixa ${n}.`)
    }

    const de = lerDecimal(linha.de)
    const ate = lerDecimal(linha.ate)
    const aliquota = lerDecimal(linha.aliquota)
    if (de === null || ate === null || aliquota === null) {
      return falha(`Informe números válidos na faixa ${n} (ex.: 1.000,50).`)
    }
    if (de < 0 || ate < 0) return falha(`Os valores da faixa ${n} não podem ser negativos.`)
    if (aliquota < 0) return falha(`A alíquota da faixa ${n} não pode ser negativa.`)
    if (de >= ate) return falha(`Na faixa ${n}, o valor “De” deve ser menor que “Até”.`)

    const anterior = faixas.at(-1)
    if (anterior && de <= anterior.ate) {
      return falha(`A faixa ${n} deve começar acima do limite da faixa ${n - 1}.`)
    }
    faixas.push({ de, ate, aliquota })
  }
  return { erro: null, faixas }
}

/** Faixas numéricas → linhas editáveis no padrão pt-BR com 2 casas (RNF-03). */
export function paraLinhasEditaveis(faixas: Faixa[]): LinhaFaixaEditavel[] {
  return faixas.map((faixa) => ({
    de: formatarNumero(faixa.de, 2),
    ate: formatarNumero(faixa.ate, 2),
    aliquota: formatarNumero(faixa.aliquota, 2),
  }))
}
