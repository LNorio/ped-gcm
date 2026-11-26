import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
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
  /**
   * Destino do foco ao fechar quando o elemento que abriu o diálogo saiu da página (ex.: a linha
   * excluída). Sem a prop (ou com o elemento fora da página), o foco vai para o `<h1>` da página ou,
   * sem `<h1>`, para o `<main>`; nunca fica no `<body>` (F12.1, M3).
   */
  focoAoFechar?: RefObject<HTMLElement | null>
}

const SELETOR_FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function obterFocaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS)).filter(
    (elemento) => !elemento.hasAttribute('hidden') && elemento.getAttribute('aria-hidden') !== 'true',
  )
}

interface EntradaPilha {
  obterPainel: () => HTMLDivElement | null
  fechar: () => void
}

/**
 * Pilha dos diálogos abertos (o último é o de cima). Um único listener de teclado no `document`
 * encaminha Esc e Tab só ao diálogo do topo, independentemente da ordem de registro.
 */
const pilhaDialogos: EntradaPilha[] = []

function aoPressionarTecla(evento: KeyboardEvent) {
  const topo = pilhaDialogos[pilhaDialogos.length - 1]
  if (!topo) return

  if (evento.key === 'Escape') {
    evento.preventDefault()
    topo.fechar()
    return
  }

  if (evento.key !== 'Tab') return
  const painel = topo.obterPainel()
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

/**
 * Foco que chega fora do painel do diálogo do topo (ex.: ao sair do `iframe` do PDF pelo Tab, cujas
 * teclas não passam pelo `document` da página) volta para dentro: ao primeiro focável se o elemento
 * fica depois do painel, ao último se fica antes (F12.1, M2).
 */
function aoReceberFoco(evento: FocusEvent) {
  const topo = pilhaDialogos[pilhaDialogos.length - 1]
  if (!topo) return
  const painel = topo.obterPainel()
  const alvo = evento.target
  if (!painel || !painel.isConnected || !(alvo instanceof Node) || painel.contains(alvo)) return

  const focaveis = obterFocaveis(painel)
  if (focaveis.length === 0) {
    painel.focus()
    return
  }
  const antesDoPainel = Boolean(painel.compareDocumentPosition(alvo) & Node.DOCUMENT_POSITION_PRECEDING)
  focaveis[antesDoPainel ? focaveis.length - 1 : 0].focus()
}

/** Coloca o diálogo no topo da pilha; devolve a função que o retira. */
function empilharDialogo(entrada: EntradaPilha): () => void {
  if (pilhaDialogos.length === 0) {
    document.addEventListener('keydown', aoPressionarTecla)
    document.addEventListener('focusin', aoReceberFoco)
  }
  pilhaDialogos.push(entrada)
  return () => {
    const indice = pilhaDialogos.lastIndexOf(entrada)
    if (indice >= 0) pilhaDialogos.splice(indice, 1)
    if (pilhaDialogos.length === 0) {
      document.removeEventListener('keydown', aoPressionarTecla)
      document.removeEventListener('focusin', aoReceberFoco)
    }
  }
}

/** Foca o elemento; se ele não recebe foco por padrão (ex.: `<h1>`), ganha `tabIndex=-1` antes. */
function focarElemento(elemento: HTMLElement): boolean {
  if (!elemento.isConnected) return false
  if (!elemento.hasAttribute('tabindex') && !elemento.matches(SELETOR_FOCAVEIS)) elemento.tabIndex = -1
  elemento.focus()
  return document.activeElement === elemento
}

/** Destino estável quando o elemento que abriu o diálogo saiu da página (F12.1, M3). */
function focarDestinoEstavel(focoAoFechar: HTMLElement | null | undefined) {
  if (focoAoFechar && focarElemento(focoAoFechar)) return
  const principal = document.querySelector<HTMLElement>('main')
  const titulo = principal?.querySelector<HTMLElement>('h1') ?? document.querySelector<HTMLElement>('h1')
  if (titulo && focarElemento(titulo)) return
  const principalDoTitulo = titulo?.closest<HTMLElement>('main')
  if (principalDoTitulo && focarElemento(principalDoTitulo)) return
  if (principal) focarElemento(principal)
}

/** Tempo (ms) em que o diálogo, já fechado, ainda acompanha a saída do elemento que o abriu. */
const VIGIA_GATILHO_MS = 5000

/**
 * O foco voltou ao elemento que abriu o diálogo, mas ele pode sair da página logo depois (ex.: a linha
 * some quando a listagem é recarregada após a exclusão). Se isso acontecer com o foco nele, o foco vai
 * para o destino estável em vez de cair no `<body>`. Devolve a função que encerra a vigia.
 */
function vigiarSaidaDoGatilho(gatilho: HTMLElement, obterFocoAoFechar: () => HTMLElement | null | undefined) {
  if (typeof MutationObserver === 'undefined') return () => {}
  let encerrada = false
  const observador = new MutationObserver(() => {
    const ativo = document.activeElement
    if (gatilho.isConnected) {
      if (ativo !== gatilho) encerrar()
      return
    }
    if (!ativo || ativo === document.body) focarDestinoEstavel(obterFocoAoFechar())
    encerrar()
  })
  const temporizador = setTimeout(encerrar, VIGIA_GATILHO_MS)
  function encerrar() {
    if (encerrada) return
    encerrada = true
    observador.disconnect()
    clearTimeout(temporizador)
  }
  observador.observe(document.body, { childList: true, subtree: true })
  return encerrar
}

/**
 * Diálogo modal acessível: `role="dialog"`, `aria-modal`, nomeado pelo título, com botão "Fechar",
 * fechamento por Esc, foco movido para dentro ao abrir, foco preso enquanto aberto e devolvido ao
 * elemento que o abriu ao fechar.
 */
export function Dialogo({
  aberto,
  titulo,
  onFechar,
  children,
  acoes,
  descricao,
  className,
  focoAoFechar,
}: DialogoProps) {
  const idTitulo = useId()
  const idDescricao = useId()
  const painelRef = useRef<HTMLDivElement>(null)
  const elementoAnteriorRef = useRef<HTMLElement | null>(null)

  // Mantém as versões mais recentes de `onFechar` e `focoAoFechar` sem reinscrever o diálogo na pilha.
  const onFecharRef = useRef(onFechar)
  const focoAoFecharRef = useRef(focoAoFechar)
  useEffect(() => {
    onFecharRef.current = onFechar
    focoAoFecharRef.current = focoAoFechar
  }, [onFechar, focoAoFechar])

  // Vigia do gatilho do último fechamento; encerrada ao reabrir ou desmontar.
  const encerrarVigiaRef = useRef<(() => void) | null>(null)

  // Foco e teclado: guarda o elemento ativo, move o foco para o painel e entra na pilha de diálogos
  // abertos (só o do topo trata Esc, Tab/Shift+Tab e o foco que chega fora dele). Ao fechar, sai da
  // pilha antes de devolver o foco: ao elemento que abriu, se ainda está na página, ou a um destino
  // estável (`focoAoFechar`, `<h1>` ou `<main>`).
  useEffect(() => {
    if (!aberto) return
    encerrarVigiaRef.current?.()
    encerrarVigiaRef.current = null

    elementoAnteriorRef.current = document.activeElement as HTMLElement | null
    const desempilhar = empilharDialogo({
      obterPainel: () => painelRef.current,
      fechar: () => onFecharRef.current(),
    })
    painelRef.current?.focus()
    // Lido só no fechamento: vale o `focoAoFechar` mais recente.
    const obterFocoAoFechar = () => focoAoFecharRef.current?.current

    return () => {
      desempilhar()
      const anterior = elementoAnteriorRef.current
      elementoAnteriorRef.current = null
      const anteriorNaPagina =
        anterior !== null && anterior !== document.body && anterior.isConnected && typeof anterior.focus === 'function'
      if (anteriorNaPagina) {
        anterior.focus()
        if (document.activeElement === anterior) {
          encerrarVigiaRef.current = vigiarSaidaDoGatilho(anterior, obterFocoAoFechar)
          return
        }
      }
      // Outro diálogo continua aberto por baixo: o foco vai para ele, não para a página.
      const abaixo = pilhaDialogos[pilhaDialogos.length - 1]?.obterPainel()
      if (abaixo) {
        abaixo.focus()
        return
      }
      focarDestinoEstavel(obterFocoAoFechar())
    }
  }, [aberto])

  // Ao desmontar, encerra a vigia (declarado depois do efeito acima: a limpeza roda depois da dele).
  useEffect(() => () => encerrarVigiaRef.current?.(), [])

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
