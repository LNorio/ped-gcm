/**
 * Hook da aba Apontamentos (F4.2–F4.6): lista filtrada pela API, contagem por tipo, filtros e
 * ações de cadastro, troca de situação e exclusão.
 *
 * Construído sobre `useFiltrosConsulta` (dados = `{ apontamentos, contagemPorTipo }`), que cuida dos
 * filtros, da espera da busca, da proteção de corrida, do `erro`/`carregando`/`carregouUmaVez` e da
 * recarga automática quando uma ação local é confirmada com um GET pendente.
 *
 * Decisões:
 * - Busca com espera de 500 ms (decisão de 04/11/2026): `setBusca` atualiza `filtros.busca` na hora e
 *   consulta 500 ms após a última chamada; se o texto voltar ao último valor consultado, não consulta.
 *   `setSituacao`, `setTipo`, `limparFiltros` e `recarregar` consultam na hora e cancelam a espera;
 *   desmontar também cancela.
 * - Mudar situação ou tipo para o mesmo valor não reconsulta.
 * - `alterarSituacao` (decisão de 04/11/2026): se o item, pela resposta do PUT, deixa de corresponder
 *   ao filtro de situação, sai da lista e é descontado da contagem do seu tipo; com "todas", só é
 *   substituído.
 * - Se o tipo selecionado sair da contagem (após exclusão ou alteração de situação), `filtros.tipo`
 *   volta a `null` e a lista é reconsultada.
 * - `criar` (F4.4): o POST 2xx pode não trazer um apontamento reconhecível; nesse caso o serviço
 *   devolve `null`, a lista é recarregada do mesmo jeito e `criar` resolve com `null`.
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useFiltrosConsulta } from '../../hooks/useFiltrosConsulta'
import {
  type ContagemPorTipo,
  type FiltrosApontamentos,
  type ResultadoListagemApontamentos,
  type SituacaoFiltro,
  alterarSituacao as alterarSituacaoApi,
  criarApontamento,
  excluirApontamento,
  listarApontamentos,
} from '../../services/apontamentosService'
import type { Apontamento, NovoApontamento } from '../../types/dominio'
import { type RegraSituacao, correspondeASituacao } from '../../utils/filtros'

export interface FiltrosTelaApontamentos {
  busca: string
  situacao: SituacaoFiltro
  /** Id do tipo selecionado; `null` = todos os tipos. */
  tipo: number | null
}

export const FILTROS_PADRAO: Readonly<FiltrosTelaApontamentos> = { busca: '', situacao: 'todas', tipo: null }

/** Espera entre a última mudança da busca e a consulta. */
export const ATRASO_BUSCA_MS = 500

export interface UseApontamentosResultado {
  apontamentos: Apontamento[]
  contagemPorTipo: ContagemPorTipo[]
  carregando: boolean
  /** `true` a partir da primeira resposta da consulta (sucesso ou erro). */
  carregouUmaVez: boolean
  erro: string | null
  filtros: FiltrosTelaApontamentos
  setBusca: (busca: string) => void
  setSituacao: (situacao: SituacaoFiltro) => void
  setTipo: (tipo: number | null) => void
  limparFiltros: () => void
  /** Repete a consulta com os filtros atuais. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
  /**
   * POST e recarga da lista. Após qualquer resposta 2xx (mesmo sem um apontamento reconhecível no
   * corpo) recarrega a lista e resolve com o valor do serviço: o apontamento criado ou `null`.
   * Falhas do POST rejeitam com a `ApiError` original, sem recarregar.
   */
  criar: (dados: NovoApontamento) => Promise<Apontamento | null>
  /** PUT da situação e troca (ou remoção, se sair do filtro) do item na lista, sem nova consulta. */
  alterarSituacao: (id: number, ativo: boolean) => Promise<Apontamento>
  /** DELETE e remoção do item da lista. */
  excluir: (id: number) => Promise<void>
}

const RESULTADO_INICIAL: ResultadoListagemApontamentos = { apontamentos: [], contagemPorTipo: [] }

function paraFiltrosApi(filtros: FiltrosTelaApontamentos): FiltrosApontamentos {
  return {
    busca: filtros.busca,
    situacao: filtros.situacao === 'todas' ? undefined : filtros.situacao,
    tipo: filtros.tipo ?? undefined,
  }
}

function carregarApontamentos(filtros: FiltrosTelaApontamentos): Promise<ResultadoListagemApontamentos> {
  return listarApontamentos(paraFiltrosApi(filtros))
}

