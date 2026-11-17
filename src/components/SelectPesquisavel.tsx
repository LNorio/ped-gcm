import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import { normalizarBusca } from '../utils/formato'
import './Campo.css'
import './SelectPesquisavel.css'

export interface OpcaoSelectPesquisavel {
  valor: string
  rotulo: string
  /** Texto secundário exibido abaixo do rótulo; também entra na busca. */
  descricao?: string
  /** Opção visível, mas que não pode ser escolhida. */
  desabilitado?: boolean
}

export interface SelectPesquisavelProps {
  /** Texto do rótulo visível; é o nome acessível do gatilho e da lista. */
  rotulo: string
  /** Opções exibidas, na ordem informada. */
  opcoes: OpcaoSelectPesquisavel[]
  /** Valor da opção selecionada (`null` quando nada foi escolhido). Componente controlado. */
  valor: string | null
  /** Chamado com o valor da opção escolhida (Enter ou clique). */
  onSelecionar: (valor: string) => void
  /** Texto exibido no gatilho quando nada foi escolhido. */
  placeholder?: string
  /** Mensagem quando a busca não encontra opções. Padrão: "Nenhuma opção encontrada." */
  textoVazio?: string
  /** Nome acessível e placeholder da barra de pesquisa. Padrão: "Pesquisar". */
  rotuloBusca?: string
  /** Id do botão gatilho (gerado quando não informado). */
  id?: string
  className?: string
}

/** Distância entre o gatilho e o painel, em px. */
const ESPACO_CAMPO = 4
/** Altura máxima do painel (barra de pesquisa + lista; 20rem com a fonte base de 16px), em px. */
const ALTURA_MAXIMA = 320
/** Abaixo desta altura disponível sob o gatilho, o painel abre para cima (se houver mais espaço lá). */
const ALTURA_MINIMA_ABAIXO = 200

/** Opções cujo rótulo ou descrição contém a busca (sem acentos e maiúsculas), na ordem original. */
function filtrar(opcoes: OpcaoSelectPesquisavel[], texto: string): OpcaoSelectPesquisavel[] {
  const busca = normalizarBusca(texto)
  if (!busca) return opcoes
  return opcoes.filter(
    (opcao) => normalizarBusca(opcao.rotulo).includes(busca) || normalizarBusca(opcao.descricao).includes(busca),
  )
}

function primeiraHabilitada(opcoes: OpcaoSelectPesquisavel[]): string | null {
  return opcoes.find((opcao) => !opcao.desabilitado)?.valor ?? null
}

/**
 * F1.20 — Lista de seleção com barra de pesquisa dentro do dropdown ("select-only combobox" do
 * WAI-ARIA 1.2). Componente controlado e genérico: recebe as opções e devolve o valor escolhido
 * por `onSelecionar`.
 *
 * - O gatilho é um botão (não editável) que mostra a opção selecionada ou o `placeholder`; abre com
 *   clique, Enter, Espaço, ↓ ou ↑ (receber o foco não abre).
 * - Aberto, o painel tem no topo uma barra de pesquisa (`type="search"`), que recebe o foco e começa
 *   vazia; digitar filtra pelo rótulo e pela descrição, sem diferenciar acentos e maiúsculas
 *   (`normalizarBusca`), mantendo a ordem original.
 * - ↓/↑ na barra movem o destaque (`aria-activedescendant`) pulando as desabilitadas; Enter ou clique
 *   escolhe e devolve o foco ao gatilho; Esc fecha e devolve o foco; Tab e clique fora fecham.
 * - O Esc com a lista aberta não se propaga, para não fechar o `Dialogo` em volta.
 * - O painel fica no DOM do componente, com `position: fixed` calculada a partir do gatilho, para não
 *   ser cortado por containers com `overflow` (corpo de diálogos, quadros com rolagem).
 */
