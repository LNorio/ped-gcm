/**
 * Botão "Editar metas (N)" da área de ações do Preenchimento (F9.9 — RF-71).
 *
 * `quantidade` é o número de indicadores da janela de metas (`listarMetasPreenchimento`); com 0 ou
 * menos, nada é renderizado. O clique só avisa a página (`onAbrir`), que abre o `DialogoEditarMetas`.
 */
import { Botao } from '../../components/Botao'

export interface BotaoEditarMetasProps {
  /** Indicadores da janela de metas; `<= 0` esconde o botão. */
  quantidade: number
  onAbrir: () => void
  desabilitado?: boolean
}

export function BotaoEditarMetas({ quantidade, onAbrir, desabilitado = false }: BotaoEditarMetasProps) {
  if (quantidade <= 0) return null

  return (
    <Botao type="button" variante="contorno" disabled={desabilitado} onClick={onAbrir}>
      {`Editar metas (${quantidade})`}
    </Botao>
  )
}
