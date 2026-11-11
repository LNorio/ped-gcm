import { describe, expect, it } from 'vitest'
import { validarSaida } from './saida'

/**
 * Parâmetros de saída (F5.14).
 *
 * Alteração de 11/11/2026 (saída por "chave: tipo", opção B — `docs/propostas-backend/FRONT-saida-chave-tipo.md`):
 * a saída **descreve a estrutura de um item** da resposta, como um **objeto** `{ "campo": "tipo" }`, com o
 * tipo entre aspas: `string`, `number`, `date` ou `boolean` (exatamente assim, em minúsculas). A resposta
 * real continua sendo uma lista com todas as filiais; o objeto só declara os campos de cada item.
 *
 * `validarSaida(texto, campoValor)` (`campoValor`: `'valor'` no dado externo, `'meta'` no indicador; a
 * regra da saída é a mesma nos dois — quem aponta a filial e o valor/meta é o mapeamento, ver
 * `mapeamento.test.ts`):
 * - vazio → `{ estado: 'vazio' }`;
 * - válido → `campos` (`{ nome, tipo }`, na ordem do objeto) e `resumo` `"N campos: a (string), b (number)"`
 *   (singular `"1 campo: ..."`), o mesmo texto que o back-end devolve em `resumo`;
 * - lista (formato antigo, com valores ou marcadores) → inválida: a modal só salva no formato novo
 *   (decisão do usuário de 11/11/2026), com a mensagem `MENSAGEM_FORMATO_ANTIGO`;
 * - objeto vazio, tipo desconhecido e JSON que não é objeto → inválidos (mensagens abaixo, alinhadas ao
 *   back-end); com vários tipos inválidos, o primeiro campo é o informado.
 *
 * Os tipos antigos (`texto`, `numero`, `booleano`, `nulo`, `lista`, `objeto`) e os marcadores (`%filial%`,
 * `%valor%`, ...) deixam de existir na saída.
 */
const MENSAGEM_FORMATO_ANTIGO = 'Formato antigo (lista). Reescreva a saída como { "campo": "tipo" }.'
const MENSAGEM_SAIDA_VAZIA = 'A saída precisa descrever ao menos um campo, ex.: { "codfil": "string", "vlrLiq": "number" }'
const MENSAGEM_NAO_OBJETO = 'A saída deve ser um objeto { "campo": "tipo" }'

/** Mensagem do tipo inválido: o valor como está no JSON (`"texto"`, `10`, `null`...). */
function tipoInvalido(campo: string, tipoNoJson: string): string {
  return `O campo "${campo}" da saída tem tipo ${tipoNoJson}; use string, number, date ou boolean`
}

