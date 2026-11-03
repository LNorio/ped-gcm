import { describe, expect, it } from 'vitest'
import {
  formatarCompetencia,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  lerDecimal,
  normalizarBusca,
} from './formato'

// Intl usa espaço não separável (U+00A0) entre "R$" e o número; o teste aceita os dois.
const semEspacoDuro = (texto: string) => texto.replace(/ /g, ' ')

describe('F1.4 — Formatos pt-BR', () => {
  describe('formatarData', () => {
    it('formata data da API (aaaa-mm-dd) como dd/mm/aaaa, sem deslocar o dia pelo fuso horário', () => {
      expect(formatarData('2026-10-01')).toBe('01/10/2026')
    })

    it('ignora a hora quando a API envia data e hora', () => {
      expect(formatarData('2026-10-19 09:58:19')).toBe('19/10/2026')
      expect(formatarData('2026-10-19T09:58:19')).toBe('19/10/2026')
    })

    it('aceita objeto Date', () => {
      expect(formatarData(new Date(2026, 0, 5))).toBe('05/01/2026')
    })

    it('devolve texto vazio para null, undefined, vazio ou data inválida', () => {
      expect(formatarData(null)).toBe('')
      expect(formatarData(undefined)).toBe('')
      expect(formatarData('')).toBe('')
      expect(formatarData('não é data')).toBe('')
    })

    it('devolve texto vazio para dia inexistente no mês ou mês fora de 1–12, sem "rolar" a data', () => {
      expect(formatarData('2025-02-30')).toBe('')
      expect(formatarData('2025-13-01')).toBe('')
      expect(formatarData('2025-04-31')).toBe('')
      expect(formatarData('2025-00-10')).toBe('')
    })

    it('aceita ISO com indicador de fuso (Z ou offset) e mantém o dia informado, sem converter para o fuso local', () => {
      expect(formatarData('2026-10-01T12:00:00Z')).toBe('01/10/2026')
      expect(formatarData('2026-10-01T23:30:00-03:00')).toBe('01/10/2026')
      expect(formatarData('2026-10-01T00:15:00+05:30')).toBe('01/10/2026')
    })
  })

  describe('formatarDataHora', () => {
    it('formata data e hora da API como dd/mm/aaaa hh:mm', () => {
      expect(formatarDataHora('2026-10-19 09:58:19')).toBe('19/10/2026 09:58')
      expect(formatarDataHora('2026-10-19T09:58:19')).toBe('19/10/2026 09:58')
    })

    it('aceita objeto Date com hora e minuto com dois dígitos', () => {
      expect(formatarDataHora(new Date(2026, 9, 19, 9, 5))).toBe('19/10/2026 09:05')
    })

    it('data sem hora mostra 00:00', () => {
      expect(formatarDataHora('2026-10-01')).toBe('01/10/2026 00:00')
    })

    it('ISO com Z mantém a hora informada, sem converter para o fuso local', () => {
      expect(formatarDataHora('2026-10-01T12:00:00Z')).toBe('01/10/2026 12:00')
    })

    it('devolve texto vazio para dia inexistente no mês', () => {
      expect(formatarDataHora('2025-02-30 10:00:00')).toBe('')
    })

    it('devolve texto vazio para null, undefined ou data inválida', () => {
      expect(formatarDataHora(null)).toBe('')
      expect(formatarDataHora(undefined)).toBe('')
      expect(formatarDataHora('xx')).toBe('')
    })
  })

  describe('formatarNumero', () => {
    it('usa vírgula decimal, ponto de milhar e 2 casas por padrão', () => {
      expect(formatarNumero(1234.5)).toBe('1.234,50')
      expect(formatarNumero(5)).toBe('5,00')
      expect(formatarNumero(0)).toBe('0,00')
      expect(formatarNumero(1234567.891)).toBe('1.234.567,89')
    })

    it('arredonda a exibição em 2 casas (RN-10)', () => {
      expect(formatarNumero(1234.567)).toBe('1.234,57')
      expect(formatarNumero(37.784)).toBe('37,78')
    })

    it('aceita quantidade de casas personalizada', () => {
      expect(formatarNumero(1234, 0)).toBe('1.234')
      expect(formatarNumero(2.64, 1)).toBe('2,6')
    })

    it('formata negativos', () => {
      expect(formatarNumero(-1234.5)).toBe('-1.234,50')
    })

    it('devolve texto vazio para null, undefined e NaN', () => {
      expect(formatarNumero(null)).toBe('')
      expect(formatarNumero(undefined)).toBe('')
      expect(formatarNumero(Number.NaN)).toBe('')
    })
  })

  describe('formatarMoeda', () => {
    it('formata em reais com 2 casas', () => {
      expect(semEspacoDuro(formatarMoeda(1234.5))).toBe('R$ 1.234,50')
      expect(semEspacoDuro(formatarMoeda(5260660.72))).toBe('R$ 5.260.660,72')
      expect(semEspacoDuro(formatarMoeda(0))).toBe('R$ 0,00')
    })

    it('arredonda em 2 casas', () => {
      expect(semEspacoDuro(formatarMoeda(8840.004))).toBe('R$ 8.840,00')
    })

    it('devolve texto vazio para null e undefined', () => {
      expect(formatarMoeda(null)).toBe('')
      expect(formatarMoeda(undefined)).toBe('')
    })
  })

  describe('formatarPercentual', () => {
    it('formata com vírgula, 2 casas e o sinal de %', () => {
      expect(formatarPercentual(37.78)).toBe('37,78%')
      expect(formatarPercentual(114.36)).toBe('114,36%')
      expect(formatarPercentual(100)).toBe('100,00%')
      expect(formatarPercentual(0)).toBe('0,00%')
    })

    it('arredonda em 2 casas', () => {
      expect(formatarPercentual(119.994)).toBe('119,99%')
    })

    it('devolve texto vazio para null e undefined', () => {
      expect(formatarPercentual(null)).toBe('')
      expect(formatarPercentual(undefined)).toBe('')
    })
  })

  describe('lerDecimal', () => {
    it('lê texto com vírgula decimal e ponto de milhar', () => {
      expect(lerDecimal('1.234,56')).toBe(1234.56)
      expect(lerDecimal('1,5')).toBe(1.5)
      expect(lerDecimal('0,25')).toBe(0.25)
      expect(lerDecimal('1.234.567,89')).toBe(1234567.89)
    })

    it('lê inteiros e ignora espaços nas pontas', () => {
      expect(lerDecimal('80')).toBe(80)
      expect(lerDecimal(' 1,5 ')).toBe(1.5)
    })

    it('lê negativos', () => {
      expect(lerDecimal('-1,5')).toBe(-1.5)
    })

    it('devolve o próprio número quando recebe number', () => {
      expect(lerDecimal(12.5)).toBe(12.5)
    })

    it('devolve null para vazio, null, undefined e texto não numérico', () => {
      expect(lerDecimal('')).toBeNull()
      expect(lerDecimal('   ')).toBeNull()
      expect(lerDecimal(null)).toBeNull()
      expect(lerDecimal(undefined)).toBeNull()
      expect(lerDecimal('abc')).toBeNull()
      expect(lerDecimal('1,2,3')).toBeNull()
    })
  })

  describe('formatarCompetencia', () => {
    it('formata o mês de referência da API como MM/AAAA', () => {
      expect(formatarCompetencia('2026-10-01')).toBe('10/2026')
      expect(formatarCompetencia('2026-01-15')).toBe('01/2026')
    })

    it('aceita "aaaa-mm" e objeto Date', () => {
      expect(formatarCompetencia('2026-03')).toBe('03/2026')
      expect(formatarCompetencia(new Date(2026, 11, 1))).toBe('12/2026')
    })

    it('devolve texto vazio para null, undefined ou valor inválido', () => {
      expect(formatarCompetencia(null)).toBe('')
      expect(formatarCompetencia(undefined)).toBe('')
      expect(formatarCompetencia('x')).toBe('')
    })
  })

  describe('normalizarBusca', () => {
    it('remove acentos e converte para minúsculas (RNF-09)', () => {
      expect(normalizarBusca('Atingimento de Cobertura')).toBe('atingimento de cobertura')
      expect(normalizarBusca('Ação')).toBe('acao')
      expect(normalizarBusca('ÇÃO Ê Í Ó Ú')).toBe('cao e i o u')
    })

    it('remove espaços das pontas e reduz espaços repetidos a um só', () => {
      expect(normalizarBusca('  Faturamento   líquido ')).toBe('faturamento liquido')
    })

    it('devolve texto vazio para vazio, null e undefined', () => {
      expect(normalizarBusca('')).toBe('')
      expect(normalizarBusca(null)).toBe('')
      expect(normalizarBusca(undefined)).toBe('')
    })
  })
})
