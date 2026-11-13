import type { ItemResumoInicio } from '../../types/dominio'
import { formatarNumero } from '../../utils/formato'
import './ResumoInicio.css'

export interface ResumoInicioProps {
  /** Indicadores na ordem da API (a composição muda com o perfil). */
  itens: ItemResumoInicio[]
}

/** Indicadores-resumo do Início (F11.3 — RF-08): rótulo da API e valor em pt-BR sem casas decimais. */
export function ResumoInicio({ itens }: ResumoInicioProps) {
  if (itens.length === 0) return null

  return (
    <ul className="resumo-inicio" aria-label="Indicadores-resumo">
      {itens.map((item) => (
        <li key={item.chave} className="resumo-inicio__item">
          <span className="resumo-inicio__valor">{formatarNumero(item.valor, 0)}</span>
          <span className="resumo-inicio__rotulo">{item.rotulo}</span>
        </li>
      ))}
    </ul>
  )
}
