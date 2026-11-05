/**
 * Confirmação da exclusão de um dashboard (F7.10 — RF-59, RN-18, RNF-07).
 *
 * Com `dashboard` nulo, nada é renderizado. A exclusão apaga a composição, os vínculos e o histórico
 * de modificações; as imagens congeladas já geradas são mantidas. Botão "Excluir" em variante de perigo.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { Dashboard } from '../../types/dominio'

export interface DialogoExcluirDashboardProps {
  /** Dashboard a excluir; `null` mantém o diálogo fechado. */
  dashboard: Dashboard | null
  /** Enquanto `true`, o botão "Excluir" fica desabilitado. */
  excluindo: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

export function DialogoExcluirDashboard({ dashboard, excluindo, onConfirmar, onCancelar }: DialogoExcluirDashboardProps) {
  if (dashboard === null) return null

  return (
    <DialogoConfirmacao
      aberto
      titulo="Excluir dashboard"
      impacto={`O dashboard “${dashboard.nome}” será excluído, com a composição, os vínculos e o histórico de modificações. As imagens congeladas já geradas são mantidas.`}
      perigo
      textoConfirmar="Excluir"
      processando={excluindo}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
