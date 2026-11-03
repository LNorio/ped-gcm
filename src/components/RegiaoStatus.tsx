import './RegiaoStatus.css'

export type TipoRegiaoStatus = 'status' | 'erro'

export interface RegiaoStatusProps {
  /** Texto anunciado. Sem mensagem, a região permanece no DOM, vazia. */
  mensagem?: string | null
  /** `status` (padrão) usa `aria-live="polite"`; `erro` usa `role="alert"` e `aria-live="assertive"`. */
  tipo?: TipoRegiaoStatus
  className?: string
}

/**
 * Região ARIA live sempre presente no DOM, para que leitores de tela anunciem
 * mudanças de estado (carregando, salvo, erro de rede).
 */
export function RegiaoStatus({ mensagem, tipo = 'status', className }: RegiaoStatusProps) {
  const erro = tipo === 'erro'
  const classes = ['regiao-status', `regiao-status--${tipo}`]
  if (className) classes.push(className)

  return (
    <div
      role={erro ? 'alert' : 'status'}
      aria-live={erro ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={classes.join(' ')}
    >
      {mensagem ?? ''}
    </div>
  )
}
