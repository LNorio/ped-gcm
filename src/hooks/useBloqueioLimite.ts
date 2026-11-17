/**
 * Bloqueio temporário pelo limite de uso do back-end (`429`), usado pela exportação e pelo PDF das
 * imagens (F10.10).
 *
 * - `registrarFalha(falha)`: se for `ApiError` 429, bloqueia por `tentarNovamenteEm` segundos (ou
 *   `SEGUNDOS_BLOQUEIO_PADRAO`, se a API não informar) e devolve `true`; outros erros não bloqueiam.
 * - Ao fim da espera, `bloqueado` volta a `false`; nada é repetido automaticamente.
 * - O temporizador é limpo ao desmontar e substituído por um novo 429.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, SEGUNDOS_BLOQUEIO_PADRAO } from '../services/api'

export interface UseBloqueioLimiteResultado {
  bloqueado: boolean
  registrarFalha: (falha: unknown) => boolean
}

export function useBloqueioLimite(): UseBloqueioLimiteResultado {
  const [bloqueado, setBloqueado] = useState(false)
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (temporizadorRef.current !== null) clearTimeout(temporizadorRef.current)
    },
    [],
  )

  const registrarFalha = useCallback((falha: unknown) => {
    if (!(falha instanceof ApiError) || falha.status !== 429) return false
    const segundos = falha.tentarNovamenteEm ?? SEGUNDOS_BLOQUEIO_PADRAO
    if (temporizadorRef.current !== null) clearTimeout(temporizadorRef.current)
    setBloqueado(true)
    temporizadorRef.current = setTimeout(() => {
      temporizadorRef.current = null
      setBloqueado(false)
    }, segundos * 1000)
    return true
  }, [])

  return { bloqueado, registrarFalha }
}
