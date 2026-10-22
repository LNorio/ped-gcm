// Executado pelo hook .githooks/pre-commit.
// Roda os testes unitários e de integração relacionados aos arquivos do commit e bloqueia o commit
// (código de saída 1) se qualquer teste falhar.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

// Alterações nestes arquivos podem afetar qualquer teste: roda a bateria completa.
const ARQUIVOS_GERAIS = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json']

const arquivosCommit = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const arquivosCodigo = arquivosCommit.filter((arquivo) => /^src\/.*\.(ts|tsx)$/.test(arquivo))
const bateriaCompleta =
  arquivosCommit.some((arquivo) => ARQUIVOS_GERAIS.includes(arquivo)) ||
  // Arquivos excluídos não podem ser passados ao `vitest related`; quem dependia deles precisa ser testado.
  execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=D', '--', 'src'], { encoding: 'utf8' }).trim() !== ''

if (!bateriaCompleta && arquivosCodigo.length === 0) process.exit(0)

const pastaTemporaria = mkdtempSync(join(tmpdir(), 'ped-testes-'))
const relatorio = join(pastaTemporaria, 'resultado.json')
const argumentos = bateriaCompleta
  ? ['vitest', 'run', '--passWithNoTests']
  : ['vitest', 'related', '--run', '--passWithNoTests', ...arquivosCodigo]

console.log(
  bateriaCompleta
    ? 'Executando todos os testes (alteração em configuração ou exclusão de arquivo)...'
    : `Executando testes relacionados a ${arquivosCodigo.length} arquivo(s) do commit...`,
)
const execucao = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', ...argumentos.slice(1), '--reporter=default', '--reporter=json', `--outputFile=${relatorio}`],
  { stdio: 'inherit' },
)

let resultado
try {
  resultado = JSON.parse(readFileSync(relatorio, 'utf8'))
} catch {
  console.error('\nCOMMIT BLOQUEADO: não foi possível executar os testes (erro de compilação ou configuração).')
  process.exit(1)
} finally {
  rmSync(pastaTemporaria, { recursive: true, force: true })
}

const baterias = {
  'Testes unitários': { aprovados: 0, total: 0, falhas: [] },
  'Testes de integração': { aprovados: 0, total: 0, falhas: [] },
}
for (const arquivo of resultado.testResults) {
  const bateria = baterias[/\.integration\.test\.tsx?$/.test(arquivo.name) ? 'Testes de integração' : 'Testes unitários']
  const nomeArquivo = relative(process.cwd(), arquivo.name)
  if (arquivo.assertionResults.length === 0 && arquivo.status === 'failed') {
    bateria.total += 1
    bateria.falhas.push(`${nomeArquivo}: ${arquivo.message.split('\n')[0]}`)
  }
  for (const teste of arquivo.assertionResults) {
    if (teste.status === 'pending' || teste.status === 'skipped') continue
    bateria.total += 1
    if (teste.status === 'passed') bateria.aprovados += 1
    else bateria.falhas.push(`${nomeArquivo} › ${teste.fullName}: ${teste.failureMessages[0]?.split('\n')[0] ?? 'falhou'}`)
  }
}

console.log('\n================ RESULTADO DOS TESTES DO COMMIT ================')
let falhou = execucao.status !== 0
for (const [nome, bateria] of Object.entries(baterias)) {
  const percentual = bateria.total === 0 ? 100 : (bateria.aprovados / bateria.total) * 100
  const aprovado = bateria.falhas.length === 0
  if (!aprovado) falhou = true
  console.log(
    `${nome}: ${aprovado ? 'APROVADO' : 'REPROVADO'} — ${percentual.toFixed(2).replace('.', ',')}% de sucesso ` +
      `(${bateria.aprovados} de ${bateria.total})`,
  )
  for (const falha of bateria.falhas) console.log(`  - ${falha}`)
}

const semFalhasListadas = Object.values(baterias).every((bateria) => bateria.falhas.length === 0)
if (falhou && semFalhasListadas) {
  console.log('Erros de execução: a bateria não terminou corretamente (erro não tratado ou tempo esgotado). Veja a saída acima.')
}

if (falhou) {
  console.error('\nCOMMIT BLOQUEADO: os testes não foram concluídos com sucesso (é necessário 100%).')
  process.exit(1)
}
console.log('\nTodos os testes passaram. Commit liberado.')
