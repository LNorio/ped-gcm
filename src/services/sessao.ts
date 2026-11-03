/**
 * Sessão do usuário: guarda o token de acesso usado pelo cliente HTTP (`api.ts`).
 *
 * Nesta fase o token fica apenas em memória (escopo do módulo). A persistência em
 * storage e a restauração ao recarregar a página ficam para a fase de autenticação (F2).
 */

let tokenAtual: string | null = null

/** Devolve o token da sessão atual ou `null` quando não há usuário autenticado. */
export function obterToken(): string | null {
  return tokenAtual
}

/** Define (ou substitui) o token da sessão atual. */
export function definirToken(token: string): void {
  tokenAtual = token
}

/** Descarta o token da sessão. Pode ser chamada mesmo sem token definido. */
export function limparToken(): void {
  tokenAtual = null
}
