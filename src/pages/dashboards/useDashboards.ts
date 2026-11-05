/**
 * Hook da aba Dashboards (F7.2, F7.7, F7.8 e F7.10 — RF-47, RF-55, RF-56, RF-58 e RF-59): lista
 * filtrada pela API (busca e situação) e ações de cadastro, edição, troca de situação, conclusão da
 * construção/modificação e exclusão.
 *
 * Construído sobre `useFiltrosConsulta`, que cuida da espera da busca, da proteção de corrida, do
 * `erro`/`carregando`/`carregouUmaVez` e da recarga com a consulta pendente.
 *
 * Decisões (mesmas regras das abas anteriores):
 * - Busca com espera de 500 ms; situação e limpar consultam na hora.
 * - Criar e editar recarregam a lista depois de qualquer 2xx (mesmo sem o dashboard na resposta).
 * - Alterar situação e concluir substituem (ou removem, se sair do filtro de situação) o item com a
 *   versão da API, sem nova consulta; 2xx sem o dashboard força `recarregar()`.
 * - Excluir remove o item da lista.
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useFiltrosConsulta } from '../../hooks/useFiltrosConsulta'
import {
  type ResultadoGravacaoDashboard,
  type SituacaoFiltroDashboard,
  alterarSituacaoDashboard,
  atualizarDashboard,
  concluirDashboard,
  criarDashboard,
  excluirDashboard,
  listarDashboards,
} from '../../services/dashboardsService'
import type { DadosDashboard, Dashboard } from '../../types/dominio'
import { type RegraSituacao, correspondeASituacao } from '../../utils/filtros'

export interface FiltrosTelaDashboards {
  busca: string
  situacao: SituacaoFiltroDashboard
}

export const FILTROS_PADRAO: Readonly<FiltrosTelaDashboards> = { busca: '', situacao: 'todas' }

/** Espera entre a última mudança da busca e a consulta. */
export const ATRASO_BUSCA_MS = 500

export interface UseDashboardsResultado {
  dashboards: Dashboard[]
  carregando: boolean
  /** `true` a partir da primeira resposta da consulta (sucesso ou erro). */
  carregouUmaVez: boolean
  erro: string | null
  filtros: FiltrosTelaDashboards
  setBusca: (busca: string) => void
  setSituacao: (situacao: SituacaoFiltroDashboard) => void
  limparFiltros: () => void
  /** Repete a consulta com os filtros atuais. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
  /** POST e recarga da lista depois de qualquer resposta 2xx. */
  criar: (dados: DadosDashboard) => Promise<ResultadoGravacaoDashboard>
  /** PUT e recarga da lista depois de qualquer resposta 2xx. */
  editar: (id: number, dados: DadosDashboard) => Promise<ResultadoGravacaoDashboard>
  /** PUT da situação e troca (ou remoção, se sair do filtro) do item; sem o item na resposta, recarrega. */
  alterarSituacao: (id: number, ativo: boolean) => Promise<Dashboard | null>
  /** PUT da conclusão e troca (ou remoção, se sair do filtro) do item; sem o item na resposta, recarrega. */
  concluir: (id: number) => Promise<Dashboard | null>
  /** DELETE e remoção do item da lista. */
  excluir: (id: number) => Promise<void>
}

const LISTA_INICIAL: Dashboard[] = []

/** Regras de correspondência ao filtro de situação (mesmas da API). */
const REGRAS_SITUACAO: Partial<Record<SituacaoFiltroDashboard, RegraSituacao<Dashboard>>> = {
  ativos: (dashboard) => dashboard.situacao === 'ativo',
  inativos: (dashboard) => dashboard.situacao === 'inativo',
  construcao: (dashboard) => dashboard.situacao === 'em_construcao' || dashboard.situacao === 'em_modificacao',
  problemas: (dashboard) => dashboard.situacao === 'ativo' && dashboard.alertas.length > 0,
}

function carregarDashboards(filtros: FiltrosTelaDashboards): Promise<Dashboard[]> {
  return listarDashboards({ busca: filtros.busca, situacao: filtros.situacao })
}

export function useDashboards(): UseDashboardsResultado {
  const { dados, setDados, carregando, carregouUmaVez, erro, filtros, setBusca, definirFiltro, limparFiltros, recarregar } =
    useFiltrosConsulta<FiltrosTelaDashboards, Dashboard[]>({
      carregar: carregarDashboards,
      inicial: LISTA_INICIAL,
      filtrosPadrao: FILTROS_PADRAO,
      atrasoBuscaMs: ATRASO_BUSCA_MS,
    })

  /** Filtro de situação atual, lido quando uma ação confirmada pela API atualiza a lista. */
  const situacaoRef = useRef(filtros.situacao)
  useEffect(() => {
    situacaoRef.current = filtros.situacao
  }, [filtros.situacao])

  const setSituacao = useCallback(
    (situacao: SituacaoFiltroDashboard) => definirFiltro('situacao', situacao),
    [definirFiltro],
  )

  /** Troca o item pela versão da API ou o remove, se ele saiu do filtro de situação. */
  const aplicarAtualizado = useCallback(
    (atualizado: Dashboard) => {
      const permanece = correspondeASituacao(situacaoRef.current, atualizado, REGRAS_SITUACAO)
      setDados((atual) =>
        permanece
          ? atual.map((d) => (d.id === atualizado.id ? atualizado : d))
          : atual.filter((d) => d.id !== atualizado.id),
      )
    },
    [setDados],
  )

  /** Aplica a resposta de uma ação com o item, ou recarrega quando a resposta não o traz. */
  const aplicarOuRecarregar = useCallback(
    async (atualizado: Dashboard | null): Promise<Dashboard | null> => {
      if (atualizado === null) await recarregar()
      else aplicarAtualizado(atualizado)
      return atualizado
    },
    [aplicarAtualizado, recarregar],
  )

  const criar = useCallback(
    async (dadosNovos: DadosDashboard): Promise<ResultadoGravacaoDashboard> => {
      const resultado = await criarDashboard(dadosNovos)
      await recarregar()
      return resultado
    },
    [recarregar],
  )

  const editar = useCallback(
    async (id: number, dadosEdicao: DadosDashboard): Promise<ResultadoGravacaoDashboard> => {
      const resultado = await atualizarDashboard(id, dadosEdicao)
      await recarregar()
      return resultado
    },
    [recarregar],
  )

  const alterarSituacao = useCallback(
    async (id: number, ativo: boolean): Promise<Dashboard | null> =>
      aplicarOuRecarregar(await alterarSituacaoDashboard(id, ativo)),
    [aplicarOuRecarregar],
  )

  const concluir = useCallback(
    async (id: number): Promise<Dashboard | null> => aplicarOuRecarregar(await concluirDashboard(id)),
    [aplicarOuRecarregar],
  )

  const excluir = useCallback(
    async (id: number): Promise<void> => {
      await excluirDashboard(id)
      setDados((atual) => atual.filter((d) => d.id !== id))
    },
    [setDados],
  )

  return {
    dashboards: dados,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    limparFiltros,
    recarregar,
    criar,
    editar,
    alterarSituacao,
    concluir,
    excluir,
  }
}
