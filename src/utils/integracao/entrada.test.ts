import { describe, expect, it } from 'vitest'
import { variaveisIntegracao } from '../../test/dadosExternosFalsos'
import type { VariavelIntegracao } from '../../types/dominio'
import { valoresDeExemplo } from './exemplos'
import type { ContextoIntegracao } from './expressoes'
import { avisosDaEntrada, validarEntrada } from './entrada'

/** Contexto dos exemplos do documento: período 10/2026, hoje = 15/10/2026, 3 meses retroativos. */
function contexto(variaveis: VariavelIntegracao[] = variaveisIntegracao()): ContextoIntegracao {
  return { variaveis, valores: valoresDeExemplo({ hoje: new Date(2026, 9, 15), mesesRetro: 3, diaColeta: null }) }
}

/** Entrada SOAP `{ operacao, parametros }` com os parâmetros informados (alteração de 11/11/2026). */
function soap(parametros: Record<string, unknown>, operacao = 'Consulta'): string {
  return JSON.stringify({ operacao, parametros })
}

/** Mensagem de entrada sem `operacao` ou sem `parametros`/`chamadas`. */
const SEM_FORMATO_SOAP = 'A entrada deve ter "operacao" e "parametros" (ou "chamadas")'
const AVISO_FILIAL = '%filial% não tem valor numa consulta que traz todas as filiais; use %empresas%.'
const AVISO_COLABORADOR = '%colaborador% não tem valor numa consulta que traz todas as filiais; use %empresas%.'
const AVISO_ZONA = '%zona% não tem valor numa consulta que traz todas as filiais; use %empresas%.'

/** Exemplo do contrato SOAP (fase 2, seção 2.1), com uma conta de datas e uma de dias. */
const EXEMPLO_DOCUMENTO = `{
  "operacao": "VolVenConsolidado",
  "parametros": {
    "ECodEmp": "%empresas%",
    "ECompet": "%competencia%",
    "EDatIni": "%dataInicial% - 3m",
    "EDatFim": "%dataFinal%",
    "EDias": "%dataFinal% - %dataInicial% + 1"
  }
}`

/**
 * Alteração de 11/11/2026 (executor das integrações — `docs/backend/FRONT-meta-via-api-fase2.md`, seção
 * 2.1, e `API (27).md`, "Executor das integrações"): a entrada SOAP precisa ser
 * `{ "operacao": "...", "parametros": { ... } }` ou `{ "operacao": "...", "chamadas": [ { "parametros":
 * { ... } }, ... ] }`; `operacao` só com letras (sem acento), números e `_`. O front não tem seletor de
 * `tipo de servico` e trata a entrada sempre como SOAP (padrão do back-end). Os erros de formato vêm
 * antes dos erros das expressões (que continuam todos listados, com o caminho completo, ex.:
 * `parametros.EDatIni`, `chamadas[0].parametros.EDatIni`).
 *
 * Aviso (seção 2.3): numa chamada que traz todas as filiais, `%filial%`, `%colaborador%` e `%zona%` não
 * têm valor. A entrada válida que usa alguma delas traz um aviso por variável em `avisos` (não bloqueia).
 */
