/**
 * Expressões dos parâmetros de entrada da integração (F5.14).
 *
 * Cada valor de texto do JSON de entrada pode ter variáveis entre `%` (ex.: `%filial%`) e, quando é uma
 * conta, operadores `+ - * / ^`, parênteses e sinal negativo. Regras:
 * - ordem de cálculo: parênteses, potência (à direita), sinal negativo, multiplicação e divisão, soma e
 *   subtração (essas da esquerda para a direita);
 * - números com vírgula ou ponto decimal; o resultado usa vírgula, sem zeros desnecessários nem
 *   separador de milhar;
 * - datas: variáveis do tipo `data` ou datas `dd/mm/aaaa`. Data ± número soma/subtrai dias; número
 *   seguido de `m` são meses e de `a` são anos (só somados a/subtraídos de uma data). Data − data dá a
 *   quantidade de dias. Quando o dia não existe no mês de destino, vale o último dia desse mês;
 * - textos que não viram conta (ver `ehConta`) só recebem a troca das variáveis.
 *
 * As variáveis existentes e seus tipos vêm da API (`ContextoIntegracao.variaveis`); os valores da
 * prévia vêm de `valoresDeExemplo`. Variável da API sem valor de exemplo: número → 1, texto → o próprio
 * nome, data → `hoje`.
 */

import type { VariavelIntegracao } from '../../types/dominio'
import type { ValoresExemplo, ValorVariavel } from './exemplos'

/** Variáveis aceitas (da API) e valores de exemplo usados para resolver as expressões. */
export interface ContextoIntegracao {
  variaveis: VariavelIntegracao[]
  valores: ValoresExemplo
}

/**
 * Resultado de `resolverTexto`: o texto resolvido (`conta` indica se foi calculado) ou os motivos
 * do erro, em português (ex.: `variável desconhecida %foo%`, `divisão por zero`).
 */
export type ResultadoTexto = { ok: true; conta: boolean; valor: string } | { ok: false; motivos: string[] }

const REGEX_VARIAVEL = /%([\p{L}_][\p{L}\p{N}_]*)%/gu
const REGEX_DATA = /\d{2}\/\d{2}\/\d{4}(?!\d)/g
const REGEX_MES_ANO_SOZINHO = /^\d{1,2}\/\d{4}$/
/** Data `aaaa-mm-dd` sozinha: não vira conta (contrato do back-end, "Não viram conta"). */
const REGEX_DATA_ISO_SOZINHA = /^\d{4}-\d{2}-\d{2}$/

const MOTIVO_OPERADOR = 'operador repetido ou fora de lugar'
const MOTIVO_UNIDADE = 'unidade m ou a sem data'
const MOTIVO_DATA_OPERACAO = 'data não pode ser multiplicada, dividida ou elevada'
const MOTIVO_DATA_SUBTRAIDA = 'data subtraída de um número'

// ---------------------------------------------------------------------------
// Variáveis e identificação de contas
// ---------------------------------------------------------------------------

/** Nomes das variáveis do texto, sem `%`, sem repetição, na ordem em que aparecem. */
export function variaveisDoTexto(texto: string): string[] {
  const nomes: string[] = []
  for (const encontrado of texto.matchAll(REGEX_VARIAVEL)) {
    if (!nomes.includes(encontrado[1])) nomes.push(encontrado[1])
  }
  return nomes
}

/**
 * Indica se o texto é uma conta: retiradas as variáveis e as datas `dd/mm/aaaa`, sobram só números,
 * operadores, parênteses, espaços e sufixos `m`/`a` colados a um número, com ao menos um operador.
 * Datas sozinhas (`dd/mm/aaaa`, `mm/aaaa` ou `aaaa-mm-dd`) e textos com letras não são contas.
 */
export function ehConta(texto: string): boolean {
  const aparado = texto.trim()
  if (REGEX_MES_ANO_SOZINHO.test(aparado) || REGEX_DATA_ISO_SOZINHA.test(aparado)) return false
  const simplificado = texto
    .replace(REGEX_VARIAVEL, '0')
    .replace(REGEX_DATA, '0')
    .replace(/(\d)[ma](?![\p{L}\p{N}_])/gu, '$1')
  return /^[\d.,+\-*/^()\s]*$/.test(simplificado) && /[+\-*/^]/.test(simplificado)
}

// ---------------------------------------------------------------------------
// Datas e números
// ---------------------------------------------------------------------------

const doisDigitos = (valor: number): string => String(valor).padStart(2, '0')

