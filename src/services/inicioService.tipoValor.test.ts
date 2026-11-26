import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { ULTIMAS_ADMIN_API, ULTIMAS_COM_TIPO_DE_VALOR_API, inicioAdminApi } from '../test/inicioFalsos'
import type { UltimaAlteracaoInicio } from '../types/dominio'
import { obterInicio } from './inicioService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/inicio'

/**
 * F11.1 (F12.12* do plano) — `"tipo de valor"` nas últimas alterações de `GET /api/ped/inicio`
 * (Swagger de 25/11/2026, l. 448 e l. 500: "Mesmo rótulo de `GET /ped/apontamentos`", exemplo `Numeral`;
 * resposta do back-end de 25/11/2026, seção 2).
 *
 * Interface esperada: `UltimaAlteracaoInicio.tipoValor: TipoValor | null` (`'porcentagem' | 'numeral' |
 * 'booleano'`), convertido como `paraTipoValor` (F1.3): `Porcentagem`, `Numeral`, `Booleano` em qualquer
 * caixa e sem espaços nas pontas. Ausente, `null` ou valor desconhecido vira `null` **sem rejeitar a
 * resposta** (o campo só serve para formatar o valor; sem ele, a tela mantém o formato atual).
 */
describe('F11.1 — Serviço do Início: "tipo de valor" nas últimas alterações', () => {
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

  function responder(alteracoes: unknown[]) {
    simularApi(fetchFalso, { [`GET ${ROTA}`]: () => respostaJson(inicioAdminApi({ 'ultimas alteracoes': alteracoes as never })) })
  }

  it('converte "Porcentagem", "Numeral" e "Booleano" para tipoValor, na ordem da API', async () => {
    responder(ULTIMAS_COM_TIPO_DE_VALOR_API)

    const { ultimasAlteracoes } = await obterInicio()

    expect(ultimasAlteracoes.map((a) => a.tipoValor)).toEqual(['porcentagem', 'porcentagem', 'numeral', 'booleano', 'numeral'])
  })

  it('a alteração completa leva o tipoValor junto dos demais campos', async () => {
    responder([ULTIMAS_COM_TIPO_DE_VALOR_API[0]])

    const [alteracao] = (await obterInicio()).ultimasAlteracoes

    expect(alteracao).toEqual<UltimaAlteracaoInicio>({
      acao: 'correcao',
      apontamento: 'Cobertura de clientes',
      competencia: '2026-10-01',
      filial: '101',
      valorAnterior: 5,
      valorNovo: 6.5,
      data: '2026-11-12 14:30:00',
      usuario: 'Ana Costa',
      tipoValor: 'porcentagem',
    })
  })

  it('exemplo do Swagger ("tipo de valor": "Numeral", correção 5 → 6) vira tipoValor "numeral"', async () => {
    responder([
      {
        acao: 'correcao',
        apontamento: 'Metas atingidas',
        'tipo de valor': 'Numeral',
        competencia: '2026-11-01',
        filial: '101',
        'valor anterior': 5,
        'valor novo': 6,
        data: '2026-11-10 09:30:00-04:00',
        usuario: 'Fulano de Tal',
      },
    ])

    const [alteracao] = (await obterInicio()).ultimasAlteracoes

    expect(alteracao).toMatchObject({ apontamento: 'Metas atingidas', tipoValor: 'numeral', valorAnterior: 5, valorNovo: 6 })
  })

  it.each([
    ['"PORCENTAGEM"', 'PORCENTAGEM', 'porcentagem'],
    ['" booleano "', ' booleano ', 'booleano'],
  ])('tipo %s (outra caixa ou com espaços) é aceito como paraTipoValor', async (_caso, tipo, esperado) => {
    responder([{ ...ULTIMAS_ADMIN_API[0], 'tipo de valor': tipo }])

    const [alteracao] = (await obterInicio()).ultimasAlteracoes

    expect(alteracao.tipoValor).toBe(esperado)
  })

  it.each([
    ['ausente (formato anterior)', undefined],
    ['null', null],
    ['desconhecido', 'Moeda'],
    ['número', 3],
  ])('"tipo de valor" %s vira tipoValor null, sem rejeitar a resposta', async (_caso, tipo) => {
    responder([{ ...ULTIMAS_ADMIN_API[0], 'tipo de valor': tipo }])

    const [alteracao] = (await obterInicio()).ultimasAlteracoes

    expect(alteracao.tipoValor).toBeNull()
    expect(alteracao).toMatchObject({ apontamento: 'Cobertura de clientes', valorAnterior: 5, valorNovo: 6.5 })
  })
})
