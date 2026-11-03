import { useId, type ComponentProps } from 'react'
import { ErroCampo } from './ErroCampo'
import './Campo.css'

export interface AreaTextoProps extends ComponentProps<'textarea'> {
  /** Texto do rótulo, sempre associado ao textarea. */
  rotulo: string
  /** Mensagem de validação; quando presente, marca o campo como inválido. */
  erro?: string | null
}

/**
 * Área de texto (textarea) com rótulo e mensagem de erro acessíveis.
 */
export function AreaTexto({ rotulo, erro, id: idInformado, className, ...resto }: AreaTextoProps) {
  const idGerado = useId()
  const id = idInformado ?? idGerado
  const idErro = `${id}-erro`

  const classes = ['campo__controle', 'foco-interno']
  if (className) classes.push(className)

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <textarea
        id={id}
        className={classes.join(' ')}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        {...resto}
      />
      <ErroCampo id={idErro} mensagem={erro} />
    </div>
  )
}
