/**
 * Tabela da listagem de tipos de apontamento (F3.2 — RF-12; F3.3 — RF-16; F3.5 — RF-15).
 *
 * Componente de apresentação: recebe a lista já filtrada e avisa o pai quando o usuário escolhe uma
 * ação no menu da linha:
 * - "Editar grupos" em todos os tipos (fixos e personalizados), com a permissão de edição;
 * - "Excluir" (perigo, último item) só nos personalizados, com a permissão de exclusão.
 * Linha sem nenhuma ação mostra "—" (oculto de leitores de tela) e "Sem ações" (só para eles).
 *
 * Colunas: Nome, Origem, Grupos vinculados, Apontamentos e Ações.
 */
import { Etiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { ORIGEM_FIXO } from '../../services/tiposService'
import type { TipoApontamento } from '../../types/dominio'

export interface TabelaTiposProps {
  tipos: TipoApontamento[]
  /** Exibe "Editar grupos" em todas as linhas. */
  podeEditar: boolean
  /** Exibe "Excluir" nos tipos personalizados. */
  podeExcluir: boolean
  /** Chamado com o tipo da linha quando o usuário escolhe "Editar grupos". */
  onEditar: (tipo: TipoApontamento) => void
  /** Chamado com o tipo da linha quando o usuário escolhe "Excluir". */
  onExcluir: (tipo: TipoApontamento) => void
  /** Texto exibido quando `tipos` está vazio. */
  textoVazio?: string
}

function textoUsuarios(quantidade: number): string {
  return quantidade === 1 ? '1 usuário vinculado' : `${quantidade} usuários vinculados`
}

function colunaGrupos(tipo: TipoApontamento) {
  const grupos = tipo.grupos ?? []
  const usuarios = tipo.usuarios ?? []
  if (grupos.length === 0 && usuarios.length === 0) {
    return <span className="tabela-tipos__secundario">Nenhum grupo</span>
  }
  return (
    <div className="tabela-tipos__grupos">
      {grupos.map((grupo) => (
        <Etiqueta key={grupo.id} tom="neutro">
          {grupo.nome}
        </Etiqueta>
      ))}
      {usuarios.length > 0 ? <span className="tabela-tipos__secundario">{textoUsuarios(usuarios.length)}</span> : null}
    </div>
  )
}

export function TabelaTipos({ tipos, podeEditar, podeExcluir, onEditar, onExcluir, textoVazio }: TabelaTiposProps) {
  function itensDoMenu(tipo: TipoApontamento): ItemMenuAcoes[] {
    const itens: ItemMenuAcoes[] = []
    if (podeEditar) itens.push({ rotulo: 'Editar grupos', onSelecionar: () => onEditar(tipo) })
    if (podeExcluir && tipo.origem !== ORIGEM_FIXO) {
      itens.push({ rotulo: 'Excluir', onSelecionar: () => onExcluir(tipo), perigo: true })
    }
    return itens
  }

  const colunas: ColunaTabela<TipoApontamento>[] = [
    { chave: 'nome', titulo: 'Nome' },
    {
      chave: 'origem',
      titulo: 'Origem',
      render: (tipo) => <Etiqueta tom={tipo.origem === ORIGEM_FIXO ? 'neutro' : 'info'}>{tipo.origem}</Etiqueta>,
    },
    { chave: 'grupos', titulo: 'Grupos vinculados', render: colunaGrupos },
    { chave: 'quantidadeApontamentos', titulo: 'Apontamentos', alinhar: 'direita' },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (tipo) => {
        const itens = itensDoMenu(tipo)
        if (itens.length === 0) {
          return (
            <>
              <span className="tabela-tipos__sem-acao" aria-hidden="true">
                —
              </span>
              <span className="visualmente-oculto">Sem ações</span>
            </>
          )
        }
        return <MenuAcoes rotulo={`Ações do tipo ${tipo.nome}`} itens={itens} />
      },
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
