/**
 * Aviso do componente desativado de um indicador (F6.9 — RF-40).
 *
 * Sem `problema`, nada é renderizado. Com ele, mostra o impacto conforme `problema.tipo` (texto
 * montado a partir dos itens inativos da composição) e a orientação de reativar o componente ou
 * inativar o indicador. Tipo desconhecido usa a mensagem enviada pela API.
 */
import { Aviso } from '../../components/Aviso'
import type { ComponenteIndicador, Indicador } from '../../types/dominio'

export interface AvisoComponenteDesativadoProps {
  indicador: Indicador
}

const ORIENTACAO = 'Reative o componente ou inative o indicador.'

/** Junta nomes em pt-BR: "A", "A e B", "A, B e C". */
function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

function textoDoProblema(indicador: Indicador): string | null {
  const problema = indicador.problema
  if (!problema) return null
  const desativados: ComponenteIndicador[] = indicador.composicao.itens.filter((item) => !item.ativo)

  switch (problema.tipo) {
    case 'dado_externo_desativado': {
      const nome = indicador.composicao.itens[0]?.nome
      return nome
        ? `O dado externo ${nome} está desativado: o indicador fica sem resultado.`
        : 'O dado externo está desativado: o indicador fica sem resultado.'
    }
    case 'todos_apontamentos_desativados':
      return 'Todos os apontamentos estão desativados: o indicador fica sem resultado.'
    case 'apontamentos_parcialmente_desativados': {
      if (desativados.length === 0) return problema.mensagem
      if (desativados.length === 1) {
        return `O apontamento ${desativados[0].nome} está desativado: o cálculo segue sem ele e pode distorcer o resultado.`
      }
      return `Os apontamentos ${juntarNomes(desativados.map((item) => item.nome))} estão desativados: o cálculo segue sem eles e pode distorcer o resultado.`
    }
    default:
      return problema.mensagem
  }
}

export function AvisoComponenteDesativado({ indicador }: AvisoComponenteDesativadoProps) {
  const texto = textoDoProblema(indicador)
  if (texto === null) return null

  return (
    <Aviso tipo="alerta" titulo="Componente desativado">
      <p>{texto}</p>
      <p>{ORIENTACAO}</p>
    </Aviso>
  )
}
