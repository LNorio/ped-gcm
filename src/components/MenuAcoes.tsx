import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Botao } from './Botao'
import './MenuAcoes.css'

export interface ItemMenuAcoes {
  /** Texto do item. */
  rotulo: string
  /** Chamado ao selecionar o item (clique ou Enter), depois de fechar o menu e devolver o foco ao gatilho. */
  onSelecionar: () => void
  /** Destaca o item com a cor de perigo (ações destrutivas, como excluir). */
  perigo?: boolean
}

export interface MenuAcoesProps {
  /** Nome acessível do gatilho (ex.: "Ações do dado externo Faturamento"). */
  rotulo: string
  itens: ItemMenuAcoes[]
  /**
   * Texto visível dentro do gatilho, ao lado do ícone (ex.: "Exportar"). O nome acessível continua
   * sendo `rotulo`. Sem ele, o gatilho mostra só o ícone de três pontos.
   */
  rotuloVisivel?: string
  /** Desabilita o gatilho; se passar a `true` com o menu aberto, o menu fecha sem selecionar nada. */
  desabilitado?: boolean
}

/** Função que fecha o menu aberto no momento (um menu aberto por vez no documento). */
let fecharMenuAberto: (() => void) | null = null

/** Distância, em px, entre o gatilho e o menu flutuante. */
const ESPACO_GATILHO = 4
/** Margem mínima, em px, entre o menu e as bordas superior e inferior da janela. */
const MARGEM_JANELA = 8

/**
 * Menu de ações por linha: botão com ícone de três pontos que abre um menu flutuante
 * (`role="menu"`). O menu usa `position: fixed`, calculado a partir do gatilho, para não ser
 * cortado pelo quadro de rolagem da Tabela.
 */
