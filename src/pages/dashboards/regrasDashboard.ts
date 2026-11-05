/**
 * Regras puras do formulário de dashboard (F7.5 e F7.6 — RF-50 a RF-53, RN-15).
 *
 * - `resumoImagens`: quantas imagens serão geradas no encerramento e em quais filiais, calculado com
 *   a lista de colaboradores (a lista de filiais da API não traz colaboradores). Segue o documento:
 *   uma imagem por colaborador; filial sem colaborador gera uma única imagem, identificada como
 *   "Filial (sem colaborador vinculado)".
 * - `motivoIndisponibilidade`: por que um indicador não pode entrar no dashboard (RF-52, RF-53).
 * - `somarPontos` e `textoTotalPontos`: total dos pontos base e quanto falta ou excede (RF-51).
 */
import type { ColaboradorVinculo } from '../../services/dashboardsService'
import { ROTULOS_REFERENCIA, type DadoExterno, type Indicador, type Referencia, type TipoVinculo } from '../../types/dominio'
import { formatarNumero, lerDecimal } from '../../utils/formato'

/** Vínculo em edição no formulário: tipo ainda não escolhido (`""`) e itens sempre em texto. */
export interface VinculoFormulario {
  tipo: TipoVinculo | ''
  /** Códigos de filial, nomes de cargo ou ids de colaborador (em texto), na ordem da escolha. */
  itens: string[]
}

export interface ResumoImagens {
  quantidade: number
  /** Filiais onde as imagens serão geradas, ordenadas pelo código. */
  filiais: string[]
  /** Filiais escolhidas (vínculo por filiais) sem nenhum colaborador. */
  filiaisSemColaborador: string[]
}

function ordenarCodigos(codigos: Iterable<string>): string[] {
  return [...new Set(codigos)].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
}

/**
 * Imagens geradas no encerramento conforme o vínculo (RF-50):
 * - por filiais: os colaboradores das filiais escolhidas + 1 imagem por filial sem colaborador;
 * - por cargos: os colaboradores dos cargos, só nas filiais que têm esses colaboradores;
 * - por colaboradores: os escolhidos (ids em texto); ids desconhecidos são ignorados.
 */
export function resumoImagens(vinculo: VinculoFormulario, colaboradores: ColaboradorVinculo[]): ResumoImagens {
  const { tipo, itens } = vinculo
  if (tipo === '' || itens.length === 0) return { quantidade: 0, filiais: [], filiaisSemColaborador: [] }

  if (tipo === 'filiais') {
    const escolhidas = new Set(itens)
    const doVinculo = colaboradores.filter((colaborador) => colaborador.filial !== null && escolhidas.has(colaborador.filial))
    const comColaborador = new Set(doVinculo.map((colaborador) => colaborador.filial))
    const semColaborador = ordenarCodigos(itens.filter((codigo) => !comColaborador.has(codigo)))
    return {
      quantidade: doVinculo.length + semColaborador.length,
      filiais: ordenarCodigos(escolhidas),
      filiaisSemColaborador: semColaborador,
    }
  }

  const escolhidos = new Set(itens)
  const doVinculo = colaboradores.filter((colaborador) =>
    tipo === 'cargos' ? colaborador.cargo !== null && escolhidos.has(colaborador.cargo) : escolhidos.has(String(colaborador.id)),
  )
  return {
    quantidade: doVinculo.length,
    filiais: ordenarCodigos(doVinculo.flatMap((colaborador) => (colaborador.filial === null ? [] : [colaborador.filial]))),
    filiaisSemColaborador: [],
  }
}

/** Referência do dado externo que compõe o indicador; `null` sem dado externo ou quando não está na lista. */
export function referenciaDoIndicador(indicador: Indicador, dadosExternos: DadoExterno[]): Referencia | null {
  if (indicador.composicao.tipo !== 'dado_externo') return null
  const idDado = indicador.composicao.itens[0]?.id
  return dadosExternos.find((dado) => dado.id === idDado)?.referencia ?? null
}

/** Dado externo por Zona de venda ou por Colaborador não entra em dashboard por filiais (RF-53). */
export function referenciaRecusadaPorFiliais(
  indicador: Indicador,
  tipoVinculo: TipoVinculo | '',
  dadosExternos: DadoExterno[],
): Referencia | null {
  if (tipoVinculo !== 'filiais') return null
  const referencia = referenciaDoIndicador(indicador, dadosExternos)
  return referencia === 'zona' || referencia === 'colaborador' ? referencia : null
}

/**
 * Motivo que impede o indicador de entrar no dashboard (RF-52, RF-53), em ordem de prioridade;
 * `null` quando está disponível.
 */
export function motivoIndisponibilidade(
  indicador: Indicador,
  tipoVinculo: TipoVinculo | '',
  dadosExternos: DadoExterno[],
): string | null {
  if (!indicador.ativo) return 'Indicador inativo'
  if (indicador.componentesDesativados) return 'Componente desativado'
  if (indicador.metaADefinir) return 'Meta a definir'
  const referencia = referenciaRecusadaPorFiliais(indicador, tipoVinculo, dadosExternos)
  if (referencia) return `Dado externo por ${ROTULOS_REFERENCIA[referencia]} não é aceito em dashboard por filiais`
  return null
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** Pontos base válidos (maiores que zero) ou `null`. */
export function lerPontos(texto: string): number | null {
  const valor = lerDecimal(texto)
  return valor !== null && valor > 0 ? valor : null
}

/** Soma os pontos digitados (pt-BR), considerando só valores maiores que zero, em duas casas. */
export function somarPontos(textos: string[]): number {
  const soma = textos.reduce((total, texto) => {
    const valor = lerDecimal(texto)
    return valor !== null && valor > 0 ? total + valor : total
  }, 0)
  return arredondar(soma)
}

/** Pontos em pt-BR: inteiro sem casas, decimal com duas casas, milhar com ponto. */
export function formatarPontos(valor: number): string {
  const arredondado = arredondar(valor)
  return formatarNumero(arredondado, Number.isInteger(arredondado) ? 0 : 2)
}

/** Total dos pontos base em relação à pontuação base máxima (RF-51). */
export function textoTotalPontos(soma: number, maximo: number | null): string {
  if (maximo === null || maximo <= 0) return 'Informe a pontuação base máxima'
  const diferenca = arredondar(soma - maximo)
  if (diferenca === 0) return `Total correto: ${formatarPontos(maximo)} pts`
  if (diferenca < 0) return `Faltam ${formatarPontos(-diferenca)} pts para ${formatarPontos(maximo)}`
  return `Excedeu ${formatarPontos(diferenca)} pts — o total deve ser ${formatarPontos(maximo)}`
}
