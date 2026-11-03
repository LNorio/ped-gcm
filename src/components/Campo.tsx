import { useId, type ComponentProps } from 'react'
import { ErroCampo } from './ErroCampo'
import './Campo.css'

export interface CampoProps extends ComponentProps<'input'> {
  /** Texto do rótulo, sempre associado ao input. */
  rotulo: string
  /** Mensagem de validação; quando presente, marca o campo como inválido. */
  erro?: string | null
  /** Texto auxiliar exibido abaixo do campo e usado como descrição acessível. */
  dica?: string
}

/**
 * Campo de texto (input) com rótulo, dica e mensagem de erro acessíveis.
 */
export function Campo({ rotulo, erro, dica, id: idInformado, className, ...resto }: CampoProps) {
  const idGerado = useId()
  const id = idInformado ?? idGerado
  const idErro = `${id}-erro`
  const idDica = `${id}-dica`

  const descricoes: string[] = []
  if (erro) descricoes.push(idErro)
  if (dica) descricoes.push(idDica)

  const classes = ['campo__controle', 'foco-interno']
  if (className) classes.push(className)

  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <input
        id={id}
        className={classes.join(' ')}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricoes.length > 0 ? descricoes.join(' ') : undefined}
        {...resto}
      />
      <ErroCampo id={idErro} mensagem={erro} />
      {dica ? (
        <p id={idDica} className="campo__dica">
          {dica}
        </p>
      ) : null}
    </div>
  )
}
