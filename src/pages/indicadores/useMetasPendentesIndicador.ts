/**
 * Estado da modal "Definir metas pendentes" (F6.12), usada pela `IndicadoresPage`:
 * - `abrir(indicador)`: abre a modal limpa (sem erros);
 * - `confirmar(metas)`: chama `definirMetasPendentes` (do `useIndicadores`, que grava e recarrega a
 *   lista) uma única vez por envio (clique duplo ignorado); no sucesso fecha a modal e chama `onSalvas`;
 *   no erro deixa a modal aberta com a mensagem da API (`erro`) e os erros por filial
 *   (`errosPorFilial`, só no 400 com `erros`);
 * - `fechar()`: ignorado durante a gravação; não chama a API.
 */
import { useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { type ErroDeFilial, type ResultadoMetasPendentes, errosPorFilial } from '../../services/indicadoresService'
import type { Indicador, MetaDaFilial } from '../../types/dominio'

const SEM_ERROS_FILIAIS: ErroDeFilial[] = []

export interface UseMetasPendentesIndicadorOpcoes {
  /** Grava as metas (PUT) e recarrega a lista; rejeita com a `ApiError` em caso de falha. */
  definirMetasPendentes: (id: number, metas: MetaDaFilial[]) => Promise<ResultadoMetasPendentes>
  /** Chamado depois de gravar com sucesso (a modal já foi fechada). */
  onSalvas: () => void
}

export function useMetasPendentesIndicador({ definirMetasPendentes, onSalvas }: UseMetasPendentesIndicadorOpcoes) {
  const [alvo, setAlvo] = useState<Indicador | null>(null)
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [errosFiliais, setErrosFiliais] = useState<ErroDeFilial[]>(SEM_ERROS_FILIAIS)
  const gravandoRef = useRef(false)
  const montadoRef = useRef(false)

  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  function limparErros() {
    setErro(null)
    setErrosFiliais(SEM_ERROS_FILIAIS)
  }

  function abrir(indicador: Indicador) {
    limparErros()
    setAlvo(indicador)
  }

  function fechar() {
    if (gravandoRef.current) return
    setAlvo(null)
    limparErros()
  }

  async function confirmar(metas: MetaDaFilial[]) {
    if (gravandoRef.current || alvo === null) return
    gravandoRef.current = true
    setGravando(true)
    limparErros()
    try {
      await definirMetasPendentes(alvo.id, metas)
      if (!montadoRef.current) return
      setAlvo(null)
      onSalvas()
    } catch (falha) {
      if (montadoRef.current) {
        setErro(mensagemDeErro(falha))
        setErrosFiliais(errosPorFilial(falha))
      }
    } finally {
      gravandoRef.current = false
      if (montadoRef.current) setGravando(false)
    }
  }

  return { alvo, gravando, erro, errosFiliais, abrir, fechar, confirmar }
}
