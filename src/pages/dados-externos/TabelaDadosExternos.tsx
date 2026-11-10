/**
 * Tabela da listagem de dados externos (F5.2 — RF-23; F5.16 e F5.17).
 *
 * Componente de apresentação: recebe a lista já filtrada e avisa o pai quando o usuário pede para
 * concluir a construção, configurar a integração, ativar/desativar ou excluir um dado. Os dados do
 * cadastro não são editáveis (RF-29), então não há ação "Editar"; só a integração é configurável.
 *
 * A tabela mostra só Nome (com o tipo), Situação (com a tarefa e, quando a integração está pendente,
 * a etiqueta "Integração pendente (TI)"), Origem, Identificador (com a URL da integração abaixo,
 * quando existe), Cadastro e Ações. No menu, logo após "Ver detalhes", o dado ativo/inativo mostra
 * "Configurações" ("Preencher integração" quando pendente) com `podeConfigurarIntegracao`. As ações ficam no menu de três pontos (`MenuAcoes`), que também abre e oculta os detalhes
 * da linha (várias linhas podem ficar abertas). Os detalhes trazem, como pares rótulo e valor,
 * Campo/cálculo, Referência, Coleta, Janela retroativa e Tipo de valor e, quando existem, os
 * comentários e quem alterou a situação e quando (RNF-01).
 */
