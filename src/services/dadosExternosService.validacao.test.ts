import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cabecalhoDaChamada, corpoDaChamada, respostaErro, respostaJson, simularApi } from '../test/apiFalsa'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, MENSAGEM_SEM_CONEXAO, mensagemPadraoPorStatus } from './api'
import { validarIntegracao } from './dadosExternosService'
import { definirToken, limparToken } from './sessao'

const ROTA = '/api/ped/integracao/validar'
const SAIDA = '{ "codemp": "string", "codfil": "string", "vlrLiq": "number" }'
const ENTRADA = '{ "operacao": "Consulta", "parametros": { "ECodEmp": "%empresas%", "EDatIni": "%dataInicial% - 3m" } }'

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
 * Desde 11/11/2026 a saída é "chave: tipo" e o mapeamento também vai no corpo (bloco próprio abaixo).
 * Corpo: `"parametros de saida"` e/ou `"parametros de entrada"` (só os não vazios). Resposta convertida
 * para o domínio (`ResultadoValidacaoIntegracao`): `saida`/`entrada` `null` quando não enviados.
 */
describe('F5.18 — Serviço: validarIntegracao({ parametrosSaida?, parametrosEntrada?, finalidade?, mapeamento? })', () => {
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
          formato: null,
          resumo: null,
          mapeamento: null,
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
        formato: null,
        resumo: null,
        mapeamento: null,
      })
    })

    it('saída inválida: { valido: false, erro: { mensagem, linha, coluna } }', async () => {
      simular(() =>
        respostaJson({ saida: { valido: false, erro: { mensagem: "virgula sobrando antes de '}'", linha: 1, coluna: 12 } }, entrada: null }),
      )

      await expect(validarIntegracao({ parametrosSaida: '{"a": 1,}' })).resolves.toEqual({
        saida: { valido: false, erro: { mensagem: "virgula sobrando antes de '}'", linha: 1, coluna: 12 }, erros: [] },
        entrada: null,
      })
    })

    it('saída inválida sem linha e coluna: linha e coluna null', async () => {
      simular(() => respostaJson({ saida: { valido: false, erro: { mensagem: 'o JSON deve ser objeto ou lista' } } }))

      const { saida } = await validarIntegracao({ parametrosSaida: '1' })

      expect(saida).toEqual({ valido: false, erro: { mensagem: 'o JSON deve ser objeto ou lista', linha: null, coluna: null }, erros: [] })
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

  /**
   * Alteração de 11/11/2026 (`FRONT-meta-via-api-fase1.md`, item 2.2, e `API (27).md`):
   * - `finalidade` (opcional): `"valor"` na modal do dado externo e `"meta"` na do indicador; enviada só
   *   quando informada (sem ela o back-end aceita `valor` ou `meta`);
   * - saída que não é lista (erro não sintático): `{ valido: false, erro: { mensagem, linha: null,
   *   coluna: null }, erros: [...] }` → no domínio, o inválido ganha `erros: ErroIntegracao[]` (campo
   *   `"parametros de saida"`; `erros` ausente ou fora do formato → `[]`; item sem `mensagem` em texto é
   *   ignorado; `caminho` ausente ou vazio → `null`);
   * - erro da entrada SOAP sem `operacao`/`parametros` vem com `campo: ""` (raiz do JSON) → `caminho: null`.
   */
  describe('finalidade, saída em lista e erros da entrada SOAP (11/11/2026)', () => {
    it.each<['valor' | 'meta']>([['valor'], ['meta']])('finalidade "%s" vai no corpo, junto com os textos', async (finalidade) => {
      const chamadas = simular()

      await validarIntegracao({ parametrosSaida: SAIDA, parametrosEntrada: ENTRADA, finalidade })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({
        'parametros de saida': SAIDA,
        'parametros de entrada': ENTRADA,
        finalidade,
      })
    })

    it('finalidade com só a entrada preenchida também vai no corpo', async () => {
      const chamadas = simular(() => respostaJson({ saida: null, entrada: RESPOSTA_VALIDA.entrada }))

      await validarIntegracao({ parametrosEntrada: ENTRADA, finalidade: 'meta' })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de entrada': ENTRADA, finalidade: 'meta' })
    })

    it('sem finalidade o corpo não leva a chave', async () => {
      const chamadas = simular()

      await validarIntegracao({ parametrosSaida: SAIDA })

      expect(corpoDaChamada(chamadas[0])).not.toHaveProperty('finalidade')
    })

    it('com os dois JSONs vazios não chama a API, mesmo com finalidade', async () => {
      const chamadas = simular()

      await expect(validarIntegracao({ parametrosSaida: ' ', finalidade: 'valor' })).resolves.toEqual({ saida: null, entrada: null })
      expect(chamadas).toHaveLength(0)
    })

    it('saída inválida sem posição (ex.: formato da lista de 10/11/2026): linha e coluna null e a lista "erros" de objetos convertida', async () => {
      simular(() =>
        respostaJson({
          saida: {
            valido: false,
            erro: { mensagem: 'a saida deve ser uma lista com todas as filiais', linha: null, coluna: null },
            erros: [
              { campo: 'parametros de saida', mensagem: 'a saida deve ser uma lista com todas as filiais' },
              { campo: 'parametros de saida', caminho: '[0]', mensagem: 'item 1 sem filial' },
              { campo: 'parametros de saida', caminho: '', mensagem: 'item 2 sem valor' },
            ],
          },
          entrada: null,
        }),
      )

      const { saida } = await validarIntegracao({ parametrosSaida: '{"filial": "101", "valor": 1}', finalidade: 'valor' })

      expect(saida).toEqual({
        valido: false,
        erro: { mensagem: 'a saida deve ser uma lista com todas as filiais', linha: null, coluna: null },
        erros: [
          {
            campo: 'parametros de saida',
            caminho: null,
            expressao: null,
            mensagem: 'a saida deve ser uma lista com todas as filiais',
            linha: null,
            coluna: null,
          },
          { campo: 'parametros de saida', caminho: '[0]', expressao: null, mensagem: 'item 1 sem filial', linha: null, coluna: null },
          { campo: 'parametros de saida', caminho: null, expressao: null, mensagem: 'item 2 sem valor', linha: null, coluna: null },
        ],
      })
    })

    it.each<[string, unknown]>([
      ['ausente', undefined],
      ['null', null],
      ['texto', 'erro'],
      ['objeto', { mensagem: 'x' }],
    ])('"erros" da saída %s → []', async (_nome, erros) => {
      simular(() => respostaJson({ saida: { valido: false, erro: { mensagem: 'saida invalida', linha: null, coluna: null }, erros } }))

      const { saida } = await validarIntegracao({ parametrosSaida: SAIDA })

      expect(saida).toEqual({ valido: false, erro: { mensagem: 'saida invalida', linha: null, coluna: null }, erros: [] })
    })

    it('item de "erros" da saída sem mensagem em texto (ou texto vazio) é ignorado, sem rejeitar a resposta', async () => {
      simular(() =>
        respostaJson({
          saida: {
            valido: false,
            erro: { mensagem: 'saida invalida', linha: null, coluna: null },
            erros: [{ campo: 'parametros de saida' }, '', '  ', 7, null, { mensagem: 10 }, { mensagem: 'item 1 sem filial' }],
          },
        }),
      )

      const { saida } = await validarIntegracao({ parametrosSaida: SAIDA })

      expect(saida).toEqual({
        valido: false,
        erro: { mensagem: 'saida invalida', linha: null, coluna: null },
        erros: [{ campo: 'parametros de saida', caminho: null, expressao: null, mensagem: 'item 1 sem filial', linha: null, coluna: null }],
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
  })

  /**
   * Alteração de 11/11/2026 (saída por "chave: tipo", opção B — `FRONT-saida-chave-tipo.md`, seção 4):
   * - requisição: `mapeamento` (`MapeamentoSaida`) vai com as chaves do back-end — `"campo da filial"`,
   *   `"campo do valor"` (de `campoValor`), `"campo da meta"` (de `campoMeta`) e `"campo da competencia"` —,
   *   só as preenchidas (vazio, só espaços, `null` ou ausente não vão) e só junto com a saída (sem
   *   `"parametros de saida"` no corpo, o mapeamento não é enviado);
   * - resposta válida na saída por tipos: `formato` (`"tipos"`), `resumo` (texto) e `mapeamento`
   *   (`{ "campo da filial", "campo do valor"/"campo da meta", "campo da competencia"? }`) → no domínio
   *   `formato`, `resumo` e `mapeamento` (`MapeamentoSaida`); ausentes ou fora do formato → `null` (não
   *   rejeitam a resposta). No formato antigo (lista) o back-end responde sem `formato` → `null`;
   * - resposta inválida: `erros` pode vir como **lista de textos** (`["...", "..."]`); cada texto não vazio
   *   vira um `ErroIntegracao` do campo `"parametros de saida"` (sem linha, coluna, caminho nem expressão).
   */
  describe('saída por "chave: tipo" (11/11/2026)', () => {
    const RESPOSTA_TIPOS = {
      saida: {
        valido: true,
        formato: 'tipos',
        campos: [
          { campo: 'codemp', tipo: 'string' },
          { campo: 'codfil', tipo: 'string' },
          { campo: 'vlrLiq', tipo: 'number' },
        ],
        resumo: '3 campos: codemp (string), codfil (string), vlrLiq (number)',
        mapeamento: { 'campo da filial': 'codfil', 'campo do valor': 'vlrLiq' },
      },
    }

    it('envia o mapeamento com as chaves do back-end, junto com a saída e a finalidade', async () => {
      const chamadas = simular(() => respostaJson(RESPOSTA_TIPOS))

      await validarIntegracao({
        parametrosSaida: SAIDA,
        parametrosEntrada: ENTRADA,
        finalidade: 'valor',
        mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: 'data' },
      })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({
        'parametros de saida': SAIDA,
        'parametros de entrada': ENTRADA,
        finalidade: 'valor',
        'campo da filial': 'codfil',
        'campo do valor': 'vlrLiq',
        'campo da competencia': 'data',
      })
    })

    it('indicador: campoMeta vai como "campo da meta"', async () => {
      const chamadas = simular(() => respostaJson(RESPOSTA_TIPOS))

      await validarIntegracao({
        parametrosSaida: SAIDA,
        finalidade: 'meta',
        mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: null },
      })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({
        'parametros de saida': SAIDA,
        finalidade: 'meta',
        'campo da filial': 'codfil',
        'campo da meta': 'metVlr',
      })
    })

    it('campos do mapeamento vazios, só com espaços ou null não vão no corpo', async () => {
      const chamadas = simular(() => respostaJson(RESPOSTA_TIPOS))

      await validarIntegracao({ parametrosSaida: SAIDA, mapeamento: { campoFilial: '', campoValor: '  ', campoCompetencia: null } })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de saida': SAIDA })
    })

    it('só com a entrada, o mapeamento não é enviado', async () => {
      const chamadas = simular(() => respostaJson({ saida: null, entrada: RESPOSTA_VALIDA.entrada }))

      await validarIntegracao({ parametrosEntrada: ENTRADA, mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null } })

      expect(corpoDaChamada(chamadas[0])).toStrictEqual({ 'parametros de entrada': ENTRADA })
    })

    it('com os dois JSONs vazios não chama a API, mesmo com o mapeamento', async () => {
      const chamadas = simular()

      await expect(
        validarIntegracao({ parametrosSaida: '', mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null } }),
      ).resolves.toEqual({ saida: null, entrada: null })
      expect(chamadas).toHaveLength(0)
    })

    it('resposta válida por tipos (exemplo do documento): campos, formato, resumo e mapeamento', async () => {
      simular(() => respostaJson(RESPOSTA_TIPOS))

      const { saida } = await validarIntegracao({ parametrosSaida: SAIDA, finalidade: 'valor' })

      expect(saida).toEqual({
        valido: true,
        campos: [
          { nome: 'codemp', tipo: 'string' },
          { nome: 'codfil', tipo: 'string' },
          { nome: 'vlrLiq', tipo: 'number' },
        ],
        formato: 'tipos',
        resumo: '3 campos: codemp (string), codfil (string), vlrLiq (number)',
        mapeamento: { campoFilial: 'codfil', campoValor: 'vlrLiq', campoCompetencia: null },
      })
    })

    it('mapeamento da resposta com "campo da meta" e "campo da competencia"', async () => {
      simular(() =>
        respostaJson({
          saida: {
            ...RESPOSTA_TIPOS.saida,
            mapeamento: { 'campo da filial': 'codfil', 'campo da meta': 'metVlr', 'campo da competencia': 'data' },
          },
        }),
      )

      const { saida } = await validarIntegracao({ parametrosSaida: SAIDA, finalidade: 'meta' })

      expect(saida).toMatchObject({ mapeamento: { campoFilial: 'codfil', campoMeta: 'metVlr', campoCompetencia: 'data' } })
    })

    it.each<[string, Record<string, unknown>]>([
      ['formato que não é texto', { formato: 1 }],
      ['resumo que não é texto', { resumo: ['3 campos'] }],
      ['mapeamento em texto', { mapeamento: 'codfil' }],
      ['mapeamento sem "campo da filial"', { mapeamento: { 'campo do valor': 'vlrLiq' } }],
    ])('%s → null no campo, sem rejeitar a resposta', async (_nome, extra) => {
      simular(() => respostaJson({ saida: { ...RESPOSTA_TIPOS.saida, ...extra } }))

      const { saida } = await validarIntegracao({ parametrosSaida: SAIDA })

      const [chave] = Object.keys(extra)
      expect(saida).toMatchObject({ valido: true, [chave]: null })
    })

    it('"erros" da saída como lista de textos (exemplo do documento) → ErroIntegracao do campo "parametros de saida"', async () => {
      const tipo = 'o campo "vlrLiq" da saida tem tipo "texto"; use string, number, date ou boolean'
      const filial = 'informe o "campo da filial" (o nome do campo da saida que traz o codigo da filial)'
      simular(() =>
        respostaJson({ saida: { valido: false, erro: { mensagem: tipo, linha: null, coluna: null }, erros: [tipo, filial] } }),
      )

      const { saida } = await validarIntegracao({ parametrosSaida: '{"vlrLiq": "texto"}', finalidade: 'valor' })

      expect(saida).toEqual({
        valido: false,
        erro: { mensagem: tipo, linha: null, coluna: null },
        erros: [
          { campo: 'parametros de saida', caminho: null, expressao: null, mensagem: tipo, linha: null, coluna: null },
          { campo: 'parametros de saida', caminho: null, expressao: null, mensagem: filial, linha: null, coluna: null },
        ],
      })
    })

    it('textos e objetos misturados em "erros" são aceitos, na ordem', async () => {
      simular(() =>
        respostaJson({
          saida: {
            valido: false,
            erro: { mensagem: 'saida invalida', linha: null, coluna: null },
            erros: ['primeiro', { campo: 'parametros de saida', mensagem: 'segundo' }],
          },
        }),
      )

      const { saida } = await validarIntegracao({ parametrosSaida: SAIDA })

      expect(saida).toMatchObject({ erros: [{ mensagem: 'primeiro' }, { mensagem: 'segundo' }] })
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
