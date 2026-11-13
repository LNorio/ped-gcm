/**
 * Regras puras da aba Preenchimento (F9.3 a F9.8 — RF-61 a RF-70, RNF-03, RNF-09).
 *
 * - `lerValorDigitado`: converte o texto digitado (ou `'sim'`/`'nao'` no booleano) no valor enviado à
 *   API; vazio não é erro (o apontamento simplesmente não entra no lote).
 * - `formatarValorLancamento`: valor lançado no padrão pt-BR (2 casas — RN-10; "%" na porcentagem;
 *   Sim/Não no booleano; "—" sem lançamento).
 * - `mensagemSucessoPreenchimento`: notificação a partir de `lancados`/`corrigidos` do `PUT`.
 * - `descreverImagensCongeladas`: aviso do mês já congelado em imagens de dashboards (RN-18).
 * - Auxiliares da lista (contagem, indicadores, dashboards, busca) e do mês de competência.
 */
import {
  ROTULOS_SITUACAO_LANCAMENTO,
  type ApontamentoPreenchimento,
  type ImagemCongeladaDoApontamento,
  type SituacaoLancamento,
  type TipoPreenchimento,
  type TipoValor,
  type ValorLancamento,
} from '../../types/dominio'
import { formatarCompetencia, formatarNumero, formatarPercentual, lerDecimal, normalizarBusca } from '../../utils/formato'

export const MENSAGEM_VALOR_INVALIDO = 'Informe um número válido, com vírgula decimal (ex.: 1.234,56).'
export const MENSAGEM_VALOR_NEGATIVO = 'O valor não pode ser negativo.'
export const SEM_VALOR = '—'

/** Texto do valor booleano no campo (botões Sim/Não). */
export type TextoBooleano = 'sim' | 'nao' | ''

export interface ValorLido {
  /** Valor convertido; `null` quando vazio ou inválido. */
  valor: ValorLancamento | null
  /** Mensagem de validação; `null` quando válido (ou vazio). */
  erro: string | null
}

/** Converte o texto digitado no valor do lançamento (Numeral/Porcentagem: decimal pt-BR não negativo). */
export function lerValorDigitado(tipoValor: TipoValor, texto: string): ValorLido {
  if (tipoValor === 'booleano') {
    if (texto === 'sim') return { valor: true, erro: null }
    if (texto === 'nao') return { valor: false, erro: null }
    return { valor: null, erro: null }
  }
  const limpo = (texto ?? '').trim()
  if (limpo === '') return { valor: null, erro: null }
  const numero = lerDecimal(limpo)
  if (numero === null) return { valor: null, erro: MENSAGEM_VALOR_INVALIDO }
  if (numero < 0) return { valor: null, erro: MENSAGEM_VALOR_NEGATIVO }
  return { valor: numero, erro: null }
}

