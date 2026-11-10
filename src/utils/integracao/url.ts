/** Tamanho máximo da URL da integração aceito pelo back-end (contado após o `trim`). */
export const TAMANHO_MAXIMO_URL = 500

/**
 * URL da integração de dados externos (F5.14).
 *
 * Aceita quando, sem os espaços das pontas, começa com `http://` ou `https://`, tem algo depois do
 * esquema, não contém espaços (nem tabulações ou quebras de linha) no meio e tem no máximo
 * `TAMANHO_MAXIMO_URL` (500) caracteres — limite do back-end (500 aceita, 501 recusa).
 */
export function urlValida(texto: string): boolean {
  const url = texto.trim()
  return url.length <= TAMANHO_MAXIMO_URL && /^https?:\/\/\S+$/.test(url)
}
