/**
 * Confirmação de ativar/desativar um dado externo (F5.8 — RF-30, RNF-07).
 *
 * Com `dado` nulo, nada é renderizado. Título, impacto e botão de confirmar acompanham a situação
 * atual do dado (dados em construção não chegam aqui: a tabela não oferece a ação).
 */
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao'
import type { DadoExterno } from '../../types/dominio'

export interface DialogoSituacaoDadoExternoProps {
  /** Dado externo a ativar/desativar; `null` mantém o diálogo fechado. */
  dado: DadoExterno | null
  /** Enquanto `true`, o botão de confirmar fica desabilitado. */
  alterando: boolean
  onConfirmar: () => void
  /** Chamado ao cancelar ou pressionar Esc. */
  onCancelar: () => void
}

export function DialogoSituacaoDadoExterno({ dado, alterando, onConfirmar, onCancelar }: DialogoSituacaoDadoExternoProps) {
  if (dado === null) return null

  const desativar = dado.situacao === 'ativo'

  return (
    <DialogoConfirmacao
      aberto
      titulo={desativar ? 'Desativar dado externo' : 'Ativar dado externo'}
      impacto={
        desativar
          ? 'Desativado, o dado deixa de ser coletado e de compor os indicadores dos próximos fechamentos. Imagens já congeladas são mantidas.'
          : 'Ativado, o dado volta a ser coletado.'
      }
      textoConfirmar={desativar ? 'Desativar' : 'Ativar'}
      processando={alterando}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  )
}
