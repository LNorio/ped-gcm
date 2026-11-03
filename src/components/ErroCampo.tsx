import './ErroCampo.css'

export interface ErroCampoProps {
  /** Mensagem de validação. Quando vazia, nula ou indefinida, nada é renderizado. */
  mensagem?: string | null
  /** Id para ser referenciado pelo `aria-describedby` do controle. */
  id?: string
}

/**
 * Mensagem de erro de um campo de formulário, anunciada como alerta por leitores de tela.
 */
export function ErroCampo({ mensagem, id }: ErroCampoProps) {
  if (!mensagem) return null

  return (
    <p id={id} role="alert" className="erro-campo">
      {mensagem}
    </p>
  )
}
