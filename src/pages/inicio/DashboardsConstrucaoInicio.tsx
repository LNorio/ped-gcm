import { Link } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { Card } from '../../components/Card'
import '../../components/Botao.css'
import { ROTULOS_PERIODICIDADE, type Dashboard } from '../../types/dominio'
import { textoTarefaBitrix } from '../../utils/tarefaBitrix'
import './PendenciasInicio.css'

export interface DashboardsConstrucaoInicioProps {
  /** Dashboards na ordem da API; `null` enquanto carrega ou na falha. */
  dashboards: Dashboard[] | null
  carregando: boolean
  erro: string | null
}

/**
 * Painel "Dashboards em construção" do Início (F11.6): nome, periodicidade e tarefa do Bitrix de cada
 * dashboard e o link "Ver dashboards". A falha aparece como texto simples (sem `role="alert"`).
 */
export function DashboardsConstrucaoInicio({ dashboards, carregando, erro }: DashboardsConstrucaoInicioProps) {
  return (
    <Card
      titulo="Dashboards em construção"
      className="pendencias-inicio"
      acoes={
        <Link to={CAMINHOS.dashboards} className="botao foco-anel botao--contorno botao--pequeno pendencias-inicio__link">
          Ver dashboards
        </Link>
      }
    >
      {erro !== null ? (
        <p className="pendencias-inicio__falha">Não foi possível carregar os dashboards em construção.</p>
      ) : carregando || dashboards === null ? null : dashboards.length === 0 ? (
        <p className="pendencias-inicio__vazio">Nenhum dashboard em construção.</p>
      ) : (
        <ul className="pendencias-inicio__lista">
          {dashboards.map((dashboard) => {
            const tarefa = textoTarefaBitrix(dashboard.tarefaBitrix, 'Tarefa #')
            return (
              <li key={dashboard.id} className="pendencias-inicio__item">
                <span className="pendencias-inicio__nome">{dashboard.nome}</span>
                <span className="pendencias-inicio__detalhe">{ROTULOS_PERIODICIDADE[dashboard.periodicidade]}</span>
                {tarefa !== null ? <span className="pendencias-inicio__detalhe">{tarefa}</span> : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
