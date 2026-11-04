/**
 * Hook genérico de listagem (F1.12): carrega uma lista ao montar e expõe o estado padrão das
 * telas de cadastro (`itens`, `carregando`, `erro`) com `recarregar()` e `setItens()`.
 *
 * Desde a F1.13 é um invólucro de `useConsulta` com valor inicial `[]` e
 * `recarregarAposMutacao: false`. Decisões herdadas:
 * - `carregar` é guardado em ref: mudar a referência entre renders não dispara nova carga;
 *   `recarregar()` usa sempre a última referência recebida.
 * - `recarregar()` nunca rejeita: falhas viram mensagem em `erro` (via `mensagemDeErro`). A mensagem
 *   anterior é mantida enquanto a nova carga está em andamento e só é limpa no sucesso.
 * - Proteção de corrida: só a última requisição aplica `itens`/`erro`; `carregando` volta a `false`
 *   apenas quando a última requisição disparada responde.
 * - `setItens()` durante uma carga em andamento invalida o resultado pendente (uma alteração local
 *   confirmada pela API, como uma exclusão, prevalece sobre um GET antigo), sem recarga automática.
 * - Nada é aplicado após a desmontagem.
 */
import type { Dispatch, SetStateAction } from 'react'
import { useConsulta } from './useConsulta'

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

const OPCOES = { recarregarAposMutacao: false } as const

export function useListagem<T>(carregar: () => Promise<T[]>): UseListagemResultado<T> {
  const { dados, setDados, carregando, erro, recarregar } = useConsulta<T[]>(carregar, [], OPCOES)
  return { itens: dados, carregando, erro, recarregar, setItens: setDados }
}
