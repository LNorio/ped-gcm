/**
 * Aviso da quantidade de imagens em PDF (F10.10 — ZIP sem limite de imagens): informa quantas imagens
 * serão geradas e que, dependendo da quantidade, a exibição dos PDFs e a montagem do ZIP podem demorar.
 * Com 0 imagens não mostra nada.
 */
import { Aviso } from '../../components/Aviso'
import { textoQuantidadeImagens } from './previaFechamento'

// oxlint-disable-next-line react/only-export-components
export { textoQuantidadeImagens }

export const TEXTO_DEMORA_IMAGENS =
  'Dependendo da quantidade de imagens, a exibição dos PDFs em tela e a montagem do ZIP com todas elas podem levar algum tempo.'

export function AvisoQuantidadeImagens({ quantidade }: { quantidade: number }) {
  if (quantidade <= 0) return null
  return (
    <Aviso tipo="info" className="aviso-quantidade-imagens">
      <p>{textoQuantidadeImagens(quantidade)}</p>
      <p>{TEXTO_DEMORA_IMAGENS}</p>
    </Aviso>
  )
}
