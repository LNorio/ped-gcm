import { describe, expect, it } from 'vitest'
import { ApiError, MENSAGEM_ERRO_INESPERADO, MENSAGEM_SEM_CONEXAO, mensagemDeErro } from './api'

/**
 * Testes em arquivo próprio (e não em api.test.ts) para não deixar vermelho o requisito F1.2,
 * que já está implementado: este comportamento pertence ao F1.12.
 */
describe('F1.12 — Mensagem de erro unificada (mensagemDeErro)', () => {
  describe('MENSAGEM_ERRO_INESPERADO', () => {
    it('tem o texto padrão em pt-BR usado em todas as telas para erros fora da API', () => {
      expect(MENSAGEM_ERRO_INESPERADO).toBe('Não foi possível concluir a operação. Tente novamente.')
    })
  })

  describe('mensagemDeErro(erro)', () => {
    it('devolve a mensagem exibível de uma ApiError', () => {
      expect(mensagemDeErro(new ApiError(400, 'Já existe um tipo com este nome.'))).toBe('Já existe um tipo com este nome.')
    })

    it('devolve a mensagem de conexão de uma ApiError de rede (status 0)', () => {
      expect(mensagemDeErro(new ApiError(0, MENSAGEM_SEM_CONEXAO))).toBe(MENSAGEM_SEM_CONEXAO)
    })

    it('usa `mensagem` da ApiError mesmo quando `message` difere', () => {
      const erro = new ApiError(500, 'Erro interno do servidor. Tente novamente mais tarde.')
      erro.message = 'detalhe técnico'

      expect(mensagemDeErro(erro)).toBe('Erro interno do servidor. Tente novamente mais tarde.')
    })

    it('Error comum devolve a mensagem inesperada, sem vazar o texto técnico', () => {
      expect(mensagemDeErro(new Error('Cannot read properties of undefined'))).toBe(MENSAGEM_ERRO_INESPERADO)
    })

    it('TypeError de rede não convertido devolve a mensagem inesperada', () => {
      expect(mensagemDeErro(new TypeError('Failed to fetch'))).toBe(MENSAGEM_ERRO_INESPERADO)
    })

    it('valores que não são Error (string, objeto, null, undefined) devolvem a mensagem inesperada', () => {
      expect(mensagemDeErro('falhou')).toBe(MENSAGEM_ERRO_INESPERADO)
      expect(mensagemDeErro({ mensagem: 'parece ApiError mas não é' })).toBe(MENSAGEM_ERRO_INESPERADO)
      expect(mensagemDeErro(null)).toBe(MENSAGEM_ERRO_INESPERADO)
      expect(mensagemDeErro(undefined)).toBe(MENSAGEM_ERRO_INESPERADO)
    })

    it('sempre devolve uma string não vazia', () => {
      for (const erro of [new ApiError(404, 'Registro não encontrado.'), new Error('x'), 42, null]) {
        const mensagem = mensagemDeErro(erro)
        expect(typeof mensagem).toBe('string')
        expect(mensagem.length).toBeGreaterThan(0)
      }
    })
  })
})
