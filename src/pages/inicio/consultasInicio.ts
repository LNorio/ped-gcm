/**
 * Consultas da tela Início e a **pré-consulta** da primeira abertura (desempenho).
 *
 * - `consultarInicio`, `consultarIndicadoresComMetaPendente` e `consultarDashboardsEmConstrucao` são as
 *   consultas usadas por `useInicio` e `usePendenciasInicio` (F11.1 e F11.6).
 * - `preConsultarInicio` é chamada quando a sessão obtém o acesso com o Início como rota aberta (ver
 *   `rotas.tsx`). Dispara as mesmas consultas **antes** de a página montar, em paralelo com a
 *   renderização do layout. Se as respostas já chegaram quando os hooks montam, a primeira renderização
 *   já sai com os dados; se ainda não chegaram, os hooks aguardam essas mesmas promessas (sem repetir o
 *   GET).
 * - Cada pré-consulta é usada uma única vez (pela montagem seguinte, do mesmo acesso e da mesma filial).
 *   Trocar de filial, "Tentar novamente" ou voltar ao Início depois consultam normalmente.
 * - O Preenchedor não dispara as consultas de pendências (como no hook).
 */
import { listarDashboards } from '../../services/dashboardsService'
import { listarIndicadores } from '../../services/indicadoresService'
import { obterInicio } from '../../services/inicioService'
import type { AcessoObtido } from '../../sessao/acessoObtido'
import { TODAS_AS_FILIAIS } from '../../sessao/filial'
import type { FilialSelecionada } from '../../sessao/SessaoProvider'
import type { Acesso, Dashboard, Indicador, Inicio, Perfil } from '../../types/dominio'

/** Código da filial da consulta: uma filial → o código; "todas" ou nenhuma → sem filial (`null`). */
export function codigoDaFilial(filial: FilialSelecionada | undefined): string | null {
  return filial === null || filial === undefined || filial === TODAS_AS_FILIAIS ? null : filial.codigo
}

/** Só Admin e Validador veem os blocos de pendências do cadastro (F11.6). */
export function vePendencias(perfil: Perfil | null | undefined): boolean {
  return perfil === 'admin' || perfil === 'validador'
}

/** Une as listas sem repetir `id` e ordena pelo nome (pt-BR). */
function unirIndicadores(listas: Indicador[][]): Indicador[] {
  const porId = new Map<number, Indicador>()
  for (const lista of listas) {
    for (const indicador of lista) {
      if (!porId.has(indicador.id)) porId.set(indicador.id, indicador)
    }
  }
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function consultarInicio(codigoFilial: string | null): Promise<Inicio> {
  return obterInicio(codigoFilial)
}

/** União de `situacao=meta` e `situacao=meta_filial_pendente`, sem repetir, em ordem alfabética. */
export async function consultarIndicadoresComMetaPendente(): Promise<Indicador[]> {
  const respostas = await Promise.all([
    listarIndicadores({ situacao: 'meta' }),
    listarIndicadores({ situacao: 'meta_filial_pendente' }),
  ])
  return unirIndicadores(respostas.map((resposta) => resposta.indicadores))
}

/** Dashboards com `situacao=construcao`, na ordem da API. */
export function consultarDashboardsEmConstrucao(): Promise<Dashboard[]> {
  return listarDashboards({ situacao: 'construcao' })
}

/** Consulta em andamento; `resultado` fica preenchido (de forma síncrona) quando ela termina. */
export interface ConsultaAntecipada<T> {
  promessa: Promise<T>
  resultado: { ok: true; valor: T } | { ok: false; erro: unknown } | null
}

function antecipar<T>(consultar: () => Promise<T>): ConsultaAntecipada<T> {
  const consulta: ConsultaAntecipada<T> = { promessa: consultar(), resultado: null }
  consulta.promessa.then(
    (valor) => {
      consulta.resultado = { ok: true, valor }
    },
    (erro: unknown) => {
      consulta.resultado = { ok: false, erro }
    },
  )
  return consulta
}

export interface PreConsultaInicio {
  codigoFilial: string | null
  consulta: ConsultaAntecipada<Inicio>
}

export interface PreConsultaPendencias {
  indicadores: ConsultaAntecipada<Indicador[]>
  dashboards: ConsultaAntecipada<Dashboard[]>
}

let preInicio: (PreConsultaInicio & { acesso: Acesso }) | null = null
let prePendencias: (PreConsultaPendencias & { acesso: Acesso }) | null = null

/** Antecipa as consultas do Início para o acesso recém-obtido (substitui uma pré-consulta anterior). */
export function preConsultarInicio({ acesso, filialSelecionada }: AcessoObtido): void {
  const codigoFilial = codigoDaFilial(filialSelecionada)
  preInicio = { acesso, codigoFilial, consulta: antecipar(() => consultarInicio(codigoFilial)) }
  prePendencias = vePendencias(acesso.perfil)
    ? {
        acesso,
        indicadores: antecipar(consultarIndicadoresComMetaPendente),
        dashboards: antecipar(consultarDashboardsEmConstrucao),
      }
    : null
}

/** Pré-consulta do Início para este acesso e esta filial, se houver (não a consome; ver `liberar...`). */
export function verPreConsultaInicio(acesso: Acesso | null, codigoFilial: string | null): PreConsultaInicio | null {
  if (preInicio === null || acesso === null || preInicio.acesso !== acesso || preInicio.codigoFilial !== codigoFilial) return null
  return preInicio
}

/** Marca a pré-consulta do Início como usada: as próximas montagens consultam normalmente. */
export function liberarPreConsultaInicio(pre: PreConsultaInicio): void {
  if (preInicio === pre) preInicio = null
}

/** Pré-consulta das pendências para este acesso, se houver (não a consome; ver `liberar...`). */
export function verPreConsultaPendencias(acesso: Acesso | null): PreConsultaPendencias | null {
  if (prePendencias === null || acesso === null || prePendencias.acesso !== acesso) return null
  return prePendencias
}

/** Marca a pré-consulta das pendências como usada. */
export function liberarPreConsultaPendencias(pre: PreConsultaPendencias): void {
  if (prePendencias === pre) prePendencias = null
}
