/**
 * Confirmação da exclusão de uma tabela de faixas (F8.6 — RF-46, RN-18, RNF-07).
 *
 * Só a tabela de um dashboard excluído pode ser excluída: nela, o diálogo descreve o impacto, com
 * "Cancelar" e "Excluir" (perigo). Tabela de dashboard existente vira um aviso de bloqueio com
 * apenas "Entendi". Com `tabela` nula, nada é renderizado.
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { TabelaFaixas } from '../../types/dominio'
import { nomeTabelaFaixas } from './regrasFaixas'

export interface DialogoExcluirTabelaFaixasProps {
  /** Tabela a excluir; `null` mantém o diálogo fechado. */
  tabela: TabelaFaixas | null
  /** Enquanto `true`, o botão "Excluir" fica desabilitado. */
  excluindo: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar, pressionar Esc ou escolher "Entendi". */
  onCancelar: () => void
}

const MENSAGEM_BLOQUEIO_EXCLUSAO_FAIXAS =
  'Esta tabela pertence a um dashboard existente e não pode ser excluída — use “Alterar faixas” para gerar uma nova versão.'

export function DialogoExcluirTabelaFaixas({ tabela, excluindo, onConfirmar, onCancelar }: DialogoExcluirTabelaFaixasProps) {
  if (tabela === null) return null

  return (
    <DialogoConfirmacao
      aberto
      titulo="Excluir tabela de faixas"
      impacto={`A tabela de faixas de “${nomeTabelaFaixas(tabela)}” e o seu histórico de versões serão excluídos. Imagens já congeladas mantêm as faixas vigentes no fechamento.`}
      bloqueio={tabela.dashboardExcluido ? undefined : MENSAGEM_BLOQUEIO_EXCLUSAO_FAIXAS}
      perigo
      textoConfirmar="Excluir"
      processando={excluindo}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
