import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Botao } from './Botao'
import './Dialogo.css'

export interface DialogoProps {
  /** Quando `false`, o diálogo não renderiza nada. */
  aberto: boolean
  /** Título exibido no cabeçalho; nomeia o diálogo para leitores de tela. */
  titulo: string
  /** Chamado ao clicar em "Fechar" ou pressionar Esc. O controle de abertura é do componente pai. */
  onFechar: () => void
  children: ReactNode
  /** Botões exibidos no rodapé (alinhados à direita). */
  acoes?: ReactNode
  /** Texto curto logo abaixo do título; vira a descrição acessível do diálogo. */
  descricao?: string
  className?: string
}

const SELETOR_FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function obterFocaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS)).filter(
    (elemento) => !elemento.hasAttribute('hidden') && elemento.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * Diálogo modal acessível: `role="dialog"`, `aria-modal`, nomeado pelo título, com botão "Fechar",
 * fechamento por Esc, foco movido para dentro ao abrir, foco preso enquanto aberto e devolvido ao
 * elemento que o abriu ao fechar.
 */
export function Dialogo({ aberto, titulo, onFechar, children, acoes, descricao, className }: DialogoProps) {
  const idTitulo = useId()
  const idDescricao = useId()
  const painelRef = useRef<HTMLDivElement>(null)
  const elementoAnteriorRef = useRef<HTMLElement | null>(null)

  // Foco: guarda o elemento ativo, move o foco para o painel e devolve ao fechar/desmontar.
  useEffect(() => {
    if (!aberto) return

    elementoAnteriorRef.current = document.activeElement as HTMLElement | null
    painelRef.current?.focus()

    return () => {
      const anterior = elementoAnteriorRef.current
      elementoAnteriorRef.current = null
      if (anterior && anterior.isConnected && typeof anterior.focus === 'function') {
        anterior.focus()
      }
    }
  }, [aberto])

  // Teclado: Esc fecha; Tab/Shift+Tab ficam presos dentro do painel.
  useEffect(() => {
    if (!aberto) return

    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        onFechar()
        return
      }

      if (evento.key !== 'Tab') return
      const painel = painelRef.current
      if (!painel) return

      const focaveis = obterFocaveis(painel)
      const ativo = document.activeElement as HTMLElement | null

      if (focaveis.length === 0) {
        evento.preventDefault()
        painel.focus()
        return
      }

      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const foraDoPainel = !ativo || !painel.contains(ativo)

      if (evento.shiftKey) {
        if (foraDoPainel || ativo === primeiro || ativo === painel) {
          evento.preventDefault()
          ultimo.focus()
        }
      } else if (foraDoPainel || ativo === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoPressionarTecla)
    return () => document.removeEventListener('keydown', aoPressionarTecla)
  }, [aberto, onFechar])

  // Evita rolagem da página atrás do diálogo.
  useEffect(() => {
    if (!aberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto])

  if (!aberto) return null

  const classes = ['dialogo']
  if (className) classes.push(className)

  return (
    <div className="dialogo-fundo">
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao ? idDescricao : undefined}
        tabIndex={-1}
        className={classes.join(' ')}
      >
        <div className="dialogo__cabecalho">
          <div className="dialogo__titulos">
            <h2 id={idTitulo} className="dialogo__titulo">
              {titulo}
            </h2>
            {descricao ? (
              <p id={idDescricao} className="dialogo__descricao">
                {descricao}
              </p>
            ) : null}
          </div>
          <Botao variante="contorno" className="dialogo__fechar" aria-label="Fechar" onClick={onFechar}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Botao>
        </div>
        <div className="dialogo__corpo">{children}</div>
        {acoes ? <footer className="dialogo__acoes">{acoes}</footer> : null}
      </div>
    </div>
  )
}
