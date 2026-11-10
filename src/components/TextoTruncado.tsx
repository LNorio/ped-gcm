import { useLayoutEffect, useRef, useState } from 'react'
import './TextoTruncado.css'

export interface TextoTruncadoProps {
  /** Texto exibido em uma única linha; o texto completo fica no DOM e no `title`. */
  texto: string
  className?: string
}

/**
 * Texto em uma linha que, ao passar da largura disponível, é cortado com reticências e esmaece no
 * final. O esmaecer só é aplicado quando o texto está de fato cortado (`data-cortado="true"`),
 * detectado por `scrollWidth > clientWidth` e reavaliado com `ResizeObserver` quando disponível.
 * O texto completo aparece como dica (`title`) ao passar o mouse.
 */
export function TextoTruncado({ texto, className }: TextoTruncadoProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [cortado, setCortado] = useState(false)

  useLayoutEffect(() => {
    const elemento = ref.current
    if (!elemento) return undefined

    const medir = () => setCortado(elemento.scrollWidth > elemento.clientWidth)
    medir()

    if (typeof ResizeObserver === 'undefined') return undefined
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [texto])

  const classes = ['texto-truncado']
  if (className) classes.push(className)

  return (
    <span ref={ref} className={classes.join(' ')} title={texto} data-cortado={cortado ? 'true' : undefined}>
      {texto}
    </span>
  )
}
