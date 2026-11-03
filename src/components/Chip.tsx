import type { ReactNode } from 'react'
import './Chip.css'

export interface ChipProps {
  /** Rótulo do filtro. */
  children: ReactNode
  /** Indica se o filtro está selecionado (refletido em `aria-pressed`). */
  ativo?: boolean
  /** Quantidade exibida ao lado do rótulo (zero também é exibido). */
  contagem?: number
  onClick?: () => void
  disabled?: boolean
  className?: string
}

/**
 * Chip de filtro: botão alternável (toggle) usado em barras de filtro e listagens.
 */
export function Chip({ children, ativo = false, contagem, onClick, disabled, className }: ChipProps) {
  const classes = ['chip', 'foco-anel']
  if (ativo) classes.push('chip--ativo')
  if (className) classes.push(className)

  return (
    <button type="button" className={classes.join(' ')} aria-pressed={ativo} onClick={onClick} disabled={disabled}>
      <span className="chip__rotulo">{children}</span>
      {contagem !== undefined ? <span className="chip__contagem contagem-pilula">{contagem}</span> : null}
    </button>
  )
}
