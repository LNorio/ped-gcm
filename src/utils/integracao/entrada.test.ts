import { describe, expect, it } from 'vitest'
import { variaveisIntegracao } from '../../test/dadosExternosFalsos'
import type { VariavelIntegracao } from '../../types/dominio'
import { valoresDeExemplo } from './exemplos'
import type { ContextoIntegracao } from './expressoes'
import { validarEntrada } from './entrada'

/** Contexto dos exemplos do documento: período 10/2026, hoje = 15/10/2026, 3 meses retroativos. */
function contexto(variaveis: VariavelIntegracao[] = variaveisIntegracao()): ContextoIntegracao {
  return { variaveis, valores: valoresDeExemplo({ hoje: new Date(2026, 9, 15), mesesRetro: 3, diaColeta: null }) }
}

const EXEMPLO_DOCUMENTO = `{
  "filial": "%filial%",
  "competencia": "%competencia%",
  "inicio": "%dataInicial% - 3m",
  "fim": "%dataFinal%",
  "dias": "%dataFinal% - %dataInicial% + 1"
}`

describe('F5.14 — validarEntrada (JSON de entrada com variáveis e expressões)', () => {
  it.each(['', '   ', '\n'])('texto vazio ("%s") → estado vazio (nada aparece)', (texto) => {
    expect(validarEntrada(texto, contexto())).toEqual({ estado: 'vazio' })
  })

  describe('entrada válida', () => {
    it('exemplo do documento: variáveis usadas, cálculos e prévia do JSON resolvido (2 espaços)', () => {
      const resultado = validarEntrada(EXEMPLO_DOCUMENTO, contexto())

      expect(resultado).toEqual({
        estado: 'valido',
        variaveisUsadas: ['filial', 'competencia', 'dataInicial', 'dataFinal'],
        calculos: [
          { caminho: 'inicio', expressao: '%dataInicial% - 3m', resultado: '01/07/2026' },
          { caminho: 'dias', expressao: '%dataFinal% - %dataInicial% + 1', resultado: '31' },
        ],
        previa: JSON.stringify(
          { filial: '101', competencia: '10/2026', inicio: '01/07/2026', fim: '31/10/2026', dias: '31' },
          null,
          2,
        ),
      })
    })

    it('entrada do contrato da meta (SOAP com %empresas% e as datas): prévia com "1,6,7,8,9" e o período (alteração de 10/11/2026)', () => {
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
      })
    })

    it('"(%mesesRetro% * 30) - 1" com 3 meses retroativos resulta 89 na prévia', () => {
      const resultado = validarEntrada('{"dias": "(%mesesRetro% * 30) - 1"}', contexto())

      expect(resultado).toMatchObject({
        estado: 'valido',
        variaveisUsadas: ['mesesRetro'],
        calculos: [{ caminho: 'dias', expressao: '(%mesesRetro% * 30) - 1', resultado: '89' }],
        previa: JSON.stringify({ dias: '89' }, null, 2),
      })
    })

    it('"31/01/2026 + 1m" resulta 28/02/2026 na prévia', () => {
      const resultado = validarEntrada('{"data": "31/01/2026 + 1m"}', contexto())

      expect(resultado).toMatchObject({
        estado: 'valido',
        variaveisUsadas: [],
        calculos: [{ caminho: 'data', expressao: '31/01/2026 + 1m', resultado: '28/02/2026' }],
        previa: JSON.stringify({ data: '28/02/2026' }, null, 2),
      })
    })

    it('percorre objetos e listas aninhados (caminho "periodo.fim", "lista[0]"); valores não textuais ficam iguais', () => {
      const texto = JSON.stringify({
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
          { caminho: 'periodo.fim', expressao: '%dataFinal% + 1', resultado: '01/11/2026' },
          { caminho: 'lista[0]', expressao: '%mes% * 2', resultado: '20' },
        ],
        previa: JSON.stringify(
          {
            periodo: { inicio: '01/10/2026', fim: '01/11/2026' },
            lista: ['20', 5, true, null],
            fixo: 7.5,
            ativo: false,
            nada: null,
          },
          null,
          2,
        ),
      })
    })

    it('variáveis repetidas aparecem uma vez só, na ordem da primeira ocorrência', () => {
      const resultado = validarEntrada('{"a": "%ano%", "b": "Mês %mes% de %ano%", "c": "%ano% - 1"}', contexto())

      expect(resultado).toMatchObject({ estado: 'valido', variaveisUsadas: ['ano', 'mes'] })
    })

    it('texto com letras só troca as variáveis e não entra nos cálculos', () => {
      const resultado = validarEntrada('{"chave": "Filial-%filial%"}', contexto())

      expect(resultado).toEqual({
        estado: 'valido',
        variaveisUsadas: ['filial'],
        calculos: [],
        previa: JSON.stringify({ chave: 'Filial-101' }, null, 2),
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
      ['lista', '[{"a": "1"}]'],
      ['texto', '"%filial%"'],
      ['número', '1'],
    ])('JSON que não é objeto (%s) → "O JSON de entrada deve ser um objeto"', (_nome, texto) => {
      expect(validarEntrada(texto, contexto())).toEqual({ estado: 'invalido', erros: ['O JSON de entrada deve ser um objeto'] })
    })

    it.each([
      ['%foo%', 'variável desconhecida %foo%'],
      ['%zona% + 1', 'variável de texto %zona% em conta'],
      ['(1 + 2', 'parêntese não fechado'],
      ['3 * * 2', 'operador repetido ou fora de lugar'],
      ['5 / 0', 'divisão por zero'],
      ['%dataInicial% + %dataFinal%', 'soma de duas datas'],
      ['%dataInicial% * 2', 'data não pode ser multiplicada, dividida ou elevada'],
      ['5 - %hoje%', 'data subtraída de um número'],
      ['3m + 1', 'unidade m ou a sem data'],
      ['31/02/2026 + 1', 'data inexistente 31/02/2026'],
    ])('"%s" → Campo "valor": %s em "<expressão>"', (expressao, motivo) => {
      expect(validarEntrada(JSON.stringify({ valor: expressao }), contexto())).toEqual({
        estado: 'invalido',
        erros: [`Campo "valor": ${motivo} em "${expressao}"`],
      })
    })

    it('lista todos os erros (não só o primeiro), com o caminho do campo, na ordem do JSON', () => {
      const texto = JSON.stringify({
        filial: '%filial%',
        a: '%foo%',
        periodo: { fim: '%dataInicial% + %dataFinal%' },
        lista: ['1', '5 / 0'],
        b: '%zona% + 1',
      })

      expect(validarEntrada(texto, contexto())).toEqual({
        estado: 'invalido',
        erros: [
          'Campo "a": variável desconhecida %foo% em "%foo%"',
          'Campo "periodo.fim": soma de duas datas em "%dataInicial% + %dataFinal%"',
          'Campo "lista[1]": divisão por zero em "5 / 0"',
          'Campo "b": variável de texto %zona% em conta em "%zona% + 1"',
        ],
      })
    })

    it('duas variáveis desconhecidas no mesmo campo geram dois erros', () => {
      expect(validarEntrada('{"x": "%foo% + %bar%"}', contexto())).toEqual({
        estado: 'invalido',
        erros: [
          'Campo "x": variável desconhecida %foo% em "%foo% + %bar%"',
          'Campo "x": variável desconhecida %bar% em "%foo% + %bar%"',
        ],
      })
    })

    it('sem variáveis da API (falha ao carregar), toda variável é desconhecida', () => {
      expect(validarEntrada('{"filial": "%filial%", "fim": "%dataFinal%"}', contexto([]))).toEqual({
        estado: 'invalido',
        erros: [
          'Campo "filial": variável desconhecida %filial% em "%filial%"',
          'Campo "fim": variável desconhecida %dataFinal% em "%dataFinal%"',
        ],
      })
    })
  })
})
