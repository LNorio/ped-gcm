/**
 * Hook da aba Indicadores (F6.2–F6.7): lista filtrada pela API (busca e situação), alertas da aba e
 * ações de cadastro, definição de meta, troca de situação e exclusão.
 *
 * Construído sobre `useFiltrosConsulta`, que cuida da espera da busca, da proteção de corrida, do
 * `erro`/`carregando`/`carregouUmaVez` e da recarga com a consulta pendente.
 *
 * Decisões (mesmas regras das abas Apontamentos e Dados Externos):
 * - Busca com espera de 500 ms; situação e limpar consultam na hora.
 * - Definir meta, alterar situação e excluir substituem, removem ou mantêm o item localmente, conforme
 *   o filtro de situação (sem nova consulta). Resposta 2xx sem o indicador força `recarregar()`.
 * - Alertas ajustados localmente pela diferença entre o item antes e depois da ação: "aguardando meta"
 *   conta indicadores ativos com meta a definir; "com componente desativado", ativos com componentes
 *   desativados. Se o item não está na lista, os alertas não são ajustados (a próxima consulta corrige).
 * - Criar recarrega a lista depois de qualquer 2xx (mesmo sem indicador na resposta).
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useFiltrosConsulta } from '../../hooks/useFiltrosConsulta'
import {
  type AlertasIndicadores,
  type DadosMeta,
  type FiltrosIndicadores,
  type ResultadoListagemIndicadores,
  type ResultadoSituacaoIndicador,
  type SituacaoFiltroIndicador,
  alterarSituacaoIndicador,
  criarIndicador,
  definirMeta as definirMetaIndicador,
  excluirIndicador,
  listarIndicadores,
} from '../../services/indicadoresService'
import type { Indicador, NovoIndicador } from '../../types/dominio'
import { type RegraSituacao, correspondeASituacao } from '../../utils/filtros'

export interface FiltrosTelaIndicadores {
  busca: string
  situacao: SituacaoFiltroIndicador
}

export const FILTROS_PADRAO: Readonly<FiltrosTelaIndicadores> = { busca: '', situacao: 'todas' }

/** Espera entre a última mudança da busca e a consulta. */
export const ATRASO_BUSCA_MS = 500

export interface UseIndicadoresResultado {
  indicadores: Indicador[]
  /** Alertas da aba; contam só indicadores ativos e não mudam com o filtro. */
  alertas: AlertasIndicadores
  carregando: boolean
  /** `true` a partir da primeira resposta da consulta (sucesso ou erro). */
  carregouUmaVez: boolean
  erro: string | null
  filtros: FiltrosTelaIndicadores
  setBusca: (busca: string) => void
  setSituacao: (situacao: SituacaoFiltroIndicador) => void
  limparFiltros: () => void
  /** Repete a consulta com os filtros atuais. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
  /** POST e recarga da lista depois de qualquer resposta 2xx; resolve com o indicador criado ou `null`. */
  criar: (dados: NovoIndicador) => Promise<Indicador | null>
  /** PUT da meta e troca do item (ou remoção, se sair do filtro), sem nova consulta. */
  definirMeta: (id: number, dados: DadosMeta) => Promise<Indicador | null>
  /** PUT da situação e troca (ou remoção, se sair do filtro) do item, sem nova consulta. */
  alterarSituacao: (id: number, ativo: boolean) => Promise<ResultadoSituacaoIndicador>
  /** DELETE e remoção do item da lista. */
  excluir: (id: number) => Promise<void>
}

const ALERTAS_ZERADOS: AlertasIndicadores = { aguardandoMeta: 0, comComponenteDesativado: 0 }
const RESULTADO_INICIAL: ResultadoListagemIndicadores = { indicadores: [], alertas: ALERTAS_ZERADOS }

/** Regras de correspondência ao filtro de situação (mesmas da API). */
const REGRAS_SITUACAO: Partial<Record<SituacaoFiltroIndicador, RegraSituacao<Indicador>>> = {
  ativos: (indicador) => indicador.ativo,
  inativos: (indicador) => !indicador.ativo,
  meta: (indicador) => indicador.ativo && indicador.metaADefinir,
  problemas: (indicador) => indicador.ativo && indicador.problema !== null,
}

function carregarIndicadores(filtros: FiltrosTelaIndicadores): Promise<ResultadoListagemIndicadores> {
  const consulta: FiltrosIndicadores = { busca: filtros.busca, situacao: filtros.situacao }
  return listarIndicadores(consulta)
}

