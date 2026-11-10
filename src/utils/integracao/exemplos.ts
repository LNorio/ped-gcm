/**
 * Valores de exemplo usados na prévia do JSON de entrada da integração (F5.14).
 *
 * O período é o mês de `hoje` (primeiro e último dia); `mesesRetro` vem da janela retroativa do dado e
 * `diaColeta` do dia da coleta (ambos `null` → 1). Filial, colaborador e zona são valores fictícios;
 * `empresa` vale 1 e `empresas` (texto, não entra em conta) vale `1,6,7,8,9` (seção 3.2 de
 * `docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md`, 10/11/2026).
 * As datas são locais, à meia-noite, sem o horário de `hoje`. Desde 09/11/2026 os exemplos devolvidos
 * pela API de variáveis (`VariavelIntegracao.exemplo`) prevalecem sobre esses valores calculados.
 */

import type { VariavelIntegracao } from '../../types/dominio'

/** Valor de exemplo de uma variável: número, texto ou data. */
export type ValorVariavel = number | string | Date

/** Valores de exemplo das variáveis do documento, pelo nome (sem `%`). */
export type ValoresExemplo = {
  filial: number
  /** Código da empresa da filial consultada. */
  empresa: number
  /** Empresas participantes, em ordem e separadas por vírgula (texto). */
  empresas: string
  colaborador: string
  zona: string
  mes: number
  ano: number
  /** `MM/AAAA`. */
  competencia: string
  dataInicial: Date
  dataFinal: Date
  hoje: Date
  diaColeta: number
  mesesRetro: number
}

export interface ParametrosExemplo {
  hoje: Date
  mesesRetro: number | null
  diaColeta: number | null
  /** Variáveis da API (F5.15); o `exemplo` de cada uma prevalece sobre o valor calculado. */
  variaveis?: readonly VariavelIntegracao[]
}

/**
 * Valores de exemplo, com as variáveis da API que tragam exemplo. O tipo da API decide a conversão,
 * então um nome do documento pode chegar com outro tipo (ex.: `zona` como número); quem lê por nome
 * (ver `expressoes.ts`) trata o valor pelo tipo da variável.
 */
export type ValoresExemploComApi = ValoresExemplo & Readonly<Record<string, ValorVariavel>>

const REGEX_NUMERO = /^-?\d+(?:[.,]\d+)?$/
const REGEX_DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** Converte o exemplo da API pelo tipo; `undefined` quando ausente ou não convertível. */
function converterExemplo(variavel: VariavelIntegracao): ValorVariavel | undefined {
  if (variavel.exemplo === null) return undefined
  const texto = variavel.exemplo.trim()
  if (variavel.tipo === 'texto') return variavel.exemplo
  if (variavel.tipo === 'numero') return REGEX_NUMERO.test(texto) ? Number(texto.replace(',', '.')) : undefined
  const partes = REGEX_DATA.exec(texto)
  if (partes === null) return undefined
  const [dia, mes, ano] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const data = new Date(ano, mes - 1, dia)
  const existe = data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia
  return existe ? data : undefined
}

/**
 * Monta os valores de exemplo do período (mês) de `hoje`. Com `variaveis`, o exemplo de cada uma
 * prevalece (número com vírgula ou ponto, data `dd/mm/aaaa`, texto como está); exemplo `null` ou que
 * não se converte no tipo mantém o valor calculado. Variável fora do documento com exemplo também entra.
 */
export function valoresDeExemplo({ hoje, mesesRetro, diaColeta, variaveis = [] }: ParametrosExemplo): ValoresExemploComApi {
  const extras: Record<string, ValorVariavel> = {}
  for (const variavel of variaveis) {
    const valor = converterExemplo(variavel)
    if (valor !== undefined) extras[variavel.nome] = valor
  }
  return { ...valoresCalculados(hoje, mesesRetro, diaColeta), ...extras }
}

function valoresCalculados(hoje: Date, mesesRetro: number | null, diaColeta: number | null): ValoresExemplo {
  const ano = hoje.getFullYear()
  const indiceMes = hoje.getMonth()
  const mes = indiceMes + 1
  return {
    filial: 101,
    empresa: 1,
    empresas: '1,6,7,8,9',
    colaborador: '000123',
    zona: 'Z01',
    mes,
    ano,
    competencia: `${String(mes).padStart(2, '0')}/${ano}`,
    dataInicial: new Date(ano, indiceMes, 1),
    dataFinal: new Date(ano, indiceMes + 1, 0),
    hoje: new Date(ano, indiceMes, hoje.getDate()),
    diaColeta: diaColeta ?? 1,
    mesesRetro: mesesRetro ?? 1,
  }
}
