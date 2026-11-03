/**
 * Hook de permissões por perfil (F2.6 — RF-04, RF-16).
 *
 * Lê o perfil da sessão atual (`useSessao`) e expõe a matriz de `permissoes.ts`:
 * `abas` para montar o menu e `pode(aba)` para proteger rotas e ações.
 */
import { useCallback, useMemo } from 'react'
import { abasVisiveis, podeAcessar, type Aba } from './permissoes'
import { useSessao } from './SessaoProvider'

export interface Permissoes {
  /** Abas visíveis para o perfil atual, na ordem do menu. */
  abas: Aba[]
  /** Indica se o perfil atual pode acessar a aba. */
  pode: (aba: Aba) => boolean
}

export function usePermissoes(): Permissoes {
  const { acesso } = useSessao()
  const perfil = acesso?.perfil ?? null

  const abas = useMemo(() => abasVisiveis(perfil), [perfil])
  const pode = useCallback((aba: Aba) => podeAcessar(perfil, aba), [perfil])

  return { abas, pode }
}
