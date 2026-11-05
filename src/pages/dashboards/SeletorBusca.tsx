/**
 * Dropdown com busca usado no formulário de dashboard (F7.5 e F7.6), no padrão dd / dd-btn / dd-panel /
 * dd-opt do protótipo (dashModal): botão com `aria-expanded` e `aria-haspopup`, painel com a busca
 * (opcional) e a lista de opções (nome + subtexto). Opções desabilitadas ficam visíveis, com
 * `aria-disabled`. Uma opção de ação pode abrir a lista (ex.: "Selecionar todas as filiais (N)").
 */
import { Campo } from '../../components/Campo'
import './FormularioDashboard.css'

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
  rotuloBusca,
  placeholderBusca,
  busca = '',
  onBusca,
  rotuloLista,
  opcoes,
  acaoInicial = null,
  mensagemVazia,
  onEscolher,
}: SeletorBuscaProps) {
  return (
    <div className="formulario-dashboard__dd">
      <button
        type="button"
        className="formulario-dashboard__dd-botao foco-anel"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={onAlternar}
      >
        <span>{textoBotao}</span>
        {ICONE_SETA}
      </button>
      {aberto ? (
        <div className="formulario-dashboard__dd-painel">
          {rotuloBusca ? (
            <div className="formulario-dashboard__dd-busca">
              <Campo
                rotulo={rotuloBusca}
                rotuloOculto
                type="search"
                autoComplete="off"
                placeholder={placeholderBusca ?? `${rotuloBusca}...`}
                value={busca}
                onChange={(evento) => onBusca?.(evento.target.value)}
              />
            </div>
          ) : null}
          <div role="listbox" aria-label={rotuloLista} className="formulario-dashboard__dd-opcoes">
            {acaoInicial ? (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="formulario-dashboard__dd-opcao formulario-dashboard__dd-opcao--acao foco-anel"
                onClick={acaoInicial.onEscolher}
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
                    ? 'formulario-dashboard__dd-opcao formulario-dashboard__dd-opcao--indisponivel foco-anel'
                    : 'formulario-dashboard__dd-opcao foco-anel'
                }
                onClick={() => onEscolher(opcao.id)}
              >
                <span>{opcao.nome}</span>
                {opcao.subtexto ? <small>{opcao.subtexto}</small> : null}
              </button>
            ))}
          </div>
          {mensagemVazia ? <p className="formulario-dashboard__dd-vazio">{mensagemVazia}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
