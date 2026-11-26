/**
 * Documentos para o back-end (F2.13): todos os `.md` de `docs/propostas-backend/`, lidos no build por
 * `import.meta.glob`. Um documento novo na pasta entra sozinho na página `/backend`, sem mudar código.
 *
 * Módulo puro (sem React): `montarDocumentos` converte o resultado do glob (caminho → texto) na lista
 * exibida pela página, já na ordem (mais recentes primeiro; sem data por último).
 */

export interface DocumentoBackend {
  /** Nome do arquivo sem `.md`; usado no parâmetro `?doc` da URL. */
  id: string
  /** Nome do arquivo, sem a pasta, com `.md`. */
  arquivo: string
  /** Texto do primeiro cabeçalho `# `; sem ele, o nome do arquivo sem `.md`. */
  titulo: string
  /** Data `AAAA-MM-DD` do nome do arquivo, ou `null`. */
  data: string | null
  /** Markdown sem alteração. */
  conteudo: string
}

const DATA_NO_NOME = /(\d{4}-\d{2}-\d{2})/
const CABECALHO_NIVEL_1 = /^#[ \t]+(.*)$/
const CERCA_DE_CODIGO = /^\s{0,3}(```|~~~)/

/** Texto do primeiro cabeçalho `# ` fora de blocos de código, ou `null`. */
function primeiroTitulo(conteudo: string): string | null {
  let dentroDeCodigo = false
  for (const linha of conteudo.split(/\r?\n/)) {
    if (CERCA_DE_CODIGO.test(linha)) {
      dentroDeCodigo = !dentroDeCodigo
      continue
    }
    if (dentroDeCodigo) continue
    const encontrado = CABECALHO_NIVEL_1.exec(linha)
    if (encontrado) {
      const titulo = encontrado[1].replace(/\r$/, '').trim()
      if (titulo) return titulo
    }
  }
  return null
}

function compararTexto(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** Ordem: data mais recente primeiro; mesma data em ordem alfabética; sem data por último, em ordem alfabética. */
function compararDocumentos(a: DocumentoBackend, b: DocumentoBackend): number {
  if (a.data !== b.data) {
    if (a.data === null) return 1
    if (b.data === null) return -1
    return compararTexto(b.data, a.data)
  }
  return compararTexto(a.arquivo, b.arquivo)
}

export function montarDocumentos(arquivos: Record<string, string>): DocumentoBackend[] {
  return Object.entries(arquivos)
    .map(([caminho, conteudo]): DocumentoBackend => {
      const arquivo = caminho.split('/').pop() ?? caminho
      const id = arquivo.replace(/\.md$/i, '')
      return {
        id,
        arquivo,
        titulo: primeiroTitulo(conteudo) ?? id,
        data: DATA_NO_NOME.exec(arquivo)?.[1] ?? null,
        conteudo,
      }
    })
    .sort(compararDocumentos)
}

export const DOCUMENTOS_BACKEND: readonly DocumentoBackend[] = montarDocumentos(
  import.meta.glob<string>('/docs/propostas-backend/*.md', { query: '?raw', import: 'default', eager: true }),
)
