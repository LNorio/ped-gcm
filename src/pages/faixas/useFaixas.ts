/**
 * Hook da aba Faixas (F8.2–F8.4, F8.6 — RF-41, RF-42, RF-44, RF-46): lista das tabelas de faixas da
 * filial do cabeçalho e ações de cadastro, alteração (nova versão) e exclusão.
 *
 * Construído sobre `useConsulta`, que cuida da proteção de corrida, do `erro`/`carregando`/
 * `carregouUmaVez` e da recarga.
 *
 * Decisões:
 * - A filial vem do cabeçalho (`useSessao().filialSelecionada`): "todas" (ou sem filial) consulta sem
 *   query; uma filial consulta `?filial={código}`. Trocar a filial consulta de novo.
 * - Criar e alterar recarregam a lista depois de qualquer 2xx (regra "2xx = gravado": a resposta
 *   pode vir sem a tabela).
 * - Excluir remove o item da lista.
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useConsulta } from '../../hooks/useConsulta'
import {
  type AlteracaoFaixas,
  alterarFaixas,
  criarTabelaFaixas,
  excluirTabelaFaixas,
  listarTabelasFaixas,
} from '../../services/faixasService'
import { useSessao } from '../../sessao/SessaoProvider'
import type { NovaTabelaFaixas, TabelaFaixas } from '../../types/dominio'

const LISTA_VAZIA: TabelaFaixas[] = []

export interface UseFaixasResultado {
  tabelas: TabelaFaixas[]
  /** Código da filial consultada; `null` com "Todas as filiais". */
  codigoFilial: string | null
  carregando: boolean
  carregouUmaVez: boolean
  erro: string | null
  recarregar: () => Promise<void>
  criar: (dados: NovaTabelaFaixas) => Promise<void>
  alterar: (id: number, dados: AlteracaoFaixas) => Promise<void>
  excluir: (id: number) => Promise<void>
}

export function useFaixas(): UseFaixasResultado {
  const { filialSelecionada } = useSessao()
  const codigoFilial = filialSelecionada === null || filialSelecionada === 'todas' ? null : filialSelecionada.codigo

  const carregar = useCallback(
    () => listarTabelasFaixas(codigoFilial === null ? {} : { filial: codigoFilial }),
    [codigoFilial],
  )
  const { dados, setDados, carregando, carregouUmaVez, erro, recarregar } = useConsulta<TabelaFaixas[]>(
    carregar,
    LISTA_VAZIA,
  )

  // Troca da filial do cabeçalho: nova consulta (a carga inicial já é feita pelo useConsulta, cujo
  // efeito de atualização do `carregar` roda antes deste).
  const filialConsultadaRef = useRef(codigoFilial)
  useEffect(() => {
    if (filialConsultadaRef.current === codigoFilial) return
    filialConsultadaRef.current = codigoFilial
    void recarregar()
  }, [codigoFilial, recarregar])

  const criar = useCallback(
    async (novos: NovaTabelaFaixas) => {
      await criarTabelaFaixas(novos)
      void recarregar()
    },
    [recarregar],
  )

  const alterar = useCallback(
    async (id: number, alteracao: AlteracaoFaixas) => {
      await alterarFaixas(id, alteracao)
      void recarregar()
    },
    [recarregar],
  )

  const excluir = useCallback(
    async (id: number) => {
      await excluirTabelaFaixas(id)
      setDados((atuais) => atuais.filter((tabela) => tabela.id !== id))
    },
    [setDados],
  )

  return { tabelas: dados, codigoFilial, carregando, carregouUmaVez, erro, recarregar, criar, alterar, excluir }
}
