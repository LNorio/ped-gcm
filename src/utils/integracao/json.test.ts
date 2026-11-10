import { describe, expect, it } from 'vitest'
import { analisarJson } from './json'

/**
 * Parser JSON próprio da integração (F5.14). O `JSON.parse` do navegador dá mensagens em inglês e
 * sem linha/coluna; o parser devolve a posição (1-based) do caractere onde o erro foi detectado e
 * a explicação em português, no formato `Linha L, coluna C: <explicação>`.
 */
describe('F5.14 — analisarJson (parser JSON com erros em português, linha e coluna)', () => {
  describe('JSON válido', () => {
    it.each([
      ['objeto simples', '{"a": 1}'],
      ['objeto vazio', '{}'],
      ['lista vazia', '[]'],
      ['texto', '"abc"'],
      ['número', '-3.5e2'],
      ['booleano e nulo', '[true, false, null]'],
      ['aninhado com espaços e quebras de linha', '{\n  "a": [1, 2.5, -3e2, true, false, null],\n  "b": { "c": "x" }\n}'],
      ['texto com escapes', '{"a": "x\\"y\\n\\u00e9\\\\"}'],
      ['quebra de linha \\r\\n', '{\r\n  "a": 1\r\n}'],
    ])('%s: devolve o mesmo valor que JSON.parse', (_nome, texto) => {
      const resultado = analisarJson(texto)

      expect(resultado.ok).toBe(true)
      if (resultado.ok) expect(resultado.valor).toEqual(JSON.parse(texto))
    })
  })

  describe('JSON inválido: linha, coluna e explicação em português', () => {
    it.each([
      ['vírgula sobrando no objeto', '{"a": 1,}', 1, 8, 'vírgula sobrando'],
      ['vírgula sobrando na lista', '[1, 2,]', 1, 6, 'vírgula sobrando'],
      ['vírgula sobrando em outra linha', '{\n  "a": 1,\n}', 2, 9, 'vírgula sobrando'],
      ['vírgula sobrando com \\r\\n', '{\r\n  "a": 1,\r\n}', 2, 9, 'vírgula sobrando'],
      ['texto sem aspas de fechamento (posição da aspa de abertura)', '{"a": "abc}', 1, 7, 'texto sem aspas de fechamento'],
      [
        'aspas faltando no fim da linha (o texto não continua na linha seguinte)',
        '{\n  "a": "abc,\n  "b": 1\n}',
        2,
        8,
        'texto sem aspas de fechamento',
      ],
      ['falta o : depois do nome do campo', '{"a" 1}', 1, 6, 'esperava : depois do nome do campo'],
      ['falta a vírgula entre campos', '{"a": 1 "b": 2}', 1, 9, 'esperava , ou }'],
      ['falta a vírgula entre itens da lista', '[1 2]', 1, 4, 'esperava , ou ]'],
      ['lista não fechada antes do }', '{"a": [1, 2}', 1, 12, 'esperava , ou ]'],
      ['nome do campo sem aspas', '{a: 1}', 1, 2, 'nome do campo deve estar entre aspas'],
      ['texto acaba antes do fim (posição logo depois do último caractere)', '{"a": 1', 1, 8, 'fim inesperado do texto'],
      ['conteúdo depois do fim do JSON', '{"a": 1} x', 1, 10, 'conteúdo depois do fim do JSON'],
      ['caractere inesperado no lugar do valor', '{"a": @}', 1, 7, 'caractere inesperado'],
    ])('%s', (_nome, texto, linha, coluna, explicacao) => {
      const resultado = analisarJson(texto)

      expect(resultado.ok).toBe(false)
      if (!resultado.ok) {
        expect(resultado.erro).toEqual({
          linha,
          coluna,
          explicacao,
          mensagem: `Linha ${linha}, coluna ${coluna}: ${explicacao}`,
        })
      }
    })

    it('a mensagem nunca vem em inglês (não repassa o erro do JSON.parse)', () => {
      const resultado = analisarJson('{"a": 1,}')

      expect(resultado.ok).toBe(false)
      if (!resultado.ok) expect(resultado.erro.mensagem).not.toMatch(/unexpected|token|JSON at position/i)
    })
  })
})