describe('F5.14 — validarEntrada (JSON de entrada SOAP com variáveis e expressões)', () => {
  it.each(['', '   ', '\n'])('texto vazio ("%s") → estado vazio (nada aparece)', (texto) => {
    expect(validarEntrada(texto, contexto())).toEqual({ estado: 'vazio' })
  })

  describe('entrada válida', () => {
    it('exemplo do documento: variáveis usadas, cálculos com o caminho completo e prévia do JSON resolvido (2 espaços)', () => {
      const resultado = validarEntrada(EXEMPLO_DOCUMENTO, contexto())

      expect(resultado).toEqual({
        estado: 'valido',
        variaveisUsadas: ['empresas', 'competencia', 'dataInicial', 'dataFinal'],
        calculos: [
          { caminho: 'parametros.EDatIni', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' },
          { caminho: 'parametros.EDias', expressao: '%dataFinal% - %dataInicial% + 1', resultado: '31' },
        ],
        previa: JSON.stringify(
          {
            operacao: 'VolVenConsolidado',
            parametros: { ECodEmp: '1,6,7,8,9', ECompet: '10/2026', EDatIni: '01/07/2026', EDatFim: '31/10/2026', EDias: '31' },
          },
          null,
          2,
        ),
        avisos: [],
      })
    })

    it('entrada do contrato da meta (SOAP com %empresas% e as datas): prévia com "1,6,7,8,9" e o período', () => {
      const texto = JSON.stringify({
        operacao: 'Metas',
        parametros: { ECodEmp: '%empresas%', EDatIni: '%dataInicial%', EDatFim: '%dataFinal%' },
      })

      expect(validarEntrada(texto, contexto())).toEqual({
        estado: 'valido',
        variaveisUsadas: ['empresas', 'dataInicial', 'dataFinal'],
        calculos: [],
        previa: JSON.stringify(
          { operacao: 'Metas', parametros: { ECodEmp: '1,6,7,8,9', EDatIni: '01/10/2026', EDatFim: '31/10/2026' } },
          null,
          2,
        ),
        avisos: [],
      })
    })

    it('várias chamadas da mesma operação ("chamadas"): cada chamada é resolvida, com o caminho "chamadas[i].parametros.x"', () => {
      const texto = JSON.stringify({
        operacao: 'VolVenConsolidado',
        chamadas: [{ parametros: { EDatIni: '%dataInicial%' } }, { parametros: { EDatIni: '%dataInicial% - 1m' } }],
      })

      expect(validarEntrada(texto, contexto())).toEqual({
        estado: 'valido',
        variaveisUsadas: ['dataInicial'],
        calculos: [{ caminho: 'chamadas[1].parametros.EDatIni', expressao: '%dataInicial% - 1m', resultado: '01/09/2026' }],
        previa: JSON.stringify(
          {
            operacao: 'VolVenConsolidado',
            chamadas: [{ parametros: { EDatIni: '01/10/2026' } }, { parametros: { EDatIni: '01/09/2026' } }],
          },
          null,
          2,
        ),
        avisos: [],
      })
    })

    it.each([
      ['letras', 'Consulta'],
      ['letras, números e _', 'Vol_Ven_2'],
      ['só _ e números', '_1'],
    ])('"operacao" com %s ("%s") é aceita', (_nome, operacao) => {
      expect(validarEntrada(soap({ a: '1' }, operacao), contexto())).toMatchObject({ estado: 'valido' })
    })

    it('"parametros" vazio ({}) é aceito', () => {
      expect(validarEntrada(soap({}), contexto())).toEqual({
        estado: 'valido',
        variaveisUsadas: [],
        calculos: [],
        previa: JSON.stringify({ operacao: 'Consulta', parametros: {} }, null, 2),
        avisos: [],
      })
    })

    it('campos extras na raiz (além de operacao e parametros) são aceitos e resolvidos', () => {
      const texto = JSON.stringify({ operacao: 'Consulta', parametros: { a: '1' }, versao: '%ano%' })

      expect(validarEntrada(texto, contexto())).toMatchObject({
        estado: 'valido',
        variaveisUsadas: ['ano'],
        previa: JSON.stringify({ operacao: 'Consulta', parametros: { a: '1' }, versao: '2026' }, null, 2),
      })
    })

    it('"(%mesesRetro% * 30) - 1" com 3 meses retroativos resulta 89 na prévia', () => {
      const resultado = validarEntrada(soap({ dias: '(%mesesRetro% * 30) - 1' }), contexto())

      expect(resultado).toMatchObject({
        estado: 'valido',
        variaveisUsadas: ['mesesRetro'],
        calculos: [{ caminho: 'parametros.dias', expressao: '(%mesesRetro% * 30) - 1', resultado: '89' }],
        previa: JSON.stringify({ operacao: 'Consulta', parametros: { dias: '89' } }, null, 2),
      })
    })

    it('"31/01/2026 + 1m" resulta 28/02/2026 na prévia', () => {
      const resultado = validarEntrada(soap({ data: '31/01/2026 + 1m' }), contexto())

      expect(resultado).toMatchObject({
        estado: 'valido',
        variaveisUsadas: [],
        calculos: [{ caminho: 'parametros.data', expressao: '31/01/2026 + 1m', resultado: '28/02/2026' }],
        previa: JSON.stringify({ operacao: 'Consulta', parametros: { data: '28/02/2026' } }, null, 2),
      })
    })

    it('percorre objetos e listas aninhados (caminho "parametros.periodo.fim", "parametros.lista[0]"); valores não textuais ficam iguais', () => {
      const texto = soap({
        periodo: { inicio: '%dataInicial%', fim: '%dataFinal% + 1' },
        lista: ['%mes% * 2', 5, true, null],
        fixo: 7.5,
        ativo: false,
        nada: null,
      })

      const resultado = validarEntrada(texto, contexto())

      expect(resultado).toEqual({
        estado: 'valido',
        variaveisUsadas: ['dataInicial', 'dataFinal', 'mes'],
        calculos: [
          { caminho: 'parametros.periodo.fim', expressao: '%dataFinal% + 1', resultado: '01/11/2026' },
          { caminho: 'parametros.lista[0]', expressao: '%mes% * 2', resultado: '20' },
        ],
        previa: JSON.stringify(
          {
            operacao: 'Consulta',
            parametros: {
              periodo: { inicio: '01/10/2026', fim: '01/11/2026' },
              lista: ['20', 5, true, null],
              fixo: 7.5,
              ativo: false,
              nada: null,
            },
          },
          null,
          2,
        ),
        avisos: [],
      })
    })

    it('variáveis repetidas aparecem uma vez só, na ordem da primeira ocorrência', () => {
      const resultado = validarEntrada(soap({ a: '%ano%', b: 'Mês %mes% de %ano%', c: '%ano% - 1' }), contexto())

      expect(resultado).toMatchObject({ estado: 'valido', variaveisUsadas: ['ano', 'mes'] })
    })

    it('texto com letras só troca as variáveis e não entra nos cálculos', () => {
      const resultado = validarEntrada(soap({ chave: 'Empresas-%empresas%' }), contexto())

      expect(resultado).toEqual({
        estado: 'valido',
        variaveisUsadas: ['empresas'],
        calculos: [],
        previa: JSON.stringify({ operacao: 'Consulta', parametros: { chave: 'Empresas-1,6,7,8,9' } }, null, 2),
        avisos: [],
      })
    })
  })

  describe('aviso: %filial%, %colaborador% e %zona% não têm valor numa consulta que traz todas as filiais (não bloqueia)', () => {
    it('entrada válida com %filial% continua válida e traz o aviso para usar %empresas%', () => {
      expect(validarEntrada(soap({ ECodFil: '%filial%' }), contexto())).toEqual({
        estado: 'valido',
        variaveisUsadas: ['filial'],
        calculos: [],
        previa: JSON.stringify({ operacao: 'Consulta', parametros: { ECodFil: '101' } }, null, 2),
        avisos: [AVISO_FILIAL],
      })
    })

    it('um aviso por variável sem valor, na ordem das variáveis usadas, sem repetir', () => {
      const texto = soap({ z: '%zona%', f: 'Filial-%filial%', c: '%colaborador%', f2: '%filial%' })

      expect(validarEntrada(texto, contexto())).toMatchObject({
        estado: 'valido',
        avisos: [AVISO_ZONA, AVISO_FILIAL, AVISO_COLABORADOR],
      })
    })

    it('sem essas variáveis, avisos fica vazio', () => {
      expect(validarEntrada(soap({ e: '%empresas%', m: '%mes%' }), contexto())).toMatchObject({ estado: 'valido', avisos: [] })
    })

    it('entrada inválida não traz avisos (só os erros)', () => {
      const resultado = validarEntrada(soap({ f: '%filial%', x: '%foo%' }), contexto())

      expect(resultado).toEqual({ estado: 'invalido', erros: ['Campo "parametros.x": variável desconhecida %foo% em "%foo%"'] })
    })

    it('avisosDaEntrada(variaveisUsadas) gera os mesmos avisos a partir dos nomes (sem %), usado com o resultado do back-end', () => {
      expect(avisosDaEntrada(['empresas', 'filial', 'mes', 'zona'])).toEqual([AVISO_FILIAL, AVISO_ZONA])
      expect(avisosDaEntrada(['colaborador'])).toEqual([AVISO_COLABORADOR])
      expect(avisosDaEntrada([])).toEqual([])
      expect(avisosDaEntrada(['dataInicial', 'empresas'])).toEqual([])
    })
  })

  describe('formato SOAP: "operacao" e "parametros" (ou "chamadas")', () => {
    it.each([
      ['formato antigo, sem operacao nem parametros', '{"filial": "%filial%", "competencia": "%competencia%"}'],
      ['objeto vazio', '{}'],
      ['só "parametros"', '{"parametros": {"a": "1"}}'],
      ['só "operacao"', '{"operacao": "Consulta"}'],
      ['"chamadas" sem "operacao"', '{"chamadas": [{"parametros": {}}]}'],
    ])('%s → "A entrada deve ter "operacao" e "parametros" (ou "chamadas")"', (_nome, texto) => {
      expect(validarEntrada(texto, contexto())).toEqual({ estado: 'invalido', erros: [SEM_FORMATO_SOAP] })
    })

    it.each(['', '   '])('"operacao" vazia ("%s") → "\\"operacao\\" não pode ficar vazia"', (operacao) => {
      expect(validarEntrada(soap({}, operacao), contexto())).toEqual({
        estado: 'invalido',
        erros: ['"operacao" não pode ficar vazia'],
      })
    })

    it.each([
      ['espaço', 'Vol Ven'],
      ['hífen', 'Vol-Ven'],
      ['ponto', 'Vol.Ven'],
      ['acento', 'Operação'],
      ['variável', '%mes%'],
      ['espaço nas pontas', ' Consulta '],
    ])('"operacao" com %s ("%s") → "\\"operacao\\" só aceita letras, números e _"', (_nome, operacao) => {
      expect(validarEntrada(soap({}, operacao), contexto())).toEqual({
        estado: 'invalido',
        erros: ['"operacao" só aceita letras, números e _'],
      })
    })

    it.each([
      ['número', 10],
      ['nulo', null],
      ['objeto', { nome: 'Consulta' }],
      ['booleano', true],
    ])('"operacao" que não é texto (%s) → "\\"operacao\\" deve ser um texto"', (_nome, operacao) => {
      expect(validarEntrada(JSON.stringify({ operacao, parametros: {} }), contexto())).toEqual({
        estado: 'invalido',
        erros: ['"operacao" deve ser um texto'],
      })
    })

    it.each([
      ['lista', []],
      ['texto', 'EDatIni=%dataInicial%'],
      ['nulo', null],
      ['número', 1],
    ])('"parametros" que não é objeto (%s) → "\\"parametros\\" deve ser um objeto"', (_nome, parametros) => {
      expect(validarEntrada(JSON.stringify({ operacao: 'Consulta', parametros }), contexto())).toEqual({
        estado: 'invalido',
        erros: ['"parametros" deve ser um objeto'],
      })
    })

    it.each([
      ['objeto', {}],
      ['texto', 'x'],
      ['nulo', null],
    ])('"chamadas" que não é lista (%s) → "\\"chamadas\\" deve ser uma lista"', (_nome, chamadas) => {
      expect(validarEntrada(JSON.stringify({ operacao: 'Consulta', chamadas }), contexto())).toEqual({
        estado: 'invalido',
        erros: ['"chamadas" deve ser uma lista'],
      })
    })

    it('"chamadas" vazia → "\\"chamadas\\" não pode ficar vazia"', () => {
      expect(validarEntrada('{"operacao": "Consulta", "chamadas": []}', contexto())).toEqual({
        estado: 'invalido',
        erros: ['"chamadas" não pode ficar vazia'],
      })
    })

    it('cada chamada precisa ser um objeto com "parametros" objeto: um erro por chamada, numerada a partir de 1', () => {
      const texto = JSON.stringify({
        operacao: 'Consulta',
        chamadas: [{ parametros: { a: '1' } }, {}, 3, { parametros: 'x' }, { parametros: { b: '2' } }],
      })

      expect(validarEntrada(texto, contexto())).toEqual({
        estado: 'invalido',
        erros: ['Chamada 2: falta "parametros"', 'Chamada 3: deve ser um objeto', 'Chamada 4: "parametros" deve ser um objeto'],
      })
    })

    it('os erros de formato vêm antes dos erros das expressões, e todos aparecem', () => {
      const texto = JSON.stringify({ operacao: 'Vol Ven', parametros: { a: '5 / 0', b: '%foo%' } })

      expect(validarEntrada(texto, contexto())).toEqual({
        estado: 'invalido',
        erros: [
          '"operacao" só aceita letras, números e _',
          'Campo "parametros.a": divisão por zero em "5 / 0"',
          'Campo "parametros.b": variável desconhecida %foo% em "%foo%"',
        ],
      })
    })

    it('sem operacao, as expressões continuam sendo verificadas (formato antigo com erro de conta)', () => {
      expect(validarEntrada('{"inicio": "%dataInicial% + %dataFinal%"}', contexto())).toEqual({
        estado: 'invalido',
        erros: [SEM_FORMATO_SOAP, 'Campo "inicio": soma de duas datas em "%dataInicial% + %dataFinal%"'],
      })
    })
  })

  describe('entrada inválida', () => {
    it('JSON mal formado → erro com linha, coluna e explicação', () => {
      expect(validarEntrada('{"a": "1",}', contexto())).toEqual({
        estado: 'invalido',
        erros: ['Linha 1, coluna 10: vírgula sobrando'],
      })
    })

    it('aspas faltando', () => {
      expect(validarEntrada('{\n  "a": "%filial%,\n  "b": "1"\n}', contexto())).toEqual({
        estado: 'invalido',
        erros: ['Linha 2, coluna 8: texto sem aspas de fechamento'],
      })
    })

    it.each([
      ['lista', '[{"operacao": "Consulta", "parametros": {}}]'],
      ['texto', '"%filial%"'],
      ['número', '1'],
    ])('JSON que não é objeto (%s) → "O JSON de entrada deve ser um objeto"', (_nome, texto) => {
      expect(validarEntrada(texto, contexto())).toEqual({ estado: 'invalido', erros: ['O JSON de entrada deve ser um objeto'] })
    })

    it.each([
      ['%foo%', 'variável desconhecida %foo%'],
      ['%zona% + 1', 'variável de texto %zona% em conta'],
      ['%empresas% + 1', 'variável de texto %empresas% em conta'],
      ['(1 + 2', 'parêntese não fechado'],
      ['3 * * 2', 'operador repetido ou fora de lugar'],
      ['5 / 0', 'divisão por zero'],
      ['%dataInicial% + %dataFinal%', 'soma de duas datas'],
      ['%dataInicial% * 2', 'data não pode ser multiplicada, dividida ou elevada'],
      ['5 - %hoje%', 'data subtraída de um número'],
      ['3m + 1', 'unidade m ou a sem data'],
      ['31/02/2026 + 1', 'data inexistente 31/02/2026'],
    ])('"%s" → Campo "parametros.valor": %s em "<expressão>"', (expressao, motivo) => {
      expect(validarEntrada(soap({ valor: expressao }), contexto())).toEqual({
        estado: 'invalido',
        erros: [`Campo "parametros.valor": ${motivo} em "${expressao}"`],
      })
    })

    it('lista todos os erros (não só o primeiro), com o caminho do campo, na ordem do JSON', () => {
      const texto = soap({
        ECodEmp: '%empresas%',
        a: '%foo%',
        periodo: { fim: '%dataInicial% + %dataFinal%' },
        lista: ['1', '5 / 0'],
        b: '%zona% + 1',
      })

      expect(validarEntrada(texto, contexto())).toEqual({
        estado: 'invalido',
        erros: [
          'Campo "parametros.a": variável desconhecida %foo% em "%foo%"',
          'Campo "parametros.periodo.fim": soma de duas datas em "%dataInicial% + %dataFinal%"',
          'Campo "parametros.lista[1]": divisão por zero em "5 / 0"',
          'Campo "parametros.b": variável de texto %zona% em conta em "%zona% + 1"',
        ],
      })
    })

    it('duas variáveis desconhecidas no mesmo campo geram dois erros', () => {
      expect(validarEntrada(soap({ x: '%foo% + %bar%' }), contexto())).toEqual({
        estado: 'invalido',
        erros: [
          'Campo "parametros.x": variável desconhecida %foo% em "%foo% + %bar%"',
          'Campo "parametros.x": variável desconhecida %bar% em "%foo% + %bar%"',
        ],
      })
    })

    it('sem variáveis da API (falha ao carregar), toda variável é desconhecida', () => {
      expect(validarEntrada(soap({ ECodEmp: '%empresas%', EDatFim: '%dataFinal%' }), contexto([]))).toEqual({
        estado: 'invalido',
        erros: [
          'Campo "parametros.ECodEmp": variável desconhecida %empresas% em "%empresas%"',
          'Campo "parametros.EDatFim": variável desconhecida %dataFinal% em "%dataFinal%"',
        ],
      })
    })
  })
})
