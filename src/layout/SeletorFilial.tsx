import { Select, type OpcaoSelect } from '../components/Select'
import { TODAS_AS_FILIAIS } from '../sessao/filial'
import type { Filial } from '../types/dominio'
import './SeletorFilial.css'

/** Reexportado por compatibilidade; a fonte é `src/sessao/filial.ts`. */
export { TODAS_AS_FILIAIS }

export interface SeletorFilialProps {
  /** Filiais às quais o usuário tem acesso. */
  filiais: Filial[]
  /** Quando `true`, oferece também a opção "Todas as filiais" (Admin/Validador). */
  todasAsFiliais: boolean
  /** Valor selecionado: `'todas'` ou o código da filial. */
  valor: string
  /** Chamado com `'todas'` ou o código da filial escolhida. */
  onChange: (valor: string) => void
}

function rotuloFilial(filial: Filial) {
  return `${filial.codigo} - ${filial.nome}`
}

/**
 * Seletor de filial do cabeçalho (RF-01).
 *
 * - Acesso a todas as filiais: select com "Todas as filiais" seguida das filiais.
 * - Acesso a várias filiais: select restrito a elas.
 * - Acesso a uma única filial: texto fixo "código - nome", sem select.
 * - Nenhuma filial: não renderiza nada.
 */
export function SeletorFilial({ filiais, todasAsFiliais, valor, onChange }: SeletorFilialProps) {
  if (!todasAsFiliais && filiais.length === 0) return null

  if (!todasAsFiliais && filiais.length === 1) {
    return (
      <div className="seletor-filial seletor-filial--fixa">
        <span className="visualmente-oculto">Filial</span>
        <span className="seletor-filial__fixa" title="Seu usuário tem acesso somente a esta filial">
          {rotuloFilial(filiais[0])}
        </span>
      </div>
    )
  }

  const opcoes: OpcaoSelect[] = filiais.map((filial) => ({ valor: filial.codigo, rotulo: rotuloFilial(filial) }))
  if (todasAsFiliais) opcoes.unshift({ valor: TODAS_AS_FILIAIS, rotulo: 'Todas as filiais' })

  return (
    <div className="seletor-filial">
      <Select
        rotulo="Filial"
        rotuloOculto
        opcoes={opcoes}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="seletor-filial__select"
      />
    </div>
  )
}
