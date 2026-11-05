/**
 * Confirmação da conclusão da construção ou da modificação de um dashboard pela TI (F7.10 — RF-55,
 * RF-56, RNF-07).
 *
 * Com `dashboard` nulo, nada é renderizado. Em construção, o dashboard passa a ficar ativo; em
 * modificação, volta à situação anterior. O número da tarefa aparece quando conhecido.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { Dashboard } from '../../types/dominio'

export interface DialogoConcluirDashboardProps {
  /** Dashboard em construção ou em modificação; `null` mantém o diálogo fechado. */
  dashboard: Dashboard | null
  /** Enquanto `true`, o botão "Concluir" fica desabilitado. */
  concluindo: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

export function DialogoConcluirDashboard({ dashboard, concluindo, onConfirmar, onCancelar }: DialogoConcluirDashboardProps) {
  if (dashboard === null) return null

  const construcao = dashboard.situacao !== 'em_modificacao'
  const texto = construcao
    ? `Confirme que a TI concluiu a construção do dashboard “${dashboard.nome}”. Ele passa a ficar ativo.`
    : `Confirme que a TI concluiu a modificação do dashboard “${dashboard.nome}”. Ele volta à situação anterior à modificação.`

  return (
    <DialogoConfirmacao
      aberto
      titulo={construcao ? 'Concluir construção' : 'Concluir modificação'}
      impacto={
        <>
          <p>{texto}</p>
          {dashboard.tarefaBitrix && dashboard.tarefaBitrix.id !== null ? <p>{`Tarefa nº ${dashboard.tarefaBitrix.id}`}</p> : null}
        </>
      }
      textoConfirmar="Concluir"
      processando={concluindo}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
