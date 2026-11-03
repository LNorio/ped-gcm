/**
 * Tabela da listagem de tipos de apontamento (F3.2 — RF-12; F3.3 — RF-16).
 *
 * Componente de apresentação: recebe a lista já filtrada e avisa o pai quando o usuário pede a
 * exclusão de um tipo personalizado. Os tipos fixos não têm ação.
 */
import { Botao } from '../../components/Botao'
import { Etiqueta } from '../../components/Etiqueta'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { ORIGEM_FIXO } from '../../services/tiposService'
import type { TipoApontamento } from '../../types/dominio'

export interface TabelaTiposProps {
  tipos: TipoApontamento[]
  /** Chamado com o tipo da linha quando o usuário clica em "Excluir". */
  onExcluir: (tipo: TipoApontamento) => void
  /** Texto exibido quando `tipos` está vazio. */
  textoVazio?: string
}

export function TabelaTipos({ tipos, onExcluir, textoVazio }: TabelaTiposProps) {
  const colunas: ColunaTabela<TipoApontamento>[] = [
    { chave: 'nome', titulo: 'Nome' },
    {
      chave: 'origem',
      titulo: 'Origem',
      render: (tipo) => <Etiqueta tom={tipo.origem === ORIGEM_FIXO ? 'neutro' : 'info'}>{tipo.origem}</Etiqueta>,
    },
    { chave: 'quantidadeApontamentos', titulo: 'Apontamentos', alinhar: 'direita' },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (tipo) =>
        tipo.origem === ORIGEM_FIXO ? (
          <>
            <span className="tabela-tipos__sem-acao" aria-hidden="true">
              —
            </span>
            <span className="visualmente-oculto">Sem ações</span>
          </>
        ) : (
          <Botao
            variante="perigo"
            tamanho="pequeno"
            aria-label={`Excluir tipo ${tipo.nome}`}
            onClick={() => onExcluir(tipo)}
          >
            Excluir
          </Botao>
        ),
    },
  ]

  return (
    <Tabela
      colunas={colunas}
      dados={tipos}
      obterChave={(tipo) => tipo.id}
      legenda="Tipos de apontamento"
      textoVazio={textoVazio}
    />
  )
}
