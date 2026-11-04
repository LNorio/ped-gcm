/**
 * Tabela da listagem de apontamentos (F4.2).
 *
 * Componente de apresentação: recebe a lista já filtrada e avisa o pai quando o usuário pede para
 * ativar/desativar ou excluir um apontamento. Apontamentos não são editáveis (RF-20), então não há
 * ação "Editar". A linha expansível mostra quem alterou a situação e quando (RNF-01).
 */
import { Botao } from '../../components/Botao'
import { Etiqueta } from '../../components/Etiqueta'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { ROTULOS_TIPO_VALOR, type Apontamento } from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import './TabelaApontamentos.css'

export interface TabelaApontamentosProps {
  apontamentos: Apontamento[]
  /** Exibe os botões "Desativar"/"Ativar". */
  podeAlterarSituacao: boolean
  /** Exibe o botão "Excluir". */
  podeExcluir: boolean
  /** Chamado com o apontamento da linha ao clicar em "Desativar" ou "Ativar". */
  onAlterarSituacao: (apontamento: Apontamento) => void
  /** Chamado com o apontamento da linha ao clicar em "Excluir". */
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
      render: (apontamento) => (
        <div className="tabela-apontamentos__acoes">
          {podeAlterarSituacao ? (
            <Botao
              variante="contorno"
              tamanho="pequeno"
              aria-label={`${apontamento.ativo ? 'Desativar' : 'Ativar'} apontamento ${apontamento.nome}`}
              onClick={() => onAlterarSituacao(apontamento)}
            >
              {apontamento.ativo ? 'Desativar' : 'Ativar'}
            </Botao>
          ) : null}
          {podeExcluir ? (
            <Botao
              variante="perigo"
              tamanho="pequeno"
              aria-label={`Excluir apontamento ${apontamento.nome}`}
              onClick={() => onExcluir(apontamento)}
            >
              Excluir
            </Botao>
          ) : null}
        </div>
      ),
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
    />
  )
}
