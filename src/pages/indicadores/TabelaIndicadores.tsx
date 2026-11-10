/**
 * Tabela da listagem de indicadores (F6.2 — RF-32, RF-37).
 *
 * Componente de apresentação: recebe a lista já filtrada e avisa o pai quando o usuário escolhe uma
 * ação no menu da linha. Não há ação "Editar" (RF-37). As ações são exibidas só quando a permissão
 * correspondente está liberada; "Excluir" só aparece em indicador que nunca esteve vinculado a
 * dashboard (RN-11). O menu também abre e oculta os detalhes da linha (várias podem ficar abertas).
 *
 * Colunas: Nome (com etiquetas de situação), Composição, Sentido e cálculo, Meta, Dashboards e Ações.
 *
 * Meta por filial (F6.10): etiqueta "Meta pendente em N filiais" e o par "Filiais sem meta" nos
 * detalhes quando `filiaisSemMeta` não é vazia. Na coluna Meta, com uma filial no cabeçalho
 * (`filialSelecionada`) e metas por filial, mostra a meta daquela filial ou "Sem meta nesta filial";
 * na visão "Todas as filiais", "Por filial" quando `metaPorFilial` (campo `"meta por filial"` da API,
 * mesmo sem a lista) ou quando só há metas por filial; senão, a meta única.
 *
 * Metas pendentes (F6.12): com `podeDefinirMetasPendentes`, o item "Definir metas pendentes" (depois de
 * "Definir meta" e antes de "Histórico de metas"/"Inativar") aparece em indicador ativo, com
 * `filiaisSemMeta` não vazia, sem "meta a definir" e sem meta via API; na visão de uma filial, só se
 * ela estiver entre as filiais sem meta.
 *
 * Meta via API (F6.11): etiqueta "Integração pendente (TI)" quando `integracao.pendente` (logo após as
 * etiquetas de meta; independe da permissão, pois só o Admin recebe o dado), coluna Meta "Via API"
 * (prevalece sobre a F6.10) e, com `podeConfigurarIntegracao`, o item "Preencher integração" (pendente)
 * ou "Configurações" (configurada) logo após "Ver detalhes", só nos indicadores com origem `terceiro`.
 *
 * Contrato final da meta via API (F6.11): a etiqueta da posição de "Integração pendente (TI)" passa a
 * seguir a situação da meta via API (`ETIQUETAS_SITUACAO_META_VIA_API`, para todos os perfis; a
 * pendência só na fonte `integracao`); a tarefa do Bitrix aparece na coluna Nome, fora das etiquetas
 * (`textoTarefaBitrix`). No menu, com `podeConfigurarIntegracao`: fonte `integracao` → "Preencher
 * integração"/"Configurações"; fonte `dado_externo` → "Ver integração do dado externo"
 * (`onVerIntegracaoDadoExterno`), sem as ações de configurar.
 */
