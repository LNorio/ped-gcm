/**
 * Apontamentos do mês em subabas por tipo (F9.5 a F9.8 — RF-64 a RF-70, RNF-09), como no protótipo.
 * Controlada pela página (rascunhos, erros e ações); a busca e a aba selecionada são locais.
 *
 * - Subabas no padrão de abas do WAI-ARIA: `tablist` "Tipos de apontamento", um `tab` "{tipo} {N}" por
 *   tipo (N = `quantidade`), na ordem recebida; só a aba selecionada tem `tabindex` 0; setas →/←
 *   (circulares) e Home/End selecionam e levam o foco à aba (ativação automática). Um único `tabpanel`
 *   acessível (o da aba selecionada); os demais ficam `hidden` e vazios.
 * - Seleção inicial: a primeira aba com apontamentos (ou a primeira, se nenhuma tiver). A aba escolhida
 *   é guardada pelo id do tipo, de modo que se mantém quando a tela do mesmo mês é recarregada.
 * - Cada apontamento é um `article` com tipo de valor, situação, indicadores, dashboards e o valor.
 * - No mês editável, o apontamento sem valor tem o `CampoValorApontamento`; o já lançado oferece
 *   "Corrigir". "Histórico" aparece em todo apontamento lançado, em qualquer mês.
 * - `erros[id]` aparece como alerta na linha; o aviso de imagens congeladas (RF-70) também.
 * - Busca "Buscar apontamento ou indicador" em todos os tipos, sem diferenciar acentos nem maiúsculas:
 *   com texto, as abas somem e os encontrados de todos os tipos aparecem numa lista única, na ordem da
 *   tela, cada um com o nome do seu tipo. Limpar a busca volta à aba de antes.
 * - Quando `erros` muda e nenhum apontamento com erro está visível: a busca que esconde algum deles é
 *   limpa e, se nenhum estiver na aba selecionada, é selecionada a aba do primeiro (na ordem da tela).
 * - `pedidoFoco` (um objeto novo a cada pedido) seleciona a aba do apontamento indicado, se preciso, e
 *   leva o foco ao campo de valor dele.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { ErroCampo } from '../../components/ErroCampo'
import { Etiqueta, type TomEtiqueta } from '../../components/Etiqueta'
import {
  ROTULOS_TIPO_VALOR,
  type ApontamentoPreenchimento,
  type SituacaoLancamento,
  type TipoPreenchimento,
} from '../../types/dominio'
import { normalizarBusca } from '../../utils/formato'
import { CampoValorApontamento } from './CampoValorApontamento'
import {
  descreverImagensCongeladas,
  filtrarTiposPreenchimento,
  formatarValorLancamento,
  rotuloSituacaoLancamento,
  textoDashboards,
  textoIndicadores,
} from './regrasPreenchimento'
import './ListaApontamentosPreenchimento.css'

export interface ListaApontamentosPreenchimentoProps {
  tipos: TipoPreenchimento[]
  /** Só o mês aberto aceita lançamento e correção. */
  editavel: boolean
  /** Texto digitado por apontamento (id → texto; no booleano, `'sim'`/`'nao'`). */
  rascunhos: Record<number, string>
  onAlterarRascunho: (id: number, texto: string) => void
  /** Mensagens de erro por apontamento (validação local ou recusa da API). */
  erros: Record<number, string>
  onCorrigir: (apontamento: ApontamentoPreenchimento) => void
  onVerHistorico: (apontamento: ApontamentoPreenchimento) => void
  /** Pedido de foco no campo de valor do apontamento (ex.: o primeiro inválido depois de validar). */
  pedidoFoco?: { id: number } | null
}

const TOM_SITUACAO: Readonly<Record<SituacaoLancamento, TomEtiqueta>> = {
  pendente: 'alerta',
  nao_lancado: 'perigo',
  preenchido: 'sucesso',
  corrigido: 'info',
}

type AcoesLinha = Pick<ListaApontamentosPreenchimentoProps, 'editavel' | 'onAlterarRascunho' | 'onCorrigir' | 'onVerHistorico'>

