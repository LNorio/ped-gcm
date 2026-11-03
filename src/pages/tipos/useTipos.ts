/**
 * Hook de estado da listagem de tipos de apontamento (F3.2 — RF-12; F3.3 — RF-16).
 *
 * Construído sobre `useListagem` (F1.12): carrega a lista ao montar e expõe `recarregar()`
 * (tentar novamente) e `excluir(id)`. Não decide regras de negócio: a exclusão chama a API e
 * repassa a recusa (`ApiError`) à tela.
 */
import { useCallback } from 'react'
import { useListagem } from '../../hooks/useListagem'
import { excluirTipo, listarTipos } from '../../services/tiposService'
import type { TipoApontamento } from '../../types/dominio'

export interface UseTiposResultado {
  tipos: TipoApontamento[]
  /** `true` no carregamento inicial e durante `recarregar()`. */
  carregando: boolean
  /** Mensagem do último erro de carga; `null` após uma carga bem-sucedida. */
  erro: string | null
  /** Chama a API de novo. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
  /**
   * Exclui o tipo na API e, com sucesso, o remove da lista local (prevalecendo sobre cargas pendentes).
   * Em falha rejeita com a `ApiError` original, sem alterar `tipos` nem `erro`.
   */
  excluir: (id: number) => Promise<void>
}

export function useTipos(): UseTiposResultado {
  const { itens: tipos, carregando, erro, recarregar, setItens } = useListagem<TipoApontamento>(listarTipos)

  const excluir = useCallback(
    async (id: number): Promise<void> => {
      await excluirTipo(id)
      setItens((atual) => atual.filter((tipo) => tipo.id !== id))
    },
    [setItens],
  )

  return { tipos, carregando, erro, recarregar, excluir }
}
