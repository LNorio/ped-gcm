import { describe, expect, it } from 'vitest'
import { urlValida } from './url'

describe('F5.14 — urlValida (URL da integração: http:// ou https://, sem espaços, até 500 caracteres)', () => {
  it.each([
    'https://api.exemplo.com.br/consulta',
    'http://192.168.7.18:8080/coleta?tipo=1',
    'https://x',
    '  https://api.exemplo.com/consulta  ',
  ])('aceita "%s"', (texto) => {
    expect(urlValida(texto)).toBe(true)
  })

  it.each([
    ['vazia', ''],
    ['só espaços', '   '],
    ['sem esquema', 'api.exemplo.com/consulta'],
    ['com www, sem esquema', 'www.exemplo.com'],
    ['outro esquema', 'ftp://exemplo.com'],
    ['esquema sem nada depois (http)', 'http://'],
    ['esquema sem nada depois (https)', 'https://'],
    ['espaço no meio', 'https://api.exemplo.com/minha consulta'],
    ['tabulação no meio', 'https://api.exemplo.com/a\tb'],
    ['esquema incompleto', 'https:/api.exemplo.com'],
  ])('recusa %s ("%s")', (_nome, texto) => {
    expect(urlValida(texto)).toBe(false)
  })

  describe('limite de 500 caracteres (o mesmo do back-end; decisão de 10/11/2026), contados sem os espaços das pontas', () => {
    /** URL válida com exatamente `tamanho` caracteres. */
    const urlCom = (tamanho: number) => 'https://' + 'a'.repeat(tamanho - 'https://'.length)

    it('aceita com exatamente 500 caracteres', () => {
      expect(urlCom(500)).toHaveLength(500)
      expect(urlValida(urlCom(500))).toBe(true)
    })

    it('recusa com 501 caracteres', () => {
      expect(urlValida(urlCom(501))).toBe(false)
    })

    it('recusa bem acima do limite (2000 caracteres)', () => {
      expect(urlValida(urlCom(2000))).toBe(false)
    })

    it('espaços nas pontas não contam: 500 caracteres com espaços em volta é aceita', () => {
      expect(urlValida(`   ${urlCom(500)}   `)).toBe(true)
    })

    it('com os espaços das pontas removidos, 501 caracteres continua recusada', () => {
      expect(urlValida(`  ${urlCom(501)}  `)).toBe(false)
    })
  })
})
