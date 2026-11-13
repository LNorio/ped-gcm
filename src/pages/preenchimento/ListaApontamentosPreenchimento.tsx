/**
 * Apontamentos do mês por tipo (F9.5 a F9.8 — RF-64 a RF-70, RNF-09). Controlada pela página (rascunhos,
 * erros e ações); só a busca é local.
 *
 * - Uma região por tipo (nome acessível = nome do tipo), na ordem recebida, com "N apontamento(s)".
 * - Cada apontamento é um `article` com tipo de valor, situação, indicadores, dashboards e o valor.
 * - No mês editável, o apontamento sem valor tem o `CampoValorApontamento`; o já lançado oferece
 *   "Corrigir". "Histórico" aparece em todo apontamento lançado, em qualquer mês.
 * - `erros[id]` aparece como alerta na linha; o aviso de imagens congeladas (RF-70) também.
 * - Busca "Buscar apontamento ou indicador" em todos os tipos, sem diferenciar acentos nem maiúsculas.
 *   Quando `erros` muda e traz o erro de um apontamento escondido pela busca, a busca é limpa.
 * - `pedidoFoco` (um objeto novo a cada pedido) leva o foco ao campo de valor do apontamento indicado.
 */
import { useEffect, useId, useRef, useState } from 'react'
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
import { CampoValorApontamento } from './CampoValorApontamento'
import {
  descreverImagensCongeladas,
  filtrarTiposPreenchimento,
  formatarValorLancamento,
  rotuloSituacaoLancamento,
  textoDashboards,
  textoIndicadores,
  textoQuantidadeApontamentos,
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

interface LinhaApontamentoProps extends Omit<ListaApontamentosPreenchimentoProps, 'tipos' | 'rascunhos' | 'erros' | 'pedidoFoco'> {
  apontamento: ApontamentoPreenchimento
  rascunho: string
  erro: string | undefined
}

function LinhaApontamento({ apontamento, editavel, rascunho, erro, onAlterarRascunho, onCorrigir, onVerHistorico }: LinhaApontamentoProps) {
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

function RegiaoTipo({
  tipo,
  apontamentos,
  quantidade,
  ...props
}: Omit<ListaApontamentosPreenchimentoProps, 'tipos' | 'pedidoFoco'> & { tipo: TipoPreenchimento; apontamentos: ApontamentoPreenchimento[]; quantidade: number }) {
  const idTitulo = useId()
  const { rascunhos, erros, ...acoes } = props

  return (
    <section aria-labelledby={idTitulo} className="tipo-preenchimento">
      <div className="tipo-preenchimento__cabecalho">
        <h2 id={idTitulo} className="tipo-preenchimento__nome">
          {tipo.nome}
        </h2>
        <span className="tipo-preenchimento__quantidade">{textoQuantidadeApontamentos(quantidade)}</span>
      </div>
      {apontamentos.length === 0 ? (
        <p className="tipo-preenchimento__vazio">{`Nenhum apontamento ativo do tipo ${tipo.nome}.`}</p>
      ) : (
        <div className="tipo-preenchimento__lista">
          {apontamentos.map((apontamento) => (
            <LinhaApontamento
              key={apontamento.id}
              apontamento={apontamento}
              rascunho={rascunhos[apontamento.id] ?? ''}
              erro={erros[apontamento.id]}
              {...acoes}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** `true` se algum apontamento com erro não está entre os exibidos pela busca. */
function haErroOculto(erros: Record<number, string>, filtrados: ReturnType<typeof filtrarTiposPreenchimento>): boolean {
  const ids = Object.keys(erros).map(Number)
  if (ids.length === 0) return false
  const visiveis = new Set(filtrados.flatMap(({ apontamentos }) => apontamentos.map((apontamento) => apontamento.id)))
  return ids.some((id) => !visiveis.has(id))
}

export function ListaApontamentosPreenchimento({ tipos, pedidoFoco = null, ...props }: ListaApontamentosPreenchimentoProps) {
  const [busca, setBusca] = useState('')
  const listaRef = useRef<HTMLDivElement>(null)

  // Erros novos de um apontamento escondido pela busca: limpa a busca (na própria renderização) para
  // que o erro fique visível na linha dele.
  const [errosAnteriores, setErrosAnteriores] = useState(props.erros)
  if (errosAnteriores !== props.erros) {
    setErrosAnteriores(props.erros)
    if (busca !== '' && haErroOculto(props.erros, filtrarTiposPreenchimento(tipos, busca))) {
      setBusca('')
    }
  }
  const filtrados = filtrarTiposPreenchimento(tipos, busca)

  // Foco no campo de valor do apontamento pedido (caixa de texto ou o primeiro botão Sim/Não).
  useEffect(() => {
    if (pedidoFoco === null) return
    const linha = listaRef.current?.querySelector(`[data-id-apontamento="${pedidoFoco.id}"]`)
    linha?.querySelector<HTMLElement>('.apontamento-preenchimento__valor input, .apontamento-preenchimento__valor button')?.focus()
  }, [pedidoFoco])

  function conteudo() {
    if (tipos.length === 0) return <p className="lista-preenchimento__vazio">Nenhum apontamento ativo nos seus tipos.</p>
    if (filtrados.length === 0) {
      return <p className="lista-preenchimento__vazio">{`Nenhum apontamento encontrado para “${busca.trim()}”.`}</p>
    }
    return filtrados.map(({ tipo, apontamentos, quantidade }) => (
      <RegiaoTipo key={tipo.id} tipo={tipo} apontamentos={apontamentos} quantidade={quantidade} {...props} />
    ))
  }

  return (
    <div className="lista-preenchimento" ref={listaRef}>
      {tipos.length > 0 ? (
        <div className="lista-preenchimento__busca">
          <Campo
            type="search"
            rotulo="Buscar apontamento ou indicador"
            value={busca}
            autoComplete="off"
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </div>
      ) : null}
      {conteudo()}
    </div>
  )
}
