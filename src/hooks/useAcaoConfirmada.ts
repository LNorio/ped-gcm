/**
 * Hook de ação com diálogo de confirmação (F1.13): guarda o alvo do diálogo (`abrir`/`cancelar`) e
 * executa a ação ao `confirmar`, com trava contra clique duplo e erro em português.
 *
 * Decisões:
 * - `confirmar()` nunca rejeita: falhas viram mensagem em `erro` (via `mensagemDeErro`).
 * - Sucesso e falha fecham o diálogo (`alvo` volta a `null`); o sucesso limpa `erro` e chama
 *   `onSucesso(alvo)`.
 * - Enquanto a ação está em andamento, `cancelar()` e novas chamadas de `confirmar()` são ignorados.
 * - `acao` e `onSucesso` são guardados em ref: vale sempre a última referência recebida.
 * - Nada é aplicado (nem `onSucesso`) após a desmontagem.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../services/api'

export interface OpcoesAcaoConfirmada<T> {
  /** Chamado com o alvo depois que a ação termina com sucesso. */
  onSucesso?: (alvo: T) => void
}

export interface UseAcaoConfirmadaResultado<T> {
  /** Alvo do diálogo aberto; `null` com o diálogo fechado. */
  alvo: T | null
  /** Abre o diálogo para o alvo informado (não executa a ação). */
  abrir: (alvo: T) => void
  /** Fecha o diálogo sem executar; ignorado enquanto a ação está em andamento. */
  cancelar: () => void
  /** Executa a ação com o alvo atual. Nunca rejeita. */
  confirmar: () => Promise<void>
  /** `true` enquanto a ação está em andamento. */
  executando: boolean
  /** Mensagem da última falha; `null` após um sucesso ou `limparErro()`. */
  erro: string | null
  limparErro: () => void
}

export function useAcaoConfirmada<T>(
  acao: (alvo: T) => Promise<void>,
  opcoes?: OpcoesAcaoConfirmada<T>,
): UseAcaoConfirmadaResultado<T> {
  const [alvo, setAlvo] = useState<T | null>(null)
  const [executando, setExecutando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const onSucesso = opcoes?.onSucesso
  const acaoRef = useRef(acao)
  const onSucessoRef = useRef(onSucesso)
  const alvoRef = useRef<T | null>(null)
  const executandoRef = useRef(false)
  const montadoRef = useRef(false)

  useEffect(() => {
    acaoRef.current = acao
    onSucessoRef.current = onSucesso
  }, [acao, onSucesso])

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  const abrir = useCallback((novo: T) => {
    if (executandoRef.current) return
    alvoRef.current = novo
    setAlvo(novo)
  }, [])

  const cancelar = useCallback(() => {
    if (executandoRef.current) return
    alvoRef.current = null
    setAlvo(null)
  }, [])

  const confirmar = useCallback(async (): Promise<void> => {
    const atual = alvoRef.current
    if (atual === null || executandoRef.current) return

    executandoRef.current = true
    setExecutando(true)

    let falha: string | null = null
    try {
      await acaoRef.current(atual)
    } catch (motivo) {
      falha = mensagemDeErro(motivo)
    }

    executandoRef.current = false
    alvoRef.current = null
    if (!montadoRef.current) return

    setExecutando(false)
    setAlvo(null)
    setErro(falha)
    if (falha === null) onSucessoRef.current?.(atual)
  }, [])

  const limparErro = useCallback(() => {
    setErro(null)
  }, [])

  return { alvo, abrir, cancelar, confirmar, executando, erro, limparErro }
}
