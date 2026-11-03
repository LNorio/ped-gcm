import { useId } from 'react'
import { formatarDataHora } from '../utils/formato'
import { Etiqueta } from './Etiqueta'
import './Historico.css'

/** Um registro de auditoria: quem fez o quê, quando, de qual valor para qual valor. */
export interface ItemHistorico {
  id: string | number
  /** Data e hora do registro no formato da API (`aaaa-mm-dd hh:mm:ss` ou ISO). */
  data: string
  /** Ação registrada (ex.: "Lançamento", "Correção", "Ajuste de meta"). */
  acao: string
  /** Usuário responsável pela ação. */
  usuario: string
  /** Valor anterior; nulo quando não havia valor (ex.: primeiro lançamento). */
  de?: string | null
  /** Novo valor. */
  para?: string | null
  /** Motivo informado pelo usuário; exibido somente quando existe. */
  motivo?: string | null
  /** Informações complementares (ex.: filial e competência da alteração). */
  detalhes?: string[]
}

export interface HistoricoProps {
  itens: ItemHistorico[]
  /** Nome acessível da lista (ex.: "Histórico do apontamento"). */
  legenda?: string
  /** Texto exibido quando não há registros. */
  textoVazio?: string
  className?: string
}

const SEM_VALOR = '—'

const temTexto = (valor: string | null | undefined): valor is string =>
  typeof valor === 'string' && valor.trim() !== ''

/**
 * Histórico/auditoria somente leitura (RNF-01): linha do tempo vertical, compacta, sem nenhuma
 * ação de edição ou exclusão. Usada dentro de linhas expansíveis da Tabela e em diálogos.
 */
export function Historico({
  itens,
  legenda,
  textoVazio = 'Nenhuma alteração registrada.',
  className,
}: HistoricoProps) {
  const idLegenda = useId()
  const classes = ['historico']
  if (className) classes.push(className)

  if (itens.length === 0) {
    return (
      <div className={classes.join(' ')}>
        {legenda ? <p className="historico__legenda rotulo-secao">{legenda}</p> : null}
        <p className="historico__vazio">{textoVazio}</p>
      </div>
    )
  }

  return (
    <div className={classes.join(' ')}>
      {legenda ? (
        <p className="historico__legenda rotulo-secao" id={idLegenda}>
          {legenda}
        </p>
      ) : null}
      <ol className="historico__lista" aria-labelledby={legenda ? idLegenda : undefined}>
        {itens.map((item) => {
          const mostrarMudanca = temTexto(item.de) || temTexto(item.para)
          return (
            <li key={item.id} className="historico__item">
              <span className="historico__marcador" aria-hidden="true" />
              <div className="historico__conteudo">
                <div className="historico__cabecalho">
                  <time className="historico__data" dateTime={item.data}>
                    {formatarDataHora(item.data)}
                  </time>
                  <Etiqueta tom="info">{item.acao}</Etiqueta>
                  <span className="historico__usuario">{item.usuario}</span>
                </div>
                {mostrarMudanca ? (
                  <p className="historico__mudanca">
                    <span className="historico__de">{temTexto(item.de) ? item.de : SEM_VALOR}</span>
                    <span className="historico__seta" aria-hidden="true">
                      {' → '}
                    </span>
                    <span className="historico__para">{temTexto(item.para) ? item.para : SEM_VALOR}</span>
                  </p>
                ) : null}
                {item.detalhes && item.detalhes.length > 0 ? (
                  <p className="historico__detalhes">
                    {item.detalhes.map((detalhe, indice) => (
                      <span key={`${detalhe}-${indice}`} className="historico__detalhe">
                        {detalhe}
                      </span>
                    ))}
                  </p>
                ) : null}
                {temTexto(item.motivo) ? (
                  <p className="historico__motivo">
                    <span className="historico__motivo-rotulo">Motivo: </span>
                    {item.motivo}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
