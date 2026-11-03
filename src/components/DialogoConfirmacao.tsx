import type { ReactNode } from 'react'
import { Botao } from './Botao'
import { Dialogo } from './Dialogo'

export interface DialogoConfirmacaoProps {
  aberto: boolean
  titulo: string
  /** Descrição do impacto da ação (o que muda, o que é mantido). Exibida quando não há `bloqueio`. */
  impacto?: ReactNode
  onConfirmar: () => void
  /** Chamado ao cancelar, fechar, pressionar Esc ou clicar em "Entendi" (modo bloqueado). */
  onCancelar: () => void
  /** Texto do botão de confirmar (padrão "Confirmar"). */
  textoConfirmar?: string
  /** Texto do botão de cancelar (padrão "Cancelar"). */
  textoCancelar?: string
  /** Ação destrutiva: o botão de confirmar usa a variante de perigo. */
  perigo?: boolean
  /** Enquanto `true`, o botão de confirmar fica desabilitado. */
  processando?: boolean
  /**
   * Motivo pelo qual a ação não pode ser realizada. Quando informado, o diálogo explica o bloqueio e
   * oferece apenas o botão "Entendi" (que chama `onCancelar`), sem Confirmar/Cancelar.
   */
  bloqueio?: ReactNode
}

function renderizarTexto(conteudo: ReactNode) {
  return typeof conteudo === 'string' ? <p>{conteudo}</p> : conteudo
}

/**
 * Diálogo de confirmação de ação com impacto (RNF-07). Em modo bloqueado (`bloqueio`), vira um aviso
 * informativo com um único botão "Entendi".
 */
export function DialogoConfirmacao({
  aberto,
  titulo,
  impacto,
  onConfirmar,
  onCancelar,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  perigo = false,
  processando = false,
  bloqueio,
}: DialogoConfirmacaoProps) {
  const bloqueado = bloqueio !== undefined && bloqueio !== null && bloqueio !== false

  const acoes = bloqueado ? (
    <Botao variante="primario" onClick={onCancelar}>
      Entendi
    </Botao>
  ) : (
    <>
      <Botao variante="contorno" onClick={onCancelar}>
        {textoCancelar}
      </Botao>
      <Botao variante={perigo ? 'perigo-cheio' : 'primario'} onClick={onConfirmar} disabled={processando}>
        {textoConfirmar}
      </Botao>
    </>
  )

  return (
    <Dialogo
      aberto={aberto}
      titulo={titulo}
      onFechar={onCancelar}
      acoes={acoes}
      className={bloqueado ? 'dialogo-confirmacao dialogo-confirmacao--bloqueado' : 'dialogo-confirmacao'}
    >
      <div className="dialogo-confirmacao__texto">{renderizarTexto(bloqueado ? bloqueio : impacto)}</div>
    </Dialogo>
  )
}
