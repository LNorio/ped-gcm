/**
 * Tabela da aba Fechamentos (F10.2 — RF-78, RN-16).
 *
 * Componente de apresentação: recebe a lista já filtrada e ordenada e avisa o pai quando o usuário
 * escolhe uma ação no menu da linha ("Pré-visualizar imagens" — F10.4; "Encerrar período" — F10.5).
 *
 * Colunas: Dashboard (nome, vínculo e etiquetas de indicadores com problema e falta de tabela de
 * faixas), Unidades (unidades de imagem e pendências), Periodicidade, Período atual (com a situação),
 * Progresso (texto e barra acessível) e Ações.
 */
import { Etiqueta } from '../../components/Etiqueta'
import { MenuAcoes, type ItemMenuAcoes } from '../../components/MenuAcoes'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { type Fechamento, ROTULOS_PERIODICIDADE, ROTULOS_SITUACAO_PERIODO } from '../../types/dominio'
import './TabelaFechamentos.css'

export interface TabelaFechamentosProps {
  fechamentos: Fechamento[]
  /** "Pré-visualizar imagens" (prévia da F10.4). */
  onPrevisualizar: (fechamento: Fechamento) => void
  /** "Encerrar período" (confirmação da F10.5). */
  onEncerrar: (fechamento: Fechamento) => void
  /** Texto exibido quando `fechamentos` está vazio. */
  textoVazio?: string
}

function contagem(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

function textoVinculo(fechamento: Fechamento): string {
  const itens = fechamento.itensVinculados
  if (fechamento.tipoVinculo === 'filiais') return `Filiais: ${itens.join(', ')}`
  if (fechamento.tipoVinculo === 'cargos') return `Cargos: ${itens.join(', ')}`
  return contagem(itens.length, 'colaborador vinculado', 'colaboradores vinculados')
}

/** Unidades de imagem: filiais no vínculo por filiais; colaboradores nos vínculos por cargos ou colaboradores. */
function textoUnidades(fechamento: Fechamento): string {
  return fechamento.tipoVinculo === 'filiais'
    ? contagem(fechamento.unidadesDeImagem, 'filial', 'filiais')
    : contagem(fechamento.unidadesDeImagem, 'colaborador', 'colaboradores')
}

function textoSemFaixas(unidades: string[]): string {
  return unidades.length === 1
    ? `Sem tabela de faixas: filial ${unidades[0]}`
    : `Sem tabela de faixas: filiais ${unidades.join(', ')}`
}

/** Percentual inteiro (0 a 100) dos lançamentos preenchidos; sem lançamentos, 0. */
function percentualProgresso(fechamento: Fechamento): number {
  const { preenchidos, total } = fechamento.progresso
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((preenchidos / total) * 100)))
}

function colunaDashboard(fechamento: Fechamento) {
  const problemas = fechamento.indicadoresComProblema
  const semFaixas = fechamento.unidadesSemTabelaDeFaixas
  return (
    <div className="tabela-fechamentos__pilha">
      <span className="tabela-fechamentos__titulo">{fechamento.nome}</span>
      <span className="tabela-fechamentos__secundario">{textoVinculo(fechamento)}</span>
      {problemas.length > 0 || semFaixas.length > 0 ? (
        <div className="tabela-fechamentos__etiquetas">
          {problemas.length > 0 ? (
            <Etiqueta tom="perigo">{contagem(problemas.length, 'indicador com problema', 'indicadores com problema')}</Etiqueta>
          ) : null}
          {semFaixas.length > 0 ? <Etiqueta tom="alerta">{textoSemFaixas(semFaixas)}</Etiqueta> : null}
        </div>
      ) : null}
    </div>
  )
}

function colunaUnidades(fechamento: Fechamento) {
  const pendencias = fechamento.unidadesComPendencias
  return (
    <div className="tabela-fechamentos__pilha">
      <span>{textoUnidades(fechamento)}</span>
      <span className={pendencias > 0 ? 'tabela-fechamentos__pendencias' : 'tabela-fechamentos__secundario'}>
        {pendencias > 0 ? `${pendencias} com pendências` : 'Sem pendências'}
      </span>
    </div>
  )
}

function colunaPeriodo(fechamento: Fechamento) {
  const aberto = fechamento.situacaoDoPeriodo === 'aberto'
  return (
    <div className="tabela-fechamentos__pilha">
      <span>{fechamento.periodoAtual}</span>
      <Etiqueta tom={aberto ? 'info' : 'neutro'}>{ROTULOS_SITUACAO_PERIODO[fechamento.situacaoDoPeriodo]}</Etiqueta>
    </div>
  )
}

function colunaProgresso(fechamento: Fechamento) {
  const { preenchidos, total } = fechamento.progresso
  const percentual = percentualProgresso(fechamento)
  return (
    <div className="tabela-fechamentos__pilha tabela-fechamentos__progresso">
      <span>{`${preenchidos} de ${total} lançamentos`}</span>
      <div
        className="tabela-fechamentos__barra"
        role="progressbar"
        aria-label={`Progresso de lançamentos de ${fechamento.nome}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentual}
      >
        <div className="tabela-fechamentos__barra-preenchida" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

export function TabelaFechamentos({ fechamentos, onPrevisualizar, onEncerrar, textoVazio }: TabelaFechamentosProps) {
  function itensDoMenu(fechamento: Fechamento): ItemMenuAcoes[] {
    return [
      { rotulo: 'Pré-visualizar imagens', onSelecionar: () => onPrevisualizar(fechamento) },
      { rotulo: 'Encerrar período', onSelecionar: () => onEncerrar(fechamento) },
    ]
  }

  const colunas: ColunaTabela<Fechamento>[] = [
    { chave: 'nome', titulo: 'Dashboard', render: colunaDashboard },
    { chave: 'unidades', titulo: 'Unidades', render: colunaUnidades },
    {
      chave: 'periodicidade',
      titulo: 'Periodicidade',
      render: (fechamento) => ROTULOS_PERIODICIDADE[fechamento.periodicidade],
    },
    { chave: 'periodoAtual', titulo: 'Período atual', render: colunaPeriodo },
    { chave: 'progresso', titulo: 'Progresso', render: colunaProgresso },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhar: 'direita',
      render: (fechamento) => <MenuAcoes rotulo={`Ações do dashboard ${fechamento.nome}`} itens={itensDoMenu(fechamento)} />,
    },
  ]

  return (
    <Tabela
      colunas={colunas}
      dados={fechamentos}
      obterChave={(fechamento) => fechamento.id}
      legenda="Fechamentos por dashboard"
      textoVazio={textoVazio}
    />
  )
}
