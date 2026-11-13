import { Link } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { Card } from '../../components/Card'
import '../../components/Botao.css'
import { ROTULOS_PERIODICIDADE, type PeriodoEmAbertoInicio } from '../../types/dominio'
import './PeriodosEmAberto.css'

export interface PeriodosEmAbertoProps {
  /** Dashboards com período em aberto, na ordem da API. */
  periodos: PeriodoEmAbertoInicio[]
}

/**
 * "Períodos em aberto" do Início (F11.4 — RF-10): nome do dashboard, periodicidade e período atual,
 * progresso dos lançamentos e o link "Preencher" para a aba Preenchimento. Período encerrado continua
 * na lista (progresso "0 de 0").
 */
export function PeriodosEmAberto({ periodos }: PeriodosEmAbertoProps) {
  return (
    <Card titulo="Períodos em aberto" className="periodos-em-aberto">
      {periodos.length === 0 ? (
        <p className="periodos-em-aberto__vazio">Nenhum período em aberto.</p>
      ) : (
        <ul className="periodos-em-aberto__lista">
          {periodos.map((periodo) => (
            <li key={periodo.id} className="periodos-em-aberto__item">
              <div className="periodos-em-aberto__dados">
                <span className="periodos-em-aberto__nome">{periodo.nome}</span>
                <span className="periodos-em-aberto__periodo">
                  {`${ROTULOS_PERIODICIDADE[periodo.periodicidade]} · período ${periodo.periodoAtual}`}
                </span>
                <span className="periodos-em-aberto__progresso">
                  {`${periodo.progresso.preenchidos} de ${periodo.progresso.total} lançamentos`}
                </span>
              </div>
              <Link
                to={CAMINHOS.preenchimento}
                aria-label={`Preencher ${periodo.nome}`}
                className="botao foco-anel botao--contorno botao--pequeno periodos-em-aberto__acao"
              >
                Preencher
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
