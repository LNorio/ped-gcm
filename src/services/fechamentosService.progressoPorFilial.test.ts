import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { respostaEncerramentoApi } from '../test/fechamentosFalsos'
import { AVISO_DRG_API, AVISO_LANCAMENTOS_PENDENTES_IMAGEM_API, previaComercialComResumoRealApi } from '../test/previaFalsos'
import type { ProgressoDaFilial } from '../types/dominio'
import { encerrarFechamento, obterPreviaFechamento } from './fechamentosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/fechamentos'

/**
 * F10.1 — Prévia do fechamento no formato de 24/11/2026 (resposta do back-end de 25/11/2026,
 * `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`, seções 2 e 4; Swagger de 25/11/2026,
 * schema `ResumoFechamento`, l. 6453–6466). É o RF-80.
 *
 * Interface esperada:
 * - `PreviaFechamento.progressoPorFilial: ProgressoDaFilial[]` (só a prévia traz o campo, por isso fica na
 *   prévia e não em `ResumoFechamento`, que também serve ao encerramento);
 * - `ProgressoDaFilial { filial: string; nomeFilial: string | null; preenchidos: number; total: number }`,
 *   lido de `resumo."progresso por filial"[]` `{ filial, "nome filial", preenchidos, total }`, na ordem da
 *   API; `filial` numérica vira texto; `"nome filial"` ausente ou `null` vira `null`;
 * - campo ausente, `null` ou que não é lista → `[]`, **sem rejeitar a prévia** (é só informativo); itens
 *   fora do formato (sem filial, contagens que não são número) são ignorados;
 * - `resumo.avisos` continua lido como hoje (o aviso único do DRG chega em `resumo.avisos`) e
 *   `imagens[].avisos` continua com todos os avisos da imagem (o filtro do texto repetido é da tela).
 */
describe('F10.1 — Serviço da prévia: "progresso por filial" e aviso do DRG no resumo', () => {
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

  function responder(previa: unknown) {
    simularApi(fetchFalso, { [`GET ${ROTA}/1/previa`]: () => respostaJson(previa) })
  }

  it('converte resumo."progresso por filial" em progressoPorFilial, na ordem da API', async () => {
    responder(previaComercialComResumoRealApi())

    const previa = await obterPreviaFechamento(1)

    expect(previa.progressoPorFilial).toEqual<ProgressoDaFilial[]>([
      { filial: '101', nomeFilial: 'CAMPO GRANDE', preenchidos: 3, total: 3 },
      { filial: '102', nomeFilial: 'DOURADOS', preenchidos: 2, total: 3 },
    ])
  })

  it('filial numérica vira texto e "nome filial" ausente ou null vira nomeFilial null', async () => {
    responder(
      previaComercialComResumoRealApi([
        { filial: 101, preenchidos: 1, total: 2 },
        { filial: '403', 'nome filial': null, preenchidos: 0, total: 5 },
      ]),
    )

    const previa = await obterPreviaFechamento(1)

    expect(previa.progressoPorFilial).toEqual<ProgressoDaFilial[]>([
      { filial: '101', nomeFilial: null, preenchidos: 1, total: 2 },
      { filial: '403', nomeFilial: null, preenchidos: 0, total: 5 },
    ])
  })

  it.each([
    ['ausente (prévia anterior ao deploy de 24/11/2026)', undefined],
    ['null', null],
    ['lista vazia (nenhuma unidade aberta)', []],
    ['um objeto (não lista)', { filial: '101' }],
  ])('"progresso por filial" %s vira [], sem rejeitar a prévia', async (_caso, progresso) => {
    const api = previaComercialComResumoRealApi()
    if (progresso === undefined) delete api.resumo['progresso por filial']
    else api.resumo['progresso por filial'] = progresso
    responder(api)

    const previa = await obterPreviaFechamento(1)

    expect(previa.progressoPorFilial).toEqual([])
    expect(previa.imagens).toHaveLength(2)
    expect(previa.resumo.imagensAGerar).toBe(2)
  })

  it('itens fora do formato (sem filial, contagem em texto ou que não são objeto) são ignorados; os válidos ficam', async () => {
    responder(
      previaComercialComResumoRealApi([
        { 'nome filial': 'SEM CÓDIGO', preenchidos: 1, total: 1 },
        { filial: '101', 'nome filial': 'CAMPO GRANDE', preenchidos: '3', total: 3 },
        'texto',
        { filial: '102', 'nome filial': 'DOURADOS', preenchidos: 2, total: 3 },
      ]),
    )

    const previa = await obterPreviaFechamento(1)

    expect(previa.progressoPorFilial).toEqual<ProgressoDaFilial[]>([{ filial: '102', nomeFilial: 'DOURADOS', preenchidos: 2, total: 3 }])
  })

  it('o aviso único do DRG chega em resumo.avisos; os avisos de cada imagem continuam completos', async () => {
    responder(previaComercialComResumoRealApi())

    const previa = await obterPreviaFechamento(1)

    expect(previa.resumo.avisos).toEqual([AVISO_DRG_API])
    expect(previa.imagens[0].avisos).toEqual([AVISO_DRG_API])
    expect(previa.imagens[1].avisos).toEqual([
      'Filial 102 sem tabela de faixas: sem pontuação',
      AVISO_DRG_API,
      AVISO_LANCAMENTOS_PENDENTES_IMAGEM_API,
    ])
  })

  it('o encerramento não ganha o campo: o resultado continua sem progressoPorFilial', async () => {
    simularApi(fetchFalso, { [`POST ${ROTA}/1/encerrar`]: () => respostaJson(respostaEncerramentoApi()) })

    const resultado = await encerrarFechamento(1)

    expect(resultado).not.toHaveProperty('progressoPorFilial')
    expect(resultado.resumo).not.toHaveProperty('progressoPorFilial')
  })
})
