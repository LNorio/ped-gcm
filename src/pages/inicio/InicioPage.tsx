import { Link } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { EstadoCarga } from '../../components/EstadoCarga'
import '../../components/Botao.css'
import { ROTULOS_ABA } from '../../sessao/permissoes'
import { AvisosInicio } from './AvisosInicio'
import { DashboardsConstrucaoInicio } from './DashboardsConstrucaoInicio'
import { IndicadoresMetaPendenteInicio } from './IndicadoresMetaPendenteInicio'
import { PendenciasResumoInicio } from './PendenciasResumoInicio'
import { PeriodosEmAberto } from './PeriodosEmAberto'
import { ResumoInicio } from './ResumoInicio'
import { UltimasAlteracoes } from './UltimasAlteracoes'
import { useInicio } from './useInicio'
import { usePendenciasInicio } from './usePendenciasInicio'
import './InicioPage.css'

// Pré-consulta da primeira abertura: `rotas.tsx` a chama pelo chunk do Início já pré-carregado, quando a
// sessão obtém o acesso com o Início aberto (ver `consultasInicio.ts`).
// oxlint-disable-next-line react/only-export-components
export { preConsultarInicio } from './consultasInicio'

/**
 * Aba "Início" (F11 — RF-06 a RF-11): avisos do período e de acesso, indicadores-resumo, link para o
 * preenchimento, períodos em aberto e últimas alterações, tudo de `GET /api/ped/inicio` pela filial do
 * cabeçalho. O título fica sempre visível; durante a carga, "Carregando o Início..." é anunciado e, em
 * erro, aparece o alerta com "Tentar novamente".
 *
 * F11.6: para Admin e Validador, a faixa de resumo ganha os cards "Pendências do cadastro" e os painéis
 * ganham "Indicadores com meta pendente" e "Dashboards em construção" (`usePendenciasInicio`, sem filial).
 * Esses blocos não dependem do `GET /api/ped/inicio`: continuam na tela durante a troca de filial e
 * mesmo se o Início falhar.
 */
export function InicioPage() {
  const { inicio, carregando, erro, recarregar } = useInicio()
  const pendencias = usePendenciasInicio()
  const quantidade = (itens: readonly unknown[] | null) => (itens === null ? null : itens.length)

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
        <AvisosInicio perfil={inicio.perfil} periodoAberto={inicio.periodoAberto} avisoDeAcesso={inicio.avisoDeAcesso} />
      ) : null}

      {inicio || pendencias.visivel ? (
        <div className="inicio-page__faixa">
          {inicio ? <ResumoInicio itens={inicio.resumo} /> : null}
          {pendencias.visivel ? (
            <PendenciasResumoInicio
              indicadoresComMetaPendente={quantidade(pendencias.indicadores.itens)}
              dashboardsEmConstrucao={quantidade(pendencias.dashboards.itens)}
            />
          ) : null}
        </div>
      ) : null}

      {inicio || pendencias.visivel ? (
        <div className="inicio-page__paineis">
          {inicio ? (
            <>
              <PeriodosEmAberto periodos={inicio.periodosEmAberto} />
              <UltimasAlteracoes alteracoes={inicio.ultimasAlteracoes} />
            </>
          ) : null}
          {pendencias.visivel ? (
            <>
              <IndicadoresMetaPendenteInicio
                indicadores={pendencias.indicadores.itens}
                carregando={pendencias.indicadores.carregando}
                erro={pendencias.indicadores.erro}
              />
              <DashboardsConstrucaoInicio
                dashboards={pendencias.dashboards.itens}
                carregando={pendencias.dashboards.carregando}
                erro={pendencias.dashboards.erro}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
