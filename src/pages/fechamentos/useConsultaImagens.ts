/**
 * Hook da consulta retroativa de imagens congeladas (F10.6 — RF-84, RN-18; A-05, A-07).
 *
 * Decisões:
 * - A filial vem do cabeçalho (`useSessao().filialSelecionada`): "todas" (ou sem filial) consulta sem
 *   `filial` (Admin e Validador veem todas as filiais — A-05).
 * - Duas consultas: a **base** (só a filial) dá `total` e `periodos`; a **filtrada** (filial + período,
 *   tipo e busca) dá `imagens`. Sem filtro ativo a base também é o resultado, numa única chamada.
 *   A base é refeita ao trocar a filial, em `recarregar()` e ao voltar ao padrão (ex.: `limparFiltros`).
 * - Na troca de filial com filtro ativo, a base é disparada antes da filtrada.
 * - `setBusca` atualiza `filtros.busca` na hora e consulta 500 ms após a última digitação;
 *   `definirFiltro` e `limparFiltros` consultam na hora (com a busca já digitada, cancelando a espera).
 * - Só a resposta mais recente de cada consulta é aplicada (contador de versão).
 * - Somente leitura (RN-18): apenas `listarImagens` (GET).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { listarImagens } from '../../services/imagensService'
import { useSessao } from '../../sessao/SessaoProvider'
import type { ImagemDaConsulta, TipoImagem } from '../../types/dominio'

/** Espera entre a última digitação da busca e a consulta. */
export const ATRASO_BUSCA_IMAGENS_MS = 500

export interface FiltrosConsultaImagens {
  /** Período das imagens; `''` = todos os períodos. */
  periodo: string
  tipo: TipoImagem | 'todas'
  busca: string
}

export const FILTROS_IMAGENS_PADRAO: FiltrosConsultaImagens = { periodo: '', tipo: 'todas', busca: '' }

export interface UseConsultaImagensResultado {
  /** Filial do cabeçalho; `null` com "Todas as filiais" ou sem filial (consulta sem filial). */
  codigoFilial: string | null
  /** Imagens com os filtros atuais, na ordem da API. */
  imagens: ImagemDaConsulta[]
  /** Imagens da filial sem os filtros de período, tipo e busca. */
  total: number
  /** Períodos distintos das imagens da filial (sem os filtros), na ordem da resposta. */
  periodos: string[]
  filtros: FiltrosConsultaImagens
  /** Algum filtro diferente do padrão. */
  filtrosAtivos: boolean
  definirFiltro: <K extends 'periodo' | 'tipo'>(chave: K, valor: FiltrosConsultaImagens[K]) => void
  setBusca: (texto: string) => void
  limparFiltros: () => void
  carregando: boolean
  erro: string | null
  recarregar: () => void
}

interface EstadoConsulta {
  imagens: ImagemDaConsulta[]
  carregando: boolean
  erro: string | null
}

const CONSULTA_INICIAL: EstadoConsulta = { imagens: [], carregando: true, erro: null }
/** Resultado da consulta filtrada, com a chave (filial, recarga e filtros) que o produziu. */
interface EstadoFiltrada {
  chave: string | null
  imagens: ImagemDaConsulta[]
  erro: string | null
}

const FILTRADA_INICIAL: EstadoFiltrada = { chave: null, imagens: [], erro: null }

function periodosDistintos(imagens: ImagemDaConsulta[]): string[] {
  const vistos = new Set<string>()
  for (const imagem of imagens) {
    if (imagem.periodo !== null && imagem.periodo !== '') vistos.add(imagem.periodo)
  }
  return [...vistos]
}

