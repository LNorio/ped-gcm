import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { validarIntegracao } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/integracao/validar'
const ENTRADA = '{"filtro": {"dias": "(%mesesRetro% * 30) - 0,5"}}'

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — `resultado` numérico dos cálculos devolvidos
 * por `POST /api/ped/integracao/validar` (`validarIntegracao`, conversão em `dadosExternosService.ts`).
 *
 * Antes, o número virava `String(n)` ("89.5"). Agora segue o motor local
 * (`utils/integracao/expressoes.ts`, `formatarNumero`): vírgula decimal, sem zeros desnecessários e sem
 * separador de milhar ("89,5", "1500,25"). `resultado` em texto continua como veio.
 */
describe('F12.2 — validarIntegracao: resultado numérico do cálculo com vírgula decimal', () => {
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

  async function resultadoDe(resultado: unknown): Promise<string | undefined> {
    simularApi(fetchFalso, {
      [`POST ${ROTA}`]: () =>
        respostaJson({
          entrada: {
            valido: true,
            'variaveis usadas': ['mesesRetro'],
            calculos: [{ caminho: 'filtro.dias', expressao: '(%mesesRetro% * 30) - 0,5', resultado }],
            previa: { filtro: { dias: '89,5' } },
          },
        }),
    })
    const { entrada } = await validarIntegracao({ parametrosEntrada: ENTRADA })
    return entrada?.valido ? entrada.calculos[0]?.resultado : undefined
  }

  it.each([
    [89.5, '89,5'],
    [89, '89'],
    [0.25, '0,25'],
    [-0.5, '-0,5'],
    [1500.25, '1500,25'],
    [0, '0'],
  ])('resultado %d vira "%s"', async (numero, esperado) => {
    expect(await resultadoDe(numero)).toBe(esperado)
  })

  it('resultado em texto continua como veio ("01/07/2026" e "89.5" em texto)', async () => {
    expect(await resultadoDe('01/07/2026')).toBe('01/07/2026')
    expect(await resultadoDe('89.5')).toBe('89.5')
  })
})
