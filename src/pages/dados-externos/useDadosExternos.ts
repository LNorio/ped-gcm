/**
 * Hook da aba Dados Externos (F5.2–F5.9): lista filtrada pela API, filtros de busca e situação e
 * ações de cadastro, conclusão da construção, troca de situação e exclusão.
 *
 * Construído sobre `useFiltrosConsulta`, que cuida da espera da busca, da proteção de corrida, do
 * `erro`/`carregando`/`carregouUmaVez` e da recarga automática quando uma ação local é confirmada
 * com um GET pendente.
 *
 * Decisões (mesmas regras da aba Apontamentos):
 * - Busca com espera de 500 ms: `setBusca` atualiza `filtros.busca` na hora e consulta 500 ms após a
 *   última chamada; se o texto voltar ao último valor consultado, não consulta. `setSituacao`,
 *   `limparFiltros` e `recarregar` consultam na hora e cancelam a espera; desmontar também cancela.
 * - Mudar a situação para o mesmo valor não reconsulta.
 * - `concluir` e `alterarSituacao`: se o item, pela resposta da API, deixa de corresponder ao filtro
 *   de situação, sai da lista; senão é substituído (sem nova consulta). Se o 2xx não traz o dado
 *   (serviço devolve `null`), recarrega a lista e resolve `null` sem erro.
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useFiltrosConsulta } from '../../hooks/useFiltrosConsulta'
import {
  type FiltrosDadosExternos,
  type ResultadoConclusaoDadoExterno,
  type ResultadoCriacaoDadoExterno,
  type SituacaoFiltroDadoExterno,
  alterarSituacaoDadoExterno,
  concluirConstrucao,
  criarDadoExterno,
  excluirDadoExterno,
  listarDadosExternos,
} from '../../services/dadosExternosService'
import type { DadoExterno, NovoDadoExterno } from '../../types/dominio'
import { type RegraSituacao, correspondeASituacao } from '../../utils/filtros'

export interface FiltrosTelaDadosExternos {
  busca: string
  situacao: SituacaoFiltroDadoExterno
}

export const FILTROS_PADRAO: Readonly<FiltrosTelaDadosExternos> = { busca: '', situacao: 'todas' }

/** Espera entre a última mudança da busca e a consulta. */
export const ATRASO_BUSCA_MS = 500

export interface UseDadosExternosResultado {
  dadosExternos: DadoExterno[]
  carregando: boolean
  /** `true` a partir da primeira resposta da consulta (sucesso ou erro). */
  carregouUmaVez: boolean
  erro: string | null
  filtros: FiltrosTelaDadosExternos
  setBusca: (busca: string) => void
  setSituacao: (situacao: SituacaoFiltroDadoExterno) => void
  limparFiltros: () => void
  /** Repete a consulta com os filtros atuais. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
  /**
   * POST e recarga da lista depois de qualquer resposta 2xx, mesmo quando ela não traz um dado
   * reconhecível (`dadoExterno` null); resolve com o dado criado (ou `null`) e a tarefa gerada (ou
   * `null`). Em falha, rejeita com a `ApiError` original, sem recarregar.
   */
  criar: (dados: NovoDadoExterno) => Promise<ResultadoCriacaoDadoExterno>
  /**
   * PUT de conclusão e troca (ou remoção, se sair do filtro) do item na lista, sem nova consulta. Se a
   * resposta 2xx não traz o dado, recarrega a lista e resolve `null`. Erro HTTP rejeita sem recarregar.
   */
  concluir: (id: number, identificador: string) => Promise<ResultadoConclusaoDadoExterno | null>
  /**
   * PUT da situação e troca (ou remoção, se sair do filtro) do item na lista, sem nova consulta. Se a
   * resposta 2xx não traz o dado, recarrega a lista e resolve `null`. Erro HTTP rejeita sem recarregar.
   */
  alterarSituacao: (id: number, ativo: boolean) => Promise<DadoExterno | null>
  /** DELETE e remoção do item da lista. */
  excluir: (id: number) => Promise<void>
}

const LISTA_INICIAL: DadoExterno[] = []

function paraFiltrosApi(filtros: FiltrosTelaDadosExternos): FiltrosDadosExternos {
  return {
    busca: filtros.busca,
    situacao: filtros.situacao === 'todas' ? undefined : filtros.situacao,
  }
}

/** Regras de correspondência ao filtro de situação (mesmas da API). */
const REGRAS_SITUACAO: Partial<Record<SituacaoFiltroDadoExterno, RegraSituacao<DadoExterno>>> = {
  ativos: (dado) => dado.situacao === 'ativo',
  inativos: (dado) => dado.situacao === 'inativo',
  construcao: (dado) => dado.situacao === 'em_construcao',
  problemas: (dado) => dado.situacao === 'inativo' && dado.indicadores.length > 0,
}

function carregarDadosExternos(filtros: FiltrosTelaDadosExternos): Promise<DadoExterno[]> {
  return listarDadosExternos(paraFiltrosApi(filtros))
}

export function useDadosExternos(): UseDadosExternosResultado {
  const {
    dados,
    setDados,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    definirFiltro,
    limparFiltros,
    recarregar,
  } = useFiltrosConsulta<FiltrosTelaDadosExternos, DadoExterno[]>({
    carregar: carregarDadosExternos,
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
    (situacao: SituacaoFiltroDadoExterno) => definirFiltro('situacao', situacao),
    [definirFiltro],
  )

  /** Substitui o item pela versão confirmada pela API, ou o remove se ele saiu do filtro de situação. */
  const aplicarAtualizado = useCallback(
    (atualizado: DadoExterno) => {
      const situacao = situacaoRef.current
      setDados((atual) =>
        correspondeASituacao(situacao, atualizado, REGRAS_SITUACAO)
          ? atual.map((d) => (d.id === atualizado.id ? atualizado : d))
          : atual.filter((d) => d.id !== atualizado.id),
      )
    },
    [setDados],
  )

  const criar = useCallback(
    async (dadosNovos: NovoDadoExterno): Promise<ResultadoCriacaoDadoExterno> => {
      const resultado = await criarDadoExterno(dadosNovos)
      await recarregar()
      return resultado
    },
    [recarregar],
  )

  const concluir = useCallback(
    async (id: number, identificador: string): Promise<ResultadoConclusaoDadoExterno | null> => {
      const resultado = await concluirConstrucao(id, identificador)
      if (resultado === null) {
        await recarregar()
        return null
      }
      aplicarAtualizado(resultado.dadoExterno)
      return resultado
    },
    [aplicarAtualizado, recarregar],
  )

  const alterarSituacao = useCallback(
    async (id: number, ativo: boolean): Promise<DadoExterno | null> => {
      const atualizado = await alterarSituacaoDadoExterno(id, ativo)
      if (atualizado === null) {
        await recarregar()
        return null
      }
      aplicarAtualizado(atualizado)
      return atualizado
    },
    [aplicarAtualizado, recarregar],
  )

  const excluir = useCallback(
    async (id: number): Promise<void> => {
      await excluirDadoExterno(id)
      setDados((atual) => atual.filter((d) => d.id !== id))
    },
    [setDados],
  )

  return {
    dadosExternos: dados,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    limparFiltros,
    recarregar,
    criar,
    concluir,
    alterarSituacao,
    excluir,
  }
}
