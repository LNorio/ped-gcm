/**
 * Diálogo "Histórico de aberturas de período" (F9.11 — RF-76: cada abertura registra o mês, o usuário
 * e a data).
 *
 * Consulta sozinho `listarHistoricoPeriodos()` ao abrir e mostra as aberturas na ordem da API (a mais
 * recente primeiro): "Mês" (MM/AAAA, com a etiqueta "Reaberto" na reabertura), "Aberto por" e
 * "Aberto em" (dd/mm/aaaa hh:mm); campos ausentes viram "—". Somente leitura, para todos os perfis.
 */
import { useEffect, useState } from 'react'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Etiqueta } from '../../components/Etiqueta'
import { Tabela, type ColunaTabela } from '../../components/Tabela'
import { mensagemDeErro } from '../../services/api'
import { listarHistoricoPeriodos } from '../../services/periodoService'
import type { PeriodoAberto } from '../../types/dominio'
import { formatarCompetencia, formatarDataHora } from '../../utils/formato'
import '../indicadores/DialogoHistoricoMetas.css'
import './DialogoHistoricoPeriodos.css'

export interface DialogoHistoricoPeriodosProps {
  /** Quando `false`, o diálogo não renderiza nem consulta a API. */
  aberto: boolean
  onFechar: () => void
}

interface EstadoConsulta {
  /** Tentativa que produziu este estado; diferente da atual, o estado é descartado. */
  tentativa: number
  aberturas: PeriodoAberto[]
  erro: string | null
}

interface LinhaHistorico {
  chave: number
  abertura: PeriodoAberto
}

const SEM_VALOR = '—'

const COLUNAS: ColunaTabela<LinhaHistorico>[] = [
  {
    chave: 'mes',
    titulo: 'Mês',
    render: ({ abertura }) => (
      <span className="dialogo-historico-periodos__mes">
        <span>{formatarCompetencia(abertura.mesDeReferencia) || SEM_VALOR}</span>
        {abertura.reaberto ? <Etiqueta tom="alerta">Reaberto</Etiqueta> : null}
      </span>
    ),
  },
  { chave: 'abertoPor', titulo: 'Aberto por', render: ({ abertura }) => abertura.abertoPor || SEM_VALOR },
  { chave: 'abertoEm', titulo: 'Aberto em', render: ({ abertura }) => formatarDataHora(abertura.abertoEm) || SEM_VALOR },
]

function ConteudoHistorico() {
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)

  useEffect(() => {
    let descartada = false
    listarHistoricoPeriodos().then(
      (aberturas) => {
        if (!descartada) setEstado({ tentativa, aberturas, erro: null })
      },
      (erro: unknown) => {
        if (!descartada) setEstado({ tentativa, aberturas: [], erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      descartada = true
    }
  }, [tentativa])

  const consultaAtual = estado !== null && estado.tentativa === tentativa ? estado : null
  const carregando = consultaAtual === null
  const erro = consultaAtual?.erro ?? null
  const aberturas = consultaAtual?.aberturas ?? []
  const linhas: LinhaHistorico[] = aberturas.map((abertura, chave) => ({ chave, abertura }))

  return (
    <div className="dialogo-historico">
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando histórico..."
        erro={erro}
        onTentarNovamente={() => setTentativa((atual) => atual + 1)}
      />
      {!carregando && !erro && aberturas.length === 0 ? (
        <p className="dialogo-historico__vazio">Nenhuma abertura registrada.</p>
      ) : null}
      {!carregando && !erro && aberturas.length > 0 ? (
        <Tabela colunas={COLUNAS} dados={linhas} obterChave={(linha) => linha.chave} legenda="Aberturas de período" />
      ) : null}
    </div>
  )
}

export function DialogoHistoricoPeriodos({ aberto, onFechar }: DialogoHistoricoPeriodosProps) {
  return (
    <Dialogo aberto={aberto} titulo="Histórico de aberturas de período" onFechar={onFechar}>
      {aberto ? <ConteudoHistorico /> : null}
    </Dialogo>
  )
}
