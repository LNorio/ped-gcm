/**
 * Confirmação de desativar/ativar um dashboard (F7.10 — RF-58, RN-17, RN-18, RNF-07).
 *
 * Com `dashboard` nulo, nada é renderizado. O título, o impacto e o botão acompanham a situação
 * atual: o ativo é desativado (sai do Início e dos Fechamentos); o inativo é ativado (volta a partir
 * do período atual).
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { Dashboard } from '../../types/dominio'

export interface DialogoSituacaoDashboardProps {
  /** Dashboard a desativar/ativar; `null` mantém o diálogo fechado. */
  dashboard: Dashboard | null
  /** Enquanto `true`, o botão de confirmar fica desabilitado. */
  alterando: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

export function DialogoSituacaoDashboard({ dashboard, alterando, onConfirmar, onCancelar }: DialogoSituacaoDashboardProps) {
  if (dashboard === null) return null

  const desativar = dashboard.situacao === 'ativo'
  const impacto = desativar
    ? `O dashboard “${dashboard.nome}” sai do Início e dos Fechamentos, e seus períodos não podem ser encerrados enquanto estiver inativo. Imagens congeladas e lançamentos são mantidos.`
    : `O dashboard “${dashboard.nome}” volta ao Início e aos Fechamentos a partir do período atual (${dashboard.periodoAtual}).`

  return (
    <DialogoConfirmacao
      aberto
      titulo={desativar ? 'Desativar dashboard' : 'Ativar dashboard'}
      impacto={impacto}
      textoConfirmar={desativar ? 'Desativar' : 'Ativar'}
      processando={alterando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