/** Desconta um apontamento da contagem do seu tipo (remove o tipo ao zerar). */
function descontarDaContagem(contagem: ContagemPorTipo[], idTipo: number): ContagemPorTipo[] {
  return contagem
    .map((item) => (item.id === idTipo ? { ...item, quantidade: item.quantidade - 1 } : item))
    .filter((item) => item.quantidade > 0)
}

/** Regras de cada filtro de situação ("todas" corresponde a qualquer apontamento). */
const REGRAS_SITUACAO: Partial<Record<SituacaoFiltro, RegraSituacao<Apontamento>>> = {
  ativos: (a) => a.ativo,
  inativos: (a) => !a.ativo,
  problemas: (a) => a.desativadoMasUsadoEmIndicadorAtivo,
}

/** Remove o apontamento da lista e o desconta da contagem do seu tipo. */
function removerDoResultado(resultado: ResultadoListagemApontamentos, id: number): ResultadoListagemApontamentos {
  const removido = resultado.apontamentos.find((a) => a.id === id)
  if (!removido) return resultado
  return {
    apontamentos: resultado.apontamentos.filter((a) => a.id !== id),
    contagemPorTipo: descontarDaContagem(resultado.contagemPorTipo, removido.idTipo),
  }
}

export function useApontamentos(): UseApontamentosResultado {
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
  } = useFiltrosConsulta<FiltrosTelaApontamentos, ResultadoListagemApontamentos>({
    carregar: carregarApontamentos,
    inicial: RESULTADO_INICIAL,
    filtrosPadrao: FILTROS_PADRAO,
    atrasoBuscaMs: ATRASO_BUSCA_MS,
  })

  /** Cópias dos dados e filtros atuais para as ações calcularem o resultado de forma síncrona. */
  const dadosRef = useRef(dados)
  const filtrosRef = useRef(filtros)
  const montadoRef = useRef(false)
  useEffect(() => {
    dadosRef.current = dados
    filtrosRef.current = filtros
  }, [dados, filtros])

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const setSituacao = useCallback((situacao: SituacaoFiltro) => definirFiltro('situacao', situacao), [definirFiltro])
  const setTipo = useCallback((tipo: number | null) => definirFiltro('tipo', tipo), [definirFiltro])

  /**
   * Aplica uma alteração local confirmada pela API. Se o tipo selecionado saiu da contagem, volta o
   * filtro de tipo para "todos" e reconsulta.
   */
  const alterarLocalmente = useCallback(
    (novo: ResultadoListagemApontamentos) => {
      if (!montadoRef.current) return
      dadosRef.current = novo
      setDados(novo)
      const tipo = filtrosRef.current.tipo
      if (tipo !== null && !novo.contagemPorTipo.some((item) => item.id === tipo)) {
        setTipo(null)
      }
    },
    [setDados, setTipo],
  )

  const criar = useCallback(
    async (dadosNovos: NovoApontamento): Promise<Apontamento | null> => {
      const criado = await criarApontamento(dadosNovos)
      await recarregar()
      return criado
    },
    [recarregar],
  )

  const alterarSituacao = useCallback(
    async (id: number, ativo: boolean): Promise<Apontamento> => {
      const atualizado = await alterarSituacaoApi(id, ativo)
      if (!montadoRef.current) return atualizado
      const atual = dadosRef.current
      if (correspondeASituacao(filtrosRef.current.situacao, atualizado, REGRAS_SITUACAO)) {
        alterarLocalmente({
          ...atual,
          apontamentos: atual.apontamentos.map((a) => (a.id === id ? atualizado : a)),
        })
      } else {
        alterarLocalmente(removerDoResultado(atual, id))
      }
      return atualizado
    },
    [alterarLocalmente],
  )

  const excluir = useCallback(
    async (id: number): Promise<void> => {
      await excluirApontamento(id)
      if (!montadoRef.current) return
      alterarLocalmente(removerDoResultado(dadosRef.current, id))
    },
    [alterarLocalmente],
  )

  return {
    apontamentos: dados.apontamentos,
    contagemPorTipo: dados.contagemPorTipo,
    carregando,
    carregouUmaVez,
    erro,
    filtros,
    setBusca,
    setSituacao,
    setTipo,
    limparFiltros,
    recarregar,
    criar,
    alterarSituacao,
    excluir,
  }
}
