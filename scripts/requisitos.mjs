// Registro de requisitos (requisitos.json) e classificação dos resultados do Vitest por requisito.
// Somente requisitos com status "implementado" bloqueiam commit e build. Os demais estão em TDD:
// os testes já existem, mas é esperado que falhem até a implementação ser concluída.
import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

export const STATUS = {
  pendente: 'pendente',
  emAlteracao: 'em-alteracao',
  implementado: 'implementado',
}

export function carregarRequisitos(arquivo = 'requisitos.json') {
  return JSON.parse(readFileSync(arquivo, 'utf8')).requisitos
}

export function normalizarCaminho(caminho) {
  return relative(process.cwd(), caminho).replaceAll('\\', '/')
}

export function validarRequisitos(requisitos) {
  const erros = []
  const ids = new Set()
  const arquivos = new Map()
  for (const requisito of requisitos) {
    if (ids.has(requisito.id)) erros.push(`${requisito.id}: id duplicado`)
    ids.add(requisito.id)
    if (!Object.values(STATUS).includes(requisito.status)) {
      erros.push(`${requisito.id}: status "${requisito.status}" inválido (use ${Object.values(STATUS).join(', ')})`)
    }
    if (requisito.testes.length === 0) erros.push(`${requisito.id}: requisito sem testes (TDD exige testes antes da implementação)`)
    for (const teste of requisito.testes) {
      if (!existsSync(teste)) erros.push(`${requisito.id}: arquivo de teste não encontrado: ${teste}`)
      if (arquivos.has(teste)) erros.push(`${teste}: vinculado a ${arquivos.get(teste)} e ${requisito.id}`)
      arquivos.set(teste, requisito.id)
    }
  }
  return erros
}

function novaBateria() {
  return { aprovados: 0, total: 0, falhas: [] }
}

function somarArquivo(bateria, arquivo, nome) {
  if (arquivo.assertionResults.length === 0 && arquivo.status === 'failed') {
    bateria.total += 1
    bateria.falhas.push(`${nome}: ${arquivo.message.split('\n')[0]}`)
  }
  for (const teste of arquivo.assertionResults) {
    if (teste.status === 'pending' || teste.status === 'skipped' || teste.status === 'todo') continue
    bateria.total += 1
    if (teste.status === 'passed') bateria.aprovados += 1
    else bateria.falhas.push(`${nome} › ${teste.fullName}: ${teste.failureMessages[0]?.split('\n')[0] ?? 'falhou'}`)
  }
}

// Separa o relatório JSON do Vitest em: baterias dos requisitos implementados (bloqueiam),
// progresso dos requisitos em TDD (informativo) e arquivos de teste sem requisito (bloqueiam).
export function classificarResultado(resultado, requisitos) {
  const requisitoPorArquivo = new Map(requisitos.flatMap((requisito) => requisito.testes.map((teste) => [teste, requisito])))
  const baterias = { 'Testes unitários': novaBateria(), 'Testes de integração': novaBateria() }
  const emTdd = new Map()
  const semRequisito = []

  for (const arquivo of resultado.testResults) {
    const nome = normalizarCaminho(arquivo.name)
    const requisito = requisitoPorArquivo.get(nome)
    if (!requisito) {
      semRequisito.push(nome)
      continue
    }
    if (requisito.status === STATUS.implementado) {
      somarArquivo(baterias[/\.integration\.test\.tsx?$/.test(nome) ? 'Testes de integração' : 'Testes unitários'], arquivo, nome)
    } else {
      if (!emTdd.has(requisito.id)) emTdd.set(requisito.id, { requisito, ...novaBateria() })
      somarArquivo(emTdd.get(requisito.id), arquivo, nome)
    }
  }
  return { baterias, emTdd: [...emTdd.values()], semRequisito }
}

function percentual(aprovados, total) {
  return `${((aprovados / total) * 100).toFixed(2).replace('.', ',')}%`
}

// Imprime o resultado e retorna true se tudo o que bloqueia passou.
export function imprimirResultado({ baterias, emTdd, semRequisito }, errosRegistro = []) {
  let aprovado = errosRegistro.length === 0 && semRequisito.length === 0
  for (const [nome, bateria] of Object.entries(baterias)) {
    if (bateria.total === 0) {
      console.log(`${nome}: SEM TESTES — nenhum teste de requisito implementado nesta bateria`)
      continue
    }
    const ok = bateria.falhas.length === 0
    if (!ok) aprovado = false
    console.log(`${nome}: ${ok ? 'APROVADO' : 'REPROVADO'} — ${percentual(bateria.aprovados, bateria.total)} de sucesso (${bateria.aprovados} de ${bateria.total})`)
    for (const falha of bateria.falhas) console.log(`  - ${falha}`)
  }
  if (emTdd.length > 0) {
    console.log('\nRequisitos em TDD (não bloqueiam — testes escritos antes da implementação):')
    for (const { requisito, aprovados, total } of emTdd) {
      console.log(`  - ${requisito.id} ${requisito.titulo} [${requisito.status}]: ${aprovados} de ${total} testes passando`)
    }
  }
  if (semRequisito.length > 0) {
    console.log('\nArquivos de teste sem requisito em requisitos.json (registre-os):')
    for (const arquivo of semRequisito) console.log(`  - ${arquivo}`)
  }
  if (errosRegistro.length > 0) {
    console.log('\nErros em requisitos.json:')
    for (const erro of errosRegistro) console.log(`  - ${erro}`)
  }
  return aprovado
}
