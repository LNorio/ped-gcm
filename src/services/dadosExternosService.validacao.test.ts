import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import type { ParametrosValidacaoIntegracao } from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { validarIntegracao } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/integracao/validar'
const SAIDA = '{ "codemp": "string", "codfil": "string", "vlrLiq": "number" }'
const ENTRADA = '{ "operacao": "Consulta", "parametros": { "ECodEmp": "%empresas%", "EDatIni": "%dataInicial% - 3m" } }'

/** Resposta 200 documentada em `FRONT-integracao-dado-externo.md`, seção 2 (o back-end ainda pode mandar `saida`). */
const RESPOSTA_VALIDA = {
  saida: null,
  entrada: {
    valido: true,
    'variaveis usadas': ['dataFinal', 'dataInicial', 'filial'],
    calculos: [{ campo: 'inicio', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' }],
    previa: { filial: '100', inicio: '01/07/2026' },
  },
}

const ENTRADA_VALIDA_DOMINIO = {
  valido: true,
  variaveisUsadas: ['dataFinal', 'dataInicial', 'filial'],
  calculos: [{ caminho: 'inicio', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' }],
  previa: { filial: '100', inicio: '01/07/2026' },
}

/**
 * Validação da integração pelo back-end (F5.18): `POST /api/ped/integracao/validar`, sem gravar.
 *
 * Alteração de 11/11/2026 (saída sem mapeamento — `docs/propostas-backend/RESPOSTA-FRONT-saida-sem-mapeamento.md`):
 * os parâmetros de saída servem só para mostrar ao back-end a saída esperada do web service e são
 * validados **só no front** (`validarSaida`). Por isso o serviço:
 * - recebe `{ parametrosEntrada?, finalidade? }` (sem `parametrosSaida` nem `mapeamento`);
 * - envia só `"parametros de entrada"` (como digitado) e a `finalidade` (`valor`/`meta`, quando informada);
 *   **nunca** envia `"parametros de saida"` nem `"campo da filial"`, `"campo do valor"`, `"campo da meta"` e
 *   `"campo da competencia"`;
 * - com a entrada vazia (ou só espaços, ou ausente) não chama a API e resolve `{ entrada: null }`;
 * - devolve `{ entrada }` (`ResultadoValidacaoIntegracao`): a `saida` da resposta, se vier, é ignorada
 *   (qualquer valor, sem rejeitar a resposta).
 */
describe('F5.18 — Serviço: validarIntegracao({ parametrosEntrada?, finalidade? })', () => {
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
    it('POST /api/ped/integracao/validar com o token e só a entrada, como digitada', async () => {
      const chamadas = simular()

      await validarIntegracao({ parametrosEntrada: ENTRADA })

      expect(chamadas).toHaveLength(1)
      expect(chamadas[0].metodo).toBe('POST')
      expect(chamadas[0].caminho).toBe(ROTA)
      expect(cabecalhoDaChamada(chamadas[0], 'Authorization')).toBe('Bearer token-123')
      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de entrada': ENTRADA })
    })

    it.each<['valor' | 'meta']>([['valor'], ['meta']])('finalidade "%s" vai no corpo, junto com a entrada', async (finalidade) => {
      const chamadas = simular()

      await validarIntegracao({ parametrosEntrada: ENTRADA, finalidade })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de entrada': ENTRADA, finalidade })
    })

    it('sem finalidade o corpo não leva a chave', async () => {
      const chamadas = simular()

      await validarIntegracao({ parametrosEntrada: ENTRADA })

      expect(corpoDaChamada(chamadas[0])).not.toHaveProperty('finalidade')
    })

    it('nunca envia a saída nem o mapeamento, mesmo que venham nos parâmetros (chamador antigo)', async () => {
      const chamadas = simular()
      const antigos = {
        parametrosSaida: SAIDA,
        parametrosEntrada: ENTRADA,
        finalidade: 'valor',
        mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: 'data' },
      } as unknown as ParametrosValidacaoIntegracao

      await validarIntegracao(antigos)

      const corpo = corpoDaChamada(chamadas[0])
      expect(corpo).toStrictEqual({ 'parametros de entrada': ENTRADA, finalidade: 'valor' })
      for (const chave of ['parametros de saida', 'campo da filial', 'campo do valor', 'campo da meta', 'campo da competencia']) {
        expect(corpo).not.toHaveProperty([chave])
      }
    })

    it('com a entrada vazia, só com espaços ou ausente não chama a API e resolve { entrada: null }', async () => {
      const chamadas = simular()

      await expect(validarIntegracao({ parametrosEntrada: '' })).resolves.toStrictEqual({ entrada: null })
      await expect(validarIntegracao({ parametrosEntrada: '   \n ' })).resolves.toStrictEqual({ entrada: null })
      await expect(validarIntegracao({})).resolves.toStrictEqual({ entrada: null })
      expect(chamadas).toHaveLength(0)
    })

    it('só com a saída (chamador antigo) também não chama a API: a saída não vai mais ao servidor', async () => {
      const chamadas = simular()

      await expect(
        validarIntegracao({ parametrosSaida: SAIDA, finalidade: 'valor' } as unknown as ParametrosValidacaoIntegracao),
      ).resolves.toStrictEqual({ entrada: null })
      expect(chamadas).toHaveLength(0)
    })

    it('com a entrada vazia não chama a API, mesmo com finalidade', async () => {
      const chamadas = simular()

      await expect(validarIntegracao({ parametrosEntrada: ' ', finalidade: 'meta' })).resolves.toStrictEqual({ entrada: null })
      expect(chamadas).toHaveLength(0)
    })
  })

  describe('resposta convertida para o domínio ({ entrada })', () => {
    it('entrada válida (exemplo do documento)', async () => {
      simular()

      await expect(validarIntegracao({ parametrosEntrada: ENTRADA })).resolves.toStrictEqual({ entrada: ENTRADA_VALIDA_DOMINIO })
    })

    it.each<[string, unknown]>([
      ['válida', { valido: true, campos: [{ campo: 'codfil', tipo: 'string' }], formato: 'tipos', resumo: '1 campo: codfil (string)' }],
      ['inválida', { valido: false, erro: { mensagem: 'a saida precisa ser uma lista (entre colchetes)' }, erros: ['x'] }],
      ['fora do formato', { valido: 'sim' }],
      ['em texto', 'ok'],
    ])('"saida" %s na resposta é ignorada, sem rejeitar e sem aparecer no resultado', async (_nome, saida) => {
      simular(() => respostaJson({ ...RESPOSTA_VALIDA, saida }))

      await expect(validarIntegracao({ parametrosEntrada: ENTRADA })).resolves.toStrictEqual({ entrada: ENTRADA_VALIDA_DOMINIO })
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

    it('erro da entrada com campo "" (falta "operacao"/"parametros", raiz do JSON): caminho null e entra na lista', async () => {
      simular(() =>
        respostaJson({
          saida: null,
          entrada: {
            valido: false,
            erros: [
              { campo: '', mensagem: 'a entrada SOAP precisa de "operacao" e "parametros" (ou "chamadas")' },
              { campo: '', caminho: '', expressao: 'x', mensagem: 'operacao invalida' },
              { campo: 'parametros.EDatIni', expressao: '5 / 0', mensagem: 'divisao por zero' },
            ],
          },
        }),
      )

      const { entrada } = await validarIntegracao({ parametrosEntrada: '{"filial": "%filial%"}', finalidade: 'valor' })

      expect(entrada).toEqual({
        valido: false,
        erros: [
          {
            campo: 'parametros de entrada',
            caminho: null,
            expressao: null,
            mensagem: 'a entrada SOAP precisa de "operacao" e "parametros" (ou "chamadas")',
            linha: null,
            coluna: null,
          },
          { campo: 'parametros de entrada', caminho: null, expressao: 'x', mensagem: 'operacao invalida', linha: null, coluna: null },
          {
            campo: 'parametros de entrada',
            caminho: 'parametros.EDatIni',
            expressao: '5 / 0',
            mensagem: 'divisao por zero',
            linha: null,
            coluna: null,
          },
        ],
      })
    })

    it('"entrada" null ou ausente → null', async () => {
      simular(() => respostaJson({ saida: null }))

      await expect(validarIntegracao({ parametrosEntrada: ENTRADA })).resolves.toStrictEqual({ entrada: null })
    })
  })

  describe('resposta fora do formato → ApiError(200, "Resposta inválida do servidor.")', () => {
    it.each<[string, unknown]>([
      ['lista', [RESPOSTA_VALIDA]],
      ['texto solto', 'ok'],
      ['entrada em texto', { entrada: 'ok' }],
      ['entrada sem "valido"', { entrada: { erros: [] } }],
      ['entrada válida com "variaveis usadas" que não é lista', { entrada: { ...RESPOSTA_VALIDA.entrada, 'variaveis usadas': 'filial' } }],
      ['entrada válida com cálculo sem expressão', { entrada: { ...RESPOSTA_VALIDA.entrada, calculos: [{ campo: 'inicio', resultado: 'x' }] } }],
      ['entrada inválida sem erros', { entrada: { valido: false } }],
      ['erro da entrada sem mensagem', { entrada: { valido: false, erros: [{ campo: 'inicio', expressao: '5 / 0' }] } }],
    ])('%s', async (_nome, corpo) => {
      simular(() => respostaJson(corpo))

      const erro = await validarIntegracao({ parametrosEntrada: ENTRADA }).catch((e: unknown) => e)

      expect(erro).toBeInstanceOf(ApiError)
      expect(erro).toMatchObject({ status: 200, mensagem: MENSAGEM_RESPOSTA_INVALIDA })
    })
  })

  describe('erros HTTP e de rede são propagados', () => {
    it('403 (perfil que não é Admin) rejeita com a mensagem da API', async () => {
      simular(() => respostaErro(403, 'Acesso negado.'))

      await expect(validarIntegracao({ parametrosEntrada: ENTRADA })).rejects.toMatchObject({ status: 403, mensagem: 'Acesso negado.' })
    })

    it('500 rejeita com a mensagem padrão', async () => {
      simular(() => respostaErro(500))

      await expect(validarIntegracao({ parametrosEntrada: ENTRADA })).rejects.toMatchObject({
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
