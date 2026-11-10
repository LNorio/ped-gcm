import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { validarIntegracao } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/integracao/validar'
const SAIDA = '{ "valor": "0", "referencia": "x" }'
const ENTRADA = '{ "filial": "%filial%", "inicio": "%dataInicial% - 3m" }'

/** Resposta 200 documentada em `FRONT-integracao-dado-externo.md`, seção 2. */
const RESPOSTA_VALIDA = {
  saida: {
    valido: true,
    campos: [
      { campo: 'valor', tipo: 'texto' },
      { campo: 'referencia', tipo: 'texto' },
    ],
  },
  entrada: {
    valido: true,
    'variaveis usadas': ['dataFinal', 'dataInicial', 'filial'],
    calculos: [{ campo: 'inicio', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' }],
    previa: { filial: '100', inicio: '01/07/2026' },
  },
}

/**
 * Validação da integração pelo back-end (F5.18): `POST /api/ped/integracao/validar`, sem gravar.
 * Corpo: `"parametros de saida"` e/ou `"parametros de entrada"` (só os não vazios). Resposta convertida
 * para o domínio (`ResultadoValidacaoIntegracao`): `saida`/`entrada` `null` quando não enviados.
 */
describe('F5.18 — Serviço: validarIntegracao({ parametrosSaida?, parametrosEntrada? })', () => {
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

  function simular(resposta: () => Response = () => respostaJson(RESPOSTA_VALIDA)) {
    return simularApi(fetchFalso, { [`POST ${ROTA}`]: resposta })
  }

  describe('requisição', () => {
    it('POST /api/ped/integracao/validar com o token e os dois textos como digitados', async () => {
      const chamadas = simular()

      await validarIntegracao({ parametrosSaida: SAIDA, parametrosEntrada: ENTRADA })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toEqual({ 'parametros de saida': SAIDA, 'parametros de entrada': ENTRADA })
    })

    it('só a saída: o corpo não leva "parametros de entrada"', async () => {
      const chamadas = simular(() => respostaJson({ saida: RESPOSTA_VALIDA.saida, entrada: null }))

      await validarIntegracao({ parametrosSaida: SAIDA })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de saida': SAIDA })
    })

    it('só a entrada: o corpo não leva "parametros de saida"', async () => {
      const chamadas = simular(() => respostaJson({ saida: null, entrada: RESPOSTA_VALIDA.entrada }))

      await validarIntegracao({ parametrosEntrada: ENTRADA })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de entrada': ENTRADA })
    })

    it('campo vazio ou só com espaços não é enviado', async () => {
      const chamadas = simular(() => respostaJson({ saida: null, entrada: RESPOSTA_VALIDA.entrada }))

      await validarIntegracao({ parametrosSaida: '   \n ', parametrosEntrada: ENTRADA })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de entrada': ENTRADA })
    })

    it('com os dois vazios (ou ausentes) não chama a API e resolve { saida: null, entrada: null }', async () => {
      const chamadas = simular()

      await expect(validarIntegracao({ parametrosSaida: '', parametrosEntrada: '  ' })).resolves.toEqual({ saida: null, entrada: null })
      await expect(validarIntegracao({})).resolves.toEqual({ saida: null, entrada: null })
      expect(chamadas).toHaveLength(0)
    })
  })

  describe('resposta convertida para o domínio', () => {
    it('saída e entrada válidas (exemplo do documento)', async () => {
      simular()

      await expect(validarIntegracao({ parametrosSaida: SAIDA, parametrosEntrada: ENTRADA })).resolves.toEqual({
        saida: {
          valido: true,
          campos: [
            { nome: 'valor', tipo: 'texto' },
            { nome: 'referencia', tipo: 'texto' },
          ],
        },
        entrada: {
          valido: true,
          variaveisUsadas: ['dataFinal', 'dataInicial', 'filial'],
          calculos: [{ caminho: 'inicio', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' }],
          previa: { filial: '100', inicio: '01/07/2026' },
        },
      })
    })

    it('os tipos dos campos da saída vêm como a API manda (numero, booleano, lista, objeto, nulo)', async () => {
      simular(() =>
        respostaJson({
          saida: {
            valido: true,
            campos: [
              { campo: 'qtd', tipo: 'numero' },
              { campo: 'ok', tipo: 'booleano' },
              { campo: 'itens', tipo: 'lista' },
              { campo: 'extra', tipo: 'objeto' },
              { campo: 'vazio', tipo: 'nulo' },
            ],
          },
        }),
      )

      const { saida } = await validarIntegracao({ parametrosSaida: SAIDA })

      expect(saida).toEqual({
        valido: true,
        campos: [
          { nome: 'qtd', tipo: 'numero' },
          { nome: 'ok', tipo: 'booleano' },
          { nome: 'itens', tipo: 'lista' },
          { nome: 'extra', tipo: 'objeto' },
          { nome: 'vazio', tipo: 'nulo' },
        ],
      })
    })

    it('saída inválida: { valido: false, erro: { mensagem, linha, coluna } }', async () => {
      simular(() =>
        respostaJson({ saida: { valido: false, erro: { mensagem: "virgula sobrando antes de '}'", linha: 1, coluna: 12 } }, entrada: null }),
      )

      await expect(validarIntegracao({ parametrosSaida: '{"a": 1,}' })).resolves.toEqual({
        saida: { valido: false, erro: { mensagem: "virgula sobrando antes de '}'", linha: 1, coluna: 12 } },
        entrada: null,
      })
    })

    it('saída inválida sem linha e coluna: linha e coluna null', async () => {
      simular(() => respostaJson({ saida: { valido: false, erro: { mensagem: 'o JSON deve ser objeto ou lista' } } }))

      const { saida } = await validarIntegracao({ parametrosSaida: '1' })

      expect(saida).toEqual({ valido: false, erro: { mensagem: 'o JSON deve ser objeto ou lista', linha: null, coluna: null } })
    })

    it('entrada válida: variáveis usadas sem os % e cálculos com "caminho" também aceitos', async () => {
      simular(() =>
        respostaJson({
          entrada: {
            valido: true,
            'variaveis usadas': ['%mesesRetro%'],
            calculos: [{ caminho: 'filtro.dias', expressao: '(%mesesRetro% * 30) - 1', resultado: '89' }],
            previa: { filtro: { dias: '89' } },
          },
        }),
      )

      const { entrada } = await validarIntegracao({ parametrosEntrada: '{"filtro": {"dias": "(%mesesRetro% * 30) - 1"}}' })

      expect(entrada).toEqual({
        valido: true,
        variaveisUsadas: ['mesesRetro'],
        calculos: [{ caminho: 'filtro.dias', expressao: '(%mesesRetro% * 30) - 1', resultado: '89' }],
        previa: { filtro: { dias: '89' } },
      })
    })

    /**
     * Em `validar`, o `campo` de cada erro da entrada é o ponto do JSON (como em `calculos`); `caminho`,
     * quando vem, prevalece. O nome do campo da modal ("parametros de entrada") não é um caminho.
     */
    it('entrada inválida: { valido: false, erros } na mesma forma do erro do 400 (ErroIntegracao)', async () => {
      simular(() =>
        respostaJson({
          saida: null,
          entrada: {
            valido: false,
            erros: [
              { campo: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero' },
              { campo: 'parametros de entrada', caminho: 'lista[0]', expressao: '%foo%', mensagem: 'variavel desconhecida: %foo%' },
              { mensagem: 'virgula sobrando', linha: 2, coluna: 3 },
              { campo: 'parametros de entrada', mensagem: 'o JSON de entrada deve ser um objeto' },
            ],
          },
        }),
      )

      const { entrada } = await validarIntegracao({ parametrosEntrada: ENTRADA })

      expect(entrada).toEqual({
        valido: false,
        erros: [
          { campo: 'parametros de entrada', caminho: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero', linha: null, coluna: null },
          {
            campo: 'parametros de entrada',
            caminho: 'lista[0]',
            expressao: '%foo%',
            mensagem: 'variavel desconhecida: %foo%',
            linha: null,
            coluna: null,
          },
          { campo: 'parametros de entrada', caminho: null, expressao: null, mensagem: 'virgula sobrando', linha: 2, coluna: 3 },
          {
            campo: 'parametros de entrada',
            caminho: null,
            expressao: null,
            mensagem: 'o JSON de entrada deve ser um objeto',
            linha: null,
            coluna: null,
          },
        ],
      })
    })

    it('"saida" ou "entrada" null ou ausente → null', async () => {
      simular(() => respostaJson({ saida: null }))

      await expect(validarIntegracao({ parametrosSaida: SAIDA, parametrosEntrada: ENTRADA })).resolves.toEqual({
        saida: null,
        entrada: null,
      })
    })
  })

  describe('resposta fora do formato → ApiError(200, "Resposta inválida do servidor.")', () => {
    it.each<[string, unknown]>([
      ['lista', [RESPOSTA_VALIDA]],
      ['texto solto', 'ok'],
      ['saída sem "valido"', { saida: { campos: [] } }],
      ['saída com "valido" em texto', { saida: { valido: 'sim', campos: [] } }],
      ['saída válida sem campos', { saida: { valido: true } }],
      ['campo da saída sem tipo', { saida: { valido: true, campos: [{ campo: 'valor' }] } }],
      ['campo da saída sem nome', { saida: { valido: true, campos: [{ tipo: 'texto' }] } }],
      ['saída inválida sem erro', { saida: { valido: false } }],
      ['erro da saída sem mensagem', { saida: { valido: false, erro: { linha: 1, coluna: 2 } } }],
      ['entrada em texto', { entrada: 'ok' }],
      ['entrada válida com "variaveis usadas" que não é lista', { entrada: { ...RESPOSTA_VALIDA.entrada, 'variaveis usadas': 'filial' } }],
      ['entrada válida com cálculo sem expressão', { entrada: { ...RESPOSTA_VALIDA.entrada, calculos: [{ campo: 'inicio', resultado: 'x' }] } }],
      ['entrada inválida sem erros', { entrada: { valido: false } }],
      ['erro da entrada sem mensagem', { entrada: { valido: false, erros: [{ campo: 'inicio', expressao: '5 / 0' }] } }],
    ])('%s', async (_nome, corpo) => {
      simular(() => respostaJson(corpo))

      const erro = await validarIntegracao({ parametrosSaida: SAIDA, parametrosEntrada: ENTRADA }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('erros HTTP e de rede são propagados', () => {
    it('403 (perfil que não é Admin) rejeita com a mensagem da API', async () => {
      simular(() => respostaErro(403, 'Acesso negado.'))

      await expect(validarIntegracao({ parametrosSaida: SAIDA })).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })

    it('500 rejeita com a mensagem padrão', async () => {
      simular(() => respostaErro(500))

      await expect(validarIntegracao({ parametrosSaida: SAIDA })).rejects.toMatchObject({
        status: 500,
        mensagem: mensagemPadraoPorStatus(500),
      })
    })

    it('falha de rede rejeita com ApiError status 0', async () => {
      fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(validarIntegracao({ parametrosEntrada: ENTRADA })).rejects.toMatchObject({ status: 0, mensagem: MENSAGEM_SEM_CONEXAO })
    })
  })
})
