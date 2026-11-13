/**
 * Diálogo "Histórico de metas" de um indicador no Preenchimento (F9.10 — RF-74, RNF-01).
 *
 * Mesmo padrão visual e de carga do `DialogoHistoricoMetas` da F6.8, mas filtrado pela filial e pelo
 * mês da tela: consulta sozinho `listarHistoricoMetas(id, { filial, mesDeReferencia })` ao abrir e
 * sempre que a filial ou o mês mudam (respostas atrasadas de uma consulta anterior são descartadas).
 * A filial e o mês ficam no cabeçalho do diálogo, então a tabela não repete essas colunas. Somente
 * leitura.
 */
import { useEffect, useState } from 'react'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { mensagemDeErro } from '../../services/api'
import { listarHistoricoMetas } from '../../services/indicadoresService'
import type { HistoricoMeta, IndicadorMetaPreenchimento } from '../../types/dominio'
import { formatarCompetencia, formatarDataHora, formatarNumero } from '../../utils/formato'
import './DialogoEditarMetas.css'

export interface DialogoHistoricoMetaPreenchimentoProps {
  /** Indicador cujo histórico é mostrado; `null` mantém o diálogo fechado (sem consultar). */
  indicador: IndicadorMetaPreenchimento | null
  /** Código da filial da tela. */
  filial: string
  /** Nome da filial; sem ele, mostra só o código. */
  nomeFilial?: string | null
  /** Mês da tela (`AAAA-MM-DD` ou `AAAA-MM`). */
  mesDeReferencia: string
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
  { chave: 'de', titulo: 'De', alinhar: 'direita', render: (linha) => (linha.de === null ? SEM_VALOR : formatarNumero(linha.de)) },
  { chave: 'para', titulo: 'Para', alinhar: 'direita', render: (linha) => formatarNumero(linha.para) },
  { chave: 'usuario', titulo: 'Usuário', render: (linha) => linha.usuario },
  { chave: 'motivo', titulo: 'Motivo', render: (linha) => linha.motivo },
]

function textoFilial(filial: string, nomeFilial?: string | null): string {
  const nome = nomeFilial?.trim()
  return nome ? `${filial} - ${nome}` : filial
}

interface ConteudoHistoricoProps {
  indicador: IndicadorMetaPreenchimento
  filial: string
  nomeFilial: string | null | undefined
  mesDeReferencia: string
}

/** Consulta e tabela; montado por indicador aberto, então cada abertura começa do zero. */
function ConteudoHistorico({ indicador, filial, nomeFilial, mesDeReferencia }: ConteudoHistoricoProps) {
  const [tentativa, setTentativa] = useState(0)
  const chaveAtual = `${tentativa}|${filial}|${mesDeReferencia}`
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)

  useEffect(() => {
    let descartada = false
    listarHistoricoMetas(indicador.id, { filial, mesDeReferencia }).then(
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
  }, [indicador.id, filial, mesDeReferencia, chaveAtual])

  const consultaAtual = estado !== null && estado.chave === chaveAtual ? estado : null
  const carregando = consultaAtual === null
  const erro = consultaAtual?.erro ?? null
  const linhas: LinhaHistorico[] = (consultaAtual?.itens ?? []).map((item, indice) => ({ ...item, chave: String(indice) }))

  return (
    <div className="metas-preenchimento">
      <p className="metas-preenchimento__nome">{indicador.nome}</p>
      <dl className="metas-preenchimento__cabecalho">
        <div className="metas-preenchimento__par">
          <dt className="metas-preenchimento__rotulo">Filial</dt>
          <dd className="metas-preenchimento__valor">{textoFilial(filial, nomeFilial)}</dd>
        </div>
        <div className="metas-preenchimento__par">
          <dt className="metas-preenchimento__rotulo">Mês</dt>
          <dd className="metas-preenchimento__valor">{formatarCompetencia(mesDeReferencia)}</dd>
        </div>
      </dl>
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando histórico..."
        erro={erro}
        onTentarNovamente={() => setTentativa((atual) => atual + 1)}
      />
      {!carregando && !erro && linhas.length === 0 ? (
        <p className="metas-preenchimento__vazio">Nenhum ajuste de meta neste mês.</p>
      ) : null}
      {!carregando && !erro && linhas.length > 0 ? (
        <Tabela colunas={COLUNAS} dados={linhas} obterChave={(linha) => linha.chave} legenda="Histórico de metas" />
      ) : null}
    </div>
  )
}

export function DialogoHistoricoMetaPreenchimento({
  indicador,
  filial,
  nomeFilial,
  mesDeReferencia,
  onFechar,
}: DialogoHistoricoMetaPreenchimentoProps) {
  return (
    <Dialogo aberto={indicador !== null} titulo="Histórico de metas" onFechar={onFechar} className="dialogo--largo">
      {indicador ? (
        <ConteudoHistorico
          key={indicador.id}
          indicador={indicador}
          filial={filial}
          nomeFilial={nomeFilial}
          mesDeReferencia={mesDeReferencia}
        />
      ) : null}
    </Dialogo>
  )
}
