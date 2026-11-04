/**
 * Hook da aba Apontamentos (F4.2–F4.6): lista filtrada pela API, contagem por tipo, filtros e
 * ações de cadastro, troca de situação e exclusão.
 *
 * Construído sobre `useConsulta` (dados = `{ apontamentos, contagemPorTipo }`), que cuida da proteção
 * de corrida, do `erro`/`carregando`/`carregouUmaVez` e da recarga automática quando uma ação local
 * é confirmada com um GET pendente. A função de carga lê os filtros atuais de uma ref.
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
 * - Falhas das ações rejeitam com a `ApiError` original, sem alterar a lista nem o `erro` de carga.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useConsulta } from '../../hooks/useConsulta'
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
  /** POST e recarga da lista; resolve com o apontamento criado. */
  criar: (dados: NovoApontamento) => Promise<Apontamento>
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

/** Desconta um apontamento da contagem do seu tipo (remove o tipo ao zerar). */
function descontarDaContagem(contagem: ContagemPorTipo[], idTipo: number): ContagemPorTipo[] {
  return contagem
    .map((item) => (item.id === idTipo ? { ...item, quantidade: item.quantidade - 1 } : item))
    .filter((item) => item.quantidade > 0)
}

/** Indica se o apontamento corresponde ao filtro de situação. */
function correspondeASituacao(apontamento: Apontamento, situacao: SituacaoFiltro): boolean {
  switch (situacao) {
    case 'ativos':
      return apontamento.ativo
    case 'inativos':
      return !apontamento.ativo
    case 'problemas':
      return apontamento.desativadoMasUsadoEmIndicadorAtivo
    default:
      return true
  }
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
  const [filtros, setFiltrosEstado] = useState<FiltrosTelaApontamentos>(FILTROS_PADRAO)
  const filtrosRef = useRef<FiltrosTelaApontamentos>(FILTROS_PADRAO)
  /** Busca usada na última consulta disparada. */
  const buscaConsultadaRef = useRef(FILTROS_PADRAO.busca)
  /** Espera pendente da busca. */
  const esperaRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montadoRef = useRef(false)

  const carregar = useCallback(() => {
    const atuais = filtrosRef.current
    buscaConsultadaRef.current = atuais.busca
    return listarApontamentos(paraFiltrosApi(atuais))
  }, [])

  const consulta = useConsulta<ResultadoListagemApontamentos>(carregar, RESULTADO_INICIAL)
  const { dados, setDados, carregando, carregouUmaVez, erro, recarregar: recarregarConsulta } = consulta

  /** Cópia dos dados atuais para as ações calcularem o resultado de forma síncrona. */
  const dadosRef = useRef(dados)
  useEffect(() => {
    dadosRef.current = dados
  }, [dados])

  const cancelarEspera = useCallback(() => {
    if (esperaRef.current !== null) {
      clearTimeout(esperaRef.current)
      esperaRef.current = null
    }
  }, [])

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
      cancelarEspera()
    }
  }, [cancelarEspera])

  const recarregar = useCallback(async (): Promise<void> => {
    if (!montadoRef.current) return
    cancelarEspera()
    await recarregarConsulta()
  }, [cancelarEspera, recarregarConsulta])

  const definirFiltros = useCallback((novos: FiltrosTelaApontamentos) => {
    filtrosRef.current = novos
    setFiltrosEstado(novos)
  }, [])

  /** Aplica filtros que consultam na hora (situação, tipo, limpar). */
  const aplicarFiltrosAgora = useCallback(
    (novos: FiltrosTelaApontamentos) => {
      const atuais = filtrosRef.current
      const iguais = atuais.busca === novos.busca && atuais.situacao === novos.situacao && atuais.tipo === novos.tipo
      if (iguais && esperaRef.current === null) return
      definirFiltros(novos)
      void recarregar()
    },
    [definirFiltros, recarregar],
  )

  const setBusca = useCallback(
    (busca: string) => {
      if (busca === filtrosRef.current.busca) return
      definirFiltros({ ...filtrosRef.current, busca })
      cancelarEspera()
      if (busca === buscaConsultadaRef.current) return
      esperaRef.current = setTimeout(() => {
        esperaRef.current = null
        void recarregar()
      }, ATRASO_BUSCA_MS)
    },
    [cancelarEspera, definirFiltros, recarregar],
  )
  const setSituacao = useCallback(
    (situacao: SituacaoFiltro) => aplicarFiltrosAgora({ ...filtrosRef.current, situacao }),
    [aplicarFiltrosAgora],
  )
  const setTipo = useCallback(
    (tipo: number | null) => aplicarFiltrosAgora({ ...filtrosRef.current, tipo }),
    [aplicarFiltrosAgora],
  )
  const limparFiltros = useCallback(() => aplicarFiltrosAgora({ ...FILTROS_PADRAO }), [aplicarFiltrosAgora])

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
    async (dadosNovos: NovoApontamento): Promise<Apontamento> => {
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
      if (correspondeASituacao(atualizado, filtrosRef.current.situacao)) {
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
