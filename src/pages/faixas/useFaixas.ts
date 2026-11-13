/**
 * Hook da aba Faixas (F8.2–F8.4, F8.6, F8.7 — RF-41, RF-42, RF-44, RF-46): lista das tabelas de
 * faixas da filial do cabeçalho e da situação escolhida, e ações de cadastro, alteração (nova versão),
 * inativação/reativação e exclusão.
 *
 * Construído sobre `useConsulta`, que cuida da proteção de corrida, do `erro`/`carregando`/
 * `carregouUmaVez` e da recarga.
 *
 * Decisões:
 * - A filial vem do cabeçalho (`useSessao().filialSelecionada`): "todas" (ou sem filial) consulta sem
 *   filial; uma filial consulta `?filial={código}`. Trocar a filial consulta de novo.
 * - Situação (F8.7): `situacao` começa em `ativas` e vai sempre na query; trocar consulta de novo.
 * - Criar, alterar e inativar/reativar recarregam a lista depois de qualquer 2xx (regra "2xx = gravado": a resposta
 *   pode vir sem a tabela).
 * - Excluir (com o motivo obrigatório) remove o item da lista.
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useConsulta } from '../../hooks/useConsulta'
import {
  type AlteracaoFaixas,
  type FiltrosFaixas,
  alterarFaixas,
  alterarSituacaoTabelaFaixas,
  criarTabelaFaixas,
  excluirTabelaFaixas,
  listarTabelasFaixas,
} from '../../services/faixasService'
import { useSessao } from '../../sessao/SessaoProvider'
import type { NovaTabelaFaixas, TabelaFaixas } from '../../types/dominio'

const LISTA_VAZIA: TabelaFaixas[] = []

/** Filtro de situação da aba (F8.7). */
export type FiltroSituacaoFaixas = NonNullable<FiltrosFaixas['situacao']>

export interface UseFaixasResultado {
  tabelas: TabelaFaixas[]
  /** Código da filial consultada; `null` com "Todas as filiais". */
  codigoFilial: string | null
  /** Situação consultada (padrão `ativas`). */
  situacao: FiltroSituacaoFaixas
  setSituacao: (situacao: FiltroSituacaoFaixas) => void
  carregando: boolean
  carregouUmaVez: boolean
  erro: string | null
  recarregar: () => Promise<void>
  criar: (dados: NovaTabelaFaixas) => Promise<void>
  alterar: (id: number, dados: AlteracaoFaixas) => Promise<void>
  /** Inativa (`ativa: false`) ou reativa (`ativa: true`) com o motivo e recarrega a lista. */
  alterarSituacao: (id: number, ativa: boolean, motivo: string) => Promise<void>
  excluir: (id: number, motivo: string) => Promise<void>
}

export function useFaixas(): UseFaixasResultado {
  const { filialSelecionada } = useSessao()
  const codigoFilial = filialSelecionada === null || filialSelecionada === 'todas' ? null : filialSelecionada.codigo

  const [situacao, setSituacao] = useState<FiltroSituacaoFaixas>('ativas')

  const carregar = useCallback(
    () => listarTabelasFaixas(codigoFilial === null ? { situacao } : { filial: codigoFilial, situacao }),
    [codigoFilial, situacao],
  )
  const { dados, setDados, carregando, carregouUmaVez, erro, recarregar } = useConsulta<TabelaFaixas[]>(
    carregar,
    LISTA_VAZIA,
  )

  // Troca da filial do cabeçalho ou da situação: nova consulta (a carga inicial já é feita pelo
  // useConsulta, cujo efeito de atualização do `carregar` roda antes deste).
  const consultaRef = useRef({ codigoFilial, situacao })
  useEffect(() => {
    const anterior = consultaRef.current
    if (anterior.codigoFilial === codigoFilial && anterior.situacao === situacao) return
    consultaRef.current = { codigoFilial, situacao }
    void recarregar()
  }, [codigoFilial, situacao, recarregar])

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

  const alterarSituacao = useCallback(
    async (id: number, ativa: boolean, motivo: string) => {
      await alterarSituacaoTabelaFaixas(id, { ativa, motivo })
      void recarregar()
    },
    [recarregar],
  )

  const excluir = useCallback(
    async (id: number, motivo: string) => {
      await excluirTabelaFaixas(id, motivo)
      setDados((atuais) => atuais.filter((tabela) => tabela.id !== id))
    },
    [setDados],
  )

  return {
    tabelas: dados,
    codigoFilial,
    situacao,
    setSituacao,
    carregando,
    carregouUmaVez,
    erro,
    recarregar,
    criar,
    alterar,
    alterarSituacao,
    excluir,
  }
}
