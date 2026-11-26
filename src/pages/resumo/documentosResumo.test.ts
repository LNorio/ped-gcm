import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOCUMENTOS_RESUMO } from './documentosResumo'

/**
 * F2.14 — Conteúdo da página /resumo: `docs/diario-implementacao.md` e `docs/documentacao.md`, lidos no
 * build (`import.meta.glob` ou `?raw`), sem alteração.
 */
const diarioReal = readFileSync(resolve(process.cwd(), 'docs/diario-implementacao.md'), 'utf8')
const documentacaoReal = readFileSync(resolve(process.cwd(), 'docs/documentacao.md'), 'utf8')

describe('F2.14 — Documentos do resumo (documentosResumo)', () => {
  it('diario é o texto de docs/diario-implementacao.md, sem alteração', () => {
    expect(DOCUMENTOS_RESUMO.diario).toBe(diarioReal)
  })

  it('documentacao é o texto de docs/documentacao.md, sem alteração', () => {
    expect(DOCUMENTOS_RESUMO.documentacao).toBe(documentacaoReal)
  })

  it('os dois textos têm o título de cada arquivo', () => {
    expect(DOCUMENTOS_RESUMO.diario).toMatch(/^# Diário de Implementação — PED\s*$/m)
    expect(DOCUMENTOS_RESUMO.documentacao).toMatch(/^# Documentação — PED\s*$/m)
  })
})
