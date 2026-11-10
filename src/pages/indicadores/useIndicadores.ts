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
 *   desativados; "meta pendente por filial" (F6.10), ativos com alguma filial em `filiaisSemMeta`;
 *   "integração pendente" (F6.11, só quando a API o informa), ativos com `integracao.pendente`. Se o
 *   item não está na lista, os alertas não são ajustados (a próxima consulta corrige).
 * - Meta via API (F6.11): `definirMeta` com `origemDaMeta: 'terceiro'` e `atualizarIntegracao` recarregam
 *   a lista depois do PUT (a pendência da integração e seu alerta vêm da API).
 * - Criar e "Definir metas pendentes" (F6.12) recarregam a lista depois de qualquer 2xx (mesmo sem
 *   indicador na resposta); as filiais sem meta e os alertas vêm da API.
 * - Filtro "Meta pendente por filial" (F6.10, `meta_filial_pendente`): ativos com alguma filial em
 *   `filiaisSemMeta`, mesma regra local das demais situações.
 * - Contrato final da meta via API (F6.11): `metaViaApi` vem do topo da última listagem; o filtro
 *   "Integração pendente (TI)" (`integracao_pendente`, só Admin) e o alerta de integração pendente usam
 *   a mesma regra: fonte `integracao` com a situação `integracao_pendente` (sem a situação, vale
 *   `integracao.pendente`).
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useFiltrosConsulta } from '../../hooks/useFiltrosConsulta'
import {
  type AlertasIndicadores,
  type DadosMeta,
  type FiltrosIndicadores,
  type MetaViaApiDisponivel,
  type ResultadoListagemIndicadores,
  type ResultadoMetasPendentes,
  type ResultadoSituacaoIndicador,
  type SituacaoFiltroIndicador,
  alterarSituacaoIndicador,
  criarIndicador,
  atualizarIntegracaoIndicador,
  definirMeta as definirMetaIndicador,
  definirMetasPendentes as definirMetasPendentesIndicador,
  excluirIndicador,
  listarIndicadores,
} from '../../services/indicadoresService'
import type { Indicador, IntegracaoDadoExterno, MetaDaFilial, NovoIndicador } from '../../types/dominio'
import { type RegraSituacao, correspondeASituacao } from '../../utils/filtros'
import { integracaoDaMetaPendente } from '../../utils/metaViaApi'

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
  /**
   * F6.11: disponibilidade da meta via API por fonte (topo `"meta via api"` da última listagem); `null`
   * antes da primeira resposta ou quando a API não traz o campo.
   */
  metaViaApi: MetaViaApiDisponivel | null
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
  /**
   * F6.11: PUT da integração da meta via API e recarga da lista com os filtros atuais. Falha rejeita
   * com a `ApiError` original, sem recarregar nem alterar o `erro` de carga.
   */
  atualizarIntegracao: (id: number, integracao: IntegracaoDadoExterno) => Promise<void>
  /**
   * F6.12: PUT das metas das filiais pendentes e recarga da lista com os filtros atuais depois de
   * qualquer 2xx. Falha rejeita com a `ApiError` original, sem recarregar nem alterar o `erro` de carga.
   */
  definirMetasPendentes: (id: number, metas: MetaDaFilial[]) => Promise<ResultadoMetasPendentes>
}

const ALERTAS_ZERADOS: AlertasIndicadores = { aguardandoMeta: 0, comComponenteDesativado: 0, metaPendentePorFilial: 0 }
const RESULTADO_INICIAL: ResultadoListagemIndicadores = { indicadores: [], alertas: ALERTAS_ZERADOS }

/** Regras de correspondência ao filtro de situação (mesmas da API). */
const REGRAS_SITUACAO: Partial<Record<SituacaoFiltroIndicador, RegraSituacao<Indicador>>> = {
  ativos: (indicador) => indicador.ativo,
  inativos: (indicador) => !indicador.ativo,
  meta: (indicador) => indicador.ativo && indicador.metaADefinir,
  meta_filial_pendente: (indicador) => indicador.ativo && indicador.filiaisSemMeta.length > 0,
  problemas: (indicador) => indicador.ativo && indicador.problema !== null,
  integracao_pendente: integracaoDaMetaPendente,
}

function carregarIndicadores(filtros: FiltrosTelaIndicadores): Promise<ResultadoListagemIndicadores> {
  const consulta: FiltrosIndicadores = { busca: filtros.busca, situacao: filtros.situacao }
  return listarIndicadores(consulta)
}

/** Quanto o indicador contribui para cada alerta da aba. */
function contribuicaoAlertas(indicador: Indicador): Required<AlertasIndicadores> {
  return {
    aguardandoMeta: indicador.ativo && indicador.metaADefinir ? 1 : 0,
    comComponenteDesativado: indicador.ativo && indicador.componentesDesativados ? 1 : 0,
    metaPendentePorFilial: indicador.ativo && indicador.filiaisSemMeta.length > 0 ? 1 : 0,
    integracaoPendente: indicador.ativo && integracaoDaMetaPendente(indicador) ? 1 : 0,
  }
}

/**
 * Ajusta os alertas trocando a contribuição de `antes` pela de `depois` (sem `depois` = removido).
 * Sem `antes` na lista, os alertas ficam como estão: não há como saber a contribuição anterior.
 */
function ajustarAlertas(alertas: AlertasIndicadores, antes: Indicador | undefined, depois: Indicador | undefined): AlertasIndicadores {
  if (antes === undefined) return alertas
  const saiu = contribuicaoAlertas(antes)
  const entrou = depois ? contribuicaoAlertas(depois) : { ...ALERTAS_ZERADOS, integracaoPendente: 0 }
  const ajustados: AlertasIndicadores = {
    aguardandoMeta: Math.max(0, alertas.aguardandoMeta - saiu.aguardandoMeta + entrou.aguardandoMeta),
    comComponenteDesativado: Math.max(0, alertas.comComponenteDesativado - saiu.comComponenteDesativado + entrou.comComponenteDesativado),
    metaPendentePorFilial: Math.max(0, alertas.metaPendentePorFilial - saiu.metaPendentePorFilial + entrou.metaPendentePorFilial),
  }
  // F6.11: o alerta opcional só existe (e só é ajustado) quando a API o informou.
  if (alertas.integracaoPendente !== undefined) {
    ajustados.integracaoPendente = Math.max(0, alertas.integracaoPendente - saiu.integracaoPendente + entrou.integracaoPendente)
  }
  return ajustados
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
          ...atual,
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
      if (atualizado === null || dadosMeta.origemDaMeta === 'terceiro') {
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
          ...atual,
          indicadores: atual.indicadores.filter((i) => i.id !== id),
          alertas: ajustarAlertas(atual.alertas, antes, undefined),
        }
      })
    },
    [setDados],
  )

  const atualizarIntegracao = useCallback(
    async (id: number, integracao: IntegracaoDadoExterno): Promise<void> => {
      await atualizarIntegracaoIndicador(id, integracao)
      await recarregar()
    },
    [recarregar],
  )

  const definirMetasPendentes = useCallback(
    async (id: number, metas: MetaDaFilial[]): Promise<ResultadoMetasPendentes> => {
      const resultado = await definirMetasPendentesIndicador(id, metas)
      await recarregar()
      return resultado
    },
    [recarregar],
  )

  return {
    indicadores: dados.indicadores,
    alertas: dados.alertas,
    metaViaApi: dados.metaViaApi ?? null,
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
    atualizarIntegracao,
    definirMetasPendentes,
  }
}
