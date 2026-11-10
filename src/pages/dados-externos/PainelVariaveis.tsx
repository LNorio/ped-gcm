/**
 * Variáveis da integração (da API, F5.15) e operadores, exibidos abaixo do JSON de entrada no
 * `DialogoConcluirConstrucao` (F5.7). Clicar num botão chama `onInserir` com o texto (`%nome%` ou o
 * operador), que a modal insere na última posição/seleção escolhida pelo usuário na entrada (ou no fim
 * do texto, enquanto ele não tiver posicionado o cursor). Variáveis presentes na entrada ficam destacadas
 * (`aria-pressed`). Os estilos ficam em `DialogoConcluirConstrucao.css`.
 */
import { useId } from 'react'
import type { VariavelIntegracao } from '../../types/dominio'

const OPERADORES = ['+', '-', '*', '/', '^', '(', ')'] as const

export interface PainelVariaveisProps {
  variaveis: VariavelIntegracao[]
  carregando: boolean
  erro: string | null
  /** Nomes (sem `%`) das variáveis presentes na entrada, destacadas com `aria-pressed`. */
  usadas: ReadonlySet<string>
  onInserir: (texto: string) => void
}

export function PainelVariaveis({ variaveis, carregando, erro, usadas, onInserir }: PainelVariaveisProps) {
  const idVariaveis = useId()
  const idOperadores = useId()
  return (
    <div className="dialogo-concluir__ajuda">
      <div role="group" aria-labelledby={idVariaveis} className="dialogo-concluir__grupo">
        <span id={idVariaveis} className="dialogo-concluir__grupo-rotulo">
          Variáveis disponíveis
        </span>
        {carregando ? <p className="dialogo-concluir__grupo-texto">Carregando variáveis...</p> : null}
        {erro !== null ? <p className="dialogo-concluir__grupo-erro">{erro}</p> : null}
        {variaveis.length > 0 ? (
          <div className="dialogo-concluir__variaveis">
            {variaveis.map((variavel) => (
              <button
                key={variavel.nome}
                type="button"
                className="dialogo-concluir__variavel foco-interno"
                aria-pressed={usadas.has(variavel.nome)}
                onClick={() => onInserir(`%${variavel.nome}%`)}
              >
                <code className="dialogo-concluir__variavel-nome">{`%${variavel.nome}%`}</code>
                <span className="dialogo-concluir__variavel-descricao">{` ${variavel.descricao}`}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div role="group" aria-labelledby={idOperadores} className="dialogo-concluir__grupo">
        <span id={idOperadores} className="dialogo-concluir__grupo-rotulo">
          Operadores
        </span>
        <div className="dialogo-concluir__operadores">
          {OPERADORES.map((operador) => (
            <button
              key={operador}
              type="button"
              className="dialogo-concluir__operador foco-interno"
              onClick={() => onInserir(operador)}
            >
              {operador}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
