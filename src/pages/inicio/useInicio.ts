/**
 * Hook da tela Início (F11.1 — RF-01, RF-06 a RF-11).
 *
 * Decisões:
 * - A filial vem do cabeçalho (`useSessao().filialSelecionada`): uma filial → o código; "todas" ou `null` →
 *   sem filial. A consulta depende só do **código** (string), não do objeto da sessão, para não consultar de
 *   novo quando a sessão recria o objeto da mesma filial.
 * - A consulta sai no efeito da primeira renderização, sem esperas.
 * - `carregando` é derivado: o resultado aplicado ainda não é o da consulta atual (filial + recarga). Assim
 *   o efeito não chama `setState` de forma síncrona, e os dados anteriores ficam na tela durante a troca.
 * - Só a resposta da consulta mais recente é aplicada (contador de versão).
 * - Falhas viram mensagem em pt-BR (`mensagemDeErro`); o 401 é tratado globalmente pela sessão.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { obterInicio } from '../../services/inicioService'
import { useSessao } from '../../sessao/SessaoProvider'
import { TODAS_AS_FILIAIS } from '../../sessao/filial'
import type { Inicio } from '../../types/dominio'

export interface UseInicioResultado {
  inicio: Inicio | null
  carregando: boolean
  erro: string | null
  /** Consulta de novo com a filial atual. */
  recarregar: () => void
}

/** Resultado da última consulta aplicada, com a chave (filial e recarga) que o produziu. */
interface EstadoInicio {
  chave: string | null
  inicio: Inicio | null
  erro: string | null
}

const ESTADO_INICIAL: EstadoInicio = { chave: null, inicio: null, erro: null }

const chaveDaConsulta = (codigoFilial: string | null, recarga: number) => `${codigoFilial ?? ''}|${recarga}`

export function useInicio(): UseInicioResultado {
  const { filialSelecionada } = useSessao()
  const codigoFilial =
    filialSelecionada === null || filialSelecionada === undefined || filialSelecionada === TODAS_AS_FILIAIS
      ? null
      : filialSelecionada.codigo

  const [estado, setEstado] = useState<EstadoInicio>(ESTADO_INICIAL)
  const [recarga, setRecarga] = useState(0)
  const versaoRef = useRef(0)

  const carregando = estado.chave !== chaveDaConsulta(codigoFilial, recarga)

  useEffect(() => {
    versaoRef.current += 1
    const versao = versaoRef.current
    const chave = chaveDaConsulta(codigoFilial, recarga)
    obterInicio(codigoFilial).then(
      (inicio) => {
        if (versaoRef.current === versao) setEstado({ chave, inicio, erro: null })
      },
      (erro: unknown) => {
        if (versaoRef.current === versao) setEstado({ chave, inicio: null, erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      // Desmontagem ou nova consulta: a resposta pendente deixa de ser aplicada.
      if (versaoRef.current === versao) versaoRef.current += 1
    }
  }, [codigoFilial, recarga])

  const recarregar = useCallback(() => setRecarga((valor) => valor + 1), [])

  return { inicio: estado.inicio, carregando, erro: estado.erro, recarregar }
}
