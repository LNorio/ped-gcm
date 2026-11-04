/**
 * Normaliza o identificador da consulta (F5.5/F5.7 — RF-26, RF-28).
 *
 * O identificador aponta para o código da coleta no back-end, por isso só pode conter letras
 * A–Z, dígitos 0–9 e "_", em maiúsculas. Qualquer outro caractere (acentos, "ç", espaços,
 * pontuação, símbolos, emoji) é removido, sem transliteração. O filtro é aplicado antes da
 * conversão para maiúsculas para que letras como "ß" (que viraria "SS") sejam descartadas.
 *
 * A função é idempotente: aplicá-la sobre um resultado já limpo não o altera.
 */
export function limparIdentificador(texto: string): string {
  return texto.replace(/[^A-Za-z0-9_]/g, '').toUpperCase()
}