import { useState, type ReactNode } from 'react'
import { Etiqueta, type TomEtiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { formatarDataHora, formatarNumero } from '../../utils/formato'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import { ROTULOS_CALCULO, ROTULOS_SENTIDO, type Indicador, type SituacaoMetaViaApi } from '../../types/dominio'
import { integracaoDaMetaPendente, situacaoDaMetaViaApi, usaIntegracaoDoIndicador, usaMetaDoDadoExterno } from '../../utils/metaViaApi'
import { textoTarefaBitrix } from '../../utils/tarefaBitrix'
import { AvisoComponenteDesativado } from './AvisoComponenteDesativado'
import './TabelaIndicadores.css'

export interface TabelaIndicadoresProps {
  indicadores: Indicador[]
  /**
   * Filial do cabeçalho, usada na coluna Meta (F6.10). Ausente, `null` ou `'todas'` = visão
   * "Todas as filiais".
   */
  filialSelecionada?: FilialSelecionada
  /** Exibe "Definir meta" nos automáticos sem meta definida. */
  podeDefinirMeta: boolean
  /** Exibe "Histórico de metas" nos indicadores de meta editável. */
  podeVerHistorico: boolean
  /** Exibe "Inativar"/"Reativar". */
  podeAlterarSituacao: boolean
  /** Exibe "Excluir" (só nos indicadores que nunca foram vinculados a dashboard). */
  podeExcluir: boolean
  onDefinirMeta: (indicador: Indicador) => void
  onVerHistorico: (indicador: Indicador) => void
  onAlterarSituacao: (indicador: Indicador) => void
  onExcluir: (indicador: Indicador) => void
  /** F6.11: exibe "Preencher integração"/"Configurações" nos indicadores com meta via API. Padrão `false`. */
  podeConfigurarIntegracao?: boolean
  /** F6.11: chamado ao escolher "Preencher integração" ou "Configurações". */
  onConfigurarIntegracao?: (indicador: Indicador) => void
  /** F6.11: chamado ao escolher "Ver integração do dado externo" (fonte `dado_externo`, com `podeConfigurarIntegracao`). */
  onVerIntegracaoDadoExterno?: (indicador: Indicador) => void
  /** F6.12: exibe "Definir metas pendentes" (ver o topo do arquivo). Padrão `false`. */
  podeDefinirMetasPendentes?: boolean
  /** F6.12: chamado ao escolher "Definir metas pendentes". */
  onDefinirMetasPendentes?: (indicador: Indicador) => void
  /** Texto exibido quando `indicadores` está vazio. */
  textoVazio?: string
}

/** Etiqueta de cada situação da meta via API (F6.11); `ok` não tem etiqueta. */
const ETIQUETAS_SITUACAO_META_VIA_API: Readonly<Record<SituacaoMetaViaApi, [TomEtiqueta, string] | null>> = {
  ok: null,
  integracao_pendente: ['alerta', 'Integração pendente (TI)'],
  aguardando_consulta: ['info', 'Aguardando primeira consulta'],
  erro: ['perigo', 'Erro na consulta da meta'],
  sem_meta_no_mes: ['alerta', 'Sem meta no mês'],
}

/** Etiquetas do nome, na ordem do RF-32. */
function etiquetasDoNome(indicador: Indicador): ReactNode[] {
  const situacao = situacaoDaMetaViaApi(indicador)
  const etiquetaSituacao = situacao === null ? null : ETIQUETAS_SITUACAO_META_VIA_API[situacao]
  const etiquetas: [TomEtiqueta, string, boolean][] = [
    ['info', 'Criado automaticamente', indicador.criadoAutomaticamente],
    ['alerta', 'Meta a definir', indicador.metaADefinir],
    ['alerta', textoMetaPendente(indicador.filiaisSemMeta.length), indicador.filiaisSemMeta.length > 0],
    [etiquetaSituacao?.[0] ?? 'alerta', etiquetaSituacao?.[1] ?? '', etiquetaSituacao !== null],
    ['perigo', 'Componentes desativados', indicador.componentesDesativados],
    ['neutro', 'Inativo', !indicador.ativo],
    ['dourado', 'Meta editável', indicador.metaEditavel],
    ['sucesso', 'Vinculado a dashboard', indicador.vinculadoADashboard],
  ]
  return etiquetas
    .filter(([, , presente]) => presente)
    .map(([tom, texto]) => <Etiqueta key={texto} tom={tom}>{texto}</Etiqueta>)
}

/** "Meta pendente em 1 filial" ou "Meta pendente em N filiais". */
function textoMetaPendente(quantidade: number): string {
  return `Meta pendente em ${quantidade} ${quantidade === 1 ? 'filial' : 'filiais'}`
}

/** Filiais sem meta como "{código} - {nome}" (só o código quando a API não traz o nome). */
function textoFiliaisSemMeta(indicador: Indicador): string {
  return indicador.filiaisSemMeta
    .map((codigo) => {
      const nome = indicador.metasPorFilial.find((item) => item.filial === codigo)?.nomeFilial
      return nome ? `${codigo} - ${nome}` : codigo
    })
    .join(', ')
}

/** Texto da coluna Meta conforme a filial do cabeçalho (ver o topo do arquivo). */
function textoMeta(indicador: Indicador, filialSelecionada: FilialSelecionada | undefined): string {
  if (indicador.origemDaMeta === 'terceiro') return 'Via API'
  const filial = filialSelecionada && filialSelecionada !== 'todas' ? filialSelecionada : null
  if (filial !== null && indicador.metasPorFilial.length > 0) {
    const meta = indicador.metasPorFilial.find((item) => item.filial === filial.codigo)?.meta ?? null
    return meta === null ? 'Sem meta nesta filial' : formatarNumero(meta)
  }
  if (indicador.metaPorFilial) return 'Por filial'
  if (indicador.meta !== null) return formatarNumero(indicador.meta)
  return indicador.metasPorFilial.length > 0 ? 'Por filial' : '—'
}

/** Regra de exibição de "Definir metas pendentes" (F6.12), sem a permissão. */
function temMetasPendentes(indicador: Indicador, filialSelecionada: FilialSelecionada | undefined): boolean {
  if (!indicador.ativo || indicador.metaADefinir || indicador.origemDaMeta === 'terceiro') return false
  if (indicador.filiaisSemMeta.length === 0) return false
  const filial = filialSelecionada && filialSelecionada !== 'todas' ? filialSelecionada : null
  return filial === null || indicador.filiaisSemMeta.includes(filial.codigo)
}

function detalhes(indicador: Indicador) {
  const cadastro = indicador.cadastradoEm
    ? `${formatarDataHora(indicador.cadastradoEm)}${indicador.cadastradoPor ? ` por ${indicador.cadastradoPor}` : ''}`
    : '—'
  const situacaoAlterada = indicador.situacaoAlteradaEm
    ? `Situação alterada em ${formatarDataHora(indicador.situacaoAlteradaEm)}${indicador.situacaoAlteradaPor ? ` por ${indicador.situacaoAlteradaPor}` : ''}`
    : null
  const pares: [string, string][] = [
    ['Descrição', indicador.descricao || '—'],
    ['Tipos', indicador.tipos.length > 0 ? indicador.tipos.join(', ') : '—'],
  ]
  if (indicador.filiaisSemMeta.length > 0) pares.push(['Filiais sem meta', textoFiliaisSemMeta(indicador)])
  pares.push(['Cadastro', cadastro])

  return (
    <div className="tabela-indicadores__pilha">
      <dl className="tabela-indicadores__campos">
        {pares.map(([rotulo, valor]) => (
          <div key={rotulo} className="tabela-indicadores__par">
            <dt className="tabela-indicadores__rotulo">{rotulo}</dt>
            <dd className="tabela-indicadores__valor">{valor}</dd>
          </div>
        ))}
      </dl>
      {situacaoAlterada ? <p className="tabela-indicadores__detalhe">{situacaoAlterada}</p> : null}
      <AvisoComponenteDesativado indicador={indicador} />
    </div>
  )
}

export function TabelaIndicadores({
  indicadores,
  filialSelecionada,
  podeDefinirMeta,
  podeVerHistorico,
  podeAlterarSituacao,
  podeExcluir,
  onDefinirMeta,
  onVerHistorico,
  onAlterarSituacao,
  onExcluir,
  podeConfigurarIntegracao = false,
  onConfigurarIntegracao,
  onVerIntegracaoDadoExterno,
  podeDefinirMetasPendentes = false,
  onDefinirMetasPendentes,
  textoVazio,
}: TabelaIndicadoresProps) {
  const [expandidas, setExpandidas] = useState<ReadonlySet<Indicador['id']>>(() => new Set())
  const [indicadoresAnteriores, setIndicadoresAnteriores] = useState(indicadores)

  // Ids que saíram da lista (filtro, exclusão) deixam de constar como expandidos.
  if (indicadores !== indicadoresAnteriores) {
    setIndicadoresAnteriores(indicadores)
    const ids = new Set(indicadores.map((indicador) => indicador.id))
    if ([...expandidas].some((id) => !ids.has(id))) {
      setExpandidas(new Set([...expandidas].filter((id) => ids.has(id))))
    }
  }

  function alternarDetalhes(id: Indicador['id']) {
    setExpandidas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(id)) novas.delete(id)
      else novas.add(id)
      return novas
    })
  }

  const colunas: ColunaTabela<Indicador>[] = [
    {
      chave: 'nome',
      titulo: 'Nome',
      render: (indicador) => (
        <div className="tabela-indicadores__pilha">
          <span className="tabela-indicadores__titulo">{indicador.nome}</span>
          {etiquetasDoNome(indicador).length > 0 ? (
            <div className="tabela-indicadores__etiquetas">{etiquetasDoNome(indicador)}</div>
          ) : null}
          {indicador.tarefaBitrix ? (
            <span className="tabela-indicadores__secundario">{textoTarefaBitrix(indicador.tarefaBitrix)}</span>
          ) : null}
        </div>
      ),
    },
    {
      chave: 'composicao',
      titulo: 'Composição',
      render: (indicador) => {
        const dadoExterno = indicador.composicao.tipo === 'dado_externo'
        return (
          <div className="tabela-indicadores__etiquetas">
            {indicador.composicao.itens.map((item) => {
              const desativado = !item.ativo
              return (
                <Etiqueta
                  key={item.id}
                  tom={dadoExterno ? 'dourado' : 'info'}
                  className={desativado ? 'tabela-indicadores__componente--desativado' : undefined}
                >
                  {desativado ? `${item.nome} (desativado)` : item.nome}
                </Etiqueta>
              )
            })}
          </div>
        )
      },
    },
    {
      chave: 'sentido',
      titulo: 'Sentido e cálculo',
      render: (indicador) => {
        const mostrarCalculo =
          indicador.composicao.tipo === 'apontamentos' && indicador.composicao.itens.length > 1 && indicador.calculo !== null
        return (
          <div className="tabela-indicadores__pilha">
            <span>{indicador.sentido ? ROTULOS_SENTIDO[indicador.sentido] : '—'}</span>
            {mostrarCalculo && indicador.calculo ? (
              <span className="tabela-indicadores__secundario">{ROTULOS_CALCULO[indicador.calculo]}</span>
            ) : null}
          </div>
        )
      },
    },
    {
      chave: 'meta',
      titulo: 'Meta',
      render: (indicador) => textoMeta(indicador, filialSelecionada),
    },
    {
      chave: 'dashboards',
      titulo: 'Dashboards',
      render: (indicador) =>
        indicador.dashboards.length === 0 ? (
          '—'
        ) : (
          <div className="tabela-indicadores__pilha">
            {indicador.dashboards.map((dashboard) => (
              <span key={dashboard.id}>{`${dashboard.nome} (${dashboard.pontosBase} pontos base)`}</span>
            ))}
          </div>
        ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (indicador) => {
        const itens: ItemMenuAcoes[] = [
          {
            rotulo: expandidas.has(indicador.id) ? 'Ocultar detalhes' : 'Ver detalhes',
            onSelecionar: () => alternarDetalhes(indicador.id),
          },
        ]
        if (podeConfigurarIntegracao && usaIntegracaoDoIndicador(indicador) && onConfigurarIntegracao) {
          itens.push({
            rotulo: integracaoDaMetaPendente(indicador) ? 'Preencher integração' : 'Configurações',
            onSelecionar: () => onConfigurarIntegracao(indicador),
          })
        }
        if (podeConfigurarIntegracao && usaMetaDoDadoExterno(indicador) && onVerIntegracaoDadoExterno) {
          itens.push({ rotulo: 'Ver integração do dado externo', onSelecionar: () => onVerIntegracaoDadoExterno(indicador) })
        }
        if (podeDefinirMeta && indicador.criadoAutomaticamente && indicador.metaADefinir) {
          itens.push({ rotulo: 'Definir meta', onSelecionar: () => onDefinirMeta(indicador) })
        }
        if (podeDefinirMetasPendentes && onDefinirMetasPendentes && temMetasPendentes(indicador, filialSelecionada)) {
          itens.push({ rotulo: 'Definir metas pendentes', onSelecionar: () => onDefinirMetasPendentes(indicador) })
        }
        if (podeVerHistorico && indicador.metaEditavel) {
          itens.push({ rotulo: 'Histórico de metas', onSelecionar: () => onVerHistorico(indicador) })
        }
        if (podeAlterarSituacao) {
          itens.push({
            rotulo: indicador.ativo ? 'Inativar' : 'Reativar',
            onSelecionar: () => onAlterarSituacao(indicador),
          })
        }
        if (podeExcluir && !indicador.vinculadoADashboard) {
          itens.push({ rotulo: 'Excluir', onSelecionar: () => onExcluir(indicador), perigo: true })
        }
        return <MenuAcoes rotulo={`Ações do indicador ${indicador.nome}`} itens={itens} />
      },
    },
  ]

  return (
    <Tabela
      colunas={colunas}
      dados={indicadores}
      obterChave={(indicador) => indicador.id}
      legenda="Indicadores"
      textoVazio={textoVazio}
      expandir={detalhes}
      expandidas={expandidas}
    />
  )
}