describe('F5.14 — validarSaida (saída por "chave: tipo")', () => {
  it.each(['', '   ', '\n\t '])('texto vazio ("%s") → estado vazio (nada aparece)', (texto) => {
    expect(validarSaida(texto, 'valor')).toEqual({ estado: 'vazio' })
    expect(validarSaida(texto, 'meta')).toEqual({ estado: 'vazio' })
  })

  describe('válido', () => {
    it('exemplo do documento → campos na ordem e o resumo "3 campos: codemp (string), codfil (string), vlrLiq (number)"', () => {
      const resultado = validarSaida('{\n  "codemp": "string",\n  "codfil": "string",\n  "vlrLiq": "number"\n}', 'valor')

      expect(resultado).toEqual({
        estado: 'valido',
        campos: [
          { nome: 'codemp', tipo: 'string' },
          { nome: 'codfil', tipo: 'string' },
          { nome: 'vlrLiq', tipo: 'number' },
        ],
        resumo: '3 campos: codemp (string), codfil (string), vlrLiq (number)',
      })
    })

    it('aceita os quatro tipos (string, number, date, boolean)', () => {
      expect(validarSaida('{ "codfil": "number", "metVlr": "number", "data": "date", "ativo": "boolean", "obs": "string" }', 'meta')).toEqual({
        estado: 'valido',
        campos: [
          { nome: 'codfil', tipo: 'number' },
          { nome: 'metVlr', tipo: 'number' },
          { nome: 'data', tipo: 'date' },
          { nome: 'ativo', tipo: 'boolean' },
          { nome: 'obs', tipo: 'string' },
        ],
        resumo: '5 campos: codfil (number), metVlr (number), data (date), ativo (boolean), obs (string)',
      })
    })

    it('um único campo → resumo no singular "1 campo: codfil (string)"', () => {
      expect(validarSaida('{"codfil": "string"}', 'valor')).toEqual({
        estado: 'valido',
        campos: [{ nome: 'codfil', tipo: 'string' }],
        resumo: '1 campo: codfil (string)',
      })
    })

    it('a regra da saída é a mesma no dado externo e no indicador', () => {
      const texto = '{ "codfil": "string", "vlrLiq": "number" }'

      expect(validarSaida(texto, 'meta')).toEqual(validarSaida(texto, 'valor'))
      expect(validarSaida(texto, 'meta')).toMatchObject({ estado: 'valido', resumo: '2 campos: codfil (string), vlrLiq (number)' })
    })

    it('nomes literais filial/valor/meta não têm nada de especial: são campos comuns', () => {
      expect(validarSaida('{"filial": "string", "valor": "number"}', 'valor')).toMatchObject({
        estado: 'valido',
        resumo: '2 campos: filial (string), valor (number)',
      })
    })
  })

  describe('formato antigo (lista)', () => {
    it.each([
      ['lista com valores de exemplo', '[ { "codemp": "1", "codfil": "100", "vlrLiq": "0" } ]'],
      ['lista com marcadores', '[ { "codfil": "%filial%", "vlrLiq": "%valor%" } ]'],
      ['lista com nomes literais', '[{"filial": "101", "valor": "1500,00", "competencia": "10/2026"}]'],
      ['lista com itens já em "chave: tipo"', '[{"codfil": "string", "vlrLiq": "number"}]'],
      ['lista vazia', '[]'],
    ])('%s → inválida, pedindo para reescrever no formato novo', (_nome, texto) => {
      expect(validarSaida(texto, 'valor')).toEqual({ estado: 'invalido', mensagem: MENSAGEM_FORMATO_ANTIGO })
      expect(validarSaida(texto, 'meta')).toEqual({ estado: 'invalido', mensagem: MENSAGEM_FORMATO_ANTIGO })
    })
  })

  describe('inválido', () => {
    it('JSON mal formado → mensagem com linha, coluna e explicação em português', () => {
      expect(validarSaida('{"codfil": "string",}', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: 'Linha 1, coluna 20: vírgula sobrando',
      })
    })

    it('aspas faltando em outra linha', () => {
      expect(validarSaida('{\n  "codfil": "string\n}', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: 'Linha 2, coluna 13: texto sem aspas de fechamento',
      })
    })

    it('objeto vazio → mensagem do back-end, com o exemplo', () => {
      expect(validarSaida('{}', 'valor')).toEqual({ estado: 'invalido', mensagem: MENSAGEM_SAIDA_VAZIA })
      expect(validarSaida('{ }', 'meta')).toEqual({ estado: 'invalido', mensagem: MENSAGEM_SAIDA_VAZIA })
    })

    it.each([
      ['texto', '"abc"'],
      ['número', '10'],
      ['booleano', 'true'],
      ['nulo', 'null'],
    ])('%s solto → "A saída deve ser um objeto { "campo": "tipo" }"', (_nome, texto) => {
      expect(validarSaida(texto, 'valor')).toEqual({ estado: 'invalido', mensagem: MENSAGEM_NAO_OBJETO })
    })

    it.each([
      ['tipo em português ("texto")', '{"codfil": "texto"}', 'codfil', '"texto"'],
      ['tipo antigo "numero"', '{"vlrLiq": "numero"}', 'vlrLiq', '"numero"'],
      ['"integer" (não existe; o number cobre)', '{"qtd": "integer"}', 'qtd', '"integer"'],
      ['"datetime"', '{"data": "datetime"}', 'data', '"datetime"'],
      ['em maiúsculas ("Number")', '{"vlrLiq": "Number"}', 'vlrLiq', '"Number"'],
      ['com espaço (" number")', '{"vlrLiq": " number"}', 'vlrLiq', '" number"'],
      ['valor de exemplo ("100")', '{"codfil": "100"}', 'codfil', '"100"'],
      ['marcador ("%filial%")', '{"codfil": "%filial%"}', 'codfil', '"%filial%"'],
      ['texto vazio', '{"codfil": ""}', 'codfil', '""'],
      ['número sem aspas', '{"vlrLiq": 10}', 'vlrLiq', '10'],
      ['nulo', '{"vlrLiq": null}', 'vlrLiq', 'null'],
      ['booleano', '{"ativo": true}', 'ativo', 'true'],
    ])('%s → "O campo ... da saída tem tipo ...; use string, number, date ou boolean"', (_nome, texto, campo, tipoNoJson) => {
      expect(validarSaida(texto, 'valor')).toEqual({ estado: 'invalido', mensagem: tipoInvalido(campo, tipoNoJson) })
    })

    it('tipo em lista ou objeto também é inválido (o valor aparece como JSON compacto)', () => {
      expect(validarSaida('{"codfil": "string", "lista": ["number"]}', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: tipoInvalido('lista', '["number"]'),
      })
      expect(validarSaida('{"item": {"a": "string"}}', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: tipoInvalido('item', '{"a":"string"}'),
      })
    })

    it('com vários tipos inválidos, o primeiro campo (na ordem do objeto) é o informado', () => {
      expect(validarSaida('{"codfil": "string", "vlrLiq": "numero", "data": "data"}', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: tipoInvalido('vlrLiq', '"numero"'),
      })
    })

    it('nenhuma mensagem do formato em lista continua em uso', () => {
      const textos = ['{}', '{"a": "x"}', '"x"', '[]', '[{}]', '[{"filial": "1", "valor": 1}]']

      for (const texto of textos) {
        const mensagem = JSON.stringify(validarSaida(texto, 'valor'))
        expect(mensagem).not.toContain('A saída deve ser uma lista com um item por filial')
        expect(mensagem).not.toContain('A lista está vazia')
        expect(mensagem).not.toContain('falta o campo')
        expect(mensagem).not.toContain('Item 1')
      }
    })
  })
})
