import { describe, expect, it } from 'vitest'
import { variaveisIntegracao } from '../../test/dadosExternosFalsos'
import type { VariavelIntegracao } from '../../types/dominio'
import { valoresDeExemplo } from './exemplos'

/** Dia, mês (1–12) e ano de uma data local, para comparar sem depender de horário/fuso. */
function diaMesAno(valor: unknown): [number, number, number] {
  expect(valor).toBeInstanceOf(Date)
  const data = valor as Date
  return [data.getDate(), data.getMonth() + 1, data.getFullYear()]
}

/**
 * Valores de exemplo usados na prévia do JSON de entrada (F5.14). O período é o mês de `hoje`;
 * `mesesRetro` vem da janela retroativa do dado e `diaColeta` do dia da coleta (ambos `null` → 1).
 */
describe('F5.14 — valoresDeExemplo (valores da prévia)', () => {
  it('período 10/2026 com hoje = 15/10/2026, 3 meses retroativos e dia de coleta 20', () => {
    const valores = valoresDeExemplo({ hoje: new Date(2026, 9, 15), mesesRetro: 3, diaColeta: 20 })

    expect(valores.mes).toBe(10)
    expect(valores.ano).toBe(2026)
    expect(valores.competencia).toBe('10/2026')
    expect(diaMesAno(valores.dataInicial)).toEqual([1, 10, 2026])
    expect(diaMesAno(valores.dataFinal)).toEqual([31, 10, 2026])
    expect(diaMesAno(valores.hoje)).toEqual([15, 10, 2026])
    expect(valores.mesesRetro).toBe(3)
    expect(valores.diaColeta).toBe(20)
    expect(valores.filial).toBe(101)
    expect(valores.colaborador).toBe('000123')
    expect(valores.zona).toBe('Z01')
    expect(valores.empresa).toBe(1)
    expect(valores.empresas).toBe('1,6,7,8,9')
  })

  /**
   * Alteração de 10/11/2026 (seção 3.2 de `RESPOSTA-FINAL-meta-via-api.md`): `%empresa%` (número,
   * código da empresa da filial; na prévia vale 1) e `%empresas%` (texto, empresas participantes em
   * ordem, separadas por vírgula).
   */
  it('empresa (número) vale 1 e empresas (texto) vale "1,6,7,8,9", independentemente do dado e de hoje', () => {
    for (const parametros of [
      { hoje: new Date(2026, 9, 15), mesesRetro: 3, diaColeta: 20 },
      { hoje: new Date(2028, 1, 3), mesesRetro: null, diaColeta: null },
    ]) {
      const valores = valoresDeExemplo(parametros)
      expect(valores.empresa).toBe(1)
      expect(typeof valores.empresa).toBe('number')
      expect(valores.empresas).toBe('1,6,7,8,9')
      expect(typeof valores.empresas).toBe('string')
    }
  })

  it('mesesRetro e diaColeta nulos viram 1', () => {
    const valores = valoresDeExemplo({ hoje: new Date(2026, 9, 15), mesesRetro: null, diaColeta: null })

    expect(valores.mesesRetro).toBe(1)
    expect(valores.diaColeta).toBe(1)
  })

  it('competência com dois dígitos no mês: 05/03/2026 → "03/2026", mes 3', () => {
    const valores = valoresDeExemplo({ hoje: new Date(2026, 2, 5), mesesRetro: 1, diaColeta: null })

    expect(valores.mes).toBe(3)
    expect(valores.competencia).toBe('03/2026')
    expect(diaMesAno(valores.dataInicial)).toEqual([1, 3, 2026])
    expect(diaMesAno(valores.dataFinal)).toEqual([31, 3, 2026])
  })

  it('dezembro e fevereiro de ano bissexto: último dia do mês correto', () => {
    expect(diaMesAno(valoresDeExemplo({ hoje: new Date(2026, 11, 10), mesesRetro: 1, diaColeta: 1 }).dataFinal)).toEqual([
      31, 12, 2026,
    ])
    expect(diaMesAno(valoresDeExemplo({ hoje: new Date(2028, 1, 3), mesesRetro: 1, diaColeta: 1 }).dataFinal)).toEqual([
      29, 2, 2028,
    ])
    expect(diaMesAno(valoresDeExemplo({ hoje: new Date(2026, 1, 3), mesesRetro: 1, diaColeta: 1 }).dataFinal)).toEqual([
      28, 2, 2026,
    ])
  })

  it('hoje com horário (15/10/2026 23:59) continua no mesmo dia', () => {
    const valores = valoresDeExemplo({ hoje: new Date(2026, 9, 15, 23, 59, 30), mesesRetro: 1, diaColeta: 1 })

    expect(diaMesAno(valores.hoje)).toEqual([15, 10, 2026])
    expect(diaMesAno(valores.dataFinal)).toEqual([31, 10, 2026])
  })
})

/**
 * Alteração de 09/11/2026 (contrato `GET /api/ped/integracao/variaveis`): cada variável pode trazer o
 * `exemplo` usado pelo back-end. Com `variaveis` informadas, o exemplo da API **prevalece**, convertido
 * pelo tipo da variável: número aceita vírgula ou ponto decimal; data no formato dd/mm/aaaa; texto como
 * está. Exemplo ausente (`null`) ou que não se converte no tipo mantém o valor calculado acima.
 */
