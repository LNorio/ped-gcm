import { useId, type ComponentProps, type ReactNode } from 'react'
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
  /** Marca o campo como obrigatório: `aria-required` no controle e " *" visual (aria-hidden) no rótulo. */
  obrigatorio?: boolean
  /** Esconde o rótulo visualmente, mantendo-o para leitores de tela (contexto já evidente na tela). */
  rotuloOculto?: boolean
  /** Texto de apoio visível abaixo do campo, incluído na descrição acessível (`aria-describedby`). */
  descricao?: ReactNode
}

/**
 * Lista de seleção (select nativo) com rótulo e mensagem de erro acessíveis.
 */
export function Select({
  rotulo,
  opcoes,
  placeholder,
  erro,
  obrigatorio = false,
  rotuloOculto = false,
  descricao,
  id: idInformado,
  className,
  ...resto
}: SelectProps) {
  const idGerado = useId()
  const id = idInformado ?? idGerado
  const idErro = `${id}-erro`
  const idRotulo = `${id}-rotulo`
  const idDescricao = `${id}-descricao`
  const temDescricao = descricao !== undefined && descricao !== null && descricao !== false && descricao !== ''

  const descricoes: string[] = []
  if (erro) descricoes.push(idErro)
  if (temDescricao) descricoes.push(idDescricao)

  const classes = ['campo__controle', 'foco-interno']
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
      <select
        id={id}
        className={classes.join(' ')}
        aria-invalid={erro ? true : undefined}
        aria-required={obrigatorio ? true : undefined}
        aria-labelledby={obrigatorio ? idRotulo : undefined}
        aria-describedby={descricoes.length > 0 ? descricoes.join(' ') : undefined}
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
      {temDescricao ? (
        <p id={idDescricao} className="campo__dica">
          {descricao}
        </p>
      ) : null}
    </div>
  )
}
