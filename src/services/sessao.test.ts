import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken, obterToken } from './sessao'

const CHAVE_TOKEN = 'ped.token'

describe('F1.2 — Sessão (token de acesso)', () => {
  beforeEach(() => {
    limparToken()
    sessionStorage.clear()
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

  describe('persistência em sessionStorage (F2.1)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('definirToken grava o token em sessionStorage na chave "ped.token"', () => {
      definirToken('token-abc')

      expect(sessionStorage.getItem(CHAVE_TOKEN)).toBe('token-abc')
    })

    it('substituir o token atualiza o valor gravado', () => {
      definirToken('primeiro')
      definirToken('segundo')

      expect(sessionStorage.getItem(CHAVE_TOKEN)).toBe('segundo')
    })

    it('limparToken remove a chave do sessionStorage', () => {
      definirToken('token-abc')
      limparToken()

      expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull()
    })

    it('obterToken restaura o token gravado no sessionStorage quando a memória está vazia (recarga da página)', async () => {
      sessionStorage.setItem(CHAVE_TOKEN, 'token-salvo')
      vi.resetModules()
      const sessao = await import('./sessao')

      expect(sessao.obterToken()).toBe('token-salvo')
    })

    it('obterToken devolve null quando não há token nem em memória nem no sessionStorage', async () => {
      vi.resetModules()
      const sessao = await import('./sessao')

      expect(sessao.obterToken()).toBeNull()
    })

    it('não grava o token em localStorage', () => {
      definirToken('token-abc')

      expect(localStorage.getItem(CHAVE_TOKEN)).toBeNull()
      expect(localStorage.length).toBe(0)
    })
  })

  describe('sessionStorage indisponível (modo privado / política do navegador)', () => {
    const falhaStorage = () => {
      throw new DOMException('Acesso ao storage negado', 'SecurityError')
    }

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('definirToken não propaga o erro de setItem e mantém o token em memória', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(falhaStorage)

      expect(() => definirToken('token-memoria')).not.toThrow()
      expect(obterToken()).toBe('token-memoria')
    })

    it('obterToken não propaga o erro de getItem e devolve null quando não há token em memória', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(falhaStorage)

      expect(() => obterToken()).not.toThrow()
      expect(obterToken()).toBeNull()
    })

    it('obterToken com getItem falhando ainda devolve o token guardado em memória', () => {
      definirToken('token-memoria')
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(falhaStorage)

      expect(obterToken()).toBe('token-memoria')
    })

    it('limparToken não propaga o erro de removeItem', () => {
      definirToken('token-memoria')
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(falhaStorage)

      expect(() => limparToken()).not.toThrow()
    })

    it('limparToken com o storage inacessível (removeItem e getItem falhando) descarta o token da memória', () => {
      definirToken('token-memoria')
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(falhaStorage)
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(falhaStorage)

      expect(() => limparToken()).not.toThrow()
      expect(obterToken()).toBeNull()
    })

    it('com todo o storage falhando, definir, obter e limpar continuam funcionando só em memória', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(falhaStorage)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(falhaStorage)
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(falhaStorage)

      expect(() => {
        definirToken('primeiro')
        definirToken('segundo')
      }).not.toThrow()
      expect(obterToken()).toBe('segundo')

      expect(() => limparToken()).not.toThrow()
      expect(obterToken()).toBeNull()
    })
  })
})
