/**
 * Lista das tabelas de faixas (F8.2, F8.7, F8.8 — RF-41, RNF-03).
 *
 * Componente de apresentação: recebe as tabelas já consultadas e avisa o pai quando o usuário escolhe
 * uma ação no menu da linha. Itens do menu:
 * - "Ver faixas"/"Ocultar faixas" sempre (abre abaixo da linha as faixas vigentes);
 * - "Alterar faixas" (só na tabela ativa), "Histórico de versões", "Inativar tabela"/"Reativar
 *   tabela" (F8.7, conforme a situação) e "Excluir tabela", conforme as permissões.
 * Tabela de dashboard excluído não muda de situação (F8.12*, contrato final): sem "Inativar tabela" e
 * "Reativar tabela"; só pode ser excluída.
 * "Excluir tabela" aparece também em tabela de dashboard existente: o bloqueio é explicado no
 * diálogo de exclusão (F8.6). Várias linhas podem ficar abertas ao mesmo tempo.
 * O botão "Ver motivo" (F8.8) fica na linha, fora do menu, com a permissão do histórico.
 *
 * Colunas: Dashboard (com a etiqueta "Inativa"), Filial ("Todas as filiais (geral)" na faixa geral),
 * Versão vigente, Faixas e Ações.
 */
import { useState } from 'react'
import { Botao } from '../../components/Botao'
import { Etiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import type { TabelaFaixas } from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import { TabelaValoresFaixas } from './TabelaValoresFaixas'
import { nomeTabelaFaixas, textoFilialTabelaFaixas } from './regrasFaixas'
import './ListaTabelasFaixas.css'

export interface ListaTabelasFaixasProps {
  tabelas: TabelaFaixas[]
  /** Exibe "Alterar faixas". */
  podeAlterar: boolean
  /** Exibe "Histórico de versões". */
  podeVerHistorico: boolean
  /** Exibe "Excluir tabela". */
  podeExcluir: boolean
  /** Exibe "Inativar tabela" (tabela ativa) ou "Reativar tabela" (inativa) — F8.7. */
  podeAlterarSituacao?: boolean
  onAlterar: (tabela: TabelaFaixas) => void
  onVerHistorico: (tabela: TabelaFaixas) => void
  onExcluir: (tabela: TabelaFaixas) => void
  /** "Inativar tabela" ou "Reativar tabela" (F8.7). */
  onAlterarSituacao?: (tabela: TabelaFaixas) => void
  /** Botão "Ver motivo" da linha (F8.8); exibido com `podeVerHistorico`. */
  onVerMotivo?: (tabela: TabelaFaixas) => void
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
      {tabela.situacao === 'inativa' ? <Etiqueta tom="alerta">Inativa</Etiqueta> : null}
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
  podeAlterarSituacao = false,
  onAlterar,
  onVerHistorico,
  onExcluir,
  onAlterarSituacao,
  onVerMotivo,
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
    const ativa = tabela.situacao !== 'inativa'
    if (podeAlterar && ativa) itens.push({ rotulo: 'Alterar faixas', onSelecionar: () => onAlterar(tabela) })
    if (podeVerHistorico) itens.push({ rotulo: 'Histórico de versões', onSelecionar: () => onVerHistorico(tabela) })
    if (podeAlterarSituacao && !tabela.dashboardExcluido) {
      itens.push({
        rotulo: ativa ? 'Inativar tabela' : 'Reativar tabela',
        onSelecionar: () => onAlterarSituacao?.(tabela),
      })
    }
    if (podeExcluir) itens.push({ rotulo: 'Excluir tabela', onSelecionar: () => onExcluir(tabela), perigo: true })
    return itens
  }

  const colunas: ColunaTabela<TabelaFaixas>[] = [
    { chave: 'dashboard', titulo: 'Dashboard', render: colunaDashboard },
    { chave: 'filial', titulo: 'Filial', render: textoFilialTabelaFaixas },
    { chave: 'versao', titulo: 'Versão vigente', render: colunaVersao },
    { chave: 'faixas', titulo: 'Faixas', render: (tabela) => textoQuantidadeFaixas(tabela.quantidadeDeFaixas) },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (tabela) => (
        <div className="lista-faixas__acoes">
          {podeVerHistorico ? (
            <Botao variante="link" tamanho="pequeno" onClick={() => onVerMotivo?.(tabela)}>
              Ver motivo
            </Botao>
          ) : null}
          <MenuAcoes rotulo={`Ações da tabela de faixas ${nomeTabelaFaixas(tabela)}`} itens={itensDoMenu(tabela)} />
        </div>
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
