/**
 * Confirmação da exclusão de um dado externo (F5.9 — RF-31, RN-12, RNF-07).
 *
 * Com `dado` nulo, nada é renderizado. Dados que compõem indicadores abrem em modo bloqueio (só
 * "Entendi"), listando os indicadores; os demais (inclusive em construção) pedem confirmação
 * explícita, com o botão Excluir em variante de perigo.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { DadoExterno } from '../../types/dominio'

export interface DialogoExcluirDadoExternoProps {
  /** Dado externo a excluir; `null` mantém o diálogo fechado. */
  dado: DadoExterno | null
  /** Enquanto `true`, o botão Excluir fica desabilitado. */
  excluindo: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar, pressionar Esc ou clicar em "Entendi" (modo bloqueado). */
  onCancelar: () => void
}

function textoBloqueio(dado: DadoExterno): string | undefined {
  if (dado.indicadores.length === 0) return undefined
  const nomes = dado.indicadores.map((indicador) => indicador.nome).join(', ')
  return `Este dado externo compõe os indicadores: ${nomes} e não pode ser excluído.`
}

export function DialogoExcluirDadoExterno({ dado, excluindo, onConfirmar, onCancelar }: DialogoExcluirDadoExternoProps) {
  if (dado === null) return null

  return (
    <DialogoConfirmacao
      aberto
      titulo="Excluir dado externo"
      impacto={`O dado externo ${dado.nome} será excluído. Esta ação não pode ser desfeita.`}
      bloqueio={textoBloqueio(dado)}
      perigo
      textoConfirmar="Excluir"
      processando={excluindo}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
