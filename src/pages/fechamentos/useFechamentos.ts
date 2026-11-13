/**
 * Hook da aba Fechamentos (F10.2 — RF-78, RF-79, RN-16, RN-17): lista dos dashboards ativos com o
 * período atual, filtrada pela API (periodicidade, situação do período e busca).
 *
 * Construído sobre `useFiltrosConsulta`, que cuida da espera da busca, da proteção de corrida, do
 * `erro`/`carregando`/`carregouUmaVez` e da recarga com a consulta pendente.
 *
 * Decisões:
 * - Busca com espera de 500 ms; periodicidade, situação e limpar consultam na hora.
 * - "todas" e busca vazia ficam fora da query (regra do `listarFechamentos`).
 * - A consulta não envia filial: Admin e Validador veem todos os dashboards (A-05).
 * - A lista é ordenada por periodicidade (ordem de `PERIODICIDADES`) e nome, mesmo que a API devolva
 *   fora de ordem.
 */
import { useCallback } from 'react'
import { useFiltrosConsulta } from '../../hooks/useFiltrosConsulta'
import { listarFechamentos } from '../../services/fechamentosService'
import { type Fechamento, PERIODICIDADES, type Periodicidade, type SituacaoPeriodo } from '../../types/dominio'

export type PeriodicidadeFiltroFechamento = Periodicidade | 'todas'
export type SituacaoFiltroFechamento = SituacaoPeriodo | 'todas'

export interface FiltrosTelaFechamentos {
  busca: string
  periodicidade: PeriodicidadeFiltroFechamento
  situacao: SituacaoFiltroFechamento
}

export const FILTROS_PADRAO: Readonly<FiltrosTelaFechamentos> = { busca: '', periodicidade: 'todas', situacao: 'todas' }

/** Espera entre a última mudança da busca e a consulta. */
export const ATRASO_BUSCA_MS = 500

export interface UseFechamentosResultado {
  fechamentos: Fechamento[]
  carregando: boolean
  /** `true` a partir da primeira resposta da consulta (sucesso ou erro). */
  carregouUmaVez: boolean
  erro: string | null
  filtros: FiltrosTelaFechamentos
  setBusca: (busca: string) => void
  setPeriodicidade: (periodicidade: PeriodicidadeFiltroFechamento) => void
  setSituacao: (situacao: SituacaoFiltroFechamento) => void
  limparFiltros: () => void
  /** Repete a consulta com os filtros atuais. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
}

const LISTA_INICIAL: Fechamento[] = []

const comparadorNome = new Intl.Collator('pt-BR', { sensitivity: 'base' })

function ordenar(fechamentos: Fechamento[]): Fechamento[] {
  return [...fechamentos].sort(
    (a, b) =>
      PERIODICIDADES.indexOf(a.periodicidade) - PERIODICIDADES.indexOf(b.periodicidade) ||
      comparadorNome.compare(a.nome, b.nome),
  )
}

async function carregarFechamentos(filtros: FiltrosTelaFechamentos): Promise<Fechamento[]> {
  const lista = await listarFechamentos({
    busca: filtros.busca,
    periodicidade: filtros.periodicidade,
    situacao: filtros.situacao,
  })
  return ordenar(lista)
}

export function useFechamentos(): UseFechamentosResultado {
  const { dados, carregando, carregouUmaVez, erro, filtros, setBusca, definirFiltro, limparFiltros, recarregar } =
    useFiltrosConsulta<FiltrosTelaFechamentos, Fechamento[]>({
      carregar: carregarFechamentos,
      inicial: LISTA_INICIAL,
      filtrosPadrao: FILTROS_PADRAO,
      atrasoBuscaMs: ATRASO_BUSCA_MS,
    })

  const setPeriodicidade = useCallback(
    (periodicidade: PeriodicidadeFiltroFechamento) => definirFiltro('periodicidade', periodicidade),
    [definirFiltro],
  )

  const setSituacao = useCallback(
    (situacao: SituacaoFiltroFechamento) => definirFiltro('situacao', situacao),
    [definirFiltro],
  )

  return {
    fechamentos: dados,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setPeriodicidade,
    setSituacao,
    limparFiltros,
    recarregar,
  }
}
