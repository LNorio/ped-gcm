import type { ReactNode } from 'react'
import './Aviso.css'

export type TipoAviso = 'info' | 'alerta' | 'sucesso' | 'erro'

export interface AvisoProps {
  /** `info` é o padrão. `erro` é anunciado imediatamente por leitores de tela (`role="alert"`). */
  tipo?: TipoAviso
  /** Título em destaque, opcional. */
  titulo?: string
  children: ReactNode
  className?: string
  /**
   * Aviso que aparece dinamicamente (ex.: depois de uma ação) e deve ser anunciado por leitores de tela:
   * `info`, `alerta` e `sucesso` passam a `role="status"`; `erro` continua `role="alert"`. Padrão `false`.
   */
  anunciar?: boolean
}

/**
 * Nota contextual (informação, alerta, sucesso ou erro) exibida dentro de formulários e telas.
 */
export function Aviso({ tipo = 'info', titulo, children, className, anunciar = false }: AvisoProps) {
  const classes = ['aviso', `aviso--${tipo}`]
  if (className) classes.push(className)
  const papel = tipo === 'erro' ? 'alert' : anunciar ? 'status' : 'note'

  return (
    <div role={papel} className={classes.join(' ')}>
      {titulo ? <strong className="aviso__titulo">{titulo}</strong> : null}
      <div className="aviso__conteudo">{children}</div>
    </div>
  )
}
