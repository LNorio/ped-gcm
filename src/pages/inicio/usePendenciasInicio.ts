/**
 * Hook dos blocos "Indicadores com meta pendente" e "Dashboards em construção" do Início (F11.6).
 *
 * Decisões:
 * - Só Admin e Validador veem os blocos (`useSessao().acesso.perfil`); para os demais (ou sem acesso),
 *   nenhuma consulta sai e as pendências ficam vazias, sem carregar.
 * - Indicadores: união de `situacao=meta` e `situacao=meta_filial_pendente` (os filtros de meta pendente da
 *   aba Indicadores), sem repetir `id`, em ordem alfabética do nome (pt-BR). Falha de qualquer das duas →
 *   `itens: null` e a mensagem em pt-BR.
 * - Dashboards: `situacao=construcao`, na ordem da API.
 * - As rotas não usam filial: as consultas saem ao montar (ou quando o perfil passa a ser visível) e não
 *   dependem da filial do cabeçalho.
 * - Na primeira abertura depois de obter o acesso, as consultas já foram antecipadas
 *   (`consultasInicio.preConsultarInicio`): o que já respondeu entra no estado inicial; o que não respondeu
 *   é aguardado (sem repetir a consulta).
 * - `carregando` é derivado (ainda sem resultado), para o efeito não chamar `setState` de forma síncrona.
 */
import { useEffect, useRef, useState } from 'react'
import { mensagemDeErro } from '../../services/api'
import { useSessao } from '../../sessao/SessaoProvider'
import type { Dashboard, Indicador } from '../../types/dominio'
import {
  consultarDashboardsEmConstrucao,
  consultarIndicadoresComMetaPendente,
  liberarPreConsultaPendencias,
  verPreConsultaPendencias,
  vePendencias,
  type ConsultaAntecipada,
} from './consultasInicio'

export interface PendenciaInicio<T> {
  itens: T[] | null
  carregando: boolean
  erro: string | null
}

export interface UsePendenciasInicioResultado {
  /** `true` só para Admin e Validador. */
  visivel: boolean
  indicadores: PendenciaInicio<Indicador>
  dashboards: PendenciaInicio<Dashboard>
}

/** Resultado aplicado de uma consulta; `null` enquanto ela não respondeu. */
interface Resultado<T> {
  itens: T[] | null
  erro: string | null
}

const SEM_PENDENCIA = { itens: null, carregando: false, erro: null } as const

function paraPendencia<T>(visivel: boolean, resultado: Resultado<T> | null): PendenciaInicio<T> {
  if (!visivel) return SEM_PENDENCIA
  if (resultado === null) return { itens: null, carregando: true, erro: null }
  return { itens: resultado.itens, carregando: false, erro: resultado.erro }
}

/** Resultado já disponível de uma consulta antecipada; `null` se ela não existe ou ainda não respondeu. */
function resultadoAntecipado<T>(consulta: ConsultaAntecipada<T[]> | undefined): Resultado<T> | null {
  const resultado = consulta?.resultado
  if (!resultado) return null
  return resultado.ok ? { itens: resultado.valor, erro: null } : { itens: null, erro: mensagemDeErro(resultado.erro) }
}

export function usePendenciasInicio(): UsePendenciasInicioResultado {
  const { acesso } = useSessao()
  const visivel = vePendencias(acesso?.perfil)

  // Pré-consulta da primeira abertura (lida uma vez, na montagem).
  const [preConsulta] = useState(() => (visivel ? verPreConsultaPendencias(acesso) : null))
  const [indicadores, setIndicadores] = useState(() => resultadoAntecipado(preConsulta?.indicadores))
  const [dashboards, setDashboards] = useState(() => resultadoAntecipado(preConsulta?.dashboards))
  // A pré-consulta vale até o efeito rodar sem os blocos visíveis (a re-execução do <StrictMode>, que
  // preserva estado e refs, reaproveita as mesmas consultas, sem repeti-las).
  const preConsultaValidaRef = useRef(preConsulta !== null)

  useEffect(() => {
    if (!visivel) {
      preConsultaValidaRef.current = false
      return undefined
    }
    let ativo = true

    if (preConsulta) liberarPreConsultaPendencias(preConsulta)
    const pre = preConsultaValidaRef.current ? preConsulta : null

    // O que a pré-consulta já respondeu entrou no estado inicial; o resto é aguardado ou consultado.
    if (!pre?.indicadores.resultado) {
      const consulta = pre ? pre.indicadores.promessa : consultarIndicadoresComMetaPendente()
      consulta.then(
        (itens) => {
          if (ativo) setIndicadores({ itens, erro: null })
        },
        (erro: unknown) => {
          if (ativo) setIndicadores({ itens: null, erro: mensagemDeErro(erro) })
        },
      )
    }

    if (!pre?.dashboards.resultado) {
      const consulta = pre ? pre.dashboards.promessa : consultarDashboardsEmConstrucao()
      consulta.then(
        (lista) => {
          if (ativo) setDashboards({ itens: lista, erro: null })
        },
        (erro: unknown) => {
          if (ativo) setDashboards({ itens: null, erro: mensagemDeErro(erro) })
        },
      )
    }

    return () => {
      ativo = false
    }
  }, [visivel, preConsulta])

  return {
    visivel,
    indicadores: paraPendencia(visivel, indicadores),
    dashboards: paraPendencia(visivel, dashboards),
  }
}
