/**
 * Hook da tela Início (F11.1 — RF-01, RF-06 a RF-11).
 *
 * Decisões:
 * - A filial vem do cabeçalho (`useSessao().filialSelecionada`): uma filial → o código; "todas" ou `null` →
 *   sem filial. A consulta depende só do **código** (string), não do objeto da sessão, para não consultar de
 *   novo quando a sessão recria o objeto da mesma filial.
 * - A consulta sai no efeito da primeira renderização, sem esperas. Na primeira abertura depois de obter o
 *   acesso, a consulta já foi antecipada (`consultasInicio.preConsultarInicio`): se a resposta já chegou, a
 *   primeira renderização já sai com os dados; se não, o efeito aguarda essa mesma consulta (sem novo GET).
 * - `carregando` é derivado: o resultado aplicado ainda não é o da consulta atual (filial + recarga). Assim
 *   o efeito não chama `setState` de forma síncrona, e os dados anteriores ficam na tela durante a troca.
 * - Só a resposta da consulta mais recente é aplicada (contador de versão).
 * - Falhas viram mensagem em pt-BR (`mensagemDeErro`); o 401 é tratado globalmente pela sessão.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { useSessao } from '../../sessao/SessaoProvider'
import type { Inicio } from '../../types/dominio'
import {
  codigoDaFilial,
  consultarInicio,
  liberarPreConsultaInicio,
  verPreConsultaInicio,
  type PreConsultaInicio,
} from './consultasInicio'

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

/** Estado inicial: o resultado da pré-consulta, se ela já respondeu; senão, ainda sem resultado. */
function estadoInicial(pre: PreConsultaInicio | null): EstadoInicio {
  const resultado = pre?.consulta.resultado
  if (!pre || !resultado) return ESTADO_INICIAL
  const chave = chaveDaConsulta(pre.codigoFilial, 0)
  return resultado.ok
    ? { chave, inicio: resultado.valor, erro: null }
    : { chave, inicio: null, erro: mensagemDeErro(resultado.erro) }
}

export function useInicio(): UseInicioResultado {
  const { acesso, filialSelecionada } = useSessao()
  const codigoFilial = codigoDaFilial(filialSelecionada)

  // Pré-consulta da primeira abertura (lida uma vez, na montagem).
  const [preConsulta] = useState(() => verPreConsultaInicio(acesso, codigoFilial))
  const [estado, setEstado] = useState<EstadoInicio>(() => estadoInicial(preConsulta))
  const [recarga, setRecarga] = useState(0)
  const versaoRef = useRef(0)
  // A pré-consulta vale enquanto o efeito só rodou com a chave dela (inclusive a re-execução do
  // <StrictMode>, que preserva estado e refs); a primeira consulta com outra chave a descarta de vez.
  const preConsultaValidaRef = useRef(preConsulta !== null)

  const carregando = estado.chave !== chaveDaConsulta(codigoFilial, recarga)

  useEffect(() => {
    versaoRef.current += 1
    const versao = versaoRef.current
    const chave = chaveDaConsulta(codigoFilial, recarga)

    // A pré-consulta só vale para a primeira consulta (mesma filial, sem recarga). A re-execução do efeito
    // no <StrictMode> reaproveita a mesma pré-consulta (resultado ou promessa), sem novo GET.
    if (preConsulta) liberarPreConsultaInicio(preConsulta)
    const mesmaChave = preConsulta !== null && preConsulta.codigoFilial === codigoFilial && recarga === 0
    if (!mesmaChave) preConsultaValidaRef.current = false
    const aproveitavel = mesmaChave && preConsultaValidaRef.current ? preConsulta : null
    // Já respondeu: o resultado entrou no estado inicial.
    if (aproveitavel?.consulta.resultado) return undefined

    const consulta = aproveitavel ? aproveitavel.consulta.promessa : consultarInicio(codigoFilial)
    consulta.then(
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
  }, [codigoFilial, recarga, preConsulta])

  const recarregar = useCallback(() => setRecarga((valor) => valor + 1), [])

  return { inicio: estado.inicio, carregando, erro: estado.erro, recarregar }
}
