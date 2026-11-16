import { Link } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { Card } from '../../components/Card'
import '../../components/Botao.css'
import type { Indicador } from '../../types/dominio'
import './PendenciasInicio.css'

export interface IndicadoresMetaPendenteInicioProps {
  /** Indicadores na ordem de exibição; `null` enquanto carrega ou na falha. */
  indicadores: Indicador[] | null
  carregando: boolean
  erro: string | null
}

/**
 * Painel "Indicadores com meta pendente" do Início (F11.6): nome, tipos e filiais sem meta de cada
 * indicador e o link "Ver indicadores". A falha aparece como texto simples (sem `role="alert"`), para não
 * derrubar nem interromper a tela Início.
 */
export function IndicadoresMetaPendenteInicio({ indicadores, carregando, erro }: IndicadoresMetaPendenteInicioProps) {
  return (
    <Card
      titulo="Indicadores com meta pendente"
      className="pendencias-inicio"
      acoes={
        <Link to={CAMINHOS.indicadores} className="botao foco-anel botao--contorno botao--pequeno pendencias-inicio__link">
          Ver indicadores
        </Link>
      }
    >
      {erro !== null ? (
        <p className="pendencias-inicio__falha">Não foi possível carregar os indicadores com meta pendente.</p>
      ) : carregando || indicadores === null ? null : indicadores.length === 0 ? (
        <p className="pendencias-inicio__vazio">Nenhum indicador com meta pendente.</p>
      ) : (
        <ul className="pendencias-inicio__lista">
          {indicadores.map((indicador) => (
            <li key={indicador.id} className="pendencias-inicio__item">
              <span className="pendencias-inicio__nome">{indicador.nome}</span>
              {indicador.tipos.length > 0 ? (
                <span className="pendencias-inicio__detalhe">{`Tipos: ${indicador.tipos.join(', ')}`}</span>
              ) : null}
              {indicador.filiaisSemMeta.length > 0 ? (
                <span className="pendencias-inicio__detalhe">{`Filiais sem meta: ${indicador.filiaisSemMeta.join(', ')}`}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
