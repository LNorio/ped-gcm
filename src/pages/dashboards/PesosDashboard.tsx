/**
 * Pesos dos indicadores de um dashboard (F7.9 — RF-48 "Ver pesos dos indicadores", RNF-01).
 *
 * Consulta o detalhe do dashboard ao montar e lista cada indicador com os pontos base, destacando o
 * problema (ou "Indicador inativo"), o total em relação à pontuação base máxima e o período atual.
 * Exibido na linha expandida da tabela de dashboards.
 */
import { useCallback } from 'react'
import { Etiqueta } from '../../components/Etiqueta'
import { EstadoCarga } from '../../components/EstadoCarga'
import { obterDashboard, type DetalheDashboard } from '../../services/dashboardsService'
import type { Dashboard } from '../../types/dominio'
import { formatarData } from '../../utils/formato'
import { useConsulta } from '../../hooks/useConsulta'
import { formatarPontos } from './regrasDashboard'
import './FormularioDashboard.css'

export interface PesosDashboardProps {
  dashboard: Dashboard
}

export function PesosDashboard({ dashboard }: PesosDashboardProps) {
  const { id, nome } = dashboard
  const carregar = useCallback(() => obterDashboard(id), [id])
  const { dados, carregando, erro, recarregar } = useConsulta<DetalheDashboard | null>(carregar, null)

  return (
    <div className="pesos-dashboard">
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando pesos dos indicadores..."
        erro={erro}
        onTentarNovamente={() => void recarregar()}
      />
      {dados && !erro ? <ConteudoPesos detalhe={dados} nome={nome} /> : null}
    </div>
  )
}

function ConteudoPesos({ detalhe, nome }: { detalhe: DetalheDashboard; nome: string }) {
  const soma = Math.round(detalhe.indicadores.reduce((total, indicador) => total + indicador.pontosBase, 0) * 100) / 100
  const { periodo } = detalhe

  return (
    <>
      {detalhe.indicadores.length === 0 ? (
        <p className="pesos-dashboard__vazio">Nenhum indicador vinculado.</p>
      ) : (
        <ul className="pesos-dashboard__lista" aria-label={`Pesos dos indicadores de ${nome}`}>
          {detalhe.indicadores.map((indicador) => {
            const problema = indicador.problema ?? (indicador.ativo ? null : 'Indicador inativo')
            return (
              <li key={indicador.id} className="pesos-dashboard__item">
                <span className="pesos-dashboard__nome">
                  <span>{indicador.nome}</span>
                  {problema ? <Etiqueta tom="alerta">{problema}</Etiqueta> : null}
                </span>
                <span className="pesos-dashboard__pontos">{`${formatarPontos(indicador.pontosBase)} pts`}</span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="pesos-dashboard__rodape">
        <span className="pesos-dashboard__total">
          {`Total: ${formatarPontos(soma)} de ${formatarPontos(detalhe.pontuacaoBaseMaxima)} pts`}
        </span>
        {periodo ? (
          <span>{`Período atual: ${periodo.codigo} (${formatarData(periodo.inicio)} a ${formatarData(periodo.fim)})`}</span>
        ) : null}
      </div>
    </>
  )
}
