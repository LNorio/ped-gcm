/**
 * Hook de permissões por perfil (F2.6 — RF-04, RF-16; ações na F1.13).
 *
 * Lê o perfil da sessão atual (`useSessao`) e expõe a matriz de `permissoes.ts`:
 * `abas` para montar o menu, `pode(aba)` para proteger rotas e `podeAcao(acao)` para exibir ou
 * ocultar ações sensíveis (exclusão, alteração de situação).
 */
import { useCallback, useMemo } from 'react'
import { abasVisiveis, podeAcessar, podeExecutar, type AcaoPermissao, type Aba } from './permissoes'
import { useSessao } from './SessaoProvider'

export interface Permissoes {
  /** Abas visíveis para o perfil atual, na ordem do menu. */
  abas: Aba[]
  /** Indica se o perfil atual pode acessar a aba. */
  pode: (aba: Aba) => boolean
  /** Indica se o perfil atual pode executar a ação. */
  podeAcao: (acao: AcaoPermissao) => boolean
}

export function usePermissoes(): Permissoes {
  const { acesso } = useSessao()
  const perfil = acesso?.perfil ?? null

  const abas = useMemo(() => abasVisiveis(perfil), [perfil])
  const pode = useCallback((aba: Aba) => podeAcessar(perfil, aba), [perfil])
  const podeAcao = useCallback((acao: AcaoPermissao) => podeExecutar(perfil, acao), [perfil])

  return { abas, pode, podeAcao }
}
