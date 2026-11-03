import type { ComponentProps } from 'react'
import './Botao.css'

export type VarianteBotao =
  | 'primario'
  | 'dourado'
  | 'contorno'
  | 'perigo'
  | 'perigo-cheio'
  | 'link'
  /** Transparente com borda e texto brancos, para uso sobre fundo primário (cabeçalho). */
  | 'sobre-primaria'
export type TamanhoBotao = 'normal' | 'pequeno'

export interface BotaoProps extends ComponentProps<'button'> {
  /** Estilo visual. `primario` (azul) é o padrão. */
  variante?: VarianteBotao
  /** `pequeno` reduz altura e fonte (ações em linhas de tabela, por exemplo). */
  tamanho?: TamanhoBotao
}

/**
 * Botão padrão do sistema. Botões somente com ícone devem receber `aria-label`.
 */
export function Botao({
  variante = 'primario',
  tamanho = 'normal',
  type = 'button',
  className,
  children,
  ...resto
}: BotaoProps) {
  const classes = ['botao', 'foco-anel', `botao--${variante}`]
  if (tamanho === 'pequeno') classes.push('botao--pequeno')
  if (className) classes.push(className)

  return (
    <button type={type} className={classes.join(' ')} {...resto}>
      {children}
    </button>
  )
}