interface LinhaApontamentoProps extends AcoesLinha {
  apontamento: ApontamentoPreenchimento
  rascunho: string
  erro: string | undefined
  /** Nome do tipo, mostrado só na busca (fora dela, a aba já informa o tipo). */
  nomeTipo?: string
}

function LinhaApontamento({ apontamento, editavel, rascunho, erro, nomeTipo, onAlterarRascunho, onCorrigir, onVerHistorico }: LinhaApontamentoProps) {
  const idNome = useId()
  const lancado = apontamento.valor !== null
  const comCampo = editavel && !lancado
  const avisoImagens = descreverImagensCongeladas(apontamento.imagensCongeladas)

  return (
    <article aria-labelledby={idNome} className="apontamento-preenchimento" data-id-apontamento={apontamento.id}>
      <div className="apontamento-preenchimento__dados">
        <div className="apontamento-preenchimento__cabecalho">
          <h3 id={idNome} className="apontamento-preenchimento__nome">
            {apontamento.nome}
          </h3>
          {nomeTipo !== undefined ? <Etiqueta tom="info">{nomeTipo}</Etiqueta> : null}
          <Etiqueta>{ROTULOS_TIPO_VALOR[apontamento.tipoValor]}</Etiqueta>
          <Etiqueta tom={TOM_SITUACAO[apontamento.situacao]}>{rotuloSituacaoLancamento(apontamento.situacao)}</Etiqueta>
        </div>
        <p className="apontamento-preenchimento__vinculo">{textoIndicadores(apontamento)}</p>
        <p className="apontamento-preenchimento__vinculo">{textoDashboards(apontamento)}</p>
        {avisoImagens ? (
          <Aviso tipo="alerta" className="apontamento-preenchimento__aviso">
            {avisoImagens}
          </Aviso>
        ) : null}
      </div>
      <div className="apontamento-preenchimento__valor">
        {comCampo ? (
          <CampoValorApontamento
            nome={apontamento.nome}
            tipoValor={apontamento.tipoValor}
            valor={rascunho}
            erro={erro}
            onChange={(texto) => onAlterarRascunho(apontamento.id, texto)}
          />
        ) : (
          <>
            <span className="apontamento-preenchimento__valor-lancado">
              {formatarValorLancamento(apontamento.tipoValor, apontamento.valor)}
            </span>
            <ErroCampo mensagem={erro} />
          </>
        )}
        {lancado ? (
          <div className="apontamento-preenchimento__acoes">
            {editavel ? (
              <Botao variante="contorno" tamanho="pequeno" onClick={() => onCorrigir(apontamento)}>
                Corrigir
              </Botao>
            ) : null}
            <Botao variante="link" tamanho="pequeno" onClick={() => onVerHistorico(apontamento)}>
              Histórico
            </Botao>
          </div>
        ) : null}
      </div>
    </article>
  )
}

/** Aba de partida: a primeira com apontamentos (protótipo) ou, se nenhuma tiver, a primeira. */
function abaInicial(tipos: TipoPreenchimento[]): TipoPreenchimento | undefined {
  return tipos.find((tipo) => tipo.apontamentos.length > 0) ?? tipos[0]
}

/** Tipo (aba) que contém o apontamento. */
function tipoDoApontamento(tipos: TipoPreenchimento[], id: number): TipoPreenchimento | undefined {
  return tipos.find((tipo) => tipo.apontamentos.some((apontamento) => apontamento.id === id))
}

/** Ids dos apontamentos exibidos pela busca. */
function idsEncontrados(tipos: TipoPreenchimento[], busca: string): Set<number> {
  return new Set(filtrarTiposPreenchimento(tipos, busca).flatMap(({ apontamentos }) => apontamentos.map((apontamento) => apontamento.id)))
}

interface Exibicao {
  busca: string
  /** Id do tipo da aba selecionada (`null` = seleção inicial). */
  idAba: number | null
}

/**
 * Ajusta a busca e a aba para que um apontamento com erro fique visível: com algum escondido pela
 * busca, a busca é limpa; sem busca, se nenhum estiver na aba selecionada, vai para a aba do primeiro
 * (na ordem da tela).
 */
