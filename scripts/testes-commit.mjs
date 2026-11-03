// Executado pelo hook .githooks/pre-commit.
// Roda os testes relacionados aos arquivos do commit e bloqueia o commit (código de saída 1) se algum
// teste de requisito implementado falhar. Testes de requisitos ainda em TDD não bloqueiam.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { carregarRequisitos, classificarResultado, imprimirResultado, validarRequisitos } from './requisitos.mjs'

// Alterações nestes arquivos podem afetar qualquer teste: roda a bateria completa.
const ARQUIVOS_GERAIS = [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'requisitos.json',
]

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
const argumentos = bateriaCompleta ? ['run', '--passWithNoTests'] : ['related', '--run', '--passWithNoTests', ...arquivosCodigo]

console.log(
  bateriaCompleta
    ? 'Executando todos os testes (alteração em configuração, requisitos ou exclusão de arquivo)...'
    : `Executando testes relacionados a ${arquivosCodigo.length} arquivo(s) do commit...`,
)
spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', ...argumentos, '--reporter=default', '--reporter=json', `--outputFile=${relatorio}`],
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

const requisitos = carregarRequisitos()
console.log('\n================ RESULTADO DOS TESTES DO COMMIT ================')
if (!imprimirResultado(classificarResultado(resultado, requisitos), validarRequisitos(requisitos))) {
  console.error('\nCOMMIT BLOQUEADO: os testes não foram concluídos com sucesso (é necessário 100%).')
  process.exit(1)
}
console.log('\nTodos os testes dos requisitos implementados passaram. Commit liberado.')
