import { useId, type ReactNode } from 'react'
import './Card.css'

export interface CardProps {
  /** Título exibido no cabeçalho; também nomeia a região para leitores de tela. */
  titulo?: string
  /** Nível do heading do título (padrão `2`). */
  nivelTitulo?: 2 | 3 | 4
  /** Ações exibidas à direita do título (botões, links). */
  acoes?: ReactNode
  children: ReactNode
  className?: string
  /**
   * Remove o padding do corpo, para conteúdos que devem encostar nas bordas do card
   * (ex.: barra de filtros + tabela). Título e ações não são afetados.
   */
  semPadding?: boolean
}

/**
 * Painel com borda e fundo branco. Com `titulo`, vira uma região nomeada (`<section aria-labelledby>`).
 */
export function Card({
  titulo,
  nivelTitulo = 2,
  acoes,
  children,
  className,
  semPadding = false,
}: CardProps) {
  const idTitulo = useId()
  const Titulo = `h${nivelTitulo}` as const

  const classes = ['card']
  if (className) classes.push(className)

  const classesCorpo = ['card__corpo']
  if (semPadding) classesCorpo.push('card__corpo--sem-padding')

  return (
    <section className={classes.join(' ')} aria-labelledby={titulo ? idTitulo : undefined}>
      {titulo ? (
        <header className="card__cabecalho">
          <Titulo id={idTitulo} className="card__titulo">
            {titulo}
          </Titulo>
          {acoes ? <div className="card__acoes">{acoes}</div> : null}
        </header>
      ) : null}
      <div className={classesCorpo.join(' ')}>{children}</div>
    </section>
  )
}
