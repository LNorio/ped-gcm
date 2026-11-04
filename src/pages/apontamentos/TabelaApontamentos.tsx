/**
 * Tabela da listagem de apontamentos (F4.2).
 *
 * Componente de apresentação: recebe a lista já filtrada e avisa o pai quando o usuário pede para
 * ativar/desativar ou excluir um apontamento. Apontamentos não são editáveis (RF-20), então não há
 * ação "Editar".
 *
 * As ações ficam no menu de três pontos (`MenuAcoes`): "Ver detalhes"/"Ocultar detalhes" (só quando a
 * situação já foi alterada), "Desativar"/"Ativar" e "Excluir", conforme as permissões. Os detalhes
 * mostram quem alterou a situação e quando (RNF-01); várias linhas podem ficar abertas.
 */
import { useState } from 'react'
import { Etiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { ROTULOS_TIPO_VALOR, type Apontamento } from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import './TabelaApontamentos.css'

export interface TabelaApontamentosProps {
  apontamentos: Apontamento[]
  /** Exibe "Desativar"/"Ativar" no menu de ações. */
  podeAlterarSituacao: boolean
  /** Exibe "Excluir" no menu de ações. */
  podeExcluir: boolean
  /** Chamado com o apontamento da linha ao escolher "Desativar" ou "Ativar". */
  onAlterarSituacao: (apontamento: Apontamento) => void
  /** Chamado com o apontamento da linha ao escolher "Excluir". */
  onExcluir: (apontamento: Apontamento) => void
  /** Texto exibido quando `apontamentos` está vazio. */
  textoVazio?: string
}

function detalhesSituacao(apontamento: Apontamento) {
  if (!apontamento.situacaoAlteradaEm) return null
  const por = apontamento.situacaoAlteradaPor ? ` por ${apontamento.situacaoAlteradaPor}` : ''
  return (
    <p className="tabela-apontamentos__detalhe">
      {`Situação alterada em ${formatarDataHora(apontamento.situacaoAlteradaEm)}${por}`}
    </p>
  )
}

export function TabelaApontamentos({
  apontamentos,
  podeAlterarSituacao,
  podeExcluir,
  onAlterarSituacao,
  onExcluir,
  textoVazio,
}: TabelaApontamentosProps) {
  const [expandidas, setExpandidas] = useState<ReadonlySet<Apontamento['id']>>(() => new Set())
  const [apontamentosAnteriores, setApontamentosAnteriores] = useState(apontamentos)

  // Ids que saíram da lista (filtro, exclusão) deixam de constar como expandidos.
  if (apontamentos !== apontamentosAnteriores) {
    setApontamentosAnteriores(apontamentos)
    const ids = new Set(apontamentos.map((apontamento) => apontamento.id))
    if ([...expandidas].some((id) => !ids.has(id))) {
      setExpandidas(new Set([...expandidas].filter((id) => ids.has(id))))
    }
  }

  function alternarDetalhes(id: Apontamento['id']) {
    setExpandidas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(id)) novas.delete(id)
      else novas.add(id)
      return novas
    })
  }

  const colunas: ColunaTabela<Apontamento>[] = [
    {
      chave: 'nome',
      titulo: 'Nome',
      render: (apontamento) => (
        <div className="tabela-apontamentos__pilha">
          <span className="tabela-apontamentos__titulo">{apontamento.nome}</span>
          {apontamento.descricao ? (
            <span className="tabela-apontamentos__secundario">{apontamento.descricao}</span>
          ) : null}
          {apontamento.vinculadoADashboard || apontamento.desativadoMasUsadoEmIndicadorAtivo ? (
            <span className="tabela-apontamentos__etiquetas">
              {apontamento.vinculadoADashboard ? <Etiqueta tom="dourado">Vinculado a dashboard</Etiqueta> : null}
              {apontamento.desativadoMasUsadoEmIndicadorAtivo ? (
                <Etiqueta tom="alerta">Desativado, mas usado em indicador ativo</Etiqueta>
              ) : null}
            </span>
          ) : null}
        </div>
      ),
    },
    { chave: 'tipo', titulo: 'Tipo' },
    {
      chave: 'tipoValor',
      titulo: 'Tipo de valor',
      render: (apontamento) => ROTULOS_TIPO_VALOR[apontamento.tipoValor],
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (apontamento) =>
        apontamento.ativo ? <Etiqueta tom="sucesso">Ativo</Etiqueta> : <Etiqueta tom="neutro">Inativo</Etiqueta>,
    },
    {
      chave: 'indicadores',
      titulo: 'Indicadores',
      render: (apontamento) =>
        apontamento.indicadores.length > 0 ? (
          apontamento.indicadores.map((indicador) => indicador.nome).join(', ')
        ) : (
          <span className="tabela-apontamentos__vazio">—</span>
        ),
    },
    {
      chave: 'cadastro',
      titulo: 'Cadastro',
      render: (apontamento) => (
        <div className="tabela-apontamentos__pilha">
          <span>{formatarDataHora(apontamento.cadastradoEm)}</span>
          {apontamento.cadastradoPor ? (
            <span className="tabela-apontamentos__secundario">{`por ${apontamento.cadastradoPor}`}</span>
          ) : null}
        </div>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (apontamento) => {
        const itens: ItemMenuAcoes[] = []
        if (apontamento.situacaoAlteradaEm) {
          itens.push({
            rotulo: expandidas.has(apontamento.id) ? 'Ocultar detalhes' : 'Ver detalhes',
            onSelecionar: () => alternarDetalhes(apontamento.id),
          })
        }
        if (podeAlterarSituacao) {
          itens.push({
            rotulo: apontamento.ativo ? 'Desativar' : 'Ativar',
            onSelecionar: () => onAlterarSituacao(apontamento),
          })
        }
        if (podeExcluir) {
          itens.push({ rotulo: 'Excluir', onSelecionar: () => onExcluir(apontamento), perigo: true })
        }
        return <MenuAcoes rotulo={`Ações do apontamento ${apontamento.nome}`} itens={itens} />
      },
    },
  ]

  return (
    <Tabela
      colunas={colunas}
      dados={apontamentos}
      obterChave={(apontamento) => apontamento.id}
      legenda="Apontamentos"
      textoVazio={textoVazio}
      expandir={detalhesSituacao}
      expandidas={expandidas}
    />
  )
}
