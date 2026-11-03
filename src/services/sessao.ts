/**
 * Sessão do usuário: guarda o token de acesso usado pelo cliente HTTP (`api.ts`).
 *
 * O token fica em memória (escopo do módulo) e é persistido em `sessionStorage` para sobreviver à
 * recarga da página, mas não ao fechamento da aba (RF-04). Nunca usa `localStorage`.
 * Os acessos ao storage são protegidos: se ele estiver indisponível (modo privado, política do
 * navegador), a sessão continua funcionando só em memória.
 */

/** Chave usada no `sessionStorage` para o token da sessão. */
export const CHAVE_TOKEN = 'ped.token'

let tokenAtual: string | null = null

function lerDoStorage(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

function gravarNoStorage(token: string): void {
  try {
    sessionStorage.setItem(CHAVE_TOKEN, token)
  } catch {
    // Storage indisponível: o token permanece apenas em memória.
  }
}

function removerDoStorage(): void {
  try {
    sessionStorage.removeItem(CHAVE_TOKEN)
  } catch {
    // Storage indisponível: nada a remover.
  }
}

/**
 * Devolve o token da sessão atual ou `null` quando não há usuário autenticado.
 * Com a memória vazia (recarga da página), restaura o token gravado no `sessionStorage`.
 */
export function obterToken(): string | null {
  if (tokenAtual !== null) return tokenAtual
  const salvo = lerDoStorage()
  if (salvo !== null && salvo !== '') tokenAtual = salvo
  return tokenAtual
}

/** Define (ou substitui) o token da sessão atual, em memória e no `sessionStorage`. */
export function definirToken(token: string): void {
  tokenAtual = token
  gravarNoStorage(token)
}

/** Descarta o token da sessão (memória e `sessionStorage`). Pode ser chamada mesmo sem token definido. */
export function limparToken(): void {
  tokenAtual = null
  removerDoStorage()
}