export function SelectPesquisavel({
  rotulo,
  opcoes,
  valor,
  onSelecionar,
  placeholder,
  textoVazio = 'Nenhuma opção encontrada.',
  rotuloBusca = 'Pesquisar',
  id: idInformado,
  className,
}: SelectPesquisavelProps) {
  const idGerado = useId()
  const id = idInformado ?? idGerado
  const idRotulo = `${id}-rotulo`
  const idLista = `${id}-lista`
  const idOpcao = (indice: number) => `${id}-opcao-${indice}`

  const [aberto, setAberto] = useState(false)
  /** Texto da barra de pesquisa (vazio a cada abertura). */
  const [texto, setTexto] = useState('')
  const [destaque, setDestaque] = useState<string | null>(null)
  const [posicao, setPosicao] = useState<CSSProperties>({})

  const raizRef = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  const selecionada = opcoes.find((opcao) => opcao.valor === valor) ?? null

  const filtradas = useMemo(() => filtrar(opcoes, texto), [opcoes, texto])

  function abrir() {
    setAberto(true)
    setTexto('')
    setDestaque(selecionada && !selecionada.desabilitado ? selecionada.valor : primeiraHabilitada(opcoes))
  }

  const fechar = useCallback(() => {
    setAberto(false)
  }, [])

  /** Fecha devolvendo o foco ao gatilho (Enter, Esc, clique numa opção). */
  function fecharComFoco() {
    gatilhoRef.current?.focus()
    fechar()
  }

  function escolher(opcao: OpcaoSelectPesquisavel) {
    if (opcao.desabilitado) return
    fecharComFoco()
    onSelecionar(opcao.valor)
  }

  // Enter e Espaço no botão disparam `click`: a abertura por eles fica só no onClick.
  function aoClicarGatilho() {
    if (aberto) fechar()
    else abrir()
  }

  function aoPressionarTeclaGatilho(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      if (!aberto) abrir()
    }
  }

  function aoDigitar(evento: ChangeEvent<HTMLInputElement>) {
    const novoTexto = evento.target.value
    setTexto(novoTexto)
    setDestaque(primeiraHabilitada(filtrar(opcoes, novoTexto)))
  }

  function moverDestaque(direcao: 1 | -1) {
    const habilitadas = filtradas.filter((opcao) => !opcao.desabilitado)
    if (habilitadas.length === 0) return
    const atual = filtradas.findIndex((opcao) => opcao.valor === destaque)
    if (atual < 0) {
      setDestaque(direcao === 1 ? habilitadas[0].valor : habilitadas[habilitadas.length - 1].valor)
      return
    }
    for (let indice = atual + direcao; indice >= 0 && indice < filtradas.length; indice += direcao) {
      if (!filtradas[indice].desabilitado) {
        setDestaque(filtradas[indice].valor)
        return
      }
    }
  }

  function aoPressionarTeclaBusca(evento: KeyboardEvent<HTMLInputElement>) {
    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        evento.preventDefault()
        moverDestaque(evento.key === 'ArrowDown' ? 1 : -1)
        return
      case 'Enter': {
        evento.preventDefault()
        const opcao = filtradas.find((item) => item.valor === destaque)
        if (opcao) escolher(opcao)
        return
      }
      case 'Escape':
        // Fecha só a lista: o Esc não chega ao listener do `Dialogo` no document.
        evento.preventDefault()
        evento.stopPropagation()
        fecharComFoco()
        return
      case 'Tab':
        // O foco volta ao gatilho antes da ação padrão: o Tab segue a ordem a partir dele.
        gatilhoRef.current?.focus()
        fechar()
        return
      default:
        return
    }
  }

  /** Foco saindo do componente (ex.: clique em outro controle) fecha a lista. */
  function aoPerderFoco(evento: FocusEvent<HTMLDivElement>) {
    if (!aberto) return
    const destino = evento.relatedTarget
    if (destino instanceof Node && raizRef.current?.contains(destino)) return
    fechar()
  }

  // Foco na barra de pesquisa ao abrir.
  useEffect(() => {
    if (aberto) buscaRef.current?.focus()
  }, [aberto])

  // Clique fora fecha.
  useEffect(() => {
    if (!aberto) return
    function aoPressionarPonteiro(evento: MouseEvent) {
      if (evento.target instanceof Node && raizRef.current?.contains(evento.target)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', aoPressionarPonteiro)
    return () => document.removeEventListener('mousedown', aoPressionarPonteiro)
  }, [aberto])

  const calcularPosicao = useCallback(() => {
    const gatilho = gatilhoRef.current
    if (!gatilho) return
    const rect = gatilho.getBoundingClientRect()
    const alturaJanela = window.innerHeight || document.documentElement.clientHeight
    const espacoAbaixo = alturaJanela - rect.bottom - ESPACO_CAMPO * 2
    const espacoAcima = rect.top - ESPACO_CAMPO * 2
    const paraCima = espacoAbaixo < ALTURA_MINIMA_ABAIXO && espacoAcima > espacoAbaixo
    const espaco = paraCima ? espacoAcima : espacoAbaixo
    setPosicao({
      left: rect.left,
      width: rect.width,
      maxHeight: espaco > 0 ? Math.min(ALTURA_MAXIMA, espaco) : ALTURA_MAXIMA,
      ...(paraCima ? { bottom: alturaJanela - rect.top + ESPACO_CAMPO } : { top: rect.bottom + ESPACO_CAMPO }),
    })
  }, [])

  // Posiciona ao abrir e acompanha rolagem e redimensionamento (exceto a rolagem do próprio painel).
  useLayoutEffect(() => {
    if (!aberto) return
    calcularPosicao()
    function aoRolar(evento: Event) {
      if (evento.target instanceof Node && painelRef.current?.contains(evento.target)) return
      calcularPosicao()
    }
    window.addEventListener('scroll', aoRolar, true)
    window.addEventListener('resize', calcularPosicao)
    return () => {
      window.removeEventListener('scroll', aoRolar, true)
      window.removeEventListener('resize', calcularPosicao)
    }
  }, [aberto, calcularPosicao])

  // Mantém a opção destacada visível na lista com rolagem.
  const indiceDestaque = aberto ? opcoes.findIndex((opcao) => opcao.valor === destaque) : -1
  const destaqueVisivel = indiceDestaque >= 0 && filtradas.some((opcao) => opcao.valor === destaque)
  useEffect(() => {
    if (!destaqueVisivel) return
    const elemento = document.getElementById(`${id}-opcao-${indiceDestaque}`)
    elemento?.scrollIntoView?.({ block: 'nearest' })
  }, [destaqueVisivel, id, indiceDestaque])

  const classes = ['campo', 'select-pesquisavel']
  if (className) classes.push(className)

  return (
    <div ref={raizRef} className={classes.join(' ')} onBlur={aoPerderFoco}>
      <label id={idRotulo} className="campo__rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <div className="campo__entrada select-pesquisavel__entrada">
        <button
          ref={gatilhoRef}
          id={id}
          type="button"
          role="combobox"
          className="campo__controle foco-interno select-pesquisavel__gatilho"
          aria-labelledby={idRotulo}
          aria-haspopup="listbox"
          aria-expanded={aberto}
          aria-controls={idLista}
          onClick={aoClicarGatilho}
          onKeyDown={aoPressionarTeclaGatilho}
        >
          {selecionada ? (
            <span className="select-pesquisavel__valor">{selecionada.rotulo}</span>
          ) : (
            <span className="select-pesquisavel__valor select-pesquisavel__valor--vazio">{placeholder}</span>
          )}
        </button>
        <svg
          className="select-pesquisavel__seta"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {aberto ? (
        <div ref={painelRef} className="select-pesquisavel__painel" style={posicao}>
          <div className="select-pesquisavel__busca">
            <input
              ref={buscaRef}
              type="search"
              className="select-pesquisavel__campo-busca foco-interno"
              aria-label={rotuloBusca}
              placeholder={rotuloBusca}
              autoComplete="off"
              spellCheck={false}
              aria-controls={idLista}
              aria-activedescendant={destaqueVisivel ? idOpcao(indiceDestaque) : undefined}
              value={texto}
              onChange={aoDigitar}
              onKeyDown={aoPressionarTeclaBusca}
            />
          </div>
          {/* Mantém o foco na barra: sem isso, clicar na lista tiraria o foco antes do clique. */}
          <div className="select-pesquisavel__rolagem" onMouseDown={(evento) => evento.preventDefault()}>
            <ul id={idLista} role="listbox" aria-labelledby={idRotulo} className="select-pesquisavel__lista">
              {filtradas.map((opcao) => {
                const indice = opcoes.indexOf(opcao)
                const itemClasses = ['select-pesquisavel__opcao']
                if (opcao.valor === destaque) itemClasses.push('select-pesquisavel__opcao--destaque')
                return (
                  <li
                    key={opcao.valor}
                    id={idOpcao(indice)}
                    role="option"
                    aria-selected={opcao.valor === valor}
                    aria-disabled={opcao.desabilitado ? true : undefined}
                    className={itemClasses.join(' ')}
                    onClick={() => escolher(opcao)}
                    onMouseMove={() => {
                      if (!opcao.desabilitado && destaque !== opcao.valor) setDestaque(opcao.valor)
                    }}
                  >
                    <span className="select-pesquisavel__rotulo">{opcao.rotulo}</span>
                    {opcao.descricao ? <span className="select-pesquisavel__descricao">{opcao.descricao}</span> : null}
                  </li>
                )
              })}
            </ul>
            {filtradas.length === 0 ? <p className="select-pesquisavel__vazio">{textoVazio}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
