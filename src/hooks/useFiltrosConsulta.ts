/**
 * Hook genérico de consulta com filtros (F1.14), construído sobre `useConsulta`.
 *
 * Decisões:
 * - Os filtros atuais ficam em ref; a consulta lê sempre os filtros da ref e o `carregar` mais
 *   recente (mudar a referência de `carregar` ou `filtrosPadrao` não dispara nova consulta).
 * - `setBusca` atualiza `filtros.busca` na hora e consulta após `atrasoBuscaMs` (padrão 500 ms,
 *   decisão de 04/11/2026) contados da última chamada. Mesmo valor atual não faz nada; voltar ao
 *   texto da última consulta disparada cancela a espera sem consultar.
 * - `definirFiltro`, `limparFiltros` e `recarregar` consultam na hora e cancelam a espera. Mesmo(s)
 *   valor(es) (comparação por `===`) sem espera pendente não consulta; com espera pendente consulta.
 * - Desmontar cancela a espera pendente.
 * - `filtrosPadrao` nunca é alterado: o estado trabalha sempre com cópias.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { type OpcoesConsulta, type UseConsultaResultado, useConsulta } from './useConsulta'

/** Espera padrão entre a última mudança da busca e a consulta. */
export const ATRASO_BUSCA_PADRAO_MS = 500

/** Forma mínima dos filtros: precisam ter a busca textual. */
export interface FiltrosComBusca {
  busca: string
}

export interface OpcoesFiltrosConsulta<F extends FiltrosComBusca, R> extends OpcoesConsulta {
  /** Consulta com os filtros atuais. */
  carregar: (filtros: F) => Promise<R>
  /** Valor de `dados` antes da primeira resposta (lido só na montagem). */
  inicial: R
  /** Filtros iniciais e os usados por `limparFiltros()`. */
  filtrosPadrao: F
  /** Espera da busca em milissegundos (padrão `ATRASO_BUSCA_PADRAO_MS`). */
  atrasoBuscaMs?: number
}

export interface UseFiltrosConsultaResultado<F extends FiltrosComBusca, R> extends UseConsultaResultado<R> {
  filtros: F
  /** Atualiza a busca na hora e consulta após a espera. */
  setBusca: (busca: string) => void
  /** Atualiza um filtro e consulta na hora (com a busca digitada, cancelando a espera). */
  definirFiltro: <K extends keyof F>(chave: K, valor: F[K]) => void
  /** Volta aos filtros padrão e consulta na hora. */
  limparFiltros: () => void
}

function filtrosIguais<F extends FiltrosComBusca>(a: F, b: F): boolean {
  const chaves = new Set<keyof F>([...(Object.keys(a) as (keyof F)[]), ...(Object.keys(b) as (keyof F)[])])
  for (const chave of chaves) {
    if (a[chave] !== b[chave]) return false
  }
  return true
}

export function useFiltrosConsulta<F extends FiltrosComBusca, R>(
  opcoes: OpcoesFiltrosConsulta<F, R>,
): UseFiltrosConsultaResultado<F, R> {
  const { carregar, inicial, filtrosPadrao, atrasoBuscaMs = ATRASO_BUSCA_PADRAO_MS, recarregarAposMutacao } = opcoes

  const [filtros, setFiltrosEstado] = useState<F>(() => ({ ...filtrosPadrao }))
  const filtrosRef = useRef<F>(filtros)
  const filtrosPadraoRef = useRef<F>(filtrosPadrao)
  const carregarRef = useRef(carregar)
  const atrasoRef = useRef(atrasoBuscaMs)
  /** Busca usada na última consulta disparada. */
  const buscaConsultadaRef = useRef(filtros.busca)
  /** Espera pendente da busca. */
  const esperaRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montadoRef = useRef(false)

  useEffect(() => {
    carregarRef.current = carregar
    filtrosPadraoRef.current = filtrosPadrao
    atrasoRef.current = atrasoBuscaMs
  }, [carregar, filtrosPadrao, atrasoBuscaMs])

  const carregarComFiltros = useCallback((): Promise<R> => {
    const atuais = filtrosRef.current
    buscaConsultadaRef.current = atuais.busca
    return carregarRef.current(atuais)
  }, [])

  const consulta = useConsulta<R>(
    carregarComFiltros,
    inicial,
    recarregarAposMutacao === undefined ? undefined : { recarregarAposMutacao },
  )
  const { recarregar: recarregarConsulta } = consulta

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

  const atualizarFiltros = useCallback((novos: F) => {
    filtrosRef.current = novos
    setFiltrosEstado(novos)
  }, [])

  /** Aplica filtros que consultam na hora. */
  const aplicarFiltrosAgora = useCallback(
    (novos: F) => {
      if (filtrosIguais(filtrosRef.current, novos) && esperaRef.current === null) return
      atualizarFiltros(novos)
      void recarregar()
    },
    [atualizarFiltros, recarregar],
  )

  const setBusca = useCallback(
    (busca: string) => {
      if (busca === filtrosRef.current.busca) return
      atualizarFiltros({ ...filtrosRef.current, busca })
      cancelarEspera()
      if (busca === buscaConsultadaRef.current) return
      esperaRef.current = setTimeout(() => {
        esperaRef.current = null
        void recarregar()
      }, atrasoRef.current)
    },
    [atualizarFiltros, cancelarEspera, recarregar],
  )

  const definirFiltro = useCallback(
    <K extends keyof F>(chave: K, valor: F[K]) => {
      aplicarFiltrosAgora({ ...filtrosRef.current, [chave]: valor })
    },
    [aplicarFiltrosAgora],
  )

  const limparFiltros = useCallback(() => {
    aplicarFiltrosAgora({ ...filtrosPadraoRef.current })
  }, [aplicarFiltrosAgora])

  return { ...consulta, recarregar, filtros, setBusca, definirFiltro, limparFiltros }
}