import { useState } from 'react'
import { Etiqueta, type TomEtiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { TextoTruncado } from '../../components/TextoTruncado'
import {
  ROTULOS_COLETA,
  ROTULOS_REFERENCIA,
  ROTULOS_SISTEMA_ORIGEM,
  ROTULOS_SITUACAO_DADO_EXTERNO,
  ROTULOS_TIPO_VALOR,
  type DadoExterno,
  type JanelaRetroativa,
  type SituacaoDadoExterno,
} from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import { textoTarefaBitrix } from '../../utils/tarefaBitrix'
import './TabelaDadosExternos.css'

export interface TabelaDadosExternosProps {
  dados: DadoExterno[]
  /** Exibe "Concluir construção" nos dados em construção. */
  podeConcluir: boolean
  /** Exibe "Desativar"/"Ativar" (nunca em dados em construção — RF-30). */
  podeAlterarSituacao: boolean
  /** Exibe o botão "Excluir". */
  podeExcluir: boolean
  /** Chamado com o dado da linha ao clicar em "Concluir construção". */
  onConcluir: (dado: DadoExterno) => void
  /** Chamado com o dado da linha ao clicar em "Desativar" ou "Ativar". */
  onAlterarSituacao: (dado: DadoExterno) => void
  /** Chamado com o dado da linha ao clicar em "Excluir". */
  onExcluir: (dado: DadoExterno) => void
  /** Exibe "Configurações"/"Preencher integração" nos dados ativos e inativos (padrão `false`). */
  podeConfigurarIntegracao?: boolean
  /** Chamado com o dado da linha ao clicar em "Configurações" ou "Preencher integração". */
  onConfigurarIntegracao?: (dado: DadoExterno) => void
  /** Texto exibido quando `dados` está vazio. */
  textoVazio?: string
}

const TOM_SITUACAO: Readonly<Record<SituacaoDadoExterno, TomEtiqueta>> = {
  ativo: 'sucesso',
  inativo: 'neutro',
  em_construcao: 'info',
}

function rotuloJanela(janela: JanelaRetroativa | null): string {
  if (janela === null) return '—'
  return janela === 1 ? 'Somente o mês' : `${janela} meses`
}

function detalhes(dado: DadoExterno) {
  const linhas: string[] = []
  if (dado.comentarios) linhas.push(`Comentários: ${dado.comentarios}`)
  if (dado.situacaoAlteradaEm) {
    const por = dado.situacaoAlteradaPor ? ` por ${dado.situacaoAlteradaPor}` : ''
    linhas.push(`Situação alterada em ${formatarDataHora(dado.situacaoAlteradaEm)}${por}`)
  }
  const pares: [string, string][] = [
    ['Campo/cálculo', dado.campoCalculo ?? '—'],
    ['Referência', ROTULOS_REFERENCIA[dado.referencia]],
    ['Coleta', dado.coletaDescricao ?? ROTULOS_COLETA[dado.coleta]],
    ['Janela retroativa', rotuloJanela(dado.janelaRetroativa)],
    ['Tipo de valor', ROTULOS_TIPO_VALOR[dado.tipoValor]],
  ]
  return (
    <div className="tabela-dados-externos__pilha">
      <dl className="tabela-dados-externos__campos">
        {pares.map(([rotulo, valor]) => (
          <div key={rotulo} className="tabela-dados-externos__par">
            <dt className="tabela-dados-externos__rotulo">{rotulo}</dt>
            <dd className="tabela-dados-externos__valor">{valor}</dd>
          </div>
        ))}
      </dl>
      {linhas.map((texto) => (
        <p key={texto} className="tabela-dados-externos__detalhe">
          {texto}
        </p>
      ))}
    </div>
  )
}

export function TabelaDadosExternos({
  dados,
  podeConcluir,
  podeAlterarSituacao,
  podeExcluir,
  onConcluir,
  onAlterarSituacao,
  onExcluir,
  podeConfigurarIntegracao = false,
  onConfigurarIntegracao,
  textoVazio,
}: TabelaDadosExternosProps) {
  const [expandidas, setExpandidas] = useState<ReadonlySet<DadoExterno['id']>>(() => new Set())
  const [dadosAnteriores, setDadosAnteriores] = useState(dados)

  // Ids que saíram da lista (filtro, exclusão) deixam de constar como expandidos.
  if (dados !== dadosAnteriores) {
    setDadosAnteriores(dados)
    const ids = new Set(dados.map((dado) => dado.id))
    if ([...expandidas].some((id) => !ids.has(id))) {
      setExpandidas(new Set([...expandidas].filter((id) => ids.has(id))))
    }
  }

  function alternarDetalhes(id: DadoExterno['id']) {
    setExpandidas((atuais) => {
      const novas = new Set(atuais)
      if (novas.has(id)) novas.delete(id)
      else novas.add(id)
      return novas
    })
  }

  const colunas: ColunaTabela<DadoExterno>[] = [
    {
      chave: 'nome',
      titulo: 'Nome',
      render: (dado) => (
        <div className="tabela-dados-externos__pilha tabela-dados-externos__quebra">
          <span className="tabela-dados-externos__titulo">{dado.nome}</span>
          <span className="tabela-dados-externos__secundario">{dado.tipo}</span>
        </div>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      render: (dado) => (
        <div className="tabela-dados-externos__pilha">
          <Etiqueta tom={TOM_SITUACAO[dado.situacao]}>{ROTULOS_SITUACAO_DADO_EXTERNO[dado.situacao]}</Etiqueta>
          {dado.integracaoPendente ? <Etiqueta tom="alerta">Integração pendente (TI)</Etiqueta> : null}
          {dado.tarefaBitrix ? (
            <span className="tabela-dados-externos__secundario">{textoTarefaBitrix(dado.tarefaBitrix)}</span>
          ) : null}
        </div>
      ),
    },
    { chave: 'origem', titulo: 'Origem', render: (dado) => ROTULOS_SISTEMA_ORIGEM[dado.sistemaOrigem] },
    {
      chave: 'identificador',
      titulo: 'Identificador',
      render: (dado) => (
        <div className="tabela-dados-externos__pilha">
          {dado.identificador ? (
            <TextoTruncado texto={dado.identificador} className="tabela-dados-externos__identificador" />
          ) : (
            <span className="tabela-dados-externos__vazio">a definir pela TI</span>
          )}
          {dado.url ? <TextoTruncado texto={dado.url} className="tabela-dados-externos__secundario tabela-dados-externos__url" /> : null}
        </div>
      ),
    },
    {
      chave: 'cadastro',
      titulo: 'Cadastro',
      render: (dado) => (
        <div className="tabela-dados-externos__pilha tabela-dados-externos__quebra tabela-dados-externos__quebra--estreita">
          <span>{formatarDataHora(dado.cadastradoEm)}</span>
          {dado.cadastradoPor ? (
            <span className="tabela-dados-externos__secundario">{`por ${dado.cadastradoPor}`}</span>
          ) : null}
        </div>
      ),
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (dado) => {
        const emConstrucao = dado.situacao === 'em_construcao'
        const ativo = dado.situacao === 'ativo'
        const itens: ItemMenuAcoes[] = [
          {
            rotulo: expandidas.has(dado.id) ? 'Ocultar detalhes' : 'Ver detalhes',
            onSelecionar: () => alternarDetalhes(dado.id),
          },
        ]
        if (podeConfigurarIntegracao && onConfigurarIntegracao && !emConstrucao) {
          itens.push({
            rotulo: dado.integracaoPendente ? 'Preencher integração' : 'Configurações',
            onSelecionar: () => onConfigurarIntegracao(dado),
          })
        }
        if (podeConcluir && emConstrucao) {
          itens.push({ rotulo: 'Concluir construção', onSelecionar: () => onConcluir(dado) })
        }
        if (podeAlterarSituacao && !emConstrucao) {
          itens.push({ rotulo: ativo ? 'Desativar' : 'Ativar', onSelecionar: () => onAlterarSituacao(dado) })
        }
        if (podeExcluir) {
          itens.push({ rotulo: 'Excluir', onSelecionar: () => onExcluir(dado), perigo: true })
        }
        return <MenuAcoes rotulo={`Ações do dado externo ${dado.nome}`} itens={itens} />
      },
    },
  ]

  return (
    <Tabela
      colunas={colunas}
      dados={dados}
      obterChave={(dado) => dado.id}
      className="tabela-dados-externos"
      legenda="Dados externos"
      textoVazio={textoVazio}
      expandir={detalhes}
      expandidas={expandidas}
    />
  )
}
