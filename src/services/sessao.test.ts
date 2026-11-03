import { beforeEach, describe, expect, it } from 'vitest'
import { definirToken, limparToken, obterToken } from './sessao'

describe('F1.2 — Sessão (token de acesso)', () => {
  beforeEach(() => {
    limparToken()
  })

  it('começa sem token', () => {
    expect(obterToken()).toBeNull()
  })

  it('guarda o token definido e o devolve em obterToken', () => {
    definirToken('token-abc')

    expect(obterToken()).toBe('token-abc')
  })

  it('substitui o token anterior ao definir um novo', () => {
    definirToken('primeiro')
    definirToken('segundo')

    expect(obterToken()).toBe('segundo')
  })

  it('limparToken descarta o token', () => {
    definirToken('token-abc')
    limparToken()

    expect(obterToken()).toBeNull()
  })

  it('limparToken sem token definido não lança erro', () => {
    expect(() => limparToken()).not.toThrow()
    expect(obterToken()).toBeNull()
  })
})
