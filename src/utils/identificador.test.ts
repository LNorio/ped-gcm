import { describe, expect, it } from 'vitest'
import { limparIdentificador } from './identificador'

describe('F5.5/F5.7 — limparIdentificador: identificador da consulta só com A–Z, 0–9 e "_", em maiúsculas', () => {
  it.each([
    ['ação ok', 'AOOK'],
    ['NOVOS-CLIENTES 2', 'NOVOSCLIENTES2'],
    ['novos_clientes', 'NOVOS_CLIENTES'],
  ])('"%s" vira "%s"', (texto, esperado) => {
    expect(limparIdentificador(texto)).toBe(esperado)
  })

  it('mantém um identificador já válido', () => {
    expect(limparIdentificador('FATURAMENTO')).toBe('FATURAMENTO')
    expect(limparIdentificador('VOLUME_VENDAS_2026')).toBe('VOLUME_VENDAS_2026')
    expect(limparIdentificador('0123456789')).toBe('0123456789')
    expect(limparIdentificador('_')).toBe('_')
  })

  it('converte letras minúsculas sem acento para maiúsculas', () => {
    expect(limparIdentificador('abcdefghijklmnopqrstuvwxyz')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    expect(limparIdentificador('Faturamento_Liq')).toBe('FATURAMENTO_LIQ')
  })

  it('remove letras acentuadas e o "ç", maiúsculas ou minúsculas, sem transliterar', () => {
    expect(limparIdentificador('áéíóú âêô ãõ à ü ç')).toBe('')
    expect(limparIdentificador('ÁÉÍÓÚÂÊÔÃÕÀÜÇ')).toBe('')
    expect(limparIdentificador('devoluções')).toBe('DEVOLUES')
    expect(limparIdentificador('Ñandú')).toBe('AND')
  })

  it('não translitera letras que mudam ao passar para maiúsculas (ex.: "ß" não vira "SS")', () => {
    expect(limparIdentificador('straße')).toBe('STRAE')
  })

  it('remove espaços, tabulações e quebras de linha, inclusive nas pontas', () => {
    expect(limparIdentificador('  faturamento  ')).toBe('FATURAMENTO')
    expect(limparIdentificador('a\tb\nc')).toBe('ABC')
    expect(limparIdentificador('   ')).toBe('')
  })

  it('remove caracteres especiais (pontuação, hífen, símbolos e emoji)', () => {
    expect(limparIdentificador('fat.liq/2026!@#$%&*()+=-')).toBe('FATLIQ2026')
    expect(limparIdentificador('vendas🚀')).toBe('VENDAS')
    expect(limparIdentificador('-.,;:?')).toBe('')
  })

  it('texto vazio continua vazio', () => {
    expect(limparIdentificador('')).toBe('')
  })

  it('aplicar duas vezes dá o mesmo resultado', () => {
    for (const texto of ['ação ok', 'NOVOS-CLIENTES 2', 'novos_clientes', 'straße']) {
      expect(limparIdentificador(limparIdentificador(texto))).toBe(limparIdentificador(texto))
    }
  })
})
