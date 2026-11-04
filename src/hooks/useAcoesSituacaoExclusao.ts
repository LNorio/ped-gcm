/**
 * Ações de troca de situação e exclusão com diálogo de confirmação (F1.14), sobre duas instâncias
 * de `useAcaoConfirmada`.
 *
 * Decisões:
 * - Um único erro por vez: quando uma ação é de fato executada (confirmar com alvo), o erro da outra
 *   é limpo na hora. `erro` = erro da situação ou, se não houver, o da exclusão.
 * - Sucesso: chama `onNotificar` com a mensagem da ação e limpa os erros.
 * - Cancelar um diálogo não limpa o erro existente.
 * - `alterarSituacao`, `excluir`, `onNotificar` e `mensagens` são guardados em ref: vale sempre a
 *   última referência recebida.
 * - Nada é aplicado (nem notificação) após a desmontagem.
 */
import { useCallback, useEffect, useRef } from 'react'
import { type UseAcaoConfirmadaResultado, useAcaoConfirmada } from './useAcaoConfirmada'

export interface MensagensAcoesSituacaoExclusao {
  /** Notificação após alterar a situação com sucesso. */
  situacao: string
  /** Notificação após excluir com sucesso. */
  exclusao: string
}

export interface OpcoesAcoesSituacaoExclusao<T> {
  alterarSituacao: (item: T) => Promise<unknown>
  excluir: (item: T) => Promise<unknown>
  onNotificar: (mensagem: string) => void
  mensagens: MensagensAcoesSituacaoExclusao
}

export interface UseAcoesSituacaoExclusaoResultado<T> {
  situacao: UseAcaoConfirmadaResultado<T>
  exclusao: UseAcaoConfirmadaResultado<T>
  /** Mensagem da última ação que falhou; `null` sem erro. */
  erro: string | null
  /** Limpa os erros das duas ações. */
  limparErros: () => void
}

export function useAcoesSituacaoExclusao<T>(
  opcoes: OpcoesAcoesSituacaoExclusao<T>,
): UseAcoesSituacaoExclusaoResultado<T> {
  const { alterarSituacao, excluir, onNotificar, mensagens } = opcoes

  const alterarSituacaoRef = useRef(alterarSituacao)
  const excluirRef = useRef(excluir)
  const onNotificarRef = useRef(onNotificar)
  const mensagensRef = useRef(mensagens)
  /** `limparErro` de cada ação, para uma limpar o erro da outra. */
  const limparErroSituacaoRef = useRef<() => void>(() => {})
  const limparErroExclusaoRef = useRef<() => void>(() => {})

  useEffect(() => {
    alterarSituacaoRef.current = alterarSituacao
    excluirRef.current = excluir
    onNotificarRef.current = onNotificar
    mensagensRef.current = mensagens
  }, [alterarSituacao, excluir, onNotificar, mensagens])

  const limparErros = useCallback(() => {
    limparErroSituacaoRef.current()
    limparErroExclusaoRef.current()
  }, [])

  // `useAcaoConfirmada` chama a ação de forma síncrona ao confirmar (antes do primeiro `await`),
  // então a limpeza do erro da outra ação acontece na hora — e só quando a ação é executada.
  const acaoSituacao = useCallback(async (item: T): Promise<void> => {
    limparErroExclusaoRef.current()
    await alterarSituacaoRef.current(item)
  }, [])

  const acaoExclusao = useCallback(async (item: T): Promise<void> => {
    limparErroSituacaoRef.current()
    await excluirRef.current(item)
  }, [])

  const sucessoSituacao = useCallback(() => {
    onNotificarRef.current(mensagensRef.current.situacao)
    limparErros()
  }, [limparErros])

  const sucessoExclusao = useCallback(() => {
    onNotificarRef.current(mensagensRef.current.exclusao)
    limparErros()
  }, [limparErros])

  const situacao = useAcaoConfirmada<T>(acaoSituacao, { onSucesso: sucessoSituacao })
  const exclusao = useAcaoConfirmada<T>(acaoExclusao, { onSucesso: sucessoExclusao })

  useEffect(() => {
    limparErroSituacaoRef.current = situacao.limparErro
    limparErroExclusaoRef.current = exclusao.limparErro
  }, [situacao.limparErro, exclusao.limparErro])

  return { situacao, exclusao, erro: situacao.erro ?? exclusao.erro, limparErros }
}
