/**
 * F11.6 — Blocos "Indicadores com meta pendente" e "Dashboards em construção" da tela Início.
 *
 * Usam as rotas que já existem (nada novo no back-end), no formato da API (chaves com espaço):
 * - `GET /api/ped/indicadores-cadastro?situacao=meta` (ativos sem meta nenhuma — "Aguardando meta") e
 *   `GET /api/ped/indicadores-cadastro?situacao=meta_filial_pendente` (ativos com ao menos uma filial sem
 *   meta — F6.12). O Início junta as duas listas, sem repetir o indicador que aparece nas duas;
 * - `GET /api/ped/dashboards?situacao=construcao` (em construção ou em modificação pela TI).
 * Nenhuma das rotas usa a filial.
 *
 * Indicadores (`indicadoresMetaPendenteInicioApi`; a rota filtra como a API):
 * - Devoluções de venda — ativo, "meta a definir" (sem meta), tipo Comercial, sem filiais pendentes →
 *   só em `situacao=meta`;
 * - Ticket médio por filial — ativo, meta por filial, 101 e 102 sem meta, tipo Comercial → só em
 *   `situacao=meta_filial_pendente`;
 * - Absenteísmo por filial — ativo, meta por filial sem nenhuma meta ("meta a definir"), tipos Logística
 *   e Financeiro, 100, 101 e 102 sem meta → nas **duas** consultas (aparece uma vez só);
 * - os demais indicadores da lista padrão (com meta ou inativos) não entram em nenhuma.
 * Em ordem alfabética: Absenteísmo por filial, Devoluções de venda, Ticket médio por filial (3).
 *
 * Dashboards (`dashboardsConstrucaoInicioApi`; a rota filtra como a API), na ordem da API:
 * - PED Supervisores — em construção, semestral, tarefa #40 enviada;
 * - PED Logística — em modificação, bimestral, tarefa #41 enviada;
 * - PED Novos Negócios — em construção, mensal, tarefa registrada aguardando envio ao Bitrix;
 * - PED Expansão — em construção, anual, sem tarefa.
 * Os dashboards ativos e inativos da lista padrão não entram (4 em construção).
 */
import type { RotaFalsa } from './apiFalsa'
import { DASHBOARD_SUPERVISORES_API, type DashboardApiFalso, dashboardsApi, rotaListarDashboards } from './dashboardsFalsos'
import { rotasDoInicio, type PerfilInicioApiFalso } from './inicioFalsos'
import {
  INDICADOR_TICKET_MEDIO_API,
  type IndicadorApiFalso,
  comCampoMetaPorFilial,
  indicadoresComMetaPendenteApi,
  rotaListarIndicadoresComMetaPendente,
} from './indicadoresFalsos'

export const ROTA_INDICADORES_CADASTRO = '/api/ped/indicadores-cadastro'
export const ROTA_DASHBOARDS = '/api/ped/dashboards'

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/** Ativo, meta por filial ainda sem nenhuma meta: "meta a definir" e as 3 filiais pendentes. */
export const INDICADOR_ABSENTEISMO_API: IndicadorApiFalso = {
  ...INDICADOR_TICKET_MEDIO_API,
  id: 10,
  nome: 'Absenteísmo por filial',
  descricao: null,
  tipos: ['Logística', 'Financeiro'],
  'meta a definir': true,
  'metas por filial': [
    { filial: '100', 'nome filial': 'MATRIZ', meta: null },
    { filial: '101', 'nome filial': 'CAMPO GRANDE', meta: null },
    { filial: '102', 'nome filial': 'DOURADOS', meta: null },
  ],
  'filiais sem meta': ['100', '101', '102'],
}

/** Nomes esperados no bloco, em ordem alfabética (pt-BR). */
export const NOMES_INDICADORES_META_PENDENTE = ['Absenteísmo por filial', 'Devoluções de venda', 'Ticket médio por filial'] as const

