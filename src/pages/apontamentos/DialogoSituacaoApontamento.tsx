/**
 * Confirmação de ativar/desativar um apontamento (F4.5 — RNF-07).
 *
 * Com `apontamento` nulo, nada é renderizado. Título, impacto e botão de confirmar acompanham a
 * situação atual do apontamento.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { Apontamento } from '../../types/dominio'

export interface DialogoSituacaoApontamentoProps {
  /** Apontamento a ativar/desativar; `null` mantém o diálogo fechado. */
  apontamento: Apontamento | null
  /** Enquanto `true`, o botão de confirmar fica desabilitado. */
  alterando: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

export function DialogoSituacaoApontamento({
  apontamento,
  alterando,
  onConfirmar,
  onCancelar,
}: DialogoSituacaoApontamentoProps) {
  if (apontamento === null) return null

  const desativar = apontamento.ativo

  return (
    <DialogoConfirmacao
      aberto
      titulo={desativar ? 'Desativar apontamento' : 'Ativar apontamento'}
      impacto={
        desativar
          ? 'Desativado, o apontamento sai do Preenchimento e dos próximos fechamentos. Lançamentos já feitos são mantidos.'
          : 'Ativado, o apontamento volta ao Preenchimento.'
      }
      textoConfirmar={desativar ? 'Desativar' : 'Ativar'}
      processando={alterando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