function mostrarErros(tipos: TipoPreenchimento[], erros: Record<number, string>, atual: Exibicao, idAbaVisivel: number | null): Exibicao {
  const comErro = tipos.flatMap((tipo) => tipo.apontamentos).filter((apontamento) => erros[apontamento.id] !== undefined)
  if (comErro.length === 0) return atual
  let { busca } = atual
  if (normalizarBusca(busca) !== '') {
    const encontrados = idsEncontrados(tipos, busca)
    if (comErro.every((apontamento) => encontrados.has(apontamento.id))) return atual
    busca = ''
  }
  const naAba = tipos.find((tipo) => tipo.id === idAbaVisivel)?.apontamentos.some((apontamento) => erros[apontamento.id] !== undefined)
  if (naAba) return { ...atual, busca }
  return { busca, idAba: tipoDoApontamento(tipos, comErro[0].id)?.id ?? atual.idAba }
}

/** Ajusta a busca e a aba para que o apontamento do pedido de foco fique visível. */
function mostrarApontamento(tipos: TipoPreenchimento[], id: number, atual: Exibicao, idAbaVisivel: number | null): Exibicao {
  const tipo = tipoDoApontamento(tipos, id)
  if (tipo === undefined) return atual
  if (normalizarBusca(atual.busca) !== '') {
    if (idsEncontrados(tipos, atual.busca).has(id)) return atual
    return { busca: '', idAba: tipo.id }
  }
  return tipo.id === idAbaVisivel ? atual : { ...atual, idAba: tipo.id }
}

