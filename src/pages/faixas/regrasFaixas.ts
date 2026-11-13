/**
 * Regras da aba Faixas (F8.2, F8.3, F8.4 — RF-41, RF-43, RF-44, RNF-03).
 *
 * - `nomeTabelaFaixas`: nome exibido da tabela, "{dashboard} · Filial {filial}" (sem a descrição);
 *   na faixa geral (F8.7), "{dashboard} · Geral".
 * - `textoFilialTabelaFaixas`: filial exibida, "{código} - {nome}"; na faixa geral, "Todas as filiais (geral)".
 * - `rotuloAcaoHistoricoFaixas`: rótulo da ação de uma linha do histórico (F8.5, F8.8).
 * - `linhaTemFaixasDaVersao`: se a linha do histórico é uma versão com faixas próprias (F8.5, F8.12*).
 * - `textoConflitoFaixas`: tabela em conflito do `400` de cadastro/reativação (F8.7, F8.12*).
 * - Linhas editáveis (De, Até e Alíquota em texto pt-BR) e a validação que as converte em faixas
 *   numéricas, lendo com `lerDecimal` (vírgula decimal, ponto de milhar: "2.000" = 2000).
 */
import type { AcaoHistoricoFaixas, ConflitoFaixas } from '../../services/faixasService'
import type { Faixa, TabelaFaixas } from '../../types/dominio'
import { formatarNumero, lerDecimal } from '../../utils/formato'

/** Nome da tabela exibido na aba: "{dashboard} · Filial {filial}"; na faixa geral, "{dashboard} · Geral". */
export function nomeTabelaFaixas(tabela: Pick<TabelaFaixas, 'dashboard' | 'filial'> & Partial<Pick<TabelaFaixas, 'geral'>>): string {
  if (tabela.geral === true || tabela.filial === null) return `${tabela.dashboard} · Geral`
  return `${tabela.dashboard} · Filial ${tabela.filial}`
}

/** Filial exibida da tabela: "{código} - {nome}"; na faixa geral, "Todas as filiais (geral)". */
export function textoFilialTabelaFaixas(tabela: Pick<TabelaFaixas, 'geral' | 'filial' | 'nomeFilial'>): string {
  if (tabela.geral || tabela.filial === null) return 'Todas as filiais (geral)'
  return tabela.nomeFilial ? `${tabela.filial} - ${tabela.nomeFilial}` : tabela.filial
}

const ROTULOS_ACAO_HISTORICO_FAIXAS: Readonly<Record<AcaoHistoricoFaixas, string>> = {
  cadastro: 'Cadastro',
  alteracao: 'Alteração das faixas',
  inativacao: 'Inativação',
  reativacao: 'Reativação',
  exclusao: 'Exclusão',
}

/** Rótulo da ação de uma linha do histórico; sem ação informada, é uma alteração das faixas. */
export function rotuloAcaoHistoricoFaixas(acao: AcaoHistoricoFaixas | null): string {
  return ROTULOS_ACAO_HISTORICO_FAIXAS[acao ?? 'alteracao']
}

/**
 * `true` quando a linha do histórico é uma versão com faixas próprias (cadastro, alteração ou sem
 * `acao`); inativação, reativação e exclusão não criam versão e não oferecem "Ver faixas da versão".
 */
export function linhaTemFaixasDaVersao(acao: AcaoHistoricoFaixas | null): boolean {
  return acao === null || acao === 'cadastro' || acao === 'alteracao'
}

/** Tabela em conflito: "Geral (todas as filiais)", "Filial {código} – {nome}" ou "Filial {código}". */
export function textoConflitoFaixas(conflito: ConflitoFaixas): string {
  if (conflito.geral || conflito.filial === null) return 'Geral (todas as filiais)'
  return conflito.nomeFilial ? `Filial ${conflito.filial} – ${conflito.nomeFilial}` : `Filial ${conflito.filial}`
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
