/**
 * Dropdown com busca usado no formulário de dashboard (F7.5 e F7.6) e nos vínculos de tipo (F3.4), no padrão dd / dd-btn / dd-panel /
 * dd-opt do protótipo (dashModal): botão com `aria-expanded` e `aria-haspopup`, painel com a busca
 * (opcional) e a lista de opções (nome + subtexto). Opções desabilitadas ficam visíveis, com
 * `aria-disabled`. Uma opção de ação pode abrir a lista (ex.: "Selecionar todas as filiais (N)").
 *
 * Aberto, o painel fecha (como qualquer lista suspensa) com clique fora do componente (botão + painel)
 * e com Esc — este devolve o foco ao botão e não se propaga, para não fechar o `Dialogo` em volta.
 * Fecha por `onFechar`; sem ela, por `onAlternar`.
 *
 * Dentro de um <form>, Enter na busca não envia o formulário (o envio implícito gravaria sem querer);
 * Enter numa opção continua escolhendo a opção.
 *
 * Foco (F12.1, A4): a opção escolhida some da lista, então o foco vai para a busca (painel aberto e com
 * busca) ou para o botão (sem busca, ou quando o painel fecha), nunca para o `<body>`. `refBotao` dá
 * acesso ao botão, para quem usa o seletor devolver o foco a ele (ex.: ao remover o último item).
 */
import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { Campo } from './Campo'
import './SeletorBusca.css'

export interface OpcaoSeletor {
  id: string
  nome: string
  subtexto?: string | null
  desabilitada?: boolean
}

/** Opção de ação exibida no topo da lista, em destaque. */
export interface AcaoSeletor {
  nome: string
  subtexto?: string | null
  onEscolher: () => void
}

export interface SeletorBuscaProps {
  textoBotao: string
  aberto: boolean
  onAlternar: () => void
  /**
   * Fecha o painel (clique fora e Esc, só com o painel aberto). Sem ela, o componente usa `onAlternar`.
   */
  onFechar?: () => void
  /** Rótulo (oculto) da busca; sem ele, o painel não tem busca. */
  rotuloBusca?: string
  /** Placeholder da busca; o padrão é "{rotuloBusca}...". */
  placeholderBusca?: string
  busca?: string
  onBusca?: (texto: string) => void
  rotuloLista: string
  opcoes: OpcaoSeletor[]
  /** Ação exibida antes das opções; `null` ou ausente quando não há. */
  acaoInicial?: AcaoSeletor | null
  /** Mensagem exibida abaixo da lista (sem opções); `null` quando não há. */
  mensagemVazia: string | null
  onEscolher: (id: string) => void
  /** Ref do botão que abre o painel (para devolver o foco a ele). */
  refBotao?: RefObject<HTMLButtonElement | null>
}

// Seta do botão que abre o dropdown.
export const ICONE_SETA = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
)

// Ícone do botão "Remover" (o nome acessível vem do aria-label).
export const ICONE_REMOVER = (
  <svg
    width="14"
    height="14"
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
)

