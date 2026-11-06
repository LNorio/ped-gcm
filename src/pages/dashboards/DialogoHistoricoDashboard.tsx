/**
 * Diálogo "Histórico de modificações" de um dashboard (F7.9 — RF-57, RNF-01).
 *
 * Consulta sozinho o histórico (`listarHistoricoDashboard`) ao abrir e a cada "Tentar novamente".
 * Respostas atrasadas de uma consulta anterior são descartadas. Somente leitura: além de fechar, não
 * há ações. Usa o `Historico` (legenda "Modificações de {nome}"), na ordem devolvida pela API: data,
 * ação, usuário e, nos detalhes, as alterações, a tarefa e a observação (quando há).
 */
import { useEffect, useState } from 'react'
import { Dialogo } from '../../components/Dialogo'
import { EstadoCarga } from '../../components/EstadoCarga'
import { Historico, type ItemHistorico } from '../../components/Historico'
import { mensagemDeErro } from '../../services/api'
import { type HistoricoDashboard, listarHistoricoDashboard } from '../../services/dashboardsService'
import type { Dashboard } from '../../types/dominio'
import { ROTULO_AGUARDANDO_ENVIO } from '../../utils/tarefaBitrix'

export interface DialogoHistoricoDashboardProps {
  /** Dashboard cujo histórico é mostrado; `null` mantém o diálogo fechado. */
  dashboard: Dashboard | null
  onFechar: () => void
}

/** Rótulo de cada ação quando a API não envia `acao descricao`. */
const ROTULOS_ACAO: Readonly<Record<string, string>> = {
  cadastro: 'Cadastro',
  edicao: 'Edição',
  desativado: 'Desativado',
  reativado: 'Reativado',
  concluida: 'Construção/Modificação concluída',
}

function rotuloAcao(registro: HistoricoDashboard): string {
  if (registro.acaoDescricao.trim() !== '') return registro.acaoDescricao
  return ROTULOS_ACAO[registro.acao] ?? registro.acao
}

function paraItemHistorico(registro: HistoricoDashboard, indice: number): ItemHistorico {
  const detalhes = [...registro.alteracoes]
  if (registro.tarefaAguardandoEnvio) detalhes.push(ROTULO_AGUARDANDO_ENVIO)
  else if (registro.tarefa !== null) detalhes.push(`Tarefa #${registro.tarefa}`)
  if (registro.observacao) detalhes.push(`Observação: ${registro.observacao}`)
  return { id: indice, data: registro.data, acao: rotuloAcao(registro), usuario: registro.usuario, detalhes }
}

interface EstadoConsulta {
  /** Tentativa que produziu este estado; diferente da atual, o estado é descartado. */
  tentativa: number
  itens: HistoricoDashboard[]
  erro: string | null
}

/** Consulta e lista; montado por dashboard aberto, então cada abertura começa do zero. */
function ConteudoHistorico({ dashboard }: { dashboard: Dashboard }) {
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState<EstadoConsulta | null>(null)

  useEffect(() => {
    let descartada = false
    listarHistoricoDashboard(dashboard.id).then(
      (itens) => {
        if (!descartada) setEstado({ tentativa, itens, erro: null })
      },
      (erro: unknown) => {
        if (!descartada) setEstado({ tentativa, itens: [], erro: mensagemDeErro(erro) })
      },
    )
    return () => {
      descartada = true
    }
  }, [dashboard.id, tentativa])

  const consultaAtual = estado !== null && estado.tentativa === tentativa ? estado : null
  const carregando = consultaAtual === null
  const erro = consultaAtual?.erro ?? null

  return (
    <>
      <EstadoCarga
        carregando={carregando}
        mensagemCarregando="Carregando histórico..."
        erro={erro}
        onTentarNovamente={() => setTentativa((atual) => atual + 1)}
      />
      {consultaAtual !== null && erro === null ? (
        <Historico
          itens={consultaAtual.itens.map(paraItemHistorico)}
          legenda={`Modificações de ${dashboard.nome}`}
          textoVazio="Nenhum registro de modificação para este dashboard."
        />
      ) : null}
    </>
  )
}

export function DialogoHistoricoDashboard({ dashboard, onFechar }: DialogoHistoricoDashboardProps) {
  return (
    <Dialogo
      aberto={dashboard !== null}
      titulo="Histórico de modificações"
      descricao={dashboard?.nome}
      onFechar={onFechar}
      className="dialogo--largo"
    >
      {dashboard ? <ConteudoHistorico key={dashboard.id} dashboard={dashboard} /> : null}
    </Dialogo>
  )
}
