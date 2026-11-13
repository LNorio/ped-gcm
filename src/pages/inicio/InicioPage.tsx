import { Link } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { EstadoCarga } from '../../components/EstadoCarga'
import '../../components/Botao.css'
import { ROTULOS_ABA } from '../../sessao/permissoes'
import { AvisosInicio } from './AvisosInicio'
import { PeriodosEmAberto } from './PeriodosEmAberto'
import { ResumoInicio } from './ResumoInicio'
import { UltimasAlteracoes } from './UltimasAlteracoes'
import { useInicio } from './useInicio'
import './InicioPage.css'

/**
 * Aba "Início" (F11 — RF-06 a RF-11): avisos do período e de acesso, indicadores-resumo, link para o
 * preenchimento, períodos em aberto e últimas alterações, tudo de `GET /api/ped/inicio` pela filial do
 * cabeçalho. O título fica sempre visível; durante a carga, "Carregando o Início..." é anunciado e, em
 * erro, aparece o alerta com "Tentar novamente".
 */
export function InicioPage() {
  const { inicio, carregando, erro, recarregar } = useInicio()

  return (
    <div className="inicio-page">
      <div className="inicio-page__cabecalho">
        <h1>{ROTULOS_ABA['inicio']}</h1>
        <Link to={CAMINHOS.preenchimento} className="botao foco-anel botao--primario inicio-page__preencher">
          Preencher apontamentos do período
        </Link>
      </div>

      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando o Início..."
        erro={erro}
        onTentarNovamente={recarregar}
      />

      {inicio ? (
        <>
          <AvisosInicio perfil={inicio.perfil} periodoAberto={inicio.periodoAberto} avisoDeAcesso={inicio.avisoDeAcesso} />
          <ResumoInicio itens={inicio.resumo} />
          <div className="inicio-page__paineis">
            <PeriodosEmAberto periodos={inicio.periodosEmAberto} />
            <UltimasAlteracoes alteracoes={inicio.ultimasAlteracoes} />
          </div>
        </>
      ) : null}
    </div>
  )
}
