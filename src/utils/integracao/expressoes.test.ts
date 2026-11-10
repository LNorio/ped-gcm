import { describe, expect, it } from 'vitest'
import { variaveisIntegracao } from '../../test/dadosExternosFalsos'
import type { VariavelIntegracao } from '../../types/dominio'
import { valoresDeExemplo } from './exemplos'
import { type ContextoIntegracao, ehConta, resolverTexto, variaveisDoTexto } from './expressoes'

/** Contexto dos exemplos do documento: período 10/2026, hoje = 15/10/2026, 3 meses retroativos. */
function contexto(variaveis: VariavelIntegracao[] = variaveisIntegracao()): ContextoIntegracao {
  return { variaveis, valores: valoresDeExemplo({ hoje: new Date(2026, 9, 15), mesesRetro: 3, diaColeta: null }) }
}

describe('F5.14 — Expressões dos parâmetros de entrada', () => {
  describe('ehConta(texto): o texto vira conta só quando, retiradas as variáveis e as datas dd/mm/aaaa, sobram números, operadores, parênteses e sufixos m/a, com ao menos um operador', () => {
    it.each([
      '1 + 2',
      '(%mesesRetro% * 30) - 1',
      '%ano% - 1',
      '1000 / 4 + 2,5',
      '%dataInicial% - 30',
      '%dataFinal% + 1m',
      '%hoje% - 1a',
      '%dataFinal% - %dataInicial% + 1',
      '31/01/2026 + 1m',
      '%zona% + 1',
      '%foo% * 2',
      '3m + 1',
      '3 * * 2',
      '(1 + 2',
      '2 ^ 3',
      '-%ano%',
      '1.5+1,5',
    ])('"%s" é conta', (texto) => {
      expect(ehConta(texto)).toBe(true)
    })

    it.each([
      ['variável sozinha', '%filial%'],
      ['variável de data sozinha', '%dataInicial%'],
      ['data dd/mm/aaaa sozinha', '15/10/2026'],
      ['data mm/aaaa sozinha', '10/2026'],
      ['texto com letras e variável', 'Filial-%filial%'],
      ['texto com letras', 'abc'],
      ['texto com letras e operador', 'mes - 1'],
      ['letra solta separada do número', '%hoje% - 1 a'],
      ['número sem operador', '5'],
      ['número com sufixo sem operador', '1m'],
      ['vazio', ''],
    ])('%s ("%s") não é conta', (_nome, texto) => {
      expect(ehConta(texto)).toBe(false)
    })
  })

  describe('variaveisDoTexto(texto): nomes sem %, únicos, na ordem em que aparecem', () => {
    it.each<[string, string[]]>([
      ['%dataFinal% - %dataInicial% + 1', ['dataFinal', 'dataInicial']],
      ['%mes%/%ano% e %mes%', ['mes', 'ano']],
      ['Filial-%filial%', ['filial']],
      ['%foo% + 1', ['foo']],
      ['sem variáveis', []],
      ['50%', []],
    ])('"%s" → %j', (texto, esperado) => {
      expect(variaveisDoTexto(texto)).toEqual(esperado)
    })
  })

  describe('resultados da tabela do documento (período 10/2026, 3 meses retroativos, hoje = 15/10/2026)', () => {
    it.each([
      ['(%mesesRetro% * 30) - 1', '89'],
      ['%ano% - 1', '2025'],
      ['1000 / 4 + 2,5', '252,5'],
      ['%dataInicial% - 30', '01/09/2026'],
      ['%dataFinal% + 1m', '30/11/2026'],
      ['%hoje% - 1a', '15/10/2025'],
      ['%dataFinal% - %dataInicial% + 1', '31'],
      ['31/01/2026 + 1m', '28/02/2026'],
      ['%dataInicial% - 3m', '01/07/2026'],
    ])('"%s" = %s', (texto, esperado) => {
      expect(resolverTexto(texto, contexto())).toEqual({ ok: true, conta: true, valor: esperado })
    })
  })

  describe('regras de cálculo', () => {
    it.each([
      ['multiplicação antes da soma', '2 + 3 * 4', '14'],
      ['parênteses primeiro', '(2 + 3) * 4', '20'],
      ['potência antes da multiplicação', '2 * 3 ^ 2', '18'],
      ['subtração da esquerda para a direita', '10 - 4 - 3', '3'],
      ['divisão da esquerda para a direita', '100 / 10 / 2', '5'],
      ['sinal negativo', '2 * -3', '-6'],
      ['sinal negativo antes de parênteses', '-(2 + 3)', '-5'],
      ['sinal negativo antes de variável', '-%ano%', '-2026'],
      ['vírgula e ponto decimal', '1,5 + 1.5', '3'],
      ['resultado decimal com vírgula', '10 / 4', '2,5'],
      ['sem zeros desnecessários', '5,0 + 1', '6'],
      ['sem separador de milhar', '1000 * 1000', '1000000'],
      ['sem espaços', '(%mesesRetro%*30)-1', '89'],
    ])('%s: "%s" = %s', (_nome, texto, esperado) => {
      expect(resolverTexto(texto, contexto())).toEqual({ ok: true, conta: true, valor: esperado })
    })

    it.each([
      ['data − data dá a quantidade de dias', '%dataFinal% - %dataInicial%', '30'],
      ['data + número soma dias', '%dataFinal% + 1', '01/11/2026'],
      ['número + data dá data', '1 + %dataInicial%', '02/10/2026'],
      ['data literal + dias', '28/02/2026 + 1', '01/03/2026'],
      ['data + meses', '%hoje% + 2m', '15/12/2026'],
      ['data + meses na virada do ano', '%hoje% + 3m', '15/01/2027'],
      ['data + anos', '%hoje% + 1a', '15/10/2027'],
      ['fim de mês em ano bissexto', '31/01/2028 + 1m', '29/02/2028'],
      ['29/02 + 1 ano vai para 28/02', '29/02/2028 + 1a', '28/02/2029'],
      ['data − meses com ajuste de fim de mês', '31/03/2026 - 1m', '28/02/2026'],
      ['meses e depois dias', '%dataFinal% + 1m + 1', '01/12/2026'],
      ['variável numérica em dias', '%dataInicial% - %mesesRetro%', '28/09/2026'],
    ])('%s: "%s" = %s', (_nome, texto, esperado) => {
      expect(resolverTexto(texto, contexto())).toEqual({ ok: true, conta: true, valor: esperado })
    })
  })

  describe('textos que não viram conta: só a troca das variáveis', () => {
    it.each([
      ['variável numérica sozinha', '%filial%', '101'],
      ['variável de texto sozinha', '%zona%', 'Z01'],
      ['variável de texto com zeros à esquerda', '%colaborador%', '000123'],
      ['competência', '%competencia%', '10/2026'],
      ['variável de data sozinha (dd/mm/aaaa)', '%dataInicial%', '01/10/2026'],
      ['mês sem zero à esquerda', '%mes%', '10'],
      ['texto com letras e variável', 'Filial-%filial%', 'Filial-101'],
      ['texto com duas variáveis de data', 'Período %dataInicial% a %dataFinal%', 'Período 01/10/2026 a 31/10/2026'],
      ['data dd/mm/aaaa sozinha', '15/10/2026', '15/10/2026'],
      ['data mm/aaaa sozinha', '10/2026', '10/2026'],
      ['texto comum', 'ABC', 'ABC'],
      ['texto vazio', '', ''],
      ['número sem operador', '5', '5'],
    ])('%s: "%s" → "%s"', (_nome, texto, esperado) => {
      expect(resolverTexto(texto, contexto())).toEqual({ ok: true, conta: false, valor: esperado })
    })
  })

  describe('variáveis só da API: o tipo e a existência vêm da lista recebida', () => {
    it('sem variáveis da API, toda variável é desconhecida', () => {
      expect(resolverTexto('%filial%', contexto([]))).toEqual({ ok: false, motivos: ['variável desconhecida %filial%'] })
      expect(resolverTexto('%ano% - 1', contexto([]))).toEqual({ ok: false, motivos: ['variável desconhecida %ano%'] })
    })

    it('o tipo informado pela API prevalece (filial como texto não entra em conta)', () => {
      const variaveis = variaveisIntegracao().map((v): VariavelIntegracao => (v.nome === 'filial' ? { ...v, tipo: 'texto' } : v))

      expect(resolverTexto('%filial% + 1', contexto(variaveis))).toEqual({
        ok: false,
        motivos: ['variável de texto %filial% em conta'],
      })
    })

    it('variável da API sem valor de exemplo conhecido: número → 1, texto → o nome da variável, data → hoje', () => {
      const variaveis: VariavelIntegracao[] = [
        ...variaveisIntegracao(),
        { nome: 'meta', descricao: 'Meta do período', tipo: 'numero' },
        { nome: 'vendedor', descricao: '', tipo: 'texto' },
        { nome: 'fechamento', descricao: 'Data de fechamento', tipo: 'data' },
      ]

      expect(resolverTexto('%meta% * 3', contexto(variaveis))).toEqual({ ok: true, conta: true, valor: '3' })
      expect(resolverTexto('%vendedor%', contexto(variaveis))).toEqual({ ok: true, conta: false, valor: 'vendedor' })
      expect(resolverTexto('%fechamento% + 1', contexto(variaveis))).toEqual({ ok: true, conta: true, valor: '16/10/2026' })
    })
  })

  /**
   * Alteração de 10/11/2026 (seção 3.2 de `RESPOSTA-FINAL-meta-via-api.md`): `%empresa%` é número
   * (prévia 1) e entra em conta; `%empresas%` é texto ("1,6,7,8,9") e não entra em conta.
   */
  describe('%empresa% e %empresas% (13 variáveis da API)', () => {
    it('"%empresa%" sozinha → "1" e "%empresas%" sozinha → "1,6,7,8,9" (não são contas)', () => {
      expect(resolverTexto('%empresa%', contexto())).toEqual({ ok: true, conta: false, valor: '1' })
      expect(resolverTexto('%empresas%', contexto())).toEqual({ ok: true, conta: false, valor: '1,6,7,8,9' })
    })

    it('"%empresa% + 1" → 2 (número entra em conta)', () => {
      expect(resolverTexto('%empresa% + 1', contexto())).toEqual({ ok: true, conta: true, valor: '2' })
    })

    it('"%empresas% + 1" → "variável de texto %empresas% em conta"', () => {
      expect(resolverTexto('%empresas% + 1', contexto())).toEqual({
        ok: false,
        motivos: ['variável de texto %empresas% em conta'],
      })
    })

    it('texto com %empresas% e outras letras só troca a variável ("EMP:%empresas%" → "EMP:1,6,7,8,9")', () => {
      expect(resolverTexto('EMP:%empresas%', contexto())).toEqual({ ok: true, conta: false, valor: 'EMP:1,6,7,8,9' })
    })
  })

  describe('erros (tabela do documento)', () => {
    it.each([
      ['variável desconhecida', '%foo%', 'variável desconhecida %foo%'],
      ['variável desconhecida em texto com letras', 'Filial-%foo%', 'variável desconhecida %foo%'],
      ['variável desconhecida em conta', '%foo% * 2', 'variável desconhecida %foo%'],
      ['variável de texto em conta', '%zona% + 1', 'variável de texto %zona% em conta'],
      ['parêntese não fechado', '(1 + 2', 'parêntese não fechado'],
      ['parêntese não fechado (aninhado)', '((1 + 2) * 3', 'parêntese não fechado'],
      ['parêntese fechado sem abertura', '1 + 2)', 'parêntese fechado sem abertura'],
      ['operador repetido', '3 * * 2', 'operador repetido ou fora de lugar'],
      ['operador repetido (+ +)', '3 + + 2', 'operador repetido ou fora de lugar'],
      ['operador no fim', '3 +', 'operador repetido ou fora de lugar'],
      ['operador no início', '* 3', 'operador repetido ou fora de lugar'],
      ['divisão por zero', '5 / 0', 'divisão por zero'],
      ['divisão por zero calculado', '5 / (2 - 2)', 'divisão por zero'],
      ['soma de duas datas', '%dataInicial% + %dataFinal%', 'soma de duas datas'],
      ['data multiplicada', '%dataInicial% * 2', 'data não pode ser multiplicada, dividida ou elevada'],
      ['data dividida', '%hoje% / 2', 'data não pode ser multiplicada, dividida ou elevada'],
      ['data elevada', '%hoje% ^ 2', 'data não pode ser multiplicada, dividida ou elevada'],
      ['data subtraída de um número', '5 - %hoje%', 'data subtraída de um número'],
      ['unidade m sem data', '3m + 1', 'unidade m ou a sem data'],
      ['unidade a sem data', '2 * 3a', 'unidade m ou a sem data'],
      ['data inexistente', '31/02/2026 + 1', 'data inexistente 31/02/2026'],
      ['data inexistente (29/02 em ano comum)', '29/02/2025 + 1', 'data inexistente 29/02/2025'],
    ])('%s: "%s" → %s', (_nome, texto, motivo) => {
      expect(resolverTexto(texto, contexto())).toEqual({ ok: false, motivos: [motivo] })
    })

    it('lista todas as variáveis desconhecidas da expressão, na ordem', () => {
      expect(resolverTexto('%foo% + %bar%', contexto())).toEqual({
        ok: false,
        motivos: ['variável desconhecida %foo%', 'variável desconhecida %bar%'],
      })
    })
  })
})
