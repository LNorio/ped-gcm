/**
 * Confirmação da exclusão de um apontamento (F4.6 — RN-11, RN-12, RNF-07).
 *
 * Com `apontamento` nulo, nada é renderizado. Apontamentos que compõem indicadores abrem em modo
 * bloqueio (só "Entendi"), listando os indicadores; os demais pedem confirmação explícita, com o
 * botão Excluir em variante de perigo.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { Apontamento } from '../../types/dominio'

export interface DialogoExcluirApontamentoProps {
  /** Apontamento a excluir; `null` mantém o diálogo fechado. */
  apontamento: Apontamento | null
  /** Enquanto `true`, o botão Excluir fica desabilitado. */
  excluindo: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar, pressionar Esc ou clicar em "Entendi" (modo bloqueado). */
  onCancelar: () => void
}

function textoBloqueio(apontamento: Apontamento): string | undefined {
  if (apontamento.indicadores.length === 0) return undefined
  const nomes = apontamento.indicadores.map((indicador) => indicador.nome).join(', ')
  return `Este apontamento compõe os indicadores: ${nomes} e não pode ser excluído.`
}

export function DialogoExcluirApontamento({
  apontamento,
  excluindo,
  onConfirmar,
  onCancelar,
}: DialogoExcluirApontamentoProps) {
  if (apontamento === null) return null

  return (
    <DialogoConfirmacao
      aberto
      titulo="Excluir apontamento"
      impacto={`O apontamento ${apontamento.nome} e todos os seus lançamentos e histórico serão apagados. Esta ação não pode ser desfeita.`}
      bloqueio={textoBloqueio(apontamento)}
      perigo
      textoConfirmar="Excluir"
      processando={excluindo}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
