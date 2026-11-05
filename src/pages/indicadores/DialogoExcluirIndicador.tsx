/**
 * Confirmação da exclusão de um indicador (F6.7 front — RF-37, RN-11, RNF-07).
 *
 * Com `indicador` nulo, nada é renderizado. Indicador que está ou já esteve vinculado a dashboard
 * (marca `vinculadoADashboard`) abre em modo bloqueio (só "Entendi"), pois a API não permite excluí-lo
 * (RN-11). Os demais pedem confirmação explícita, com o botão Excluir em variante de perigo.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { Indicador } from '../../types/dominio'

export interface DialogoExcluirIndicadorProps {
  /** Indicador a excluir; `null` mantém o diálogo fechado. */
  indicador: Indicador | null
  /** Enquanto `true`, o botão Excluir fica desabilitado. */
  excluindo: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar, pressionar Esc ou clicar em "Entendi" (modo bloqueado). */
  onCancelar: () => void
}

const BLOQUEIO_VINCULADO =
  'Este indicador está ou já esteve vinculado a dashboard e não pode ser excluído. Se necessário, inative-o.'

export function DialogoExcluirIndicador({ indicador, excluindo, onConfirmar, onCancelar }: DialogoExcluirIndicadorProps) {
  if (indicador === null) return null

  return (
    <DialogoConfirmacao
      aberto
      titulo="Excluir indicador"
      impacto={`O indicador ${indicador.nome} será excluído definitivamente. Esta ação não pode ser desfeita.`}
      bloqueio={indicador.vinculadoADashboard ? BLOQUEIO_VINCULADO : undefined}
      perigo
      textoConfirmar="Excluir"
      processando={excluindo}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
