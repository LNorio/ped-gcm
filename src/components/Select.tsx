import { useId, type ComponentProps } from 'react'
import { ErroCampo } from './ErroCampo'
import './Campo.css'

export interface OpcaoSelect {
  valor: string
  rotulo: string
  desabilitado?: boolean
}

export interface SelectProps extends Omit<ComponentProps<'select'>, 'children'> {
  /** Texto do rótulo, sempre associado ao select. */
  rotulo: string
  /** Opções exibidas, na ordem informada. */
  opcoes: OpcaoSelect[]
  /** Texto da primeira opção (valor vazio e desabilitada), usado quando nada foi escolhido. */
  placeholder?: string
  /** Mensagem de validação; quando presente, marca o campo como inválido. */
  erro?: string | null
}

/**
 * Lista de seleção (select nativo) com rótulo e mensagem de erro acessíveis.
 */
export function Select({ rotulo, opcoes, placeholder, erro, id: idInformado, className, ...resto }: SelectProps) {
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
      <select
        id={id}
        className={classes.join(' ')}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        {...resto}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor} disabled={opcao.desabilitado}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
      <ErroCampo id={idErro} mensagem={erro} />
    </div>
  )
}
