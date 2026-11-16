import { formatarNumero } from '../../utils/formato'
import './ResumoInicio.css'

export interface PendenciasResumoInicioProps {
  /** Quantidade de indicadores com meta pendente; `null` enquanto carrega ou na falha da consulta. */
  indicadoresComMetaPendente: number | null
  /** Quantidade de dashboards em construção; `null` enquanto carrega ou na falha da consulta. */
  dashboardsEmConstrucao: number | null
}

/**
 * Cards de pendências do cadastro na faixa de resumo do Início (F11.6): lista própria, separada dos
 * indicadores-resumo da API. Quantidade em pt-BR sem casas decimais; `null` → card só com o rótulo.
 */
export function PendenciasResumoInicio({ indicadoresComMetaPendente, dashboardsEmConstrucao }: PendenciasResumoInicioProps) {
  const cards = [
    { chave: 'indicadores', rotulo: 'Indicadores com meta pendente', valor: indicadoresComMetaPendente },
    { chave: 'dashboards', rotulo: 'Dashboards em construção', valor: dashboardsEmConstrucao },
  ]

  return (
    <ul className="resumo-inicio" aria-label="Pendências do cadastro">
      {cards.map((card) => (
        <li key={card.chave} className="resumo-inicio__item">
          {card.valor === null ? (
            <span className="resumo-inicio__valor" aria-hidden="true">
              —
            </span>
          ) : (
            <span className="resumo-inicio__valor">{formatarNumero(card.valor, 0)}</span>
          )}
          <span className="resumo-inicio__rotulo">{card.rotulo}</span>
        </li>
      ))}
    </ul>
  )
}
