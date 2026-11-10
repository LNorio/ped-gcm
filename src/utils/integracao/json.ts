/**
 * Parser JSON próprio da integração de dados externos (F5.14).
 *
 * O `JSON.parse` do navegador dá mensagens em inglês e sem linha/coluna. Este parser segue a mesma
 * gramática e, no erro, devolve a posição (linha e coluna, a partir de 1) do caractere onde o problema
 * foi detectado e a explicação em português, no formato `Linha L, coluna C: <explicação>`.
 *
 * `\r\n` conta como uma única quebra de linha. Texto sem aspas de fechamento (inclusive quando a linha
 * acaba antes das aspas) aponta para a aspa de abertura; fim inesperado aponta para logo depois do
 * último caractere.
 */

/** Valor JSON já interpretado. */
export type ValorJson = null | boolean | number | string | ValorJson[] | { [chave: string]: ValorJson }

/** Erro de sintaxe do JSON, com a posição (1-based) e a explicação em português. */
export interface ErroJson {
  linha: number
  coluna: number
  explicacao: string
  /** `Linha L, coluna C: <explicação>`. */
  mensagem: string
}

export type ResultadoJson = { ok: true; valor: ValorJson } | { ok: false; erro: ErroJson }

/** Falha interna do parser; convertida em `ErroJson` por `analisarJson`. */
class FalhaJson {
  readonly posicao: number
  readonly explicacao: string

  constructor(posicao: number, explicacao: string) {
    this.posicao = posicao
    this.explicacao = explicacao
  }
}

const ESPACOS = new Set([' ', '\t', '\n', '\r'])

const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
}

const REGEX_NUMERO = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y

class Parser {
  private posicao = 0
  private readonly texto: string

  constructor(texto: string) {
    this.texto = texto
  }

  analisar(): ValorJson {
    this.pularEspacos()
    const valor = this.lerValor()
    this.pularEspacos()
    if (this.posicao < this.texto.length) throw new FalhaJson(this.posicao, 'conteúdo depois do fim do JSON')
    return valor
  }

  private atual(): string | undefined {
    return this.texto[this.posicao]
  }

  private fimInesperado(): FalhaJson {
    return new FalhaJson(this.texto.length, 'fim inesperado do texto')
  }

  private pularEspacos(): void {
    while (this.posicao < this.texto.length && ESPACOS.has(this.texto[this.posicao])) this.posicao++
  }

  private lerValor(): ValorJson {
    const caractere = this.atual()
    if (caractere === undefined) throw this.fimInesperado()
    if (caractere === '{') return this.lerObjeto()
    if (caractere === '[') return this.lerLista()
    if (caractere === '"') return this.lerTexto()
    if (caractere === '-' || (caractere >= '0' && caractere <= '9')) return this.lerNumero()
    if (this.texto.startsWith('true', this.posicao)) return this.lerLiteral('true', true)
    if (this.texto.startsWith('false', this.posicao)) return this.lerLiteral('false', false)
    if (this.texto.startsWith('null', this.posicao)) return this.lerLiteral('null', null)
    throw new FalhaJson(this.posicao, 'caractere inesperado')
  }

  private lerLiteral(palavra: string, valor: boolean | null): boolean | null {
    this.posicao += palavra.length
    return valor
  }

  private lerNumero(): number {
    REGEX_NUMERO.lastIndex = this.posicao
    const encontrado = REGEX_NUMERO.exec(this.texto)
    if (!encontrado) {
      if (this.posicao + 1 >= this.texto.length) throw this.fimInesperado()
      throw new FalhaJson(this.posicao, 'número inválido')
    }
    this.posicao += encontrado[0].length
    return Number(encontrado[0])
  }

  private lerTexto(): string {
    const inicio = this.posicao
    this.posicao++
    let resultado = ''
    for (;;) {
      const caractere = this.atual()
      if (caractere === undefined || caractere === '\n' || caractere === '\r') {
        throw new FalhaJson(inicio, 'texto sem aspas de fechamento')
      }
      if (caractere === '"') {
        this.posicao++
        return resultado
      }
      if (caractere === '\\') {
        resultado += this.lerEscape(inicio)
        continue
      }
      if (caractere < ' ') throw new FalhaJson(this.posicao, 'caractere de controle dentro do texto')
      resultado += caractere
      this.posicao++
    }
  }