export function useConsultaImagens(): UseConsultaImagensResultado {
  const { filialSelecionada } = useSessao()
  const codigoFilial = filialSelecionada === null || filialSelecionada === undefined || filialSelecionada === 'todas'
    ? null
    : filialSelecionada.codigo

  const [filtros, setFiltros] = useState<FiltrosConsultaImagens>(() => ({ ...FILTROS_IMAGENS_PADRAO }))
  /** Busca já aplicada à consulta (depois da espera). */
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [base, setBase] = useState<EstadoConsulta>(CONSULTA_INICIAL)
  const [filtrada, setFiltrada] = useState<EstadoFiltrada>(FILTRADA_INICIAL)

  const filtrosRef = useRef(filtros)
  const esperaRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const versaoBaseRef = useRef(0)
  const versaoFiltradaRef = useRef(0)
  /** Filial e recarga da última consulta base disparada. */
  const chaveBaseRef = useRef<string | null>(null)
  const montadoRef = useRef(false)

  const { periodo, tipo } = filtros
  const filtrosAplicadosAtivos = periodo !== '' || tipo !== 'todas' || buscaAplicada.trim() !== ''
  const chaveFiltrada = JSON.stringify([codigoFilial, recarga, periodo, tipo, buscaAplicada])

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
      if (esperaRef.current !== null) clearTimeout(esperaRef.current)
    }
  }, [])

  // Consulta base (só a filial): total, períodos e o resultado quando não há filtro.
  useEffect(() => {
    const chave = `${codigoFilial ?? ''}|${recarga}`
    if (filtrosAplicadosAtivos && chaveBaseRef.current === chave) return
    chaveBaseRef.current = chave
    versaoBaseRef.current += 1
    const versao = versaoBaseRef.current
    setBase((atual) => ({ ...atual, carregando: true }))
    listarImagens({ filial: codigoFilial ?? undefined }).then(
      (imagens) => {
        if (montadoRef.current && versao === versaoBaseRef.current) setBase({ imagens, carregando: false, erro: null })
      },
      (falha: unknown) => {
        if (montadoRef.current && versao === versaoBaseRef.current) {
          setBase({ imagens: [], carregando: false, erro: mensagemDeErro(falha) })
        }
      },
    )
  }, [codigoFilial, recarga, filtrosAplicadosAtivos])

  // Consulta filtrada (filial + período, tipo e busca), só com algum filtro aplicado.
  useEffect(() => {
    versaoFiltradaRef.current += 1
    const versao = versaoFiltradaRef.current
    // Sem filtro, a base é o resultado: a versão nova só descarta a resposta filtrada pendente.
    if (!filtrosAplicadosAtivos) return
    listarImagens({ filial: codigoFilial ?? undefined, periodo, tipo, busca: buscaAplicada }).then(
      (imagens) => {
        if (montadoRef.current && versao === versaoFiltradaRef.current) setFiltrada({ chave: chaveFiltrada, imagens, erro: null })
      },
      (falha: unknown) => {
        if (montadoRef.current && versao === versaoFiltradaRef.current) {
          setFiltrada({ chave: chaveFiltrada, imagens: [], erro: mensagemDeErro(falha) })
        }
      },
    )
  }, [codigoFilial, recarga, periodo, tipo, buscaAplicada, filtrosAplicadosAtivos, chaveFiltrada])

  const cancelarEspera = useCallback(() => {
    if (esperaRef.current !== null) {
      clearTimeout(esperaRef.current)
      esperaRef.current = null
    }
  }, [])

  const atualizarFiltros = useCallback((novos: FiltrosConsultaImagens) => {
    filtrosRef.current = novos
    setFiltros(novos)
  }, [])

  const definirFiltro = useCallback(
    <K extends 'periodo' | 'tipo'>(chave: K, valor: FiltrosConsultaImagens[K]) => {
      cancelarEspera()
      const novos = { ...filtrosRef.current, [chave]: valor }
      atualizarFiltros(novos)
      setBuscaAplicada(novos.busca)
    },
    [atualizarFiltros, cancelarEspera],
  )

  const setBusca = useCallback(
    (texto: string) => {
      if (texto === filtrosRef.current.busca) return
      atualizarFiltros({ ...filtrosRef.current, busca: texto })
      cancelarEspera()
      esperaRef.current = setTimeout(() => {
        esperaRef.current = null
        setBuscaAplicada(texto)
      }, ATRASO_BUSCA_IMAGENS_MS)
    },
    [atualizarFiltros, cancelarEspera],
  )

  const limparFiltros = useCallback(() => {
    cancelarEspera()
    atualizarFiltros({ ...FILTROS_IMAGENS_PADRAO })
    setBuscaAplicada('')
  }, [atualizarFiltros, cancelarEspera])

  const recarregar = useCallback(() => {
    cancelarEspera()
    setBuscaAplicada(filtrosRef.current.busca)
    setRecarga((atual) => atual + 1)
  }, [cancelarEspera])

  const periodos = useMemo(() => periodosDistintos(base.imagens), [base.imagens])

  const filtrosAtivos = filtros.periodo !== '' || filtros.tipo !== 'todas' || filtros.busca !== ''
  const erro = filtrosAplicadosAtivos ? (base.erro ?? filtrada.erro) : base.erro
  const carregando = base.carregando || (filtrosAplicadosAtivos && filtrada.chave !== chaveFiltrada)
  const imagens = erro !== null ? [] : filtrosAplicadosAtivos ? filtrada.imagens : base.imagens

  return {
    codigoFilial,
    imagens,
    total: base.imagens.length,
    periodos,
    filtros,
    filtrosAtivos,
    definirFiltro,
    setBusca,
    limparFiltros,
    carregando,
    erro,
    recarregar,
  }
}