/** Lista completa (padrão + Ticket médio + Margem bruta + Absenteísmo), com `"meta por filial"`. Cópias novas. */
export function indicadoresMetaPendenteInicioApi(): IndicadorApiFalso[] {
  return [...indicadoresComMetaPendenteApi(), comCampoMetaPorFilial(INDICADOR_ABSENTEISMO_API)]
}

/** Lista sem nenhum indicador pendente (só os com meta definida ou inativos). */
export function indicadoresSemPendenciaApi(): IndicadorApiFalso[] {
  return indicadoresMetaPendenteInicioApi().filter(
    (indicador) => !indicador.ativo || (!indicador['meta a definir'] && (indicador['filiais sem meta'] ?? []).length === 0),
  )
}

/** Rota `GET /api/ped/indicadores-cadastro` com os filtros `situacao=meta` e `situacao=meta_filial_pendente`. */
export function rotaIndicadoresMetaPendente(obterLista: () => IndicadorApiFalso[] = indicadoresMetaPendenteInicioApi): RotaFalsa {
  return rotaListarIndicadoresComMetaPendente(obterLista)
}

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

/** Em construção, mensal, tarefa registrada e ainda não enviada ao Bitrix24. */
export const DASHBOARD_NOVOS_NEGOCIOS_API: DashboardApiFalso = {
  ...DASHBOARD_SUPERVISORES_API,
  id: 7,
  nome: 'PED Novos Negócios',
  situacao: 'em_construcao',
  'situacao descricao': 'Em construção (TI)',
  'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: PED Novos Negócios' },
  periodicidade: 'mensal',
  'periodo atual': '11/2026',
}

/** Em construção, anual, sem tarefa. */
export const DASHBOARD_EXPANSAO_API: DashboardApiFalso = {
  ...DASHBOARD_SUPERVISORES_API,
  id: 8,
  nome: 'PED Expansão',
  situacao: 'em_construcao',
  'situacao descricao': 'Em construção (TI)',
  'tarefa bitrix': null,
  periodicidade: 'anual',
  'periodo atual': '2026',
}

/** Nomes esperados no bloco, na ordem da API. */
export const NOMES_DASHBOARDS_CONSTRUCAO = ['PED Supervisores', 'PED Logística', 'PED Novos Negócios', 'PED Expansão'] as const

/** Lista completa (padrão + Novos Negócios + Expansão). Cópias novas. */
export function dashboardsConstrucaoInicioApi(): DashboardApiFalso[] {
  return [
    ...dashboardsApi(),
    { ...DASHBOARD_NOVOS_NEGOCIOS_API, 'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: PED Novos Negócios' } },
    { ...DASHBOARD_EXPANSAO_API },
  ]
}

/** Lista sem dashboards em construção ou modificação. */
export function dashboardsSemConstrucaoApi(): DashboardApiFalso[] {
  return dashboardsApi().filter((dashboard) => dashboard.situacao === 'ativo' || dashboard.situacao === 'inativo')
}

/** Rota `GET /api/ped/dashboards` com o filtro `situacao=construcao`. */
export function rotaDashboardsConstrucao(obterLista: () => DashboardApiFalso[] = dashboardsConstrucaoInicioApi): RotaFalsa {
  return rotaListarDashboards(obterLista)
}

// ---------------------------------------------------------------------------
// Rotas do Início com os blocos
// ---------------------------------------------------------------------------

/**
 * Sessão + `GET /api/ped/inicio` (`rotasDoInicio`) + as listagens de indicadores e dashboards dos blocos;
 * `extras` substitui ou acrescenta rotas.
 */
export function rotasDoInicioComBlocos(
  perfil: PerfilInicioApiFalso,
  extras: Record<string, RotaFalsa> = {},
): Record<string, RotaFalsa> {
  return rotasDoInicio(perfil, {
    [`GET ${ROTA_INDICADORES_CADASTRO}`]: rotaIndicadoresMetaPendente(),
    [`GET ${ROTA_DASHBOARDS}`]: rotaDashboardsConstrucao(),
    ...extras,
  })
}

