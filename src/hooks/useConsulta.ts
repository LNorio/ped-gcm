/**
 * Hook genérico de consulta (F1.13): carrega um resultado qualquer (lista, página com contagem etc.)
 * ao montar e expõe `dados`, `carregando`, `carregouUmaVez` e `erro`, com `recarregar()` e
 * `setDados()`. O `useListagem` (F1.12) é um invólucro deste hook.
 *
 * Decisões:
 * - `carregar` é guardado em ref: mudar a referência entre renders não dispara nova carga;
 *   `recarregar()` (e a recarga automática) usa sempre a última referência recebida.
 * - `inicial` só é lido na montagem (como em `useState`).
 * - `recarregar()` nunca rejeita: falhas viram mensagem em `erro` (via `mensagemDeErro`). A mensagem
 *   anterior é mantida enquanto a nova carga está em andamento e só é limpa no sucesso.
 * - Proteção de corrida por contador de versão: só a última requisição aplica `dados`/`erro`;
 *   `carregando` volta a `false` apenas quando a última requisição disparada responde.
 * - `carregouUmaVez` vira `true` quando a última requisição disparada responde pela primeira vez
 *   (inclusive com erro); serve para distinguir "ainda não consultou" de "consultou e veio vazio".
 * - `setDados()` durante uma carga em andamento invalida o resultado pendente (uma alteração local
 *   confirmada pela API prevalece sobre um GET antigo). Com `recarregarAposMutacao` (padrão `true`),
 *   quando a carga pendente terminar é disparada **uma** recarga, para que os dados reflitam a
 *   consulta mais recente (ex.: filtros novos) já com a mutação aplicada no servidor.
 * - Nada é aplicado (nem recarga automática) após a desmontagem.
 */
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../services/api'

export interface OpcoesConsulta {
  /**
   * Se `true` (padrão), um `setDados()` feito com carga pendente agenda uma única recarga para
   * quando essa carga terminar. Se `false`, a carga pendente é apenas descartada.
   */
  recarregarAposMutacao?: boolean
}

export interface UseConsultaResultado<R> {
  dados: R
  /** Altera os dados localmente (valor ou função atualizadora) e descarta cargas pendentes. */
  setDados: Dispatch<SetStateAction<R>>
  /** `true` na carga inicial e enquanto a última chamada de `recarregar()` não responde. */
  carregando: boolean
  /** `true` a partir da primeira resposta (sucesso ou erro). */
  carregouUmaVez: boolean
  /** Mensagem do último erro de carga; `null` após uma carga bem-sucedida. */
  erro: string | null
  /** Chama `carregar` de novo. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
}

type ResultadoCarga<R> = { dados: R } | { erro: string }

async function executarCarga<R>(carregar: () => Promise<R>): Promise<ResultadoCarga<R>> {
  try {
    return { dados: await carregar() }
  } catch (falha) {
    return { erro: mensagemDeErro(falha) }
  }
}

export function useConsulta<R>(
  carregar: () => Promise<R>,
  inicial: R,
  opcoes?: OpcoesConsulta,
): UseConsultaResultado<R> {
  const recarregarAposMutacao = opcoes?.recarregarAposMutacao ?? true

  const [dados, setDadosEstado] = useState<R>(inicial)
  const [carregando, setCarregando] = useState(true)
  const [carregouUmaVez, setCarregouUmaVez] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregarRef = useRef(carregar)
  const recarregarAposMutacaoRef = useRef(recarregarAposMutacao)
  const montadoRef = useRef(false)
  /** Versão atual dos dados: incrementada a cada requisição e a cada `setDados`. */
  const versaoRef = useRef(0)
  /** Número da última requisição disparada; só ela encerra o `carregando`. */
  const ultimaRequisicaoRef = useRef(0)
  /** `true` enquanto a última requisição disparada não respondeu. */
  const pendenteRef = useRef(false)
  /** Recarga agendada por um `setDados` feito com carga pendente. */
  const recargaAgendadaRef = useRef(false)

  useEffect(() => {
    carregarRef.current = carregar
    recarregarAposMutacaoRef.current = recarregarAposMutacao
  }, [carregar, recarregarAposMutacao])

  const executar = useCallback(async function executarRequisicao(): Promise<void> {
    versaoRef.current += 1
    const numero = versaoRef.current
    ultimaRequisicaoRef.current = numero
    pendenteRef.current = true

    const resultado = await executarCarga(carregarRef.current)
    if (!montadoRef.current) return

    if (numero === versaoRef.current) {
      if ('erro' in resultado) {
        setErro(resultado.erro)
      } else {
        setDadosEstado(resultado.dados)
        setErro(null)
      }
    }
    if (numero !== ultimaRequisicaoRef.current) return

    pendenteRef.current = false
    setCarregouUmaVez(true)
    if (recargaAgendadaRef.current) {
      recargaAgendadaRef.current = false
      // Mantém `carregando` em `true` e dispara a recarga com a referência mais recente.
      void executarRequisicao()
      return
    }
    setCarregando(false)
  }, [])

  const recarregar = useCallback(async (): Promise<void> => {
    setCarregando(true)
    await executar()
  }, [executar])

  const setDados = useCallback<Dispatch<SetStateAction<R>>>((valor) => {
    if (!montadoRef.current) return
    versaoRef.current += 1
    if (pendenteRef.current && recarregarAposMutacaoRef.current) recargaAgendadaRef.current = true
    setDadosEstado(valor)
  }, [])

  // Carga inicial: o estado já nasce "carregando, sem erro"; só o resultado é aplicado.
  useEffect(() => {
    montadoRef.current = true
    void executar()
    return () => {
      montadoRef.current = false
      recargaAgendadaRef.current = false
    }
  }, [executar])

  return { dados, setDados, carregando, carregouUmaVez, erro, recarregar }
}
