/**
 * Diálogo "Motivo da última alteração" de uma tabela de faixas (F8.8 — botão "Ver motivo"; proposta
 * "faixa geral e situação", seção 7).
 *
 * Consulta sozinho o histórico (`listarHistoricoFaixas`, rota existente) ao abrir e mostra, da
 * primeira linha (a mais recente), a ação, o motivo, o autor e a data. Linha sem `acao` = "Alteração
 * das faixas". Na tabela inativa, mostra também o motivo, a data e o autor da inativação, da situação
 * da própria tabela (que pode ainda não constar no histórico). Somente leitura.
 */
import { useEffect, useState } from 'react'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { mensagemDeErro } from '../../services/api'
import { listarHistoricoFaixas, type VersaoFaixas } from '../../services/faixasService'
import type { TabelaFaixas } from '../../types/dominio'
import { formatarDataHora } from '../../utils/formato'
import { nomeTabelaFaixas, rotuloAcaoHistoricoFaixas } from './regrasFaixas'
import '../indicadores/DialogoHistoricoMetas.css'
import './ListaTabelasFaixas.css'

export interface DialogoMotivoFaixasProps {
  /** Tabela cujo motivo é mostrado; `null` mantém o diálogo fechado (sem consultar). */
  tabela: TabelaFaixas | null
  onFechar: () => void
}

interface EstadoConsulta {
  /** Tentativa que produziu este estado; diferente da atual, o estado é descartado. */
  tentativa: number
  versoes: VersaoFaixas[]
  erro: string | null
}

type Par = [rotulo: string, valor: string]

function ListaPares({ pares }: { pares: Par[] }) {
  return (
    <dl className="dialogo-motivo-faixas__campos">
      {pares.map(([rotulo, valor]) => (
        <div key={rotulo} className="dialogo-motivo-faixas__par">
          <dt className="dialogo-motivo-faixas__rotulo">{rotulo}</dt>
          <dd className="dialogo-motivo-faixas__valor">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Motivo, data e autor da inativação, da situação da tabela; vazio na tabela ativa. */
function paresDaInativacao(tabela: TabelaFaixas): Par[] {
  if (tabela.situacao !== 'inativa') return []
  const pares: Par[] = []
  if (tabela.motivoDaSituacao) pares.push(['Motivo da inativação', tabela.motivoDaSituacao])
  if (tabela.dataDaSituacao) {
    const data = formatarDataHora(tabela.dataDaSituacao)
    pares.push(['Inativada em', tabela.usuarioDaSituacao ? `${data} por ${tabela.usuarioDaSituacao}` : data])
  }
  return pares
}

function ConteudoMotivo({ tabela }: { tabela: TabelaFaixas }) {
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)

  useEffect(() => {
    let descartada = false
    listarHistoricoFaixas(tabela.id).then(
      (versoes) => {
        if (!descartada) setEstado({ tentativa, versoes, erro: null })
      },
      (erro: unknown) => {
        if (!descartada) setEstado({ tentativa, versoes: [], erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      descartada = true
    }
  }, [tabela.id, tentativa])

  const consultaAtual = estado !== null && estado.tentativa === tentativa ? estado : null
  const carregando = consultaAtual === null
  const erro = consultaAtual?.erro ?? null
  const ultima = consultaAtual?.versoes[0] ?? null
  const inativacao = paresDaInativacao(tabela)

  return (
    <div className="dialogo-historico">
      <p className="dialogo-historico__indicador">{nomeTabelaFaixas(tabela)}</p>
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando motivo..."
        erro={erro}
        onTentarNovamente={() => setTentativa((atual) => atual + 1)}
      />
      {!carregando && !erro && ultima === null ? (
        <p className="dialogo-historico__vazio">Nenhuma alteração registrada.</p>
      ) : null}
      {!carregando && !erro && ultima !== null ? (
        <ListaPares
          pares={[
            ['Ação', rotuloAcaoHistoricoFaixas(ultima.acao)],
            ['Motivo', ultima.motivo],
            ['Autor', ultima.usuario],
            ['Data', formatarDataHora(ultima.data)],
          ]}
        />
      ) : null}
      {!carregando && !erro && inativacao.length > 0 ? <ListaPares pares={inativacao} /> : null}
    </div>
  )
}

export function DialogoMotivoFaixas({ tabela, onFechar }: DialogoMotivoFaixasProps) {
  return (
    <Dialogo aberto={tabela !== null} titulo="Motivo da última alteração" onFechar={onFechar}>
      {tabela ? <ConteudoMotivo key={tabela.id} tabela={tabela} /> : null}
    </Dialogo>
  )
}