/** Quanto o indicador contribui para cada alerta da aba. */
function contribuicaoAlertas(indicador: Indicador): AlertasIndicadores {
  return {
    aguardandoMeta: indicador.ativo && indicador.metaADefinir ? 1 : 0,
    comComponenteDesativado: indicador.ativo && indicador.componentesDesativados ? 1 : 0,
  }
}

/**
 * Ajusta os alertas trocando a contribuição de `antes` pela de `depois` (sem `depois` = removido).
 * Sem `antes` na lista, os alertas ficam como estão: não há como saber a contribuição anterior.
 */
function ajustarAlertas(alertas: AlertasIndicadores, antes: Indicador | undefined, depois: Indicador | undefined): AlertasIndicadores {
  if (antes === undefined) return alertas
  const saiu = contribuicaoAlertas(antes)
  const entrou = depois ? contribuicaoAlertas(depois) : ALERTAS_ZERADOS
  return {
    aguardandoMeta: Math.max(0, alertas.aguardandoMeta - saiu.aguardandoMeta + entrou.aguardandoMeta),
    comComponenteDesativado: Math.max(0, alertas.comComponenteDesativado - saiu.comComponenteDesativado + entrou.comComponenteDesativado),
  }
}

export function useIndicadores(): UseIndicadoresResultado {
  const { dados, setDados, carregando, carregouUmaVez, erro, filtros, setBusca, definirFiltro, limparFiltros, recarregar } =
    useFiltrosConsulta<FiltrosTelaIndicadores, ResultadoListagemIndicadores>({
      carregar: carregarIndicadores,
      inicial: RESULTADO_INICIAL,
      filtrosPadrao: FILTROS_PADRAO,
      atrasoBuscaMs: ATRASO_BUSCA_MS,
    })

  /** Filtro de situação atual, lido quando uma ação confirmada pela API atualiza a lista. */
  const situacaoRef = useRef(filtros.situacao)
  useEffect(() => {
    situacaoRef.current = filtros.situacao
  }, [filtros.situacao])

  const setSituacao = useCallback(
    (situacao: SituacaoFiltroIndicador) => definirFiltro('situacao', situacao),
    [definirFiltro],
  )

  /**
   * Troca o item pela versão confirmada pela API (ou o remove, se ele saiu do filtro de situação) e
   * ajusta os alertas. Usa função atualizadora, então lê sempre o estado atual da lista.
   */
  const aplicarAtualizado = useCallback(
    (atualizado: Indicador) => {
      const situacao = situacaoRef.current
      setDados((atual) => {
        const antes = atual.indicadores.find((i) => i.id === atualizado.id)
        const permaneceNoFiltro = correspondeASituacao(situacao, atualizado, REGRAS_SITUACAO)
        const indicadores = permaneceNoFiltro
          ? atual.indicadores.map((i) => (i.id === atualizado.id ? atualizado : i))
          : atual.indicadores.filter((i) => i.id !== atualizado.id)
        return {
          indicadores,
          alertas: ajustarAlertas(atual.alertas, antes, atualizado),
        }
      })
    },
    [setDados],
  )

  const criar = useCallback(
    async (dadosNovos: NovoIndicador): Promise<Indicador | null> => {
      const criado = await criarIndicador(dadosNovos)
      await recarregar()
      return criado
    },
    [recarregar],
  )

  const definirMeta = useCallback(
    async (id: number, dadosMeta: DadosMeta): Promise<Indicador | null> => {
      const atualizado = await definirMetaIndicador(id, dadosMeta)
      if (atualizado === null) {
        await recarregar()
      } else {
        aplicarAtualizado(atualizado)
      }
      return atualizado
    },
    [aplicarAtualizado, recarregar],
  )

  const alterarSituacao = useCallback(
    async (id: number, ativo: boolean): Promise<ResultadoSituacaoIndicador> => {
      const resultado = await alterarSituacaoIndicador(id, ativo)
      if (resultado.indicador === null) {
        await recarregar()
      } else {
        aplicarAtualizado(resultado.indicador)
      }
      return resultado
    },
    [aplicarAtualizado, recarregar],
  )

  const excluir = useCallback(
    async (id: number): Promise<void> => {
      await excluirIndicador(id)
      setDados((atual) => {
        const antes = atual.indicadores.find((i) => i.id === id)
        return {
          indicadores: atual.indicadores.filter((i) => i.id !== id),
          alertas: ajustarAlertas(atual.alertas, antes, undefined),
        }
      })
    },
    [setDados],
  )

  return {
    indicadores: dados.indicadores,
    alertas: dados.alertas,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    limparFiltros,
    recarregar,
    criar,
    definirMeta,
    alterarSituacao,
    excluir,
  }
}
