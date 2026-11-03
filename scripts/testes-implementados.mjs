// Executado pela build: roda todos os testes, mas só exige 100% de sucesso dos requisitos com status
// "implementado" em requisitos.json. Requisitos ainda em TDD aparecem apenas como progresso.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STATUS, carregarRequisitos, classificarResultado, imprimirResultado, validarRequisitos } from './requisitos.mjs'

const requisitos = carregarRequisitos()
const implementados = requisitos.filter((requisito) => requisito.status === STATUS.implementado)
console.log(`Requisitos implementados: ${implementados.length} de ${requisitos.length}`)
for (const requisito of requisitos) console.log(`  - ${requisito.id} ${requisito.titulo} [${requisito.status}]`)
console.log('')

const pastaTemporaria = mkdtempSync(join(tmpdir(), 'ped-testes-'))
const relatorio = join(pastaTemporaria, 'resultado.json')
spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', '--passWithNoTests', '--reporter=dot', '--reporter=json', `--outputFile=${relatorio}`],
  { stdio: 'inherit' },
)

let resultado
try {
  resultado = JSON.parse(readFileSync(relatorio, 'utf8'))
} catch {
  console.error('\nTESTES FALHARAM: não foi possível executar os testes (erro de compilação ou configuração).')
  process.exit(1)
} finally {
  rmSync(pastaTemporaria, { recursive: true, force: true })
}

console.log('\n============ TESTES DAS PARTES IMPLEMENTADAS ============')
const aprovado = imprimirResultado(classificarResultado(resultado, requisitos), validarRequisitos(requisitos))
if (!aprovado) {
  console.error('\nTESTES REPROVADOS: a build não será realizada.')
  process.exit(1)
}
console.log('\nTESTES APROVADOS')
