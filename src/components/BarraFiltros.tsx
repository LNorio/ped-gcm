import { useId, type KeyboardEvent } from 'react'
import { normalizarBusca } from '../utils/formato'
import { Botao } from './Botao'
import { Chip } from './Chip'
import './Campo.css'
import './BarraFiltros.css'

/** Opção do seletor de situação (ex.: Todas, Ativos, Inativos). */
export interface OpcaoSituacao {
  valor: string
  rotulo: string
  /** Quantidade de registros na situação; zero também é exibido. */
  contagem?: number
}

/** Botão de filtro com contagem (ex.: por tipo ou periodicidade). */
export interface BotaoFiltro {
  valor: string
  rotulo: string
  contagem: number
}

export interface BarraFiltrosProps {
  /** Texto atual da busca (controlado pelo pai). */
  busca: string
  /**
   * Chamado a cada alteração da busca com o texto digitado e a versão normalizada
   * (sem acentos, minúscula, espaços reduzidos — RNF-09) para uso direto no filtro.
   */
  onBuscaChange: (valor: string, normalizado: string) => void
  /** Rótulo do campo de busca. Padrão: "Buscar". */
  rotuloBusca?: string
  placeholderBusca?: string

  /** Situações exibidas como lista de opções; sem elas o seletor não é renderizado. */
  situacoes?: OpcaoSituacao[]
  /** Valor da situação selecionada. A primeira situação é considerada o padrão. */
  situacao?: string
  onSituacaoChange?: (valor: string) => void
  /** Rótulo acessível do seletor de situação. Padrão: "Situação". */
  rotuloSituacoes?: string

  /** Botões alternáveis com contagem; sem eles o grupo não é renderizado. */
  botoes?: BotaoFiltro[]
  /** Valor do botão ativo ou null quando nenhum está ativo. */
  botaoAtivo?: string | null
  /** Recebe o valor clicado, ou null ao clicar no botão já ativo (desmarca). */
  onBotaoChange?: (valor: string | null) => void
  /** Rótulo acessível do grupo de botões. Padrão: "Tipo". */
  rotuloBotoes?: string

  /** Quando informado, exibe "Limpar filtros" sempre que houver algum filtro ativo. */
  onLimpar?: () => void
}

/**
 * Barra de filtros reutilizável das listagens: busca normalizada, seletor de situação,
 * botões com contagem e "Limpar filtros". Não conhece regras de negócio — recebe as opções,
 * as contagens e os valores selecionados por props e devolve as mudanças pelos callbacks.
 */
export function BarraFiltros({
  busca,
  onBuscaChange,
  rotuloBusca = 'Buscar',
  placeholderBusca,
  situacoes,
  situacao,
  onSituacaoChange,
  rotuloSituacoes = 'Situação',
  botoes,
  botaoAtivo = null,
  onBotaoChange,
  rotuloBotoes = 'Tipo',
  onLimpar,
}: BarraFiltrosProps) {
  const idBusca = useId()

  const temSituacoes = situacoes !== undefined && situacoes.length > 0
  const temBotoes = botoes !== undefined && botoes.length > 0

  const situacaoPadrao = temSituacoes ? situacoes[0].valor : undefined
  const situacaoAlterada = temSituacoes && situacao !== undefined && situacao !== situacaoPadrao
  /*
   * Roving tabindex: só a opção selecionada entra na ordem de tabulação. Se `situacao` não
   * corresponder a nenhuma opção (indefinida ou valor desconhecido), a primeira recebe o foco,
   * para o listbox nunca sair da ordem de tabulação.
   */
  const indiceSelecionado = temSituacoes ? situacoes.findIndex((opcao) => opcao.valor === situacao) : -1
  const indiceFocavel = indiceSelecionado === -1 ? 0 : indiceSelecionado
  const filtrosAtivos = busca !== '' || situacaoAlterada || botaoAtivo !== null
  const exibirLimpar = onLimpar !== undefined && filtrosAtivos

  const selecionarSituacao = (valor: string) => {
    onSituacaoChange?.(valor)
  }

  /** Navegação por teclado no listbox: setas movem a seleção; Home/End vão às pontas. */
  const aoTeclarSituacao = (evento: KeyboardEvent<HTMLDivElement>, indice: number) => {
    if (!temSituacoes) return
    const ultimo = situacoes.length - 1
    let destino: number | null = null

    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        destino = indice === ultimo ? 0 : indice + 1
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        destino = indice === 0 ? ultimo : indice - 1
        break
      case 'Home':
        destino = 0
        break
      case 'End':
        destino = ultimo
        break
      case 'Enter':
      case ' ':
        evento.preventDefault()
        selecionarSituacao(situacoes[indice].valor)
        return
      default:
        return
    }

    evento.preventDefault()
    selecionarSituacao(situacoes[destino].valor)
    const opcoes = evento.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="option"]')
    opcoes?.[destino]?.focus()
  }

  return (
    <div className="barra-filtros">
      <div className="barra-filtros__busca">
        <label className="rotulo-secao" htmlFor={idBusca}>
          {rotuloBusca}
        </label>
        <input
          id={idBusca}
          type="search"
          className="campo__controle foco-interno barra-filtros__campo"
          value={busca}
          placeholder={placeholderBusca}
          autoComplete="off"
          onChange={(evento) => onBuscaChange(evento.target.value, normalizarBusca(evento.target.value))}
        />
      </div>

      {temSituacoes ? (
        <div className="barra-filtros__secao">
          <span className="rotulo-secao" aria-hidden="true">
            {rotuloSituacoes}
          </span>
          <div className="barra-filtros__situacoes" role="listbox" aria-label={rotuloSituacoes}>
            {situacoes.map((opcao, indice) => {
              const selecionada = opcao.valor === situacao
              const classes = ['barra-filtros__situacao']
              if (selecionada) classes.push('barra-filtros__situacao--ativa')
              return (
                <div
                  key={opcao.valor}
                  role="option"
                  aria-selected={selecionada}
                  tabIndex={indice === indiceFocavel ? 0 : -1}
                  className={classes.join(' ')}
                  onClick={() => selecionarSituacao(opcao.valor)}
                  onKeyDown={(evento) => aoTeclarSituacao(evento, indice)}
                >
                  <span className="barra-filtros__situacao-rotulo">{opcao.rotulo}</span>
                  {opcao.contagem !== undefined ? (
                    <span className="barra-filtros__situacao-contagem contagem-pilula">{opcao.contagem}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {temBotoes ? (
        <div className="barra-filtros__secao">
          <span className="rotulo-secao" aria-hidden="true">
            {rotuloBotoes}
          </span>
          <div className="barra-filtros__botoes" role="group" aria-label={rotuloBotoes}>
            {botoes.map((botao) => {
              const ativo = botao.valor === botaoAtivo
              return (
                <Chip
                  key={botao.valor}
                  ativo={ativo}
                  contagem={botao.contagem}
                  onClick={() => onBotaoChange?.(ativo ? null : botao.valor)}
                >
                  {botao.rotulo}
                </Chip>
              )
            })}
          </div>
        </div>
      ) : null}

      {exibirLimpar ? (
        <div className="barra-filtros__limpar">
          <Botao variante="link" tamanho="pequeno" onClick={onLimpar}>
            Limpar filtros
          </Botao>
        </div>
      ) : null}
    </div>
  )
}
