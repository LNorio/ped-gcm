import { useId, type ComponentProps } from 'react'
import { ErroCampo } from './ErroCampo'
import './Campo.css'

export interface AreaTextoProps extends ComponentProps<'textarea'> {
  /** Texto do rótulo, sempre associado ao textarea. */
  rotulo: string
  /** Mensagem de validação; quando presente, marca o campo como inválido. */
  erro?: string | null
  /** Marca o campo como obrigatório: `aria-required` no controle e " *" visual (aria-hidden) no rótulo. */
  obrigatorio?: boolean
}

/**
 * Área de texto (textarea) com rótulo e mensagem de erro acessíveis.
 */
export function AreaTexto({
  rotulo,
  erro,
  obrigatorio = false,
  id: idInformado,
  className,
  ...resto
}: AreaTextoProps) {
  const idGerado = useId()
  const id = idInformado ?? idGerado
  const idErro = `${id}-erro`
  const idRotulo = `${id}-rotulo`

  const classes = ['campo__controle', 'foco-interno']
  if (className) classes.push(className)

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        {/* Com a marca " *", o nome acessível vem só do texto do rótulo (aria-labelledby). */}
        {obrigatorio ? <span id={idRotulo}>{rotulo}</span> : rotulo}
        {obrigatorio ? (
          <span aria-hidden="true" className="campo__obrigatorio">
            {' *'}
          </span>
        ) : null}
      </label>
      <textarea
        id={id}
        className={classes.join(' ')}
        aria-invalid={erro ? true : undefined}
        aria-required={obrigatorio ? true : undefined}
        aria-labelledby={obrigatorio ? idRotulo : undefined}
        aria-describedby={erro ? idErro : undefined}
        {...resto}
      />
      <ErroCampo id={idErro} mensagem={erro} />
    </div>
  )
}
