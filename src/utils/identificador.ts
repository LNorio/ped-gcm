/**
 * Normaliza o identificador da consulta (F5.5/F5.7 — RF-26, RF-28).
 *
 * O identificador aponta para o código da coleta no back-end, que aceita só letras sem acento,
 * números, "_", "-" e "." (sem espaços — `FRONT-PED-mudancas.md`, item 7). Por isso só são mantidos
 * A–Z, 0–9, "_", "-" e ".", em maiúsculas. Qualquer outro caractere (acentos, "ç", espaços, demais
 * pontuações, símbolos, emoji) é removido, sem transliteração. O filtro é aplicado antes da
 * conversão para maiúsculas para que letras como "ß" (que viraria "SS") sejam descartadas.
 *
 * Ex.: `"fat.liq/2026!@#$%&*()+=-"` → `"FAT.LIQ2026-"`.
 *
 * A função é idempotente: aplicá-la sobre um resultado já limpo não o altera.
 */
export function limparIdentificador(texto: string): string {
  return texto.replace(/[^A-Za-z0-9_.-]/g, '').toUpperCase()
}
