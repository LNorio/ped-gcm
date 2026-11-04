/**
 * Sugestões de identificadores de consulta já existentes (F5.5, F5.7 — RF-26, RF-28).
 *
 * Usado no formulário de cadastro (variante Admin) e no diálogo de concluir construção. Mostra cada
 * identificador em maiúsculas com quantos dados externos o usam, filtrado pelo texto já digitado
 * (sem diferenciar maiúsculas). Sem identificadores (ou sem correspondência), nada é renderizado.
 */
import { useId } from 'react'
import { Botao } from '../../components/Botao'
import type { IdentificadorColeta } from '../../types/dominio'
import './SugestoesIdentificador.css'

export interface SugestoesIdentificadorProps {
  identificadores: IdentificadorColeta[]
  /** Texto digitado no campo; filtra as sugestões. */
  filtro: string
  /** Chamado com o identificador escolhido, já em maiúsculas. */
  onEscolher: (identificador: string) => void
}

export function SugestoesIdentificador({ identificadores, filtro, onEscolher }: SugestoesIdentificadorProps) {
  const idRotulo = useId()
  const termo = filtro.trim().toUpperCase()
  const visiveis = identificadores
    .map((item) => ({ ...item, identificador: item.identificador.toUpperCase() }))
    .filter((item) => termo === '' || item.identificador.includes(termo))

  if (visiveis.length === 0) return null

  return (
    <div className="sugestoes-identificador" role="group" aria-labelledby={idRotulo}>
      <span id={idRotulo} className="sugestoes-identificador__rotulo">
        Identificadores existentes
      </span>
      <div className="sugestoes-identificador__lista">
        {visiveis.map((item, indice) => (
          <Botao
            // Índice na chave: identificadores que só diferem em maiúsculas ficam iguais após a conversão.
            key={`${item.identificador}-${indice}`}
            variante="contorno"
            tamanho="pequeno"
            onClick={() => onEscolher(item.identificador)}
          >
            {`${item.identificador} — usado por ${item.quantidade} dado(s)`}
          </Botao>
        ))}
      </div>
    </div>
  )
}