function formatarData(data: Date): string {
  return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}/${data.getFullYear()}`
}

/** Número com vírgula decimal, sem zeros desnecessários nem separador de milhar. */
function formatarNumero(valor: number): string {
  const arredondado = Number.parseFloat(valor.toFixed(10))
  return String(Object.is(arredondado, -0) ? 0 : arredondado).replace('.', ',')
}

function ultimoDiaDoMes(ano: number, indiceMes: number): number {
  return new Date(ano, indiceMes + 1, 0).getDate()
}

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + Math.round(dias))
}

/** Soma meses; sem o dia no mês de destino, vale o último dia desse mês. */
function somarMeses(data: Date, meses: number): Date {
  const destino = new Date(data.getFullYear(), data.getMonth() + Math.round(meses), 1)
  const dia = Math.min(data.getDate(), ultimoDiaDoMes(destino.getFullYear(), destino.getMonth()))
  return new Date(destino.getFullYear(), destino.getMonth(), dia)
}

/** Dias entre duas datas locais, sem efeito de horário de verão. */
function diferencaEmDias(fim: Date, inicio: Date): number {
  const utc = (d: Date): number => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc(fim) - utc(inicio)) / 86_400_000)
}

/** Data `dd/mm/aaaa` existente, ou `null`. */
function lerDataLiteral(texto: string): Date | null {
  const [dia, mes, ano] = texto.split('/').map(Number)
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDoMes(ano, mes - 1)) return null
  return new Date(ano, mes - 1, dia)
}

// ---------------------------------------------------------------------------
// Valores das variáveis
// ---------------------------------------------------------------------------

function valorDeExemplo(valores: ValoresExemplo, nome: string): ValorVariavel | undefined {
  const tabela: Readonly<Record<string, ValorVariavel>> = valores
  return Object.hasOwn(tabela, nome) ? tabela[nome] : undefined
}

/** Valor da variável conforme o tipo informado pela API (o tipo prevalece sobre o valor de exemplo). */
function valorDaVariavel(variavel: VariavelIntegracao, valores: ValoresExemplo): ValorVariavel {
  const valor = valorDeExemplo(valores, variavel.nome)
  if (variavel.tipo === 'numero') return typeof valor === 'number' ? valor : 1
  if (variavel.tipo === 'data') return valor instanceof Date ? valor : valores.hoje
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number') return formatarNumero(valor)
  if (valor instanceof Date) return formatarData(valor)
  return variavel.nome
}

function valorComoTexto(valor: ValorVariavel): string {
  if (valor instanceof Date) return formatarData(valor)
  if (typeof valor === 'number') return formatarNumero(valor)
  return valor
}

// ---------------------------------------------------------------------------
// Leitura (tokens) e cálculo
// ---------------------------------------------------------------------------

type Operador = '+' | '-' | '*' | '/' | '^'

type Token =
  | { tipo: 'valor'; valor: Valor }
  | { tipo: 'operador'; operador: Operador }
  | { tipo: 'abre' }
  | { tipo: 'fecha' }

type Valor = { tipo: 'numero'; numero: number } | { tipo: 'data'; data: Date } | { tipo: 'duracao'; meses: number }

/** Erro de cálculo; vira um motivo em `resolverTexto`. */
class FalhaConta {
  readonly motivo: string

  constructor(motivo: string) {
    this.motivo = motivo
  }
}

const REGEX_TOKEN_DATA = /\d{2}\/\d{2}\/\d{4}(?!\d)/y
const REGEX_TOKEN_NUMERO = /(\d+(?:[.,]\d+)?)([ma](?![\p{L}\p{N}_]))?/uy
const REGEX_TOKEN_VARIAVEL = /%([\p{L}_][\p{L}\p{N}_]*)%/uy

function lerNoInicio(regex: RegExp, texto: string, posicao: number): RegExpExecArray | null {
  regex.lastIndex = posicao
  return regex.exec(texto)
}

/** Separa a conta em tokens; devolve os motivos encontrados (variável de texto, data inexistente). */
function lerTokens(texto: string, contexto: ContextoIntegracao): { tokens: Token[]; motivos: string[] } {
  const tokens: Token[] = []
  const motivos: string[] = []
  let posicao = 0
  while (posicao < texto.length) {
    const caractere = texto[posicao]
    if (/\s/.test(caractere)) {
      posicao++
      continue
    }
    const data = lerNoInicio(REGEX_TOKEN_DATA, texto, posicao)
    if (data) {
      const lida = lerDataLiteral(data[0])
      if (lida === null) motivos.push(`data inexistente ${data[0]}`)
      tokens.push({ tipo: 'valor', valor: { tipo: 'data', data: lida ?? new Date(0) } })
      posicao += data[0].length
      continue
    }
    const numero = lerNoInicio(REGEX_TOKEN_NUMERO, texto, posicao)
    if (numero) {
      const quantidade = Number(numero[1].replace(',', '.'))
      const sufixo = numero[2]
      const valor: Valor =
        sufixo === undefined
          ? { tipo: 'numero', numero: quantidade }
          : { tipo: 'duracao', meses: sufixo === 'a' ? quantidade * 12 : quantidade }
      tokens.push({ tipo: 'valor', valor })
      posicao += numero[0].length
      continue
    }
    const variavel = lerNoInicio(REGEX_TOKEN_VARIAVEL, texto, posicao)
    if (variavel) {
      const definicao = contexto.variaveis.find((v) => v.nome === variavel[1])
      if (definicao === undefined || definicao.tipo === 'texto') {
        motivos.push(
          definicao === undefined
            ? `variável desconhecida %${variavel[1]}%`
            : `variável de texto %${definicao.nome}% em conta`,
        )
        // Marca o lugar do valor para a leitura continuar; a conta não é calculada com motivos.
        tokens.push({ tipo: 'valor', valor: { tipo: 'numero', numero: 0 } })
      } else {
        const valor = valorDaVariavel(definicao, contexto.valores)
        tokens.push({
          tipo: 'valor',
          valor: valor instanceof Date ? { tipo: 'data', data: valor } : { tipo: 'numero', numero: Number(valor) },
        })
      }
      posicao += variavel[0].length
      continue
    }
    if (caractere === '(') tokens.push({ tipo: 'abre' })
    else if (caractere === ')') tokens.push({ tipo: 'fecha' })
    else if ('+-*/^'.includes(caractere)) tokens.push({ tipo: 'operador', operador: caractere as Operador })
    else motivos.push(`caractere inesperado ${caractere}`)
    posicao++
  }
  return { tokens, motivos }
}

function numero(valor: number): Valor {
  if (!Number.isFinite(valor)) throw new FalhaConta('resultado não é um número válido')
  return { tipo: 'numero', numero: valor }
}

function somar(esquerda: Valor, direita: Valor): Valor {
  if (esquerda.tipo === 'data' || direita.tipo === 'data') {
    const [data, outro] = esquerda.tipo === 'data' ? [esquerda, direita] : [direita, esquerda]
    if (data.tipo !== 'data' || outro.tipo === 'data') throw new FalhaConta('soma de duas datas')
    const resultado = outro.tipo === 'duracao' ? somarMeses(data.data, outro.meses) : somarDias(data.data, outro.numero)
    return { tipo: 'data', data: resultado }
  }
  if (esquerda.tipo === 'duracao' || direita.tipo === 'duracao') throw new FalhaConta(MOTIVO_UNIDADE)
  return numero(esquerda.numero + direita.numero)
}

function subtrair(esquerda: Valor, direita: Valor): Valor {
  if (esquerda.tipo === 'data') {
    if (direita.tipo === 'data') return numero(diferencaEmDias(esquerda.data, direita.data))
    if (direita.tipo === 'duracao') return { tipo: 'data', data: somarMeses(esquerda.data, -direita.meses) }
    return { tipo: 'data', data: somarDias(esquerda.data, -direita.numero) }
  }
  if (direita.tipo === 'data') throw new FalhaConta(MOTIVO_DATA_SUBTRAIDA)
  if (esquerda.tipo === 'duracao' || direita.tipo === 'duracao') throw new FalhaConta(MOTIVO_UNIDADE)
  return numero(esquerda.numero - direita.numero)
}

function operar(operador: Operador, esquerda: Valor, direita: Valor): Valor {
  if (operador === '+') return somar(esquerda, direita)
  if (operador === '-') return subtrair(esquerda, direita)
  if (esquerda.tipo === 'data' || direita.tipo === 'data') throw new FalhaConta(MOTIVO_DATA_OPERACAO)
  if (esquerda.tipo === 'duracao' || direita.tipo === 'duracao') throw new FalhaConta(MOTIVO_UNIDADE)
  if (operador === '*') return numero(esquerda.numero * direita.numero)
  if (operador === '/') {
    if (direita.numero === 0) throw new FalhaConta('divisão por zero')
    return numero(esquerda.numero / direita.numero)
  }
  return numero(esquerda.numero ** direita.numero)
}

function negar(valor: Valor): Valor {
  if (valor.tipo === 'data') throw new FalhaConta(MOTIVO_DATA_SUBTRAIDA)
  if (valor.tipo === 'duracao') return { tipo: 'duracao', meses: -valor.meses }
  return numero(-valor.numero)
}

/**
 * Análise descendente recursiva:
 * soma := produto (('+' | '-') produto)*
 * produto := unario (('*' | '/') unario)*
 * unario := '-' unario | potencia
 * potencia := primario ('^' unario)?
 * primario := valor | '(' soma ')'
 */
class Calculadora {
  private posicao = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  calcular(): Valor {
    const resultado = this.soma()
    const sobra = this.tokens[this.posicao]
    if (sobra !== undefined) {
      if (sobra.tipo === 'fecha') throw new FalhaConta('parêntese fechado sem abertura')
      throw new FalhaConta(sobra.tipo === 'operador' ? MOTIVO_OPERADOR : 'operador faltando entre valores')
    }
    return resultado
  }

  private operadorAtual(...aceitos: Operador[]): Operador | null {
    const token = this.tokens[this.posicao]
    return token?.tipo === 'operador' && aceitos.includes(token.operador) ? token.operador : null
  }

  private soma(): Valor {
    let resultado = this.produto()
    for (let operador = this.operadorAtual('+', '-'); operador; operador = this.operadorAtual('+', '-')) {
      this.posicao++
      resultado = operar(operador, resultado, this.produto())
    }
    return resultado
  }

  private produto(): Valor {
    let resultado = this.unario()
    for (let operador = this.operadorAtual('*', '/'); operador; operador = this.operadorAtual('*', '/')) {
      this.posicao++
      resultado = operar(operador, resultado, this.unario())
    }
    return resultado
  }

  private unario(): Valor {
    if (this.operadorAtual('-')) {
      this.posicao++
      return negar(this.unario())
    }
    return this.potencia()
  }

  private potencia(): Valor {
    const base = this.primario()
    if (!this.operadorAtual('^')) return base
    this.posicao++
    return operar('^', base, this.unario())
  }

  private primario(): Valor {
    const token = this.tokens[this.posicao]
    if (token === undefined || token.tipo === 'operador') throw new FalhaConta(MOTIVO_OPERADOR)
    if (token.tipo === 'fecha') {
      const anterior = this.tokens[this.posicao - 1]
      throw new FalhaConta(anterior?.tipo === 'abre' ? 'parênteses vazios' : 'parêntese fechado sem abertura')
    }
    this.posicao++
    if (token.tipo === 'valor') return token.valor
    const resultado = this.soma()
    if (this.tokens[this.posicao] === undefined) throw new FalhaConta('parêntese não fechado')
    if (this.tokens[this.posicao].tipo !== 'fecha') throw new FalhaConta('operador faltando entre valores')
    this.posicao++
    return resultado
  }
}

/** Calcula a conta; o resultado é número (`252,5`) ou data (`dd/mm/aaaa`). */
function calcularConta(texto: string, contexto: ContextoIntegracao): ResultadoTexto {
  const { tokens, motivos } = lerTokens(texto, contexto)
  if (motivos.length > 0) return { ok: false, motivos }
  try {
    const resultado = new Calculadora(tokens).calcular()
    if (resultado.tipo === 'duracao') return { ok: false, motivos: [MOTIVO_UNIDADE] }
    const valor = resultado.tipo === 'data' ? formatarData(resultado.data) : formatarNumero(resultado.numero)
    return { ok: true, conta: true, valor }
  } catch (falha) {
    if (falha instanceof FalhaConta) return { ok: false, motivos: [falha.motivo] }
    throw falha
  }
}

// ---------------------------------------------------------------------------
// Resolução
// ---------------------------------------------------------------------------

/**
 * Resolve um valor de texto do JSON de entrada com os valores de exemplo: calcula as contas e, nos
 * demais textos, só troca as variáveis. Variáveis fora da lista da API são sempre erro (todas listadas,
 * na ordem); nas contas, o primeiro erro de cálculo encontrado é devolvido.
 */
export function resolverTexto(texto: string, contexto: ContextoIntegracao): ResultadoTexto {
  const desconhecidas = variaveisDoTexto(texto).filter((nome) => !contexto.variaveis.some((v) => v.nome === nome))
  if (desconhecidas.length > 0) {
    return { ok: false, motivos: desconhecidas.map((nome) => `variável desconhecida %${nome}%`) }
  }
  if (ehConta(texto)) return calcularConta(texto, contexto)

  const valor = texto.replace(REGEX_VARIAVEL, (trecho, nome: string) => {
    const variavel = contexto.variaveis.find((v) => v.nome === nome)
    return variavel === undefined ? trecho : valorComoTexto(valorDaVariavel(variavel, contexto.valores))
  })
  return { ok: true, conta: false, valor }
}