export function ListaApontamentosPreenchimento({ tipos, pedidoFoco = null, ...props }: ListaApontamentosPreenchimentoProps) {
  const { rascunhos, erros, ...acoes } = props
  const [busca, setBusca] = useState('')
  const [idAbaEscolhida, setIdAbaEscolhida] = useState<number | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const abasRef = useRef(new Map<number, HTMLButtonElement>())
  const idBase = useId()

  const abaVisivel = (idAba: number | null) => (tipos.find((tipo) => tipo.id === idAba) ?? abaInicial(tipos))?.id ?? null

  // Erros novos ou pedido de foco num apontamento que não está visível: limpa a busca e/ou seleciona a
  // aba dele (na própria renderização, antes de o efeito de foco rodar).
  const [errosAnteriores, setErrosAnteriores] = useState(erros)
  const [focoAnterior, setFocoAnterior] = useState(pedidoFoco)
  if (errosAnteriores !== erros || focoAnterior !== pedidoFoco) {
    let exibicao: Exibicao = { busca, idAba: idAbaEscolhida }
    if (errosAnteriores !== erros) {
      setErrosAnteriores(erros)
      exibicao = mostrarErros(tipos, erros, exibicao, abaVisivel(exibicao.idAba))
    }
    if (focoAnterior !== pedidoFoco) {
      setFocoAnterior(pedidoFoco)
      if (pedidoFoco !== null) exibicao = mostrarApontamento(tipos, pedidoFoco.id, exibicao, abaVisivel(exibicao.idAba))
    }
    if (exibicao.busca !== busca) setBusca(exibicao.busca)
    if (exibicao.idAba !== idAbaEscolhida) setIdAbaEscolhida(exibicao.idAba)
  }

  const buscando = normalizarBusca(busca) !== ''
  const idAbaSelecionada = abaVisivel(idAbaEscolhida)

  // Foco no campo de valor do apontamento pedido (caixa de texto ou o primeiro botão Sim/Não).
  useEffect(() => {
    if (pedidoFoco === null) return
    const linha = listaRef.current?.querySelector(`[data-id-apontamento="${pedidoFoco.id}"]`)
    linha?.querySelector<HTMLElement>('.apontamento-preenchimento__valor input, .apontamento-preenchimento__valor button')?.focus()
  }, [pedidoFoco])

  const idAba = (tipo: TipoPreenchimento) => `${idBase}-aba-${tipo.id}`
  const idPainel = (tipo: TipoPreenchimento) => `${idBase}-painel-${tipo.id}`

  function selecionarAba(tipo: TipoPreenchimento, focar: boolean) {
    setIdAbaEscolhida(tipo.id)
    if (focar) abasRef.current.get(tipo.id)?.focus()
  }

  function teclaNaAba(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const ultimo = tipos.length - 1
    const destinos: Record<string, number> = {
      ArrowRight: indice === ultimo ? 0 : indice + 1,
      ArrowLeft: indice === 0 ? ultimo : indice - 1,
      Home: 0,
      End: ultimo,
    }
    const destino = destinos[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    selecionarAba(tipos[destino], true)
  }

  const linha = (apontamento: ApontamentoPreenchimento, nomeTipo?: string) => (
    <LinhaApontamento
      key={apontamento.id}
      apontamento={apontamento}
      rascunho={rascunhos[apontamento.id] ?? ''}
      erro={erros[apontamento.id]}
      nomeTipo={nomeTipo}
      {...acoes}
    />
  )

  function resultadosDaBusca() {
    const encontrados = filtrarTiposPreenchimento(tipos, busca)
    return (
      encontrados.length === 0 ? (
        <p className="lista-preenchimento__vazio">{`Nenhum apontamento encontrado para “${busca.trim()}”.`}</p>
      ) : (
        <div className="tipo-preenchimento__lista">
          {encontrados.flatMap(({ tipo, apontamentos }) => apontamentos.map((apontamento) => linha(apontamento, tipo.nome)))}
        </div>
      )
    )
  }

  function abas() {
    return (
      <>
        <div role="tablist" aria-label="Tipos de apontamento" className="abas-tipos-preenchimento">
          {tipos.map((tipo, indice) => {
            const selecionada = tipo.id === idAbaSelecionada
            return (
              <button
                key={tipo.id}
                ref={(elemento) => {
                  if (elemento) abasRef.current.set(tipo.id, elemento)
                  else abasRef.current.delete(tipo.id)
                }}
                type="button"
                role="tab"
                id={idAba(tipo)}
                aria-selected={selecionada}
                aria-controls={idPainel(tipo)}
                tabIndex={selecionada ? 0 : -1}
                className={selecionada ? 'aba-tipo-preenchimento aba-tipo-preenchimento--ativa foco-anel' : 'aba-tipo-preenchimento foco-anel'}
                onClick={() => selecionarAba(tipo, false)}
                onKeyDown={(evento) => teclaNaAba(evento, indice)}
              >
                <span className="aba-tipo-preenchimento__nome">{tipo.nome}</span>{' '}
                <span className="aba-tipo-preenchimento__contagem contagem-pilula">{tipo.quantidade}</span>
              </button>
            )
          })}
        </div>
        {tipos.map((tipo) => {
          const selecionada = tipo.id === idAbaSelecionada
          return (
            <div
              key={tipo.id}
              role="tabpanel"
              id={idPainel(tipo)}
              aria-labelledby={idAba(tipo)}
              hidden={!selecionada}
              className="tipo-preenchimento"
            >
              {!selecionada ? null : tipo.apontamentos.length === 0 ? (
                <p className="tipo-preenchimento__vazio">{`Nenhum apontamento ativo do tipo ${tipo.nome}.`}</p>
              ) : (
                <div className="tipo-preenchimento__lista">{tipo.apontamentos.map((apontamento) => linha(apontamento))}</div>
              )}
            </div>
          )
        })}
      </>
    )
  }

  return (
    <div className="lista-preenchimento" ref={listaRef}>
      {tipos.length === 0 ? (
        <p className="lista-preenchimento__vazio">Nenhum apontamento ativo nos seus tipos.</p>
      ) : (
        <>
          <div className="lista-preenchimento__busca">
            <Campo
              type="search"
              rotulo="Buscar apontamento ou indicador"
              value={busca}
              autoComplete="off"
              onChange={(evento) => setBusca(evento.target.value)}
            />
            {buscando ? <p className="lista-preenchimento__aviso-busca">Buscando em todos os seus tipos de apontamento.</p> : null}
          </div>
          {buscando ? resultadosDaBusca() : abas()}
        </>
      )}
    </div>
  )
}
