import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { respostaErrosPorFilial, respostaMetasPendentesApi } from '../test/indicadoresFalsos'
import { ApiError } from './api'
import { definirMetasPendentes, errosPorFilial } from './indicadoresService'
import { definirToken, limparToken } from './sessao'

/**
 * F6.12 — "Definir metas pendentes": `PUT /api/ped/indicadores-cadastro/{id}/metas-filiais`
 * (API (26).md, "Definir as filiais pendentes", 2026-11-10).
 *
 * - Corpo: exatamente `{ "metas por filial": [{ filial, meta }] }`, na ordem recebida, com a meta como
 *   número JSON (o back recusa o texto "1.500").
 * - Regra "2xx = gravado": resolve `{ filiaisDefinidas: string[]; filiaisSemMeta: string[] | null }` a
 *   partir de `"filiais definidas"` e `"filiais sem meta"` (códigos numéricos viram texto). Ausentes ou
 *   fora do formato → `filiaisDefinidas: []` e `filiaisSemMeta: null`, sem erro (corpo vazio, 204, texto).
 * - Erros HTTP (400 com `erros` por filial, 403, 404) são propagados como `ApiError`; os erros por filial
 *   são lidos com `errosPorFilial` (F6.10).
 */
const ROTA = '/api/ped/indicadores-cadastro'
const ROTA_PUT = `PUT ${ROTA}/8/metas-filiais`

describe('F6.12 — definirMetasPendentes (serviço de indicadores)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  it('envia PUT .../{id}/metas-filiais só com "metas por filial" (metas como número, na ordem recebida)', async () => {
    const chamadas = simularApi(fetchFalso, { [ROTA_PUT]: () => respostaJson(respostaMetasPendentesApi(['101', '102'], [])) })

    await definirMetasPendentes(8, [
      { filial: '102', meta: 980 },
      { filial: '101', meta: 1200.5 },
    ])

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].metodo).toBe('PUT')
    expect(chamadas[0].caminho).toBe(`${ROTA}/8/metas-filiais`)
    expect(corpoDaChamada(chamadas[0])).toEqual({
      'metas por filial': [
        { filial: '102', meta: 980 },
        { filial: '101', meta: 1200.5 },
      ],
    })
  })

  it('200: devolve as filiais definidas e as que continuam sem meta', async () => {
    simularApi(fetchFalso, { [ROTA_PUT]: () => respostaJson(respostaMetasPendentesApi(['101'], ['102'])) })

    await expect(definirMetasPendentes(8, [{ filial: '101', meta: 10 }])).resolves.toEqual({ filiaisDefinidas: ['101'], filiaisSemMeta: ['102'] })
  })

  it('códigos numéricos nas listas viram texto', async () => {
    simularApi(fetchFalso, {
      [ROTA_PUT]: () => respostaJson({ mensagem: 'metas definidas', 'filiais definidas': [101, 102], 'filiais sem meta': [] }),
    })

    await expect(definirMetasPendentes(8, [{ filial: '101', meta: 10 }])).resolves.toEqual({ filiaisDefinidas: ['101', '102'], filiaisSemMeta: [] })
  })

  it.each([
    ['corpo vazio (204)', () => new Response(null, { status: 204 })],
    ['só mensagem', () => respostaJson({ mensagem: 'metas definidas' })],
    ['listas fora do formato', () => respostaJson({ 'filiais definidas': 'todas', 'filiais sem meta': { filial: '102' } })],
    ['lista pura', () => respostaJson(['101'])],
    ['texto JSON', () => respostaJson('metas definidas')],
  ])('2xx com %s resolve sem erro (filiaisDefinidas [] e filiaisSemMeta null)', async (_caso, resposta) => {
    simularApi(fetchFalso, { [ROTA_PUT]: resposta })

    await expect(definirMetasPendentes(8, [{ filial: '101', meta: 10 }])).resolves.toEqual({ filiaisDefinidas: [], filiaisSemMeta: null })
  })

  it('400 com erros por filial: rejeita com ApiError (mensagem da API) e os erros são lidos por errosPorFilial', async () => {
    simularApi(fetchFalso, {
      [ROTA_PUT]: () =>
        respostaErrosPorFilial([
          { filial: '100', mensagem: 'a filial 100 ja tem meta' },
          { filial: '102', mensagem: 'a meta da filial 102 deve ser um numero maior que zero' },
        ]),
    })

    const falha = await definirMetasPendentes(8, [{ filial: '100', meta: 1 }]).catch((erro: unknown) => erro)

    expect(falha).toBeInstanceOf(ApiError)
    expect(falha).toMatchObject({ status: 400, mensagem: 'a filial 100 ja tem meta' })
    expect(errosPorFilial(falha)).toEqual([
      { filial: '100', mensagem: 'a filial 100 ja tem meta' },
      { filial: '102', mensagem: 'a meta da filial 102 deve ser um numero maior que zero' },
    ])
  })

  it.each([
    [404, 'indicador nao encontrado'],
    [403, 'sem permissao'],
  ])('%i: rejeita com ApiError e a mensagem da API', async (status, mensagem) => {
    simularApi(fetchFalso, { [ROTA_PUT]: () => respostaErro(status, mensagem) })

    await expect(definirMetasPendentes(8, [{ filial: '101', meta: 10 }])).rejects.toMatchObject({ status, mensagem })
  })
})
