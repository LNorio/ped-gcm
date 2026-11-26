/**
 * Confirmação da exclusão de um tipo personalizado (F3.3 — RF-16, RN-13, RNF-07).
 *
 * Com `tipo` nulo, nada é renderizado. Tipos com apontamentos vinculados abrem em modo bloqueio
 * (só "Entendi"); os demais pedem confirmação explícita, com o botão Excluir em variante de perigo.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { TipoApontamento } from '../../types/dominio'
import { formatarInteiro } from '../../utils/formato'

export interface DialogoExcluirTipoProps {
  /** Tipo a excluir; `null` mantém o diálogo fechado. */
  tipo: TipoApontamento | null
  /** Enquanto `true`, o botão Excluir fica desabilitado. */
  excluindo: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar, pressionar Esc ou clicar em "Entendi" (modo bloqueado). */
  onCancelar: () => void
}

function textoBloqueio(tipo: TipoApontamento): string | undefined {
  if (tipo.quantidadeApontamentos <= 0) return undefined
  const quantidade = tipo.quantidadeApontamentos
  const texto = quantidade === 1 ? 'apontamento vinculado' : 'apontamentos vinculados'
  return `Este tipo possui ${formatarInteiro(quantidade)} ${texto} e não pode ser excluído.`
}

export function DialogoExcluirTipo({ tipo, excluindo, onConfirmar, onCancelar }: DialogoExcluirTipoProps) {
  if (tipo === null) return null

  return (
    <DialogoConfirmacao
      aberto
      titulo="Excluir tipo"
      impacto={`O tipo ${tipo.nome} será removido. Esta ação não pode ser desfeita.`}
      bloqueio={textoBloqueio(tipo)}
      perigo
      textoConfirmar="Excluir"
      processando={excluindo}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
