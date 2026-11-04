import { useId, type ComponentProps, type ReactNode } from 'react'
import { ErroCampo } from './ErroCampo'
import './Campo.css'

export interface CampoProps extends ComponentProps<'input'> {
  /** Texto do rótulo, sempre associado ao input. */
  rotulo: string
  /** Mensagem de validação; quando presente, marca o campo como inválido. */
  erro?: string | null
  /** Marca o campo como obrigatório: `aria-required` no controle e " *" visual (aria-hidden) no rótulo. */
  obrigatorio?: boolean
  /** Texto auxiliar exibido abaixo do campo e usado como descrição acessível. */
  dica?: string
  /** Esconde o rótulo visualmente, mantendo-o para leitores de tela (contexto já evidente na tela). */
  rotuloOculto?: boolean
  /**
   * Conteúdo exibido sobre o canto direito do input (ex.: botão de mostrar/ocultar senha).
   * Fica fora do rótulo e não entra na descrição acessível; use `className="campo__sufixo"` no
   * elemento para posicioná-lo.
   */
  sufixo?: ReactNode
}

/**
 * Campo de texto (input) com rótulo, dica e mensagem de erro acessíveis.
 */
export function Campo({
  rotulo,
  erro,
  obrigatorio = false,
  dica,
  rotuloOculto = false,
  sufixo,
  id: idInformado,
  className,
  ...resto
}: CampoProps) {
  const idGerado = useId()
  const id = idInformado ?? idGerado
  const idErro = `${id}-erro`
  const idRotulo = `${id}-rotulo`
  const idDica = `${id}-dica`

  const descricoes: string[] = []
  if (erro) descricoes.push(idErro)
  if (dica) descricoes.push(idDica)

  const temSufixo = sufixo !== undefined && sufixo !== null && sufixo !== false
  const classes = ['campo__controle', 'foco-interno']
  if (temSufixo) classes.push('campo__controle--com-sufixo')
  if (className) classes.push(className)

  return (
    <div className="campo">
      <label className={rotuloOculto ? 'campo__rotulo visualmente-oculto' : 'campo__rotulo'} htmlFor={id}>
        {/* Com a marca " *", o nome acessível vem só do texto do rótulo (aria-labelledby). */}
        {obrigatorio ? <span id={idRotulo}>{rotulo}</span> : rotulo}
        {obrigatorio ? (
          <span aria-hidden="true" className="campo__obrigatorio">
            {' *'}
          </span>
        ) : null}
      </label>
      <div className="campo__entrada">
        <input
          id={id}
          className={classes.join(' ')}
          aria-invalid={erro ? true : undefined}
          aria-required={obrigatorio ? true : undefined}
          aria-labelledby={obrigatorio ? idRotulo : undefined}
          aria-describedby={descricoes.length > 0 ? descricoes.join(' ') : undefined}
          {...resto}
        />
        {temSufixo ? sufixo : null}
      </div>
      <ErroCampo id={idErro} mensagem={erro} />
      {dica ? (
        <p id={idDica} className="campo__dica">
          {dica}
        </p>
      ) : null}
    </div>
  )
}
