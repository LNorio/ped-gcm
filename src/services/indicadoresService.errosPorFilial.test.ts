import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { errosPorFilial } from './indicadoresService'

/**
 * F6.10 — Erros 400 da meta por filial (API (26).md e FRONT-meta-por-filial.md, 2026-11-10).
 *
 * Formato do 400: `{ "mensagem": "<primeiro erro>", "erros": [{ "filial": "101" | null, "mensagem" }] }`,
 * com todos os erros de uma vez. `errosPorFilial(falha)` lê `ApiError.dados.erros` e devolve os itens
 * na ordem recebida, com `filial` em texto (código numérico vira texto) ou `null` (erro que não é de
 * uma filial). Itens sem `mensagem` em texto são ignorados; `filial` ausente ou fora do formato vira
 * `null`. Falha que não é `ApiError`, sem `dados` ou sem a lista `erros` devolve `[]`.
 */
describe('F6.10 — errosPorFilial (erros 400 da meta por filial)', () => {
  it('devolve cada erro com a filial e a mensagem, na ordem da API', () => {
    const falha = new ApiError(400, 'filial 99999 nao encontrada', {
      mensagem: 'filial 99999 nao encontrada',
      erros: [
        { filial: '99999', mensagem: 'filial 99999 nao encontrada' },
        { filial: '101', mensagem: 'a meta da filial 101 deve ser um numero maior que zero' },
      ],
    })

    expect(errosPorFilial(falha)).toEqual([
      { filial: '99999', mensagem: 'filial 99999 nao encontrada' },
      { filial: '101', mensagem: 'a meta da filial 101 deve ser um numero maior que zero' },
    ])
  })

  it('erro que não é de uma filial vem com filial null', () => {
    const mensagem = 'envie a meta (para todas as filiais) ou as metas por filial, nunca as duas juntas'
    const falha = new ApiError(400, mensagem, { mensagem, erros: [{ filial: null, mensagem }] })

    expect(errosPorFilial(falha)).toEqual([{ filial: null, mensagem }])
  })

  it('código de filial numérico vira texto', () => {
    const falha = new ApiError(400, 'x', { mensagem: 'x', erros: [{ filial: 102, mensagem: 'a filial 102 aparece mais de uma vez' }] })

    expect(errosPorFilial(falha)).toEqual([{ filial: '102', mensagem: 'a filial 102 aparece mais de uma vez' }])
  })

  it('filial ausente ou fora do formato vira null; itens sem mensagem em texto são ignorados', () => {
    const falha = new ApiError(400, 'x', {
      mensagem: 'x',
      erros: [
        { mensagem: 'sem filial' },
        { filial: { codigo: '100' }, mensagem: 'filial em objeto' },
        { filial: '100' },
        { filial: '101', mensagem: 42 },
        'texto solto',
        null,
        { filial: '102', mensagem: 'a meta da filial 102 ("1.500") e ambigua' },
      ],
    })

    expect(errosPorFilial(falha)).toEqual([
      { filial: null, mensagem: 'sem filial' },
      { filial: null, mensagem: 'filial em objeto' },
      { filial: '102', mensagem: 'a meta da filial 102 ("1.500") e ambigua' },
    ])
  })

  it.each([
    ['ApiError sem dados', new ApiError(400, 'Falha.')],
    ['ApiError sem a lista erros', new ApiError(400, 'Falha.', { mensagem: 'Falha.' })],
    ['erros que não é lista', new ApiError(400, 'Falha.', { mensagem: 'Falha.', erros: { filial: '101' } })],
    ['dados em texto', new ApiError(400, 'Falha.', 'texto')],
    ['erro que não é ApiError', new Error('rede')],
    ['valor qualquer', 'falhou'],
  ])('%s → []', (_caso, falha) => {
    expect(errosPorFilial(falha)).toEqual([])
  })
})
