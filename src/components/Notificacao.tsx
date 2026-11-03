import { useEffect, useRef } from 'react'
import './Notificacao.css'

export type TipoNotificacao = 'sucesso' | 'erro' | 'info'

export interface NotificacaoProps {
  /** Texto exibido. Com `null`, nada é renderizado e nenhum temporizador é agendado. */
  mensagem: string | null
  /** `sucesso` é o padrão. */
  tipo?: TipoNotificacao
  /** Tempo em milissegundos até `onFechar` ser chamado. Padrão: 3000. */
  duracaoMs?: number
  /** Chamado ao fim do prazo para que o chamador limpe a mensagem. */
  onFechar: () => void
}

/**
 * Notificação temporária ("toast") fixa no canto da tela, anunciada por leitores
 * de tela (`role="status"`). O temporizador reinicia sempre que a mensagem muda e é
 * cancelado ao desmontar.
 */
export function Notificacao({ mensagem, tipo = 'sucesso', duracaoMs = 3000, onFechar }: NotificacaoProps) {
  // Guarda a callback mais recente sem reiniciar o temporizador quando o pai
  // passa uma nova função a cada renderização.
  const onFecharRef = useRef(onFechar)
  useEffect(() => {
    onFecharRef.current = onFechar
  }, [onFechar])

  useEffect(() => {
    if (mensagem === null) return undefined

    const timer = setTimeout(() => {
      onFecharRef.current()
    }, duracaoMs)

    return () => {
      clearTimeout(timer)
    }
  }, [mensagem, duracaoMs])

  if (mensagem === null) return null

  return (
    <div role="status" className={`notificacao notificacao--${tipo}`}>
      {mensagem}
    </div>
  )
}
