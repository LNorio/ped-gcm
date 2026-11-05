/**
 * Tabela da listagem de dashboards (F7.2 e F7.3 — RF-47, RF-48, RN-16).
 *
 * Componente de apresentação: recebe a lista já filtrada e avisa o pai quando o usuário escolhe uma
 * ação no menu da linha. As ações dependem da permissão e da situação do dashboard:
 * - "Editar" com a permissão de edição;
 * - "Ver pesos dos indicadores"/"Ocultar pesos" e "Histórico de modificações" sempre;
 * - "Preencher apontamentos" só no dashboard ativo;
 * - "Desativar"/"Ativar" (ativo ou inativo) ou "Concluir construção/modificação (TI)" (em TI), só Admin;
 * - "Excluir" só Admin.
 * Os pesos abrem abaixo da linha (`PesosDashboard`); várias linhas podem ficar abertas.
 * Os alertas de indicadores com problema só aparecem em dashboard ativo (RF-47).
 *
 * Colunas: Dashboard, Periodicidade, Vínculo, Indicadores, Período atual e Ações.
 */
import { useState } from 'react'
import { Etiqueta, type TomEtiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import {
  ROTULOS_PERIODICIDADE,
  ROTULOS_SITUACAO_DASHBOARD,
  type Dashboard,
  type SituacaoDashboard,
  type TipoVinculo,
} from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import { PesosDashboard } from './PesosDashboard'
import { formatarPontos } from './regrasDashboard'
import './TabelaDashboards.css'

export interface TabelaDashboardsProps {
  dashboards: Dashboard[]
  /** Exibe "Editar". */
  podeEditar: boolean
  /** Exibe "Desativar"/"Ativar" nos dashboards ativos ou inativos. */
  podeAlterarSituacao: boolean
  /** Exibe "Concluir construção (TI)"/"Concluir modificação (TI)" nos dashboards em TI. */
  podeConcluir: boolean
  /** Exibe "Excluir". */
  podeExcluir: boolean
  onEditar: (dashboard: Dashboard) => void
  onVerHistorico: (dashboard: Dashboard) => void
  onPreencher: (dashboard: Dashboard) => void
  onAlterarSituacao: (dashboard: Dashboard) => void
  onConcluir: (dashboard: Dashboard) => void
  onExcluir: (dashboard: Dashboard) => void
  /** Texto exibido quando `dashboards` está vazio. */
  textoVazio?: string
}

const ROTULOS_TIPO: Readonly<Record<TipoVinculo, string>> = {
  filiais: 'Por filial',
  cargos: 'Por cargo',
  colaboradores: 'Por colaborador',
}

const TONS_SITUACAO: Readonly<Record<SituacaoDashboard, TomEtiqueta>> = {
  ativo: 'sucesso',
  inativo: 'neutro',
  em_construcao: 'alerta',
  em_modificacao: 'alerta',
}

function contagem(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

function textoVinculo(dashboard: Dashboard): string {
  const itens = dashboard.itensVinculados
  if (dashboard.tipoVinculo === 'filiais') return `Filiais: ${itens.join(', ')}`
  if (dashboard.tipoVinculo === 'cargos') return `Cargos: ${itens.join(', ')}`
  return contagem(itens.length, 'colaborador', 'colaboradores')
}

function textoData(dashboard: Dashboard): string | null {
  if (dashboard.ultimaAlteracao) return `Alterado em ${formatarDataHora(dashboard.ultimaAlteracao)}`
  if (dashboard.cadastradoEm) return `Cadastrado em ${formatarDataHora(dashboard.cadastradoEm)}`
  return null
}

function emTi(dashboard: Dashboard): boolean {
  return dashboard.situacao === 'em_construcao' || dashboard.situacao === 'em_modificacao'
}

function colunaDashboard(dashboard: Dashboard) {
  const data = textoData(dashboard)
  const alertas = dashboard.situacao === 'ativo' ? dashboard.alertas : []
  return (
    <div className="tabela-dashboards__pilha">
      <span className="tabela-dashboards__titulo">{dashboard.nome}</span>
      <div className="tabela-dashboards__etiquetas">
        <Etiqueta tom="info">{ROTULOS_TIPO[dashboard.tipoVinculo]}</Etiqueta>
        <Etiqueta tom={TONS_SITUACAO[dashboard.situacao]}>{ROTULOS_SITUACAO_DASHBOARD[dashboard.situacao]}</Etiqueta>
        {dashboard.tarefaBitrix && dashboard.tarefaBitrix.id !== null ? <Etiqueta tom="dourado">{`Tarefa nº ${dashboard.tarefaBitrix.id}`}</Etiqueta> : null}
        {alertas.length > 0 ? (
          <Etiqueta tom="perigo">{contagem(alertas.length, 'indicador com problema', 'indicadores com problema')}</Etiqueta>
        ) : null}
      </div>
      {data ? <span className="tabela-dashboards__secundario">{data}</span> : null}
      {alertas.length > 0 ? (
        <ul className="tabela-dashboards__problemas" aria-label={`Indicadores com problema em ${dashboard.nome}`}>
          {alertas.map((alerta, indice) => (
            <li key={`${alerta.indicador}-${indice}`}>
              {`${alerta.indicador} — ${alerta.motivo} · ${formatarPontos(alerta.pontosAfetados)} pts`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function TabelaDashboards({
  dashboards,
  podeEditar,
  podeAlterarSituacao,
  podeConcluir,
  podeExcluir,
  onEditar,
  onVerHistorico,
  onPreencher,
  onAlterarSituacao,
  onConcluir,
  onExcluir,
  textoVazio,
}: TabelaDashboardsProps) {
  const [expandidas, setExpandidas] = useState<ReadonlySet<Dashboard['id']>>(() => new Set())
  const [dashboardsAnteriores, setDashboardsAnteriores] = useState(dashboards)

  // Ids que saíram da lista (filtro, exclusão) deixam de constar como expandidos.
  if (dashboards !== dashboardsAnteriores) {
    setDashboardsAnteriores(dashboards)
    const ids = new Set(dashboards.map((dashboard) => dashboard.id))
    if ([...expandidas].some((id) => !ids.has(id))) {
      setExpandidas(new Set([...expandidas].filter((id) => ids.has(id))))
    }
  }

  function alternarPesos(id: Dashboard['id']) {
    setExpandidas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(id)) novas.delete(id)
      else novas.add(id)
      return novas
    })
  }

  function itensDoMenu(dashboard: Dashboard): ItemMenuAcoes[] {
    const itens: ItemMenuAcoes[] = []
    if (podeEditar) itens.push({ rotulo: 'Editar', onSelecionar: () => onEditar(dashboard) })
    itens.push(
      {
        rotulo: expandidas.has(dashboard.id) ? 'Ocultar pesos' : 'Ver pesos dos indicadores',
        onSelecionar: () => alternarPesos(dashboard.id),
      },
      { rotulo: 'Histórico de modificações', onSelecionar: () => onVerHistorico(dashboard) },
    )
    if (dashboard.situacao === 'ativo') {
      itens.push({ rotulo: 'Preencher apontamentos', onSelecionar: () => onPreencher(dashboard) })
    }
    if (emTi(dashboard)) {
      if (podeConcluir) {
        itens.push({
          rotulo: dashboard.situacao === 'em_construcao' ? 'Concluir construção (TI)' : 'Concluir modificação (TI)',
          onSelecionar: () => onConcluir(dashboard),
        })
      }
    } else if (podeAlterarSituacao) {
      itens.push({
        rotulo: dashboard.situacao === 'ativo' ? 'Desativar' : 'Ativar',
        onSelecionar: () => onAlterarSituacao(dashboard),
      })
    }
    if (podeExcluir) itens.push({ rotulo: 'Excluir', onSelecionar: () => onExcluir(dashboard), perigo: true })
    return itens
  }

  const colunas: ColunaTabela<Dashboard>[] = [
    { chave: 'nome', titulo: 'Dashboard', render: colunaDashboard },
    {
      chave: 'periodicidade',
      titulo: 'Periodicidade',
      render: (dashboard) => ROTULOS_PERIODICIDADE[dashboard.periodicidade],
    },
    { chave: 'vinculo', titulo: 'Vínculo', render: textoVinculo },
    {
      chave: 'indicadores',
      titulo: 'Indicadores',
      render: (dashboard) => (
        <div className="tabela-dashboards__pilha">
          <span>{contagem(dashboard.quantidadeDeIndicadores, 'indicador', 'indicadores')}</span>
          <span className="tabela-dashboards__secundario">
            {`${formatarPontos(dashboard.pontos.soma)} de ${formatarPontos(dashboard.pontos.maximo)} pts`}
          </span>
        </div>
      ),
    },
    { chave: 'periodoAtual', titulo: 'Período atual', render: (dashboard) => dashboard.periodoAtual },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (dashboard) => <MenuAcoes rotulo={`Ações do dashboard ${dashboard.nome}`} itens={itensDoMenu(dashboard)} />,
    },
  ]

  return (
    <Tabela
      colunas={colunas}
      dados={dashboards}
      obterChave={(dashboard) => dashboard.id}
      legenda="Dashboards"
      textoVazio={textoVazio}
      expandir={(dashboard) => <PesosDashboard dashboard={dashboard} />}
      expandidas={expandidas}
    />
  )
}