export function MenuAcoes({ rotulo, itens, rotuloVisivel, desabilitado = false }: MenuAcoesProps) {
  const [aberto, setAberto] = useState(false)
  const [posicao, setPosicao] = useState<CSSProperties>({})
  const wrapperRef = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itensRef = useRef<(HTMLButtonElement | null)[]>([])
  const idMenu = useId()

  const [desabilitadoAnterior, setDesabilitadoAnterior] = useState(desabilitado)

  // Desabilitado com o menu aberto: fecha sem selecionar (ajuste de estado durante a renderização).
  if (desabilitado !== desabilitadoAnterior) {
    setDesabilitadoAnterior(desabilitado)
    if (desabilitado) setAberto(false)
  }

  const fechar = useCallback(() => setAberto(false), [])

  const calcularPosicao = useCallback(() => {
    const gatilho = gatilhoRef.current
    if (!gatilho) return
    const rect = gatilho.getBoundingClientRect()
    // Sem espaço abaixo para o menu (altura medida depois de renderizado), abre para cima se lá houver mais.
    const alturaJanela = window.innerHeight || document.documentElement.clientHeight
    const alturaMenu = menuRef.current?.scrollHeight ?? 0
    const espacoAbaixo = alturaJanela - rect.bottom - ESPACO_GATILHO - MARGEM_JANELA
    const espacoAcima = rect.top - ESPACO_GATILHO - MARGEM_JANELA
    const paraCima = alturaMenu > espacoAbaixo && espacoAcima > espacoAbaixo
    const espaco = paraCima ? espacoAcima : espacoAbaixo
    setPosicao({
      ...(paraCima ? { bottom: alturaJanela - rect.top + ESPACO_GATILHO } : { top: rect.bottom + ESPACO_GATILHO }),
      right: Math.max(0, document.documentElement.clientWidth - rect.right),
      ...(alturaMenu > espaco && espaco > 0 ? { maxHeight: espaco, overflowY: 'auto' as const } : {}),
    })
  }, [])

  // Registro global: abrir este menu fecha o de outra instância.
  useEffect(() => {
    if (!aberto) return
    if (fecharMenuAberto && fecharMenuAberto !== fechar) fecharMenuAberto()
    fecharMenuAberto = fechar
    return () => {
      if (fecharMenuAberto === fechar) fecharMenuAberto = null
    }
  }, [aberto, fechar])

  // Reposiciona com a altura real do menu, já renderizado, antes da pintura (abre para cima se preciso).
  useLayoutEffect(() => {
    if (aberto) calcularPosicao()
  }, [aberto, calcularPosicao])

  // Foco no primeiro item ao abrir.
  useLayoutEffect(() => {
    if (aberto) itensRef.current[0]?.focus()
  }, [aberto])

  // Clique fora (inclusive dentro de um iframe) fecha; rolagem e redimensionamento reposicionam.
  useEffect(() => {
    if (!aberto) return
    function aoPressionar(evento: PointerEvent | MouseEvent) {
      const alvo = evento.target as Node | null
      if (alvo && wrapperRef.current?.contains(alvo)) return
      setAberto(false)
    }
    // Clique dentro de um iframe (ex.: PDF embutido) não gera evento no documento: a janela perde o foco.
    function aoPerderFocoJanela() {
      if (document.activeElement?.tagName === 'IFRAME') setAberto(false)
    }
    document.addEventListener('pointerdown', aoPressionar)
    window.addEventListener('blur', aoPerderFocoJanela)
    window.addEventListener('scroll', calcularPosicao, true)
    window.addEventListener('resize', calcularPosicao)
    return () => {
      document.removeEventListener('pointerdown', aoPressionar)
      window.removeEventListener('blur', aoPerderFocoJanela)
      window.removeEventListener('scroll', calcularPosicao, true)
      window.removeEventListener('resize', calcularPosicao)
    }
  }, [aberto, calcularPosicao])

  if (itens.length === 0) return null

  function abrir() {
    if (desabilitado) return
    calcularPosicao()
    setAberto(true)
  }

  function fecharDevolvendoFoco() {
    setAberto(false)
    gatilhoRef.current?.focus()
  }

  function selecionar(item: ItemMenuAcoes) {
    // O foco volta ao gatilho antes da ação: um Dialogo aberto por ela o guarda para restaurar.
    fecharDevolvendoFoco()
    item.onSelecionar()
  }

  function focarItem(indice: number) {
    const total = itens.length
    itensRef.current[((indice % total) + total) % total]?.focus()
  }

  function aoTeclarNoMenu(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = itensRef.current.findIndex((el) => el === document.activeElement)
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault()
        focarItem(atual + 1)
        break
      case 'ArrowUp':
        evento.preventDefault()
        focarItem(atual < 0 ? -1 : atual - 1)
        break
      case 'Home':
        evento.preventDefault()
        focarItem(0)
        break
      case 'End':
        evento.preventDefault()
        focarItem(itens.length - 1)
        break
      case 'Escape':
        evento.preventDefault()
        evento.stopPropagation()
        fecharDevolvendoFoco()
        break
      case 'Tab':
        setAberto(false)
        break
    }
  }

  return (
    <div className="menu-acoes" ref={wrapperRef}>
      <Botao
        ref={gatilhoRef}
        variante={rotuloVisivel ? 'contorno' : 'link'}
        tamanho="pequeno"
        className={rotuloVisivel ? 'menu-acoes__gatilho menu-acoes__gatilho--com-texto' : 'menu-acoes__gatilho'}
        disabled={desabilitado}
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto && !desabilitado}
        aria-controls={aberto && !desabilitado ? idMenu : undefined}
        onClick={() => (aberto ? setAberto(false) : abrir())}
      >
        {rotuloVisivel ? <span className="menu-acoes__texto">{rotuloVisivel}</span> : null}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </Botao>
      {aberto && !desabilitado ? (
        <div
          id={idMenu}
          role="menu"
          aria-label={rotulo}
          ref={menuRef}
          className="menu-acoes__menu"
          style={posicao}
          onKeyDown={aoTeclarNoMenu}
        >
          {itens.map((item, indice) => (
            <button
              key={`${indice}-${item.rotulo}`}
              ref={(el) => {
                itensRef.current[indice] = el
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={item.perigo ? 'menu-acoes__item menu-acoes__item--perigo' : 'menu-acoes__item'}
              onClick={() => selecionar(item)}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