  private lerEscape(inicioTexto: number): string {
    const barra = this.posicao
    const codigo = this.texto[barra + 1]
    if (codigo === undefined) throw new FalhaJson(inicioTexto, 'texto sem aspas de fechamento')
    if (codigo === 'u') {
      const hexa = this.texto.slice(barra + 2, barra + 6)
      if (!/^[0-9a-fA-F]{4}$/.test(hexa)) throw new FalhaJson(barra, 'sequência de escape inválida')
      this.posicao = barra + 6
      return String.fromCharCode(Number.parseInt(hexa, 16))
    }
    const traduzido = ESCAPES[codigo]
    if (traduzido === undefined) throw new FalhaJson(barra, 'sequência de escape inválida')
    this.posicao = barra + 2
    return traduzido
  }

  private lerLista(): ValorJson[] {
    this.posicao++
    const itens: ValorJson[] = []
    this.pularEspacos()
    if (this.atual() === ']') {
      this.posicao++
      return itens
    }
    for (;;) {
      itens.push(this.lerValor())
      this.pularEspacos()
      const caractere = this.atual()
      if (caractere === undefined) throw this.fimInesperado()
      if (caractere === ']') {
        this.posicao++
        return itens
      }
      if (caractere !== ',') throw new FalhaJson(this.posicao, 'esperava , ou ]')
      const virgula = this.posicao
      this.posicao++
      this.pularEspacos()
      if (this.atual() === ']') throw new FalhaJson(virgula, 'vírgula sobrando')
    }
  }

  private lerObjeto(): { [chave: string]: ValorJson } {
    this.posicao++
    const entradas: [string, ValorJson][] = []
    this.pularEspacos()
    if (this.atual() === '}') {
      this.posicao++
      return {}
    }
    for (;;) {
      const caractere = this.atual()
      if (caractere === undefined) throw this.fimInesperado()
      if (caractere !== '"') throw new FalhaJson(this.posicao, 'nome do campo deve estar entre aspas')
      const chave = this.lerTexto()
      this.pularEspacos()
      if (this.atual() === undefined) throw this.fimInesperado()
      if (this.atual() !== ':') throw new FalhaJson(this.posicao, 'esperava : depois do nome do campo')
      this.posicao++
      this.pularEspacos()
      entradas.push([chave, this.lerValor()])
      this.pularEspacos()
      const depois = this.atual()
      if (depois === undefined) throw this.fimInesperado()
      if (depois === '}') {
        this.posicao++
        // `Object.fromEntries` cria propriedades próprias (inclusive `__proto__`), como o `JSON.parse`.
        return Object.fromEntries(entradas)
      }
      if (depois !== ',') throw new FalhaJson(this.posicao, 'esperava , ou }')
      const virgula = this.posicao
      this.posicao++
      this.pularEspacos()
      if (this.atual() === '}') throw new FalhaJson(virgula, 'vírgula sobrando')
    }
  }
}

/** Linha e coluna (1-based) de uma posição do texto; `\r\n` conta como uma quebra só. */
function linhaEColuna(texto: string, posicao: number): { linha: number; coluna: number } {
  let linha = 1
  let inicioDaLinha = 0
  for (let i = 0; i < posicao && i < texto.length; i++) {
    if (texto[i] === '\n') {
      linha++
      inicioDaLinha = i + 1
    }
  }
  return { linha, coluna: posicao - inicioDaLinha + 1 }
}

/** Interpreta o JSON; no erro, devolve linha, coluna e explicação em português. */
export function analisarJson(texto: string): ResultadoJson {
  try {
    return { ok: true, valor: new Parser(texto).analisar() }
  } catch (falha) {
    if (!(falha instanceof FalhaJson)) throw falha
    const { linha, coluna } = linhaEColuna(texto, falha.posicao)
    const explicacao = falha.explicacao
    return { ok: false, erro: { linha, coluna, explicacao, mensagem: `Linha ${linha}, coluna ${coluna}: ${explicacao}` } }
  }
}
