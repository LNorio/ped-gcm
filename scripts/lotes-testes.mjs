// Divide uma bateria de testes (unit ou integration) em lotes de até N testes (padrão 150), para o
// orquestrador subir um subagente de execução por lote, em paralelo.
//
// Uso (a partir de C:\ com "C" maiúsculo no Windows):
//   node scripts/lotes-testes.mjs --projeto unit [--max 150] [--saida <arquivo.json>] [filtros...]
//   node scripts/lotes-testes.mjs --projeto integration --saida C:\...\lotes-integracao.json
//
// Os filtros opcionais (trechos de caminho) restringem os arquivos de teste considerados.
// A contagem é estática (lê os arquivos), para funcionar mesmo com testes de TDD que ainda não compilam.
// Saída: JSON com { projeto, max, totalTestes, totalArquivos, lotes: [{ lote, testes, arquivos }] },
// em que `arquivos` são caminhos relativos à raiz do projeto, prontos para `vitest run`.
// Um arquivo nunca é dividido entre lotes; um arquivo com mais de N testes fica sozinho num lote.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const argumentos = process.argv.slice(2)
let projeto = null
let max = 150
let saida = null
const filtros = []
for (let i = 0; i < argumentos.length; i++) {
  const argumento = argumentos[i]
  if (argumento === '--projeto') projeto = argumentos[++i]
  else if (argumento === '--max') max = Number(argumentos[++i])
  else if (argumento === '--saida') saida = argumentos[++i]
  else filtros.push(argumento)
}

if (projeto !== 'unit' && projeto !== 'integration') {
  console.error('Informe --projeto unit ou --projeto integration.')
  process.exit(2)
}
if (!Number.isInteger(max) || max < 1) {
  console.error('--max precisa ser um inteiro maior que zero.')
  process.exit(2)
}

// Arquivos de teste do projeto pedido (mesmos padrões do vite.config.ts).
function listarArquivos(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name)
    return entrada.isDirectory() ? listarArquivos(caminho) : [caminho]
  })
}
const ehIntegracao = (arquivo) => /\.integration\.test\.tsx?$/.test(arquivo)
const ehTeste = (arquivo) => /\.test\.tsx?$/.test(arquivo)
const arquivosDoProjeto = listarArquivos('src')
  .map((arquivo) => relative(process.cwd(), arquivo).replaceAll('\\', '/'))
  .filter((arquivo) => ehTeste(arquivo) && (projeto === 'integration' ? ehIntegracao(arquivo) : !ehIntegracao(arquivo)))
  .filter((arquivo) => filtros.length === 0 || filtros.some((filtro) => arquivo.includes(filtro.replaceAll('\\', '/'))))

// Contagem estática (não depende de o teste compilar, o que em TDD nem sempre acontece): cada
// `it(`/`test(` conta 1; `it.each(...)`/`test.each(...)` conta o número de casos da tabela quando
// ela é um literal de lista, senão 1. É uma estimativa suficiente para dividir os lotes.
function contarTestes(texto) {
  let total = 0
  for (const encontrado of texto.matchAll(/\b(?:it|test)(?:\.(?:only|skip|concurrent|todo|fails))*(\.each)?\s*\(/g)) {
    if (!encontrado[1]) {
      total += 1
      continue
    }
    const resto = texto.slice(encontrado.index + encontrado[0].length)
    const tabela = /^\s*\[([\s\S]*?)\]\s*\)/.exec(resto)
    const casos = tabela ? tabela[1].split(/\n\s*[[{'"`]/).length : 1
    total += Math.max(1, casos)
  }
  return Math.max(1, total)
}

const porArquivo = new Map(arquivosDoProjeto.map((arquivo) => [arquivo, contarTestes(readFileSync(arquivo, 'utf8'))]))
const testes = { length: [...porArquivo.values()].reduce((soma, n) => soma + n, 0) }

// First-fit decreasing: arquivos maiores primeiro, cada um no primeiro lote em que couber.
const arquivos = [...porArquivo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
const lotes = []
for (const [arquivo, quantidade] of arquivos) {
  const lote = lotes.find((candidato) => candidato.testes + quantidade <= max)
  if (lote) {
    lote.testes += quantidade
    lote.arquivos.push(arquivo)
  } else {
    lotes.push({ testes: quantidade, arquivos: [arquivo] })
  }
}
const resultado = {
  projeto,
  max,
  totalTestes: testes.length,
  totalArquivos: porArquivo.size,
  lotes: lotes.map((lote, indice) => ({ lote: indice + 1, testes: lote.testes, arquivos: lote.arquivos.sort() })),
}

const json = JSON.stringify(resultado, null, 2)
if (saida) writeFileSync(saida, json)
console.log(
  `${projeto}: ${resultado.totalTestes} testes em ${resultado.totalArquivos} arquivos → ${resultado.lotes.length} lote(s) de até ${max} testes` +
    (saida ? ` (gravado em ${saida})` : ''),
)
for (const lote of resultado.lotes) console.log(`  lote ${lote.lote}: ${lote.testes} testes, ${lote.arquivos.length} arquivo(s)`)
if (!saida) console.log(json)
