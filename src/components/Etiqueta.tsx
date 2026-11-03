import type { ReactNode } from 'react'
import './Etiqueta.css'

export type TomEtiqueta = 'neutro' | 'info' | 'sucesso' | 'alerta' | 'perigo' | 'dourado'

export interface EtiquetaProps {
  children: ReactNode
  /** Cor semântica. `neutro` é o padrão. */
  tom?: TomEtiqueta
  className?: string
}

/**
 * Etiqueta (tag) informativa, sem interação — usada para status e marcadores.
 */
export function Etiqueta({ children, tom = 'neutro', className }: EtiquetaProps) {
  const classes = ['etiqueta', `etiqueta--${tom}`]
  if (className) classes.push(className)

  return <span className={classes.join(' ')}>{children}</span>
}