/** Valor lançado no padrão pt-BR; sem lançamento, "—". */
export function formatarValorLancamento(tipoValor: TipoValor, valor: ValorLancamento | null): string {
  if (valor === null || valor === undefined) return SEM_VALOR
  if (tipoValor === 'booleano' || typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (tipoValor === 'porcentagem') return formatarPercentual(valor)
  return formatarNumero(valor, 2)
}

function plural(quantidade: number, singular: string, varios: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`
}

/** Notificação do `PUT /api/ped/preenchimento` a partir das contagens da resposta. */
export function mensagemSucessoPreenchimento({ lancados, corrigidos }: { lancados: number; corrigidos: number }): string {
  const textoLancados = plural(lancados, 'lançamento', 'lançamentos')
  const textoCorrigidos = plural(corrigidos, 'correção', 'correções')
  if (lancados > 0 && corrigidos > 0) return `${textoLancados} e ${textoCorrigidos} salvos.`
  if (lancados > 0) return `${textoLancados} ${lancados === 1 ? 'salvo' : 'salvos'}.`
  if (corrigidos > 0) return `${textoCorrigidos} ${corrigidos === 1 ? 'salva' : 'salvas'}.`
  return 'Preenchimento salvo.'
}

function descreverImagem({ codigo, dashboard, periodo }: ImagemCongeladaDoApontamento): string {
  const base = [dashboard, periodo].filter((parte): parte is string => Boolean(parte?.trim())).join(' · ')
  if (codigo?.trim()) return base ? `${base} (${codigo})` : codigo
  return base || 'imagem sem identificação'
}

/** Aviso do mês congelado em imagens (RF-70, RN-18); `null` quando não há imagens. */
export function descreverImagensCongeladas(imagens: ImagemCongeladaDoApontamento[]): string | null {
  if (imagens.length === 0) return null
  return (
    `Este mês já foi congelado na imagem de: ${imagens.map(descreverImagem).join(', ')}.` +
    ' Uma correção agora vale só para os períodos ainda abertos; a imagem já gerada não muda.'
  )
}

// ---------------------------------------------------------------------------
// Lista dos apontamentos (F9.5)
// ---------------------------------------------------------------------------

/** "1 apontamento", "N apontamentos". */
export function textoQuantidadeApontamentos(quantidade: number): string {
  return plural(quantidade, 'apontamento', 'apontamentos')
}

export function textoIndicadores(apontamento: ApontamentoPreenchimento): string {
  if (apontamento.indicadores.length === 0) return 'Indicadores: não vinculado'
  return `Indicadores: ${apontamento.indicadores.map((indicador) => indicador.nome).join(', ')}`
}

export function textoDashboards(apontamento: ApontamentoPreenchimento): string {
  if (apontamento.dashboards.length === 0) return 'Dashboards: nenhum'
  const nomes = apontamento.dashboards.map((dashboard) =>
    dashboard.periodicidade ? `${dashboard.nome} (${dashboard.periodicidade.toLowerCase()})` : dashboard.nome,
  )
  return `Dashboards: ${nomes.join(', ')}`
}

export function rotuloSituacaoLancamento(situacao: SituacaoLancamento): string {
  return ROTULOS_SITUACAO_LANCAMENTO[situacao]
}

/** Tipo com os apontamentos visíveis e a contagem exibida. */
export interface TipoFiltrado {
  tipo: TipoPreenchimento
  apontamentos: ApontamentoPreenchimento[]
  quantidade: number
}

/**
 * Busca local em todos os tipos (RF-64, RNF-09): pelo nome do apontamento ou de um indicador, sem
 * diferenciar acentos nem maiúsculas. Sem busca, todos os tipos com a `quantidade` da API; com busca,
 * só os tipos com resultado e a quantidade encontrada.
 */
export function filtrarTiposPreenchimento(tipos: TipoPreenchimento[], busca: string): TipoFiltrado[] {
  const termo = normalizarBusca(busca)
  if (termo === '') return tipos.map((tipo) => ({ tipo, apontamentos: tipo.apontamentos, quantidade: tipo.quantidade }))
  return tipos.flatMap((tipo) => {
    const apontamentos = tipo.apontamentos.filter(
      (apontamento) =>
        normalizarBusca(apontamento.nome).includes(termo) ||
        apontamento.indicadores.some((indicador) => normalizarBusca(indicador.nome).includes(termo)),
    )
    return apontamentos.length > 0 ? [{ tipo, apontamentos, quantidade: apontamentos.length }] : []
  })
}

/** Apontamentos sem valor do mês, na ordem da tela (os que podem entrar no lote). */
export function apontamentosSemValor(tipos: TipoPreenchimento[]): ApontamentoPreenchimento[] {
  return tipos.flatMap((tipo) => tipo.apontamentos.filter((apontamento) => apontamento.valor === null))
}

// ---------------------------------------------------------------------------
// Mês de competência (F9.3, F9.4)
// ---------------------------------------------------------------------------

export const ANO_MINIMO_PREENCHIMENTO = 2000

export const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

/** Data da API (`AAAA-MM...`) no mês de competência `AAAA-MM-01`; fora do formato, `null`. */
export function mesDeCompetencia(data: string | null | undefined): string | null {
  const partes = /^(\d{4})-(\d{2})/.exec((data ?? '').trim())
  return partes ? `${partes[1]}-${partes[2]}-01` : null
}

/** Ano de uma data da API (`AAAA-...`); fora do formato, `null`. */
export function anoDaData(data: string | null | undefined): number | null {
  const partes = /^(\d{4})-/.exec((data ?? '').trim())
  return partes ? Number(partes[1]) : null
}

/** Aviso de somente consulta de um mês fora do período aberto (RF-62). */
export function avisoSomenteConsulta(periodoAberto: string | null): string {
  const competencia = periodoAberto ? formatarCompetencia(periodoAberto) : ''
  if (!competencia) return 'Somente consulta: este mês não aceita lançamentos nem correções.'
  return `Somente consulta: o único período aberto para preenchimento é ${competencia}. Os demais meses não aceitam lançamentos nem correções.`
}
