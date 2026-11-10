/**
 * Texto exibido para um erro da integração vindo do back-end (F5.7): 400 de `concluir`/`integracao` e
 * `POST /api/ped/integracao/validar`. As mensagens já vêm em português e são mostradas como vierem.
 */

import type { ErroIntegracao } from '../../types/dominio'

/**
 * - com `linha` e `coluna` → `Linha L, coluna C: <mensagem>` (prevalece);
 * - com `caminho` e `expressao` → `Campo "<caminho>": <mensagem> em "<expressao>"`;
 * - senão, só a mensagem.
 */
export function formatarErroIntegracao(erro: ErroIntegracao): string {
  if (erro.linha !== null && erro.coluna !== null) return `Linha ${erro.linha}, coluna ${erro.coluna}: ${erro.mensagem}`
  if (erro.caminho !== null && erro.expressao !== null) {
    return `Campo "${erro.caminho}": ${erro.mensagem} em "${erro.expressao}"`
  }
  return erro.mensagem
}