describe('F5.14 — valoresDeExemplo com os exemplos da API (variaveis)', () => {
  const BASE = { hoje: new Date(2026, 2, 5), mesesRetro: 1, diaColeta: 7 }

  function variavel(nome: string, tipo: VariavelIntegracao['tipo'], exemplo: string | null): VariavelIntegracao {
    return { nome, descricao: '', tipo, exemplo }
  }

  it('sem variaveis (ou lista vazia), nada muda', () => {
    expect(valoresDeExemplo({ ...BASE, variaveis: [] })).toEqual(valoresDeExemplo(BASE))
  })

  it('os exemplos da API (filial 100, período 10/2026, 3 meses retroativos) prevalecem sobre os calculados', () => {
    const valores = valoresDeExemplo({ ...BASE, variaveis: variaveisIntegracao() })

    expect(valores.filial).toBe(100)
    expect(valores.colaborador).toBe('000123')
    expect(valores.zona).toBe('Z01')
    expect(valores.mes).toBe(10)
    expect(valores.ano).toBe(2026)
    expect(valores.competencia).toBe('10/2026')
    expect(diaMesAno(valores.dataInicial)).toEqual([1, 10, 2026])
    expect(diaMesAno(valores.dataFinal)).toEqual([31, 10, 2026])
    expect(diaMesAno(valores.hoje)).toEqual([9, 11, 2026])
    expect(valores.diaColeta).toBe(1)
    expect(valores.mesesRetro).toBe(3)
    expect(valores.empresa).toBe(1)
    expect(valores.empresas).toBe('1,6,7,8,9')
  })

  it('o exemplo da API de empresas prevalece como texto ("1,6") e o de empresa como número ("6" → 6)', () => {
    const valores = valoresDeExemplo({ ...BASE, variaveis: [variavel('empresas', 'texto', '1,6'), variavel('empresa', 'numero', '6')] })

    expect(valores.empresas).toBe('1,6')
    expect(valores.empresa).toBe(6)
  })

  it('número com vírgula ou ponto decimal', () => {
    expect(valoresDeExemplo({ ...BASE, variaveis: [variavel('mesesRetro', 'numero', '2,5')] }).mesesRetro).toBe(2.5)
    expect(valoresDeExemplo({ ...BASE, variaveis: [variavel('mesesRetro', 'numero', '2.5')] }).mesesRetro).toBe(2.5)
    expect(valoresDeExemplo({ ...BASE, variaveis: [variavel('filial', 'numero', '101')] }).filial).toBe(101)
  })

  it('texto fica como está', () => {
    const valores = valoresDeExemplo({ ...BASE, variaveis: [variavel('colaborador', 'texto', '000999'), variavel('zona', 'texto', 'Norte 1')] })

    expect(valores.colaborador).toBe('000999')
    expect(valores.zona).toBe('Norte 1')
  })

  it('data dd/mm/aaaa vira data local', () => {
    const valores = valoresDeExemplo({ ...BASE, variaveis: [variavel('hoje', 'data', '28/02/2027')] })

    expect(diaMesAno(valores.hoje)).toEqual([28, 2, 2027])
  })

  it('exemplo null mantém o valor calculado', () => {
    const valores = valoresDeExemplo({ ...BASE, variaveis: [variavel('mesesRetro', 'numero', null), variavel('hoje', 'data', null)] })

    expect(valores.mesesRetro).toBe(1)
    expect(diaMesAno(valores.hoje)).toEqual([5, 3, 2026])
  })

  it.each<[string, VariavelIntegracao]>([
    ['número que não é número ("abc")', variavel('mesesRetro', 'numero', 'abc')],
    ['número vazio', variavel('mesesRetro', 'numero', '')],
    ['data em outro formato ("2026-10-01")', variavel('dataInicial', 'data', '2026-10-01')],
    ['data inexistente ("31/02/2026")', variavel('dataInicial', 'data', '31/02/2026')],
  ])('exemplo que não se converte no tipo (%s) mantém o valor calculado', (_nome, definicao) => {
    const calculados = valoresDeExemplo(BASE)

    expect(valoresDeExemplo({ ...BASE, variaveis: [definicao] })).toEqual(calculados)
  })

  it('o tipo da API decide a conversão (zona como número → 7)', () => {
    const valores = valoresDeExemplo({ ...BASE, variaveis: [variavel('zona', 'numero', '7')] }) as Record<string, unknown>

    expect(valores.zona).toBe(7)
  })

  it('variável da API fora da lista do documento entra nos valores com o seu exemplo', () => {
    const valores = valoresDeExemplo({
      ...BASE,
      variaveis: [variavel('regiao', 'texto', 'Centro-Oeste'), variavel('meta', 'numero', '1500,5')],
    }) as Record<string, unknown>

    expect(valores.regiao).toBe('Centro-Oeste')
    expect(valores.meta).toBe(1500.5)
  })

  it('variável sem exemplo e fora da lista do documento não entra nos valores', () => {
    const valores = valoresDeExemplo({ ...BASE, variaveis: [variavel('regiao', 'texto', null)] }) as Record<string, unknown>

    expect('regiao' in valores).toBe(false)
  })
})
