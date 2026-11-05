/**
 * Lista das tabelas de faixas (F8.2 — RF-41, RNF-03).
 *
 * Componente de apresentação: recebe as tabelas já consultadas e avisa o pai quando o usuário escolhe
 * uma ação no menu da linha. Itens do menu:
 * - "Ver faixas"/"Ocultar faixas" sempre (abre abaixo da linha as faixas vigentes);
 * - "Alterar faixas", "Histórico de versões" e "Excluir tabela" conforme as permissões.
 * "Excluir tabela" aparece também em tabela de dashboard existente: o bloqueio é explicado no
 * diálogo de exclusão (F8.6). Várias linhas podem ficar abertas ao mesmo tempo.
 *
 * Colunas: Dashboard, Filial, Versão vigente, Faixas e Ações.
 */
import { useState } from 'react'
import { Etiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import type { TabelaFaixas } from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import { TabelaValoresFaixas } from './TabelaValoresFaixas'
import { nomeTabelaFaixas } from './regrasFaixas'
import './ListaTabelasFaixas.css'

export interface ListaTabelasFaixasProps {
  tabelas: TabelaFaixas[]
  /** Exibe "Alterar faixas". */
  podeAlterar: boolean
  /** Exibe "Histórico de versões". */
  podeVerHistorico: boolean
  /** Exibe "Excluir tabela". */
  podeExcluir: boolean
  onAlterar: (tabela: TabelaFaixas) => void
  onVerHistorico: (tabela: TabelaFaixas) => void
  onExcluir: (tabela: TabelaFaixas) => void
  /** Texto exibido quando `tabelas` está vazia. */
  textoVazio: string
}

/** "1 faixa" / "N faixas". */
function textoQuantidadeFaixas(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'faixa' : 'faixas'}`
}

function colunaDashboard(tabela: TabelaFaixas) {
  return (
    <div className="lista-faixas__pilha">
      <span className="lista-faixas__titulo">{tabela.dashboard}</span>
      {tabela.descricao ? <span className="lista-faixas__secundario">{tabela.descricao}</span> : null}
      {tabela.dashboardExcluido ? <Etiqueta tom="perigo">Dashboard excluído</Etiqueta> : null}
    </div>
  )
}

function colunaVersao(tabela: TabelaFaixas) {
  const partes: string[] = []
  if (tabela.dataDaVersao) partes.push(formatarDataHora(tabela.dataDaVersao))
  if (tabela.autorDaVersao) partes.push(`por ${tabela.autorDaVersao}`)
  return (
    <div className="lista-faixas__pilha">
      <span className="lista-faixas__titulo">{`v${tabela.versaoVigente}`}</span>
      {partes.length > 0 ? <span className="lista-faixas__secundario">{partes.join(' ')}</span> : null}
    </div>
  )
}

export function ListaTabelasFaixas({
  tabelas,
  podeAlterar,
  podeVerHistorico,
  podeExcluir,
  onAlterar,
  onVerHistorico,
  onExcluir,
  textoVazio,
}: ListaTabelasFaixasProps) {
  const [expandidas, setExpandidas] = useState<ReadonlySet<TabelaFaixas['id']>>(() => new Set())
  const [tabelasAnteriores, setTabelasAnteriores] = useState(tabelas)

  // Ids que saíram da lista (filial trocada, exclusão) deixam de constar como expandidos.
  if (tabelas !== tabelasAnteriores) {
    setTabelasAnteriores(tabelas)
    const ids = new Set(tabelas.map((tabela) => tabela.id))
    if ([...expandidas].some((id) => !ids.has(id))) {
      setExpandidas(new Set([...expandidas].filter((id) => ids.has(id))))
    }
  }

  function alternarFaixas(id: TabelaFaixas['id']) {
    setExpandidas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(id)) novas.delete(id)
      else novas.add(id)
      return novas
    })
  }

  function itensDoMenu(tabela: TabelaFaixas): ItemMenuAcoes[] {
    const itens: ItemMenuAcoes[] = [
      {
        rotulo: expandidas.has(tabela.id) ? 'Ocultar faixas' : 'Ver faixas',
        onSelecionar: () => alternarFaixas(tabela.id),
      },
    ]
    if (podeAlterar) itens.push({ rotulo: 'Alterar faixas', onSelecionar: () => onAlterar(tabela) })
    if (podeVerHistorico) itens.push({ rotulo: 'Histórico de versões', onSelecionar: () => onVerHistorico(tabela) })
    if (podeExcluir) itens.push({ rotulo: 'Excluir tabela', onSelecionar: () => onExcluir(tabela), perigo: true })
    return itens
  }

  const colunas: ColunaTabela<TabelaFaixas>[] = [
    { chave: 'dashboard', titulo: 'Dashboard', render: colunaDashboard },
    { chave: 'filial', titulo: 'Filial', render: (tabela) => `${tabela.filial} - ${tabela.nomeFilial}` },
    { chave: 'versao', titulo: 'Versão vigente', render: colunaVersao },
    { chave: 'faixas', titulo: 'Faixas', render: (tabela) => textoQuantidadeFaixas(tabela.quantidadeDeFaixas) },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (tabela) => (
        <MenuAcoes rotulo={`Ações da tabela de faixas ${nomeTabelaFaixas(tabela)}`} itens={itensDoMenu(tabela)} />
      ),
    },
  ]

  return (
    <Tabela
      colunas={colunas}
      dados={tabelas}
      obterChave={(tabela) => tabela.id}
      legenda="Tabelas de faixas"
      textoVazio={textoVazio}
      expandir={(tabela) => (
        <TabelaValoresFaixas faixas={tabela.faixas} legenda={`Faixas vigentes de ${nomeTabelaFaixas(tabela)}`} />
      )}
      expandidas={expandidas}
    />
  )
}
