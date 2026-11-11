/**
 * Inserção de texto no cursor de uma caixa de texto da modal da integração (`DialogoConcluirConstrucao`):
 * variáveis e operadores na entrada (F5.7). Cada caixa que usar o hook tem a sua instância, então as
 * posições são independentes.
 *
 * Enquanto o usuário não posicionar o cursor desde a abertura (ou desde `reiniciar()`, usado por
 * "Inserir modelo"), a inserção vai para o fim do texto; depois vale a última posição ou seleção do
 * usuário (guardada por `guardarSelecao` nos eventos da caixa, mesmo após ela perder o foco), e
 * inserções seguidas continuam depois do último texto inserido. Depois de inserir, a caixa recebe o foco
 * com o cursor logo após o texto.
 */
import { type RefObject, type SyntheticEvent, useLayoutEffect, useRef } from 'react'

interface Selecao {
  inicio: number
  fim: number
}

export interface InsercaoNoCursor {
  /** Ligar no `ref` da caixa de texto. */
  ref: RefObject<HTMLTextAreaElement | null>
  /** Ligar nos eventos de foco, clique, seleção, teclado e digitação da caixa. */
  guardarSelecao: (evento: SyntheticEvent<HTMLTextAreaElement>) => void
  /** Insere o texto na posição/seleção guardada (ou no fim) e chama `alterar` com o novo valor. */
  inserir: (texto: string) => void
  /** Esquece a posição guardada: a próxima inserção vai para o fim do texto. */
  reiniciar: () => void
}

export function useInsercaoNoCursor(valor: string, alterar: (novo: string) => void): InsercaoNoCursor {
  const ref = useRef<HTMLTextAreaElement>(null)
  /** Última posição/seleção escolhida pelo usuário (ou logo após o último texto inserido); `null` = fim. */
  const selecaoRef = useRef<Selecao | null>(null)
  /** Posição do cursor a aplicar depois de inserir. */
  const cursorPendenteRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const posicao = cursorPendenteRef.current
    const campo = ref.current
    if (posicao === null || campo === null) return
    cursorPendenteRef.current = null
    campo.focus()
    campo.setSelectionRange(posicao, posicao)
    // Depois do foco programático, que também passa pelos eventos que guardam a seleção.
    selecaoRef.current = { inicio: posicao, fim: posicao }
  }, [valor])

  function guardarSelecao(evento: SyntheticEvent<HTMLTextAreaElement>) {
    const { selectionStart, selectionEnd } = evento.currentTarget
    selecaoRef.current = { inicio: selectionStart, fim: selectionEnd }
  }

  function inserir(texto: string) {
    const selecao = selecaoRef.current
    const inicio = Math.min(selecao?.inicio ?? valor.length, valor.length)
    const fim = Math.min(Math.max(selecao?.fim ?? inicio, inicio), valor.length)
    const posicao = inicio + texto.length
    cursorPendenteRef.current = posicao
    selecaoRef.current = { inicio: posicao, fim: posicao }
    alterar(valor.slice(0, inicio) + texto + valor.slice(fim))
  }

  function reiniciar() {
    selecaoRef.current = null
  }

  return { ref, guardarSelecao, inserir, reiniciar }
}
