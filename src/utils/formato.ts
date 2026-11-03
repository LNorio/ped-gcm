/**
 * Utilitários de formatação e leitura de valores no padrão pt-BR (RNF-03, RNF-09, RN-10).
 *
 * Funções puras, sem dependências externas. Datas vindas da API (`aaaa-mm-dd`, com ou sem hora)
 * são interpretadas por componentes, sem conversão de fuso horário, para que o dia não se desloque.
 */

export type ValorData = string | Date | null | undefined
export type ValorNumero = number | null | undefined

interface ComponentesData {
  ano: number
  mes: number
  dia: number
  hora: number
  minuto: number
}

const REGEX_DATA_API =
  /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

const doisDigitos = (valor: number): string => String(valor).padStart(2, '0')

function componentesDeDate(data: Date): ComponentesData | null {
  if (Number.isNaN(data.getTime())) return null
  return {
    ano: data.getFullYear(),
    mes: data.getMonth() + 1,
    dia: data.getDate(),
    hora: data.getHours(),
    minuto: data.getMinutes(),
  }
}

function componentesValidos(ano: number, mes: number, dia: number, hora: number, minuto: number): boolean {
  if (mes < 1 || mes > 12) return false
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return false
  const ultimoDia = new Date(ano, mes, 0).getDate()
  return dia >= 1 && dia <= ultimoDia
}

/** Interpreta string ou Date em componentes locais; devolve null quando inválido. */
function interpretarData(valor: ValorData): ComponentesData | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return componentesDeDate(valor)

  const texto = valor.trim()
  if (texto === '') return null

  const partes = REGEX_DATA_API.exec(texto)
  if (partes) {
    const ano = Number(partes[1])
    const mes = Number(partes[2])
    const dia = partes[3] === undefined ? 1 : Number(partes[3])
    const hora = partes[4] === undefined ? 0 : Number(partes[4])
    const minuto = partes[5] === undefined ? 0 : Number(partes[5])
    if (!componentesValidos(ano, mes, dia, hora, minuto)) return null
    return { ano, mes, dia, hora, minuto }
  }

  // Outros formatos reconhecidos pelo motor JS (ex.: ISO completo com fuso).
  return componentesDeDate(new Date(texto))
}

/** Formata uma data como `dd/mm/aaaa`. Inválido ou nulo devolve texto vazio. */
export function formatarData(valor: ValorData): string {
  const data = interpretarData(valor)
  if (!data) return ''
  return `${doisDigitos(data.dia)}/${doisDigitos(data.mes)}/${data.ano}`
}

/** Formata data e hora como `dd/mm/aaaa hh:mm`. Data sem hora mostra `00:00`. */
export function formatarDataHora(valor: ValorData): string {
  const data = interpretarData(valor)
  if (!data) return ''
  return `${formatarData(valor)} ${doisDigitos(data.hora)}:${doisDigitos(data.minuto)}`
}

/** Formata o mês de referência como `MM/AAAA`. Aceita `aaaa-mm-dd`, `aaaa-mm` ou Date. */
export function formatarCompetencia(valor: ValorData): string {
  const data = interpretarData(valor)
  if (!data) return ''
  return `${doisDigitos(data.mes)}/${data.ano}`
}

const numeroValido = (valor: ValorNumero): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor)

/**
 * Formata número com vírgula decimal, ponto de milhar e quantidade fixa de casas (padrão 2, RN-10).
 * null, undefined e NaN devolvem texto vazio.
 */
export function formatarNumero(valor: ValorNumero, casas = 2): string {
  if (!numeroValido(valor)) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor)
}

/** Formata valor em reais (`R$ 1.234,50`). Nulo devolve texto vazio. */
export function formatarMoeda(valor: ValorNumero): string {
  if (!numeroValido(valor)) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

/** Formata percentual já em escala 0–100 (`37,78%`), com 2 casas e sem espaço. */
export function formatarPercentual(valor: ValorNumero): string {
  if (!numeroValido(valor)) return ''
  return `${formatarNumero(valor, 2)}%`
}

/**
 * Lê um texto no formato pt-BR (`1.234,56`) e devolve o número correspondente.
 * Devolve null para vazio, nulo ou texto não numérico. Number é devolvido como está.
 */
export function lerDecimal(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null

  const limpo = texto.trim()
  if (limpo === '') return null
  if (!/^[+-]?(\d{1,3}(\.\d{3})*|\d+)(,\d+)?$/.test(limpo)) return null

  const normalizado = limpo.replace(/\./g, '').replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}

/**
 * Normaliza texto para busca (RNF-09): remove acentos, converte para minúsculas,
 * apara as pontas e reduz espaços repetidos a um só.
 */
export function normalizarBusca(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
