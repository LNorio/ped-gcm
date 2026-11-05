import { describe, expect, it } from 'vitest'
import { linhaFaixaVazia, validarLinhasFaixas, type LinhaFaixaEditavel } from './regrasFaixas'

const linha = (de: string, ate: string, aliquota: string): LinhaFaixaEditavel => ({ de, ate, aliquota })

/**
 * Validações das linhas (RF-43 e API fase 5): De, Até e Alíquota preenchidos e numéricos (vírgula
 * decimal, ponto de milhar — RNF-03); De menor que Até; sem valores negativos; cada faixa começa
 * **acima** do Até da anterior (começar exatamente nele é erro); ao menos uma faixa. Lacunas entre
 * faixas são permitidas (o documento não as proíbe). Textos das mensagens seguem o protótipo.
 * As linhas são validadas na ordem exibida e a primeira linha com problema é a informada.
 */
describe('F8.3 — validarLinhasFaixas (validações das linhas — RF-43)', () => {
  it('linhaFaixaVazia() devolve uma linha com De, Até e Alíquota vazios', () => {
    expect(linhaFaixaVazia()).toEqual({ de: '', ate: '', aliquota: '' })
  })

  it('linhas válidas com vírgula decimal e ponto de milhar viram faixas numéricas, na ordem informada', () => {
    expect(
      validarLinhasFaixas([linha('0', '1.000,00', '0'), linha('1.000,01', '2.000', '1,5'), linha(' 2.000,01 ', '5000', '3')]),
    ).toEqual({
      erro: null,
      faixas: [
        { de: 0, ate: 1000, aliquota: 0 },
        { de: 1000.01, ate: 2000, aliquota: 1.5 },
        { de: 2000.01, ate: 5000, aliquota: 3 },
      ],
    })
  })

  it('"2.000" é lido no padrão pt-BR (dois mil), e não como 2', () => {
    expect(validarLinhasFaixas([linha('0', '2.000', '1')])).toEqual({ erro: null, faixas: [{ de: 0, ate: 2000, aliquota: 1 }] })
  })

  it('uma única faixa é válida; alíquota zero é válida', () => {
    expect(validarLinhasFaixas([linha('0', '100', '0')])).toEqual({ erro: null, faixas: [{ de: 0, ate: 100, aliquota: 0 }] })
  })

  it('lacuna entre faixas é permitida (a seguinte só precisa começar acima do Até da anterior)', () => {
    expect(validarLinhasFaixas([linha('0', '1.000', '0'), linha('1.500', '3.000', '2')]).erro).toBeNull()
  })

  it('sem linhas: "Adicione ao menos uma faixa."', () => {
    expect(validarLinhasFaixas([])).toEqual({ erro: 'Adicione ao menos uma faixa.', faixas: null })
  })

  it.each([
    ['De vazio', linha('', '100', '1')],
    ['Até vazio', linha('0', '', '1')],
    ['Alíquota vazia', linha('0', '100', '')],
    ['só espaços', linha('  ', '100', '1')],
  ])('%s: "Preencha De, Até e Alíquota da faixa N."', (_caso, invalida) => {
    expect(validarLinhasFaixas([linha('0', '10', '0'), invalida])).toEqual({
      erro: 'Preencha De, Até e Alíquota da faixa 2.',
      faixas: null,
    })
  })

  it.each([
    ['texto', linha('abc', '100', '1')],
    ['ponto decimal no lugar da vírgula com 2 casas', linha('0', '100.50', '1')],
    ['dois separadores decimais', linha('0', '100', '1,5,0')],
  ])('valor não numérico (%s): "Informe números válidos na faixa N (ex.: 1.000,50)."', (_caso, invalida) => {
    expect(validarLinhasFaixas([invalida])).toEqual({ erro: 'Informe números válidos na faixa 1 (ex.: 1.000,50).', faixas: null })
  })

  it('De negativo: "Os valores da faixa N não podem ser negativos."', () => {
    expect(validarLinhasFaixas([linha('-10', '100', '1')])).toEqual({
      erro: 'Os valores da faixa 1 não podem ser negativos.',
      faixas: null,
    })
  })

  it('Alíquota negativa: "A alíquota da faixa N não pode ser negativa."', () => {
    expect(validarLinhasFaixas([linha('0', '100', '1'), linha('100,01', '200', '-0,5')])).toEqual({
      erro: 'A alíquota da faixa 2 não pode ser negativa.',
      faixas: null,
    })
  })

  it.each([
    ['De igual a Até', linha('100', '100', '1')],
    ['De maior que Até', linha('200', '100', '1')],
  ])('%s: "Na faixa N, o valor “De” deve ser menor que “Até”."', (_caso, invalida) => {
    expect(validarLinhasFaixas([invalida])).toEqual({
      erro: 'Na faixa 1, o valor “De” deve ser menor que “Até”.',
      faixas: null,
    })
  })

  it.each([
    ['começa exatamente no Até da anterior', linha('1.000', '2.000', '1')],
    ['começa abaixo do Até da anterior (sobreposição)', linha('500', '2.000', '1')],
  ])('faixa que %s: "A faixa N deve começar acima do limite da faixa N-1."', (_caso, invalida) => {
    expect(validarLinhasFaixas([linha('0', '1.000', '0'), invalida])).toEqual({
      erro: 'A faixa 2 deve começar acima do limite da faixa 1.',
      faixas: null,
    })
  })

  it('a ordem exibida é a validada: faixa 3 abaixo da faixa 2 é erro, mesmo sem sobrepor a faixa 1', () => {
    expect(validarLinhasFaixas([linha('0', '100', '0'), linha('1.000', '2.000', '1'), linha('200', '300', '2')]).erro).toBe(
      'A faixa 3 deve começar acima do limite da faixa 2.',
    )
  })

  it('informa só a primeira linha com problema', () => {
    expect(validarLinhasFaixas([linha('0', '100', '0'), linha('', '', ''), linha('abc', '1', '1')]).erro).toBe(
      'Preencha De, Até e Alíquota da faixa 2.',
    )
  })
})
