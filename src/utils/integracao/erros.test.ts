import { describe, expect, it } from 'vitest'
import type { ErroIntegracao } from '../../types/dominio'
import { formatarErroIntegracao } from './erros'

function erro(sobrescrever: Partial<ErroIntegracao>): ErroIntegracao {
  return { campo: null, mensagem: 'mensagem', linha: null, coluna: null, caminho: null, expressao: null, ...sobrescrever }
}

/**
 * Texto exibido para um erro da integração vindo do back-end (400 do concluir/integracao e
 * `POST /api/ped/integracao/validar`). As mensagens vêm em português e são mostradas como vierem:
 * - com `linha` e `coluna` → `Linha L, coluna C: <mensagem>`;
 * - com `caminho` e `expressao` → `Campo "<caminho>": <mensagem> em "<expressao>"`;
 * - senão, só a mensagem.
 */
describe('F5.7 — formatarErroIntegracao (erros da integração devolvidos pelo back-end)', () => {
  it('erro de JSON com linha e coluna: "Linha L, coluna C: <mensagem>"', () => {
    expect(
      formatarErroIntegracao(erro({ campo: 'parametros de saida', mensagem: "virgula sobrando antes de '}'", linha: 3, coluna: 1 })),
    ).toBe("Linha 3, coluna 1: virgula sobrando antes de '}'")
  })

  it('erro de conta com caminho e expressão: Campo "<caminho>": <mensagem> em "<expressao>"', () => {
    expect(
      formatarErroIntegracao(
        erro({ campo: 'parametros de entrada', caminho: 'inicio', expressao: '5 / 0', mensagem: 'divisao por zero' }),
      ),
    ).toBe('Campo "inicio": divisao por zero em "5 / 0"')
  })

  it('caminho com ponto e índice de lista é mostrado como veio', () => {
    expect(
      formatarErroIntegracao(erro({ caminho: 'lista[0].filtro', expressao: '%foo%', mensagem: 'variavel desconhecida: %foo%' })),
    ).toBe('Campo "lista[0].filtro": variavel desconhecida: %foo% em "%foo%"')
  })

  it('sem linha/coluna e sem caminho/expressão: só a mensagem, como veio', () => {
    expect(
      formatarErroIntegracao(erro({ campo: 'url', mensagem: 'a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)' })),
    ).toBe('a URL precisa comecar com http:// ou https://, sem espacos (ate 500 caracteres)')
  })

  it('caminho sem expressão ou linha sem coluna: só a mensagem', () => {
    expect(formatarErroIntegracao(erro({ caminho: 'inicio', mensagem: 'valor invalido' }))).toBe('valor invalido')
    expect(formatarErroIntegracao(erro({ linha: 2, mensagem: 'JSON invalido' }))).toBe('JSON invalido')
  })

  it('com linha/coluna e caminho/expressão juntos, prevalece o formato de linha e coluna', () => {
    expect(
      formatarErroIntegracao(erro({ linha: 1, coluna: 5, caminho: 'x', expressao: '1 +', mensagem: 'expressao incompleta' })),
    ).toBe('Linha 1, coluna 5: expressao incompleta')
  })
})
