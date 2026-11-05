/**
 * Diálogo "Histórico de metas" de um indicador (F6.8 — RF-39, RNF-01).
 *
 * Consulta sozinho o histórico de ajustes de meta (`listarHistoricoMetas`) ao abrir e sempre que a
 * filial muda. Respostas atrasadas de uma consulta anterior são descartadas. Somente leitura: não há
 * ação de editar ou excluir. Sem ajustes, mostra a mensagem de vazio no lugar da tabela.
 */
import { useEffect, useState } from 'react'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { mensagemDeErro } from '../../services/api'
import { listarHistoricoMetas } from '../../services/indicadoresService'
import type { HistoricoMeta, Indicador } from '../../types/dominio'
import { formatarCompetencia, formatarDataHora, formatarNumero } from '../../utils/formato'
import './DialogoHistoricoMetas.css'

export interface DialogoHistoricoMetasProps {
  /** Indicador cujo histórico é mostrado; `null` mantém o diálogo fechado. */
  indicador: Indicador | null
  /** Filial do cabeçalho; `todas` ou `null` mostra todas as filiais (só Admin). */
  filial: string | null
  onFechar: () => void
}

interface LinhaHistorico extends HistoricoMeta {
  chave: string
}

interface EstadoConsulta {
  /** Identifica a consulta que produziu este estado; diferente da atual, o estado é descartado. */
  chave: string
  itens: HistoricoMeta[]
  erro: string | null
}

const SEM_VALOR = '—'

const COLUNAS: ColunaTabela<LinhaHistorico>[] = [
  { chave: 'data', titulo: 'Data', render: (linha) => formatarDataHora(linha.data) },
  { chave: 'filial', titulo: 'Filial', render: (linha) => linha.filial },
  { chave: 'mes', titulo: 'Mês', render: (linha) => formatarCompetencia(linha.mesDeReferencia) },
  { chave: 'de', titulo: 'De', alinhar: 'direita', render: (linha) => (linha.de === null ? SEM_VALOR : formatarNumero(linha.de)) },
  { chave: 'para', titulo: 'Para', alinhar: 'direita', render: (linha) => formatarNumero(linha.para) },
  { chave: 'usuario', titulo: 'Usuário', render: (linha) => linha.usuario },
  { chave: 'motivo', titulo: 'Motivo', render: (linha) => linha.motivo },
]

function textoFilial(filial: string | null): string {
  return filial === null || filial === 'todas' ? 'Todas as filiais' : `Filial ${filial}`
}

interface ConteudoHistoricoProps {
  indicador: Indicador
  filial: string | null
}

/** Consulta e tabela; montado por indicador aberto, então cada abertura começa do zero. */
function ConteudoHistorico({ indicador, filial }: ConteudoHistoricoProps) {
  const [tentativa, setTentativa] = useState(0)
  const filialConsulta = filial === null || filial === 'todas' ? undefined : filial
  const chaveAtual = `${tentativa}|${filialConsulta ?? ''}`
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)

  useEffect(() => {
    let descartada = false
    listarHistoricoMetas(indicador.id, { filial: filialConsulta }).then(
      (itens) => {
        if (!descartada) setEstado({ chave: chaveAtual, itens, erro: null })
      },
      (erro: unknown) => {
        if (!descartada) setEstado({ chave: chaveAtual, itens: [], erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      descartada = true
    }
  }, [indicador.id, filialConsulta, chaveAtual])

  const consultaAtual = estado !== null && estado.chave === chaveAtual ? estado : null
  const carregando = consultaAtual === null
  const erro = consultaAtual?.erro ?? null
  const linhas: LinhaHistorico[] = (consultaAtual?.itens ?? []).map((item, indice) => ({ ...item, chave: String(indice) }))

  return (
    <div className="dialogo-historico">
      <p className="dialogo-historico__indicador">{indicador.nome}</p>
      <p className="dialogo-historico__filial">
        <span>{textoFilial(filial)}</span>
      </p>
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando histórico..."
        erro={erro}
        onTentarNovamente={() => setTentativa((atual) => atual + 1)}
      />
      {!carregando && !erro && linhas.length === 0 ? (
        <p className="dialogo-historico__vazio">Nenhuma alteração de meta registrada.</p>
      ) : null}
      {!carregando && !erro && linhas.length > 0 ? (
        <Tabela colunas={COLUNAS} dados={linhas} obterChave={(linha) => linha.chave} legenda="Histórico de metas" />
      ) : null}
    </div>
  )
}

export function DialogoHistoricoMetas({ indicador, filial, onFechar }: DialogoHistoricoMetasProps) {
  return (
    <Dialogo aberto={indicador !== null} titulo="Histórico de metas" onFechar={onFechar} className="dialogo--largo">
      {indicador ? <ConteudoHistorico key={indicador.id} indicador={indicador} filial={filial} /> : null}
    </Dialogo>
  )
}
