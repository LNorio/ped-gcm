/**
 * Título do documento por tela (F12.1 — RNF-05, M5): "{título} · PED" (ex.: "Tipos · PED",
 * "Entrar · PED"). Com `null`, o título não é alterado (outra tela define o seu).
 *
 * O título não é restaurado ao desmontar: a próxima tela define o próprio, sem voltar por um instante
 * ao título anterior.
 */
import { useEffect } from 'react'

/** Sufixo comum aos títulos das telas. */
export const SUFIXO_TITULO = ' · PED'

/** Monta o título do documento de uma tela. */
export function tituloDocumento(titulo: string): string {
  return `${titulo}${SUFIXO_TITULO}`
}

export function useTituloDocumento(titulo: string | null) {
  useEffect(() => {
    if (titulo) document.title = tituloDocumento(titulo)
  }, [titulo])
}
