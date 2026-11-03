/**
 * Hook genérico de listagem (F1.12): carrega uma lista ao montar e expõe o estado padrão das
 * telas de cadastro (`itens`, `carregando`, `erro`) com `recarregar()` e `setItens()`.
 *
 * Decisões:
 * - `carregar` é guardado em ref: mudar a referência entre renders não dispara nova carga;
 *   `recarregar()` usa sempre a última referência recebida.
 * - `recarregar()` nunca rejeita: falhas viram mensagem em `erro` (via `mensagemDeErro`). A mensagem
 *   anterior é mantida enquanto a nova carga está em andamento e só é limpa no sucesso.
 * - Proteção de corrida por contador: só a última requisição aplica `itens`/`erro`; `carregando`
 *   volta a `false` apenas quando a última requisição disparada responde.
 * - `setItens()` durante uma carga em andamento invalida o resultado pendente (uma alteração local
 *   confirmada pela API, como uma exclusão, prevalece sobre um GET antigo).
 * - Nada é aplicado após a desmontagem.
 */
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../services/api'

export interface UseListagemResultado<T> {
  itens: T[]
  /** `true` na carga inicial e enquanto a última chamada de `recarregar()` não responde. */
  carregando: boolean
  /** Mensagem do último erro de carga; `null` após uma carga bem-sucedida. */
  erro: string | null
  /** Chama `carregar` de novo. Nunca rejeita: falhas vão para `erro`. */
  recarregar: () => Promise<void>
  /** Altera a lista localmente (valor ou função atualizadora) e descarta cargas pendentes. */
  setItens: Dispatch<SetStateAction<T[]>>
}

type ResultadoCarga<T> = { itens: T[] } | { erro: string }

async function executarCarga<T>(carregar: () => Promise<T[]>): Promise<ResultadoCarga<T>> {
  try {
    return { itens: await carregar() }
  } catch (falha) {
    return { erro: mensagemDeErro(falha) }
  }
}

export function useListagem<T>(carregar: () => Promise<T[]>): UseListagemResultado<T> {
  const [itens, setItensEstado] = useState<T[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregarRef = useRef(carregar)
  const montadoRef = useRef(false)
  /** Versão atual dos dados: incrementada a cada requisição e a cada `setItens`. */
  const versaoRef = useRef(0)
  /** Número da última requisição disparada; só ela encerra o `carregando`. */
  const ultimaRequisicaoRef = useRef(0)

  useEffect(() => {
    carregarRef.current = carregar
  }, [carregar])

  const executar = useCallback(async (): Promise<void> => {
    versaoRef.current += 1
    const numero = versaoRef.current
    ultimaRequisicaoRef.current = numero

    const resultado = await executarCarga(carregarRef.current)
    if (!montadoRef.current) return

    if (numero === versaoRef.current) {
      if ('erro' in resultado) {
        setErro(resultado.erro)
      } else {
        setItensEstado(resultado.itens)
        setErro(null)
      }
    }
    if (numero === ultimaRequisicaoRef.current) setCarregando(false)
  }, [])

  const recarregar = useCallback(async (): Promise<void> => {
    setCarregando(true)
    await executar()
  }, [executar])

  const setItens = useCallback<Dispatch<SetStateAction<T[]>>>((valor) => {
    if (!montadoRef.current) return
    versaoRef.current += 1
    setItensEstado(valor)
  }, [])

  // Carga inicial: o estado já nasce "carregando, sem erro"; só o resultado é aplicado.
  useEffect(() => {
    montadoRef.current = true
    void executar()
    return () => {
      montadoRef.current = false
    }
  }, [executar])

  return { itens, carregando, erro, recarregar, setItens }
}
