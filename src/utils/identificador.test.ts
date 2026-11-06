import { describe, expect, it } from 'vitest'
import { limparIdentificador } from './identificador'

/**
 * Regra do back-end publicada em 06/11/2026 (FRONT-PED-mudancas.md, item 7): o identificador aceita só
 * letras sem acento, números, "_", "-" e "." — sem espaços (`^[A-Za-z0-9_\-\.]+$`). O front descarta os
 * demais caracteres e converte para maiúsculas.
 */
describe('F5.5/F5.7 — limparIdentificador: identificador da consulta só com A–Z, 0–9, "_", "-" e ".", em maiúsculas', () => {
  it.each([
    ['ação ok', 'AOOK'],
    ['NOVOS-CLIENTES 2', 'NOVOS-CLIENTES2'],
    ['novos_clientes', 'NOVOS_CLIENTES'],
    ['fat.liq-2026', 'FAT.LIQ-2026'],
  ])('"%s" vira "%s"', (texto, esperado) => {
    expect(limparIdentificador(texto)).toBe(esperado)
  })

  it('mantém um identificador já válido', () => {
    expect(limparIdentificador('FATURAMENTO')).toBe('FATURAMENTO')
    expect(limparIdentificador('VOLUME_VENDAS_2026')).toBe('VOLUME_VENDAS_2026')
    expect(limparIdentificador('0123456789')).toBe('0123456789')
    expect(limparIdentificador('_')).toBe('_')
    expect(limparIdentificador('-')).toBe('-')
    expect(limparIdentificador('.')).toBe('.')
    expect(limparIdentificador('FAT.LIQ-FILIAL_1')).toBe('FAT.LIQ-FILIAL_1')
  })

  it('mantém "-" e "." em qualquer posição, inclusive nas pontas e repetidos', () => {
    expect(limparIdentificador('-fat.')).toBe('-FAT.')
    expect(limparIdentificador('a--b..c')).toBe('A--B..C')
    expect(limparIdentificador('-._')).toBe('-._')
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

  it('remove os demais caracteres especiais (pontuação, barra, símbolos e emoji), mantendo "-" e "."', () => {
    expect(limparIdentificador('fat.liq/2026!@#$%&*()+=-')).toBe('FAT.LIQ2026-')
    expect(limparIdentificador('vendas🚀')).toBe('VENDAS')
    expect(limparIdentificador(',;:?!/\\\'"')).toBe('')
    expect(limparIdentificador('-.,;:?')).toBe('-.')
  })

  it('o resultado sempre atende à regra do back-end (^[A-Z0-9_\\-.]*$)', () => {
    for (const texto of ['ação ok', 'NOVOS-CLIENTES 2', 'fat.liq/2026!@#$%&*()+=-', 'straße', 'vendas🚀', 'Ñandú-1.2']) {
      expect(limparIdentificador(texto)).toMatch(/^[A-Z0-9_\-.]*$/)
    }
  })

  it('texto vazio continua vazio', () => {
    expect(limparIdentificador('')).toBe('')
  })

  it('aplicar duas vezes dá o mesmo resultado', () => {
    for (const texto of ['ação ok', 'NOVOS-CLIENTES 2', 'novos_clientes', 'straße', 'fat.liq-2026']) {
      expect(limparIdentificador(limparIdentificador(texto))).toBe(limparIdentificador(texto))
    }
  })
})
