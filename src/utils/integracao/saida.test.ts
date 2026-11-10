import { describe, expect, it } from 'vitest'
import { validarSaida } from './saida'

/**
 * Parâmetros de saída (F5.14): estrutura que a consulta devolve ao PED. Tipos com os nomes do
 * back-end (decisão de 10/11/2026): texto, numero (sem acento), booleano, nulo, lista, objeto.
 *
 * Alteração de 10/11/2026 (contrato final da meta via API, seção 2.3 de
 * `docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md`): a saída **é uma lista** com um item por
 * filial. `validarSaida(texto, campoValor)`, com `campoValor: 'valor' | 'meta'` (`valor` na integração
 * do dado externo, `meta` na do indicador), exige lista não vazia de objetos; cada item precisa de
 * `filial` e do campo de valor; `competencia` é opcional. O resumo lista os campos do primeiro item.
 * Objeto solto (aceito antes) passa a ser inválido. O primeiro item com problema é o informado.
 */
describe('F5.14 — validarSaida (JSON de saída em lista, um item por filial)', () => {
  it.each(['', '   ', '\n\t '])('texto vazio ("%s") → estado vazio (nada aparece)', (texto) => {
    expect(validarSaida(texto, 'valor')).toEqual({ estado: 'vazio' })
    expect(validarSaida(texto, 'meta')).toEqual({ estado: 'vazio' })
  })

  describe('válido', () => {
    it('lista do dado externo (filial, valor, competencia) → campos do primeiro item e o resumo "3 campos: filial (texto), valor (texto), competencia (texto)"', () => {
      const resultado = validarSaida(
        '[\n  { "filial": "101", "valor": "1500,00", "competencia": "10/2026" },\n  { "filial": "102", "valor": "980,50", "competencia": "10/2026" }\n]',
        'valor',
      )

      expect(resultado).toEqual({
        estado: 'valido',
        campos: [
          { nome: 'filial', tipo: 'texto' },
          { nome: 'valor', tipo: 'texto' },
          { nome: 'competencia', tipo: 'texto' },
        ],
        resumo: '3 campos: filial (texto), valor (texto), competencia (texto)',
      })
    })

    it('lista do indicador (filial e meta, como no contrato) → "2 campos: filial (texto), meta (texto)"', () => {
      expect(validarSaida('[ { "filial": "100", "meta": "4600000" } ]', 'meta')).toEqual({
        estado: 'valido',
        campos: [
          { nome: 'filial', tipo: 'texto' },
          { nome: 'meta', tipo: 'texto' },
        ],
        resumo: '2 campos: filial (texto), meta (texto)',
      })
    })

    it('competencia é opcional: item só com filial e valor é aceito', () => {
      expect(validarSaida('[{"filial": "101", "valor": 10}]', 'valor')).toMatchObject({
        estado: 'valido',
        resumo: '2 campos: filial (texto), valor (numero)',
      })
    })

    it('competencia presente em um item e ausente em outro continua válido', () => {
      expect(validarSaida('[{"filial": "101", "valor": 1, "competencia": "10/2026"}, {"filial": "102", "valor": 2}]', 'valor')).toMatchObject({
        estado: 'valido',
      })
    })

    it('identifica cada tipo com os nomes do back-end ("numero" sem acento), na ordem dos campos do primeiro item', () => {
      const resultado = validarSaida('[{"filial": 101, "valor": 1.5, "a": "x", "c": true, "d": null, "e": [1], "f": {"g": 1}}]', 'valor')

      expect(resultado).toEqual({
        estado: 'valido',
        campos: [
          { nome: 'filial', tipo: 'numero' },
          { nome: 'valor', tipo: 'numero' },
          { nome: 'a', tipo: 'texto' },
          { nome: 'c', tipo: 'booleano' },
          { nome: 'd', tipo: 'nulo' },
          { nome: 'e', tipo: 'lista' },
          { nome: 'f', tipo: 'objeto' },
        ],
        resumo: '7 campos: filial (numero), valor (numero), a (texto), c (booleano), d (nulo), e (lista), f (objeto)',
      })
      expect(JSON.stringify(resultado)).not.toContain('número')
    })

    it('o resumo usa os campos do primeiro item, mesmo que os demais tenham campos a mais', () => {
      expect(validarSaida('[{"filial": "101", "valor": 1}, {"filial": "102", "valor": 2, "extra": true}]', 'valor')).toMatchObject({
        estado: 'valido',
        resumo: '2 campos: filial (texto), valor (numero)',
      })
    })

    it('a ordem dos campos no item não importa para a regra (valor antes de filial)', () => {
      expect(validarSaida('[{"valor": 1, "filial": "101"}]', 'valor')).toEqual({
        estado: 'valido',
        campos: [
          { nome: 'valor', tipo: 'numero' },
          { nome: 'filial', tipo: 'texto' },
        ],
        resumo: '2 campos: valor (numero), filial (texto)',
      })
    })
  })

  describe('inválido', () => {
    it('JSON mal formado → mensagem com linha, coluna e explicação em português', () => {
      expect(validarSaida('[{"filial": "101", "valor": 1,}]', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: 'Linha 1, coluna 30: vírgula sobrando',
      })
    })

    it('aspas faltando em outra linha', () => {
      expect(validarSaida('[\n  {"valor": "abc\n}]', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: 'Linha 2, coluna 13: texto sem aspas de fechamento',
      })
    })

    it.each([
      ['objeto solto (formato aceito antes de 10/11/2026)', '{"filial": "101", "valor": "1500,00"}'],
      ['objeto vazio', '{}'],
      ['texto', '"abc"'],
      ['número', '10'],
      ['booleano', 'true'],
      ['nulo', 'null'],
    ])('%s → "A saída deve ser uma lista com um item por filial"', (_nome, texto) => {
      expect(validarSaida(texto, 'valor')).toEqual({ estado: 'invalido', mensagem: 'A saída deve ser uma lista com um item por filial' })
      expect(validarSaida(texto, 'meta')).toEqual({ estado: 'invalido', mensagem: 'A saída deve ser uma lista com um item por filial' })
    })

    it('lista vazia → "A lista está vazia"', () => {
      expect(validarSaida('[]', 'valor')).toEqual({ estado: 'invalido', mensagem: 'A lista está vazia' })
    })

    it.each([
      ['número', '[1, 2]', 'Item 1: deve ser um objeto'],
      ['texto no segundo item', '[{"filial": "101", "valor": 1}, "x"]', 'Item 2: deve ser um objeto'],
      ['lista dentro da lista', '[[{"filial": "101", "valor": 1}]]', 'Item 1: deve ser um objeto'],
      ['nulo', '[null]', 'Item 1: deve ser um objeto'],
    ])('item que não é objeto (%s: %s) → mensagem do item', (_nome, texto, mensagem) => {
      expect(validarSaida(texto, 'valor')).toEqual({ estado: 'invalido', mensagem })
    })

    it('item sem filial → "Item 1: falta o campo filial"', () => {
      expect(validarSaida('[{"valor": 1}]', 'valor')).toEqual({ estado: 'invalido', mensagem: 'Item 1: falta o campo filial' })
    })

    it('item sem o campo de valor do dado externo → "Item 2: falta o campo valor"', () => {
      expect(validarSaida('[{"filial": "101", "valor": 1}, {"filial": "102", "competencia": "10/2026"}]', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: 'Item 2: falta o campo valor',
      })
    })

    it('item sem filial nem o campo de valor → "Item 1: faltam os campos filial e valor"', () => {
      expect(validarSaida('[{"competencia": "10/2026"}]', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: 'Item 1: faltam os campos filial e valor',
      })
    })

    it('item vazio ([{}]) → "Item 1: faltam os campos filial e valor" (ou "meta")', () => {
      expect(validarSaida('[{}]', 'valor')).toEqual({ estado: 'invalido', mensagem: 'Item 1: faltam os campos filial e valor' })
      expect(validarSaida('[{}]', 'meta')).toEqual({ estado: 'invalido', mensagem: 'Item 1: faltam os campos filial e meta' })
    })

    it('o primeiro item com problema é o informado', () => {
      expect(validarSaida('[{"filial": "101", "valor": 1}, {"filial": "102"}, {"valor": 3}]', 'valor')).toEqual({
        estado: 'invalido',
        mensagem: 'Item 2: falta o campo valor',
      })
    })

    describe('o campo de valor depende do tipo da integração', () => {
      it('integração do indicador (meta): item com "valor" e sem "meta" → "Item 1: falta o campo meta"', () => {
        expect(validarSaida('[{"filial": "100", "valor": "4600000"}]', 'meta')).toEqual({
          estado: 'invalido',
          mensagem: 'Item 1: falta o campo meta',
        })
      })

      it('integração do dado externo (valor): item com "meta" e sem "valor" → "Item 1: falta o campo valor"', () => {
        expect(validarSaida('[{"filial": "100", "meta": "4600000"}]', 'valor')).toEqual({
          estado: 'invalido',
          mensagem: 'Item 1: falta o campo valor',
        })
      })

      it('integração do indicador sem filial → "Item 1: falta o campo filial"', () => {
        expect(validarSaida('[{"meta": "4600000"}]', 'meta')).toEqual({ estado: 'invalido', mensagem: 'Item 1: falta o campo filial' })
      })
    })

    it('nenhuma mensagem antiga de objeto continua em uso', () => {
      const mensagens = ['{}', '[{}]', '[1]', '{"valor": 1}'].map((texto) => JSON.stringify(validarSaida(texto, 'valor')))

      for (const mensagem of mensagens) {
        expect(mensagem).not.toContain('O objeto não tem campos')
        expect(mensagem).not.toContain('O JSON deve ser um objeto ou uma lista de objetos')
      }
    })
  })
})
