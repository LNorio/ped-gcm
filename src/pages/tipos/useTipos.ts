/**
 * Hook de estado da listagem de tipos de apontamento (F3.2 — RF-12; F3.3 — RF-16; F3.4 — RF-14;
 * F3.5 — RF-15).
 *
 * Construído sobre `useConsulta` (F1.13), com a mesma configuração do `useListagem` (F1.12) e expondo
 * também `carregouUmaVez`: carrega a lista ao montar e expõe `recarregar()`
 * (tentar novamente), `criar(dados)`, `atualizar(id, dados)` e `excluir(id)`. Não decide regras de
 * negócio: as ações chamam a API e repassam a recusa (`ApiError`) à tela, sem alterar a lista.
 * - Criar recarrega a lista depois de qualquer 2xx.
 * - Atualizar substitui o item, na mesma posição, pela versão da API; 2xx sem o tipo recarrega.
 * - Excluir remove o item da lista.
 */
import { useCallback } from 'react'
import { useConsulta } from '../../hooks/useConsulta'
import {
  type AtualizacaoTipo,
  type NovoTipo,
  atualizarTipo,
  criarTipo,
  excluirTipo,
  listarTipos,
} from '../../services/tiposService'
import type { TipoApontamento } from '../../types/dominio'

export interface UseTiposResultado {
  tipos: TipoApontamento[]
  /** `true` no carregamento inicial e durante `recarregar()`. */
  carregando: boolean
  /**
   * `true` a partir da primeira resposta (sucesso ou erro). Permite manter a tabela visível durante
   * recargas (ex.: depois de cadastrar), sem desmontar as linhas e o gatilho que recebe o foco de volta.
   */
  carregouUmaVez: boolean
  /** Mensagem do último erro de carga; `null` após uma carga bem-sucedida. */
  erro: string | null
  /** Chama a API de novo. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
  /**
   * Exclui o tipo na API e, com sucesso, o remove da lista local (prevalecendo sobre cargas pendentes).
   * Em falha rejeita com a `ApiError` original, sem alterar `tipos` nem `erro`.
   */
  excluir: (id: number) => Promise<void>
  /** POST e recarga da lista depois de qualquer 2xx. Em falha rejeita com a `ApiError` original. */
  criar: (dados: NovoTipo) => Promise<void>
  /**
   * PUT só com as listas informadas; com o tipo na resposta, troca o item na mesma posição; sem ele,
   * recarrega. Em falha rejeita com a `ApiError` original, sem alterar a lista.
   */
  atualizar: (id: number, dados: AtualizacaoTipo) => Promise<void>
}

const OPCOES_CONSULTA = { recarregarAposMutacao: false } as const
const SEM_TIPOS: TipoApontamento[] = []

export function useTipos(): UseTiposResultado {
  const {
    dados: tipos,
    carregando,
    carregouUmaVez,
    erro,
    recarregar,
    setDados: setItens,
  } = useConsulta<TipoApontamento[]>(listarTipos, SEM_TIPOS, OPCOES_CONSULTA)

  const excluir = useCallback(
    async (id: number): Promise<void> => {
      await excluirTipo(id)
      setItens((atual) => atual.filter((tipo) => tipo.id !== id))
    },
    [setItens],
  )

  const criar = useCallback(
    async (dados: NovoTipo): Promise<void> => {
      await criarTipo(dados)
      await recarregar()
    },
    [recarregar],
  )

  const atualizar = useCallback(
    async (id: number, dados: AtualizacaoTipo): Promise<void> => {
      const atualizado = await atualizarTipo(id, dados)
      if (atualizado === null) {
        await recarregar()
        return
      }
      setItens((atual) => atual.map((tipo) => (tipo.id === id ? atualizado : tipo)))
    },
    [recarregar, setItens],
  )

  return { tipos, carregando, carregouUmaVez, erro, recarregar, excluir, criar, atualizar }
}
