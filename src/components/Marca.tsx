import './Marca.css'

export type TomMarca = 'claro' | 'escuro'

export interface MarcaProps {
  /**
   * `claro` (padrão): marca branca, para fundos azuis (login, cabeçalho).
   * `escuro`: marca na cor primária, para fundos claros (cartões).
   */
  tom?: TomMarca
  className?: string
}

/**
 * Marca "Comercial Mariano" desenhada em SVG inline (sem imagens externas).
 * Exposta a leitores de tela como uma única imagem nomeada.
 */
export function Marca({ tom = 'claro', className }: MarcaProps) {
  const classes = ['marca', `marca--${tom}`]
  if (className) classes.push(className)

  return (
    <div className={classes.join(' ')} role="img" aria-label="Comercial Mariano">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 64 36" className="marca__simbolo">
        <path
          d="M22 7.5c-2.4-1.6-5.2-2.5-8.3-2.5C6.1 5 1 10.6 1 18s5.1 13 12.7 13c3.1 0 5.9-.9 8.3-2.5l-3.2-5.3c-1.4 1-3.1 1.6-5 1.6-4.1 0-6.9-2.9-6.9-6.8s2.8-6.8 6.9-6.8c1.9 0 3.6.6 5 1.6L22 7.5Z"
          fill="currentColor"
        />
        <path d="M34 5h9L34 31h-9L34 5Z" fill="currentColor" />
        <path d="M52 5h9L52 31h-9L52 5Z" fill="currentColor" />
      </svg>
      <span className="marca__texto" aria-hidden="true">
        <span className="marca__linha1">Comercial</span>
        <span className="marca__linha2">Mariano</span>
      </span>
    </div>
  )
}