export function SeletorBusca({
  textoBotao,
  aberto,
  onAlternar,
  onFechar,
  rotuloBusca,
  placeholderBusca,
  busca = '',
  onBusca,
  rotuloLista,
  opcoes,
  acaoInicial = null,
  mensagemVazia,
  onEscolher,
  refBotao,
}: SeletorBuscaProps) {
  const raizRef = useRef<HTMLDivElement>(null)
  const botaoInternoRef = useRef<HTMLButtonElement>(null)
  const botaoRef = refBotao ?? botaoInternoRef
  const buscaRef = useRef<HTMLInputElement>(null)
  // Depois de escolher, o foco é conferido de novo na renderização seguinte (o painel pode ter fechado).
  const focoPendenteRef = useRef(false)
  // Callback mais recente para os listeners do documento, sem reinscrevê-los a cada renderização.
  const fecharRef = useRef<() => void>(onFechar ?? onAlternar)
  useEffect(() => {
    fecharRef.current = onFechar ?? onAlternar
  })

  // Clique fora fecha. pointerdown e mousedown do mesmo clique fecham uma única vez (o fallback
  // `onAlternar` alterna o estado, e chamá-lo duas vezes reabriria o painel).
  useEffect(() => {
    if (!aberto) return
    let fechado = false
    function aoPressionar(evento: Event) {
      if (fechado) return
      if (evento.target instanceof Node && raizRef.current?.contains(evento.target)) return
      fechado = true
      focoPendenteRef.current = false
      fecharRef.current()
    }
    document.addEventListener('pointerdown', aoPressionar)
    document.addEventListener('mousedown', aoPressionar)
    return () => {
      document.removeEventListener('pointerdown', aoPressionar)
      document.removeEventListener('mousedown', aoPressionar)
    }
  }, [aberto])

  // Esc (na busca, numa opção ou no botão) fecha só o painel e devolve o foco ao botão.
  function aoPressionarTecla(evento: KeyboardEvent<HTMLDivElement>) {
    if (!aberto || evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    focoPendenteRef.current = false
    botaoRef.current?.focus()
    fecharRef.current()
  }

  // Foco depois de escolher: a busca, se o painel continua aberto e tem busca; senão, o botão.
  function focarAposEscolher() {
    const alvo = buscaRef.current?.isConnected ? buscaRef.current : botaoRef.current
    alvo?.focus()
  }

  useEffect(() => {
    if (!focoPendenteRef.current) return
    focoPendenteRef.current = false
    focarAposEscolher()
  })

  function aoEscolher(escolher: () => void) {
    escolher()
    focoPendenteRef.current = true
    focarAposEscolher()
  }

  // Enter na busca não dispara o envio implícito do formulário em volta.
  function impedirEnvioPelaBusca(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') evento.preventDefault()
  }

  return (
    <div ref={raizRef} className="seletor-busca" onKeyDown={aoPressionarTecla}>
      <button
        ref={botaoRef}
        type="button"
        className="seletor-busca__botao foco-anel"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={onAlternar}
      >
        <span>{textoBotao}</span>
        {ICONE_SETA}
      </button>
      {aberto ? (
        <div className="seletor-busca__painel">
          {rotuloBusca ? (
            <div className="seletor-busca__busca">
              <Campo
                rotulo={rotuloBusca}
                rotuloOculto
                type="search"
                autoComplete="off"
                placeholder={placeholderBusca ?? `${rotuloBusca}...`}
                ref={buscaRef}
                value={busca}
                onChange={(evento) => onBusca?.(evento.target.value)}
                onKeyDown={impedirEnvioPelaBusca}
              />
            </div>
          ) : null}
          <div role="listbox" aria-label={rotuloLista} className="seletor-busca__opcoes">
            {acaoInicial ? (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="seletor-busca__opcao seletor-busca__opcao--acao foco-anel"
                onClick={() => aoEscolher(acaoInicial.onEscolher)}
              >
                <span>{acaoInicial.nome}</span>
                {acaoInicial.subtexto ? <small>{acaoInicial.subtexto}</small> : null}
              </button>
            ) : null}
            {opcoes.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                role="option"
                aria-selected={false}
                aria-disabled={opcao.desabilitada ? true : undefined}
                disabled={opcao.desabilitada}
                className={
                  opcao.desabilitada
                    ? 'seletor-busca__opcao seletor-busca__opcao--indisponivel foco-anel'
                    : 'seletor-busca__opcao foco-anel'
                }
                onClick={() => aoEscolher(() => onEscolher(opcao.id))}
              >
                <span>{opcao.nome}</span>
                {opcao.subtexto ? <small>{opcao.subtexto}</small> : null}
              </button>
            ))}
          </div>
          {mensagemVazia ? <p className="seletor-busca__vazio">{mensagemVazia}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
