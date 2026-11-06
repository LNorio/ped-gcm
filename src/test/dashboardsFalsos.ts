/**
 * Dashboards no formato devolvido por `GET /api/ped/dashboards` (chaves com espaço), para os testes
 * da F7 (RF-47 a RF-59). Ver `docs/backend/API (24).md`, seção "fase 6: dashboards".
 *
 * Lista padrão (cobre os casos da tela):
 * - PED Comercial (1) — ativo, por filiais 100, 101 e 102, trimestral, 2 indicadores (40 + 60 = 100
 *   de 100), tarefa #31 concluída, alterado depois do cadastro;
 * - PED Gerentes (2) — ativo, por cargo "Gerente de Loja", mensal, 2 indicadores (30 + 20 = 50 de 50),
 *   com um alerta (Custo de frete por entrega, 20 pontos afetados — filtro "Com problemas");
 * - PED Supervisores (3) — em construção (TI), por colaboradores 16 e 11, semestral, tarefa #40 (enviada)
 *   aguardando envio, nunca alterado;
 * - PED Logística (4) — em modificação (TI), por filial 102, bimestral, 1 indicador, tarefa #41 (enviada);
 * - PED Financeiro (5) — inativo, por cargos "Vendedor" e "Supervisor Comercial", anual, pontos com
 *   decimais (90,5 de 90,5), sem tarefa. Traz um alerta mesmo inativo (a tela só mostra alertas de
 *   dashboard ativo — RF-47).
 *
 * `RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API` é a resposta real de `GET /api/ped/dashboards` colada pelo
 * usuário em 05/11/2026 (bug da aba): a "tarefa bitrix" vem com `"id": null`.
 *
 * `RESPOSTA_REAL_LISTAGEM_DASHBOARDS_TAREFA_ENVIADA_API` é a resposta real de `GET /api/ped/dashboards`
 * colada pelo usuário em 06/11/2026: depois que a tarefa é enviada ao Bitrix24, o `id` da
 * "tarefa bitrix" vem em **texto** (`"328439"`) e o status é `"enviada"`.
 *
 * `RESPOSTA_REAL_DETALHE_DASHBOARD_API` é a resposta real de `GET /api/ped/dashboards/1` colada pelo
 * usuário em 05/11/2026 (bug da edição): `"itens vinculados"` traz **rótulos** de exibição
 * (`"100 - Filial 100"`) e `"vinculos"` traz os **códigos** (`[{ "filial": "100" }]`), que são o que o
 * POST/PUT espera.
 *
 * Formatos assumidos enquanto a API não documenta (ver dúvidas da F7 em `docs/plano-implementacao.md`):
 * - listagem: lista pura (o serviço também aceita `{ dashboards: [...] }`);
 * - detalhe: o dashboard na raiz (o serviço também aceita `{ dashboard: {...} }`); `indicadores` com
 *   `{ id, nome, "pontos base", ativo, problema }`; `indicador base da faixa` como id; `vinculos` com os
 *   códigos dos itens vinculados, uma chave por tipo: `{ filial }` (formato real), `{ cargo }` e
 *   `{ "id colaborador" }` (cargos e colaboradores não vistos na API real; seguem as listas de vínculo);
 * - POST/PUT de cadastro e edição: `{ dashboard, tarefa }` (tarefa `{ id, status, titulo, descricao }`,
 *   `id` nulo enquanto a tarefa não foi criada no Bitrix24 — A-12);
 * - PUT concluir e situação: `{ dashboard }` (ou na raiz);
 * - prévia: `{ titulo, descricao }` (ou dentro de `tarefa`);
 * - histórico e tarefas: lista pura (ou `{ historico }` / `{ tarefas }`);
 * - vínculos: lista pura por `tipo` (filiais, cargos ou colaboradores).
 */
import { normalizarBusca } from '../utils/formato'
import type { RotaFalsa } from './apiFalsa'
import { respostaJson } from './apiFalsa'
import { DADO_FATURAMENTO_API, type DadoExternoApiFalso, dadosExternosApi } from './dadosExternosFalsos'
import { INDICADOR_FATURAMENTO_API, type IndicadorApiFalso, indicadoresApi } from './indicadoresFalsos'

export interface TarefaBitrixDashboardApiFalsa {
  /**
   * `null` enquanto a tarefa só está registrada localmente (`aguardando_envio`), antes do Bitrix24.
   * Depois de enviada, a API real devolve o número em texto (ex.: `"328439"`, resposta de 06/11/2026).
   */
  id: number | string | null
  status: string
  titulo: string
}

export interface AlertaDashboardApiFalso {
  indicador: string
  motivo: string
  'pontos afetados': number
}

export interface DashboardApiFalso {
  id: number
  nome: string
  situacao: 'ativo' | 'inativo' | 'em_construcao' | 'em_modificacao'
  'situacao descricao': string
  'tarefa bitrix': TarefaBitrixDashboardApiFalsa | null
  'tipo de vinculo': 'filiais' | 'cargos' | 'colaboradores'
  /** Presente na resposta real (ex.: "Filiais"); a tela não usa. */
  'tipo de vinculo descricao'?: string
  'itens vinculados': Array<string | number>
  'unidades de imagem': number
  periodicidade: 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  'periodo atual': string
  'quantidade de indicadores': number
  pontos: { soma: number; maximo: number }
  alertas: AlertaDashboardApiFalso[]
  'cadastrado em': string | null
  'ultima alteracao': string | null
}

export interface IndicadorDoDetalheApiFalso {
  id: number
  nome: string
  'pontos base': number
  ativo: boolean
  problema: string | null
}

export interface DetalheDashboardApiFalso extends DashboardApiFalso {
  'pontuacao base maxima': number
  'indicador base da faixa': number
  'formula de pontuacao': string
  'observacao para ti': string | null
  vinculos: unknown[]
  indicadores: IndicadorDoDetalheApiFalso[]
  periodo: { codigo: string; inicio: string; fim: string }
}

export interface HistoricoDashboardApiFalso {
  acao: 'cadastro' | 'edicao' | 'desativado' | 'reativado' | 'concluida'
  'acao descricao': string
  data: string
  usuario: string
  alteracoes: string[]
  'tarefa bitrix': TarefaBitrixDashboardApiFalsa | number | null
  observacao: string | null
}

export interface TarefaDashboardApiFalsa {
  id: number | string | null
  tipo: 'construcao' | 'modificacao'
  status: string
  titulo: string
  descricao: string | null
  'criada em': string | null
}

export interface TarefaGravacaoApiFalsa {
  /** Formato anterior a 06/11/2026; o front continua aceitando `id` quando não há `"id bitrix"`. */
  id?: number | string | null
  /**
   * Número da tarefa no Bitrix24, no formato publicado em 06/11/2026 (`FRONT-tarefas-bitrix.md`):
   * texto numérico (`"328169"`) com `status` `enviada`; `null` com `status` `aguardando_envio`.
   */
  'id bitrix'?: number | string | null
  status: string | null
  titulo: string
  descricao: string | null
}

export interface FilialVinculoApiFalsa {
  filial: string
  'nome filial': string
}

export interface CargoVinculoApiFalso {
  cargo: string
  colaboradores: number
}

export interface ColaboradorVinculoApiFalso {
  'id colaborador': number
  nome: string
  cargo: string
  filial: string
}

// ---------------------------------------------------------------------------
// Dashboards da listagem
// ---------------------------------------------------------------------------

export const DASHBOARD_COMERCIAL_API: DashboardApiFalso = {
  id: 1,
  nome: 'PED Comercial',
  situacao: 'ativo',
  'situacao descricao': 'Ativo',
  'tarefa bitrix': { id: 31, status: 'concluida', titulo: '[PED] Construir dashboard: PED Comercial' },
  'tipo de vinculo': 'filiais',
  'itens vinculados': ['100', '101', '102'],
  'unidades de imagem': 3,
  periodicidade: 'trimestral',
  'periodo atual': '4º tri/2026',
  'quantidade de indicadores': 2,
  pontos: { soma: 100, maximo: 100 },
  alertas: [],
  'cadastrado em': '2026-09-01 10:00:00',
  'ultima alteracao': '2026-10-20 15:30:00',
}

export const DASHBOARD_GERENTES_API: DashboardApiFalso = {
  id: 2,
  nome: 'PED Gerentes',
  situacao: 'ativo',
  'situacao descricao': 'Ativo',
  'tarefa bitrix': { id: 25, status: 'concluida', titulo: '[PED] Modificar dashboard: PED Gerentes' },
  'tipo de vinculo': 'cargos',
  'itens vinculados': ['Gerente de Loja'],
  'unidades de imagem': 2,
  periodicidade: 'mensal',
  'periodo atual': '11/2026',
  'quantidade de indicadores': 2,
  pontos: { soma: 50, maximo: 50 },
  alertas: [{ indicador: 'Custo de frete por entrega', motivo: 'Todos os apontamentos estão desativados', 'pontos afetados': 20 }],
  'cadastrado em': '2026-08-01 10:00:00',
  'ultima alteracao': '2026-09-12 08:45:00',
}

export const DASHBOARD_SUPERVISORES_API: DashboardApiFalso = {
  id: 3,
  nome: 'PED Supervisores',
  situacao: 'em_construcao',
  'situacao descricao': 'Em construção (TI)',
  'tarefa bitrix': { id: 40, status: 'enviada', titulo: '[PED] Construir dashboard: PED Supervisores' },
  'tipo de vinculo': 'colaboradores',
  'itens vinculados': [16, 11],
  'unidades de imagem': 2,
  periodicidade: 'semestral',
  'periodo atual': '2º sem/2026',
  'quantidade de indicadores': 2,
  pontos: { soma: 120, maximo: 120 },
  alertas: [],
  'cadastrado em': '2026-11-04 17:10:00',
  'ultima alteracao': null,
}

export const DASHBOARD_LOGISTICA_API: DashboardApiFalso = {
  id: 4,
  nome: 'PED Logística',
  situacao: 'em_modificacao',
  'situacao descricao': 'Em modificação (TI)',
  'tarefa bitrix': { id: 41, status: 'enviada', titulo: '[PED] Modificar dashboard: PED Logística' },
  'tipo de vinculo': 'filiais',
  'itens vinculados': ['102'],
  'unidades de imagem': 1,
  periodicidade: 'bimestral',
  'periodo atual': '6º bim/2026',
  'quantidade de indicadores': 1,
  pontos: { soma: 80, maximo: 80 },
  alertas: [],
  'cadastrado em': '2026-07-15 09:00:00',
  'ultima alteracao': '2026-11-03 16:20:00',
}

export const DASHBOARD_FINANCEIRO_API: DashboardApiFalso = {
  id: 5,
  nome: 'PED Financeiro',
  situacao: 'inativo',
  'situacao descricao': 'Inativo',
  'tarefa bitrix': null,
  'tipo de vinculo': 'cargos',
  'itens vinculados': ['Vendedor', 'Supervisor Comercial'],
  'unidades de imagem': 4,
  periodicidade: 'anual',
  'periodo atual': '2026',
  'quantidade de indicadores': 2,
  pontos: { soma: 90.5, maximo: 90.5 },
  alertas: [{ indicador: 'Capacitação', motivo: 'Indicador inativo', 'pontos afetados': 40 }],
  'cadastrado em': '2026-06-10 11:00:00',
  'ultima alteracao': null,
}

/**
 * Resposta real de `GET /api/ped/dashboards` (05/11/2026): dashboard em construção com a tarefa
 * registrada localmente e ainda sem número no Bitrix24 (`"tarefa bitrix": { "id": null, ... }`).
 */
export const RESPOSTA_REAL_LISTAGEM_DASHBOARDS_API: DashboardApiFalso[] = [
  {
    id: 1,
    nome: 'teste',
    situacao: 'em_construcao',
    'situacao descricao': 'Em construcao (TI)',
    'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: teste' },
    'tipo de vinculo': 'filiais',
    'tipo de vinculo descricao': 'Filiais',
    'itens vinculados': ['100 - Filial 100'],
    'unidades de imagem': 1,
    periodicidade: 'mensal',
    'periodo atual': '11/2026',
    'quantidade de indicadores': 2,
    pontos: { soma: 100, maximo: 100 },
    alertas: [],
    'cadastrado em': '2026-11-05 16:28:43-04:00',
    'ultima alteracao': '2026-11-05 16:28:43-04:00',
  },
]

/**
 * Resposta real de `GET /api/ped/dashboards` (06/11/2026): a tarefa já foi enviada ao Bitrix24 e o
 * número vem em texto (`"tarefa bitrix": { "id": "328439", "status": "enviada", ... }`).
 */
export const RESPOSTA_REAL_LISTAGEM_DASHBOARDS_TAREFA_ENVIADA_API: DashboardApiFalso[] = [
  {
    id: 1,
    nome: 'teste',
    situacao: 'em_construcao',
    'situacao descricao': 'Em construcao (TI)',
    'tarefa bitrix': { id: '328439', status: 'enviada', titulo: '[PED] Construir dashboard: teste' },
    'tipo de vinculo': 'filiais',
    'tipo de vinculo descricao': 'Filiais',
    'itens vinculados': ['100 - Filial 100'],
    'unidades de imagem': 1,
    periodicidade: 'mensal',
    'periodo atual': '11/2026',
    'quantidade de indicadores': 3,
    pontos: { soma: 100, maximo: 100 },
    alertas: [],
    'cadastrado em': '2026-11-05 16:28:43-04:00',
    'ultima alteracao': '2026-11-05 16:52:42-04:00',
  },
]

export const NOMES_DASHBOARDS = ['PED Comercial', 'PED Gerentes', 'PED Supervisores', 'PED Logística', 'PED Financeiro'] as const

/** Nomes dos indicadores de cada dashboard (a busca da API alcança o indicador). */
export const INDICADORES_POR_DASHBOARD: Readonly<Record<number, readonly string[]>> = {
  1: ['Cobertura de visitas', 'Faturamento líquido mensal'],
  2: ['Faturamento líquido mensal', 'Custo de frete por entrega'],
  3: ['Cobertura de visitas', 'Vendas por zona'],
  4: ['Custo de frete por entrega'],
  5: ['Rotinas financeiras em dia', 'Capacitação'],
}

function copiar(dashboard: DashboardApiFalso): DashboardApiFalso {
  return {
    ...dashboard,
    'tarefa bitrix': dashboard['tarefa bitrix'] ? { ...dashboard['tarefa bitrix'] } : null,
    'itens vinculados': [...dashboard['itens vinculados']],
    pontos: { ...dashboard.pontos },
    alertas: dashboard.alertas.map((alerta) => ({ ...alerta })),
  }
}

/** Lista padrão (5 dashboards), na ordem acima. Devolve sempre cópias novas. */
export function dashboardsApi(): DashboardApiFalso[] {
  return [
    DASHBOARD_COMERCIAL_API,
    DASHBOARD_GERENTES_API,
    DASHBOARD_SUPERVISORES_API,
    DASHBOARD_LOGISTICA_API,
    DASHBOARD_FINANCEIRO_API,
  ].map(copiar)
}

function casaBusca(dashboard: DashboardApiFalso, termo: string): boolean {
  const termoNormalizado = normalizarBusca(termo)
  if (termoNormalizado === '') return true
  const campos = [
    dashboard.nome,
    ...dashboard['itens vinculados'].map((item) => String(item)),
    ...(INDICADORES_POR_DASHBOARD[dashboard.id] ?? []),
  ]
  return campos.some((campo) => normalizarBusca(campo).includes(termoNormalizado))
}

function casaSituacao(dashboard: DashboardApiFalso, situacao: string | null): boolean {
  switch (situacao) {
    case 'ativos':
      return dashboard.situacao === 'ativo'
    case 'inativos':
      return dashboard.situacao === 'inativo'
    case 'construcao':
      return dashboard.situacao === 'em_construcao' || dashboard.situacao === 'em_modificacao'
    case 'problemas':
      return dashboard.situacao === 'ativo' && dashboard.alertas.length > 0
    default:
      return true
  }
}

/**
 * Aplica à lista os filtros da query string como a API faz: `busca` (dashboard, item vinculado ou
 * indicador, sem acento/maiúsculas) e `situacao` (todas | ativos | inativos | construcao | problemas).
 */
export function filtrarDashboardsApi(lista: DashboardApiFalso[], url: URL): DashboardApiFalso[] {
  const busca = url.searchParams.get('busca') ?? ''
  const situacao = url.searchParams.get('situacao')
  return lista.filter((dashboard) => casaBusca(dashboard, busca) && casaSituacao(dashboard, situacao))
}

/**
 * Rota falsa de `GET /api/ped/dashboards` com filtragem pela query. `obterLista` é chamada a cada
 * requisição, para refletir alterações (cadastro, edição, situação, conclusão, exclusão).
 */
export function rotaListarDashboards(obterLista: () => DashboardApiFalso[]): RotaFalsa {
  return (_init, url) => respostaJson(filtrarDashboardsApi(obterLista(), url))
}

// ---------------------------------------------------------------------------
// Detalhe, histórico, tarefas, prévia e gravação
// ---------------------------------------------------------------------------

const EXTRAS_DETALHE: Readonly<
  Record<number, Pick<DetalheDashboardApiFalso, 'pontuacao base maxima' | 'indicador base da faixa' | 'formula de pontuacao' | 'observacao para ti' | 'indicadores' | 'periodo'>>
> = {
  1: {
    'pontuacao base maxima': 100,
    'indicador base da faixa': 3,
    'formula de pontuacao': 'Soma ponderada dos atingimentos, limitada a 120% por indicador.',
    'observacao para ti': null,
    indicadores: [
      { id: 1, nome: 'Cobertura de visitas', 'pontos base': 40, ativo: true, problema: null },
      { id: 3, nome: 'Faturamento líquido mensal', 'pontos base': 60, ativo: true, problema: null },
    ],
    periodo: { codigo: '4º tri/2026', inicio: '2026-10-01', fim: '2026-12-31' },
  },
  2: {
    'pontuacao base maxima': 50,
    'indicador base da faixa': 3,
    'formula de pontuacao': 'Atingimento médio ponderado pelos pontos base.',
    'observacao para ti': 'Usar a mesma régua do PED Comercial.',
    indicadores: [
      { id: 3, nome: 'Faturamento líquido mensal', 'pontos base': 30, ativo: true, problema: null },
      { id: 6, nome: 'Custo de frete por entrega', 'pontos base': 20, ativo: true, problema: 'Todos os apontamentos estão desativados' },
    ],
    periodo: { codigo: '11/2026', inicio: '2026-11-01', fim: '2026-11-30' },
  },
  3: {
    'pontuacao base maxima': 120,
    'indicador base da faixa': 1,
    'formula de pontuacao': 'Pontos base × atingimento, sem limite.',
    'observacao para ti': null,
    indicadores: [
      { id: 1, nome: 'Cobertura de visitas', 'pontos base': 70, ativo: true, problema: null },
      { id: 8, nome: 'Vendas por zona', 'pontos base': 50, ativo: true, problema: null },
    ],
    periodo: { codigo: '2º sem/2026', inicio: '2026-07-01', fim: '2026-12-31' },
  },
  4: {
    'pontuacao base maxima': 80,
    'indicador base da faixa': 6,
    'formula de pontuacao': 'Atingimento do custo de frete.',
    'observacao para ti': null,
    indicadores: [{ id: 6, nome: 'Custo de frete por entrega', 'pontos base': 80, ativo: true, problema: null }],
    periodo: { codigo: '6º bim/2026', inicio: '2026-11-01', fim: '2026-12-31' },
  },
  5: {
    'pontuacao base maxima': 90.5,
    'indicador base da faixa': 2,
    'formula de pontuacao': 'Soma simples.',
    'observacao para ti': null,
    indicadores: [
      { id: 2, nome: 'Rotinas financeiras em dia', 'pontos base': 50.5, ativo: true, problema: null },
      { id: 5, nome: 'Capacitação', 'pontos base': 40, ativo: false, problema: 'Indicador inativo' },
    ],
    periodo: { codigo: '2026', inicio: '2026-01-01', fim: '2026-12-31' },
  },
}

/**
 * `vinculos` do detalhe a partir dos itens vinculados da lista padrão (que já usa os códigos):
 * filiais `{ filial }`, cargos `{ cargo }` e colaboradores `{ "id colaborador" }`.
 */
export function vinculosApi(tipo: DashboardApiFalso['tipo de vinculo'], itens: Array<string | number>): unknown[] {
  if (tipo === 'filiais') return itens.map((item) => ({ filial: String(item) }))
  if (tipo === 'cargos') return itens.map((item) => ({ cargo: String(item) }))
  return itens.map((item) => ({ 'id colaborador': Number(item) }))
}

/** Detalhe (`GET /api/ped/dashboards/{id}`) de um dashboard da lista padrão, com os pesos dos indicadores. */
export function detalheDashboardApi(dashboard: DashboardApiFalso): DetalheDashboardApiFalso {
  const extras = EXTRAS_DETALHE[dashboard.id]
  return {
    ...copiar(dashboard),
    ...extras,
    vinculos: vinculosApi(dashboard['tipo de vinculo'], dashboard['itens vinculados']),
    indicadores: extras.indicadores.map((indicador) => ({ ...indicador })),
    periodo: { ...extras.periodo },
  }
}

/** Detalhe real com o indicador base como `{ id, nome }` e as chaves extras que a tela não usa. */
export interface DetalheDashboardRealApiFalso extends Omit<DetalheDashboardApiFalso, 'indicador base da faixa'> {
  'indicador base da faixa': { id: number; nome: string }
  'cadastrado por': string
  'situacao anterior': string | null
}

/**
 * Resposta real de `GET /api/ped/dashboards/1` (05/11/2026), colada pelo usuário no bug da edição:
 * `"itens vinculados"` traz o rótulo `"100 - Filial 100"` e `"vinculos"` traz o código `{ "filial": "100" }`.
 * Devolve sempre uma cópia nova.
 */
export function respostaRealDetalheDashboardApi(): DetalheDashboardRealApiFalso {
  return {
    id: 1,
    nome: 'teste',
    situacao: 'em_construcao',
    'situacao descricao': 'Em construcao (TI)',
    'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dashboard: teste' },
    'tipo de vinculo': 'filiais',
    'tipo de vinculo descricao': 'Filiais',
    'itens vinculados': ['100 - Filial 100'],
    'unidades de imagem': 1,
    periodicidade: 'mensal',
    'periodo atual': '11/2026',
    'quantidade de indicadores': 3,
    pontos: { soma: 100, maximo: 100 },
    alertas: [],
    'cadastrado em': '2026-11-05 16:28:43-04:00',
    'ultima alteracao': '2026-11-05 16:52:42-04:00',
    'pontuacao base maxima': 100,
    'indicador base da faixa': { id: 1, nome: 'teste indicador' },
    'formula de pontuacao': 'teste indicador',
    'observacao para ti': 'teste',
    'situacao anterior': null,
    periodo: { codigo: '11/2026', inicio: '2026-11-01', fim: '2026-11-30' },
    'cadastrado por': 'master',
    vinculos: [{ filial: '100' }],
    indicadores: [
      { id: 3, nome: 'teste 2', 'pontos base': 50, ativo: true, problema: null },
      { id: 1, nome: 'teste indicador', 'pontos base': 30, ativo: true, problema: null },
      { id: 4, nome: 'testes', 'pontos base': 20, ativo: true, problema: null },
    ],
  }
}

/** Histórico de modificações do PED Comercial (id 1), do mais recente ao mais antigo (ordem da API). */
export function historicoDashboardApi(): HistoricoDashboardApiFalso[] {
  return [
    {
      acao: 'edicao',
      'acao descricao': 'Edição',
      data: '2026-10-20 15:30:00',
      usuario: 'Ana Costa',
      alteracoes: ['Pontos de Cobertura de visitas: 50 → 40 pts', 'Indicador incluído: Faturamento líquido mensal (60 pts)'],
      'tarefa bitrix': null,
      observacao: null,
    },
    {
      acao: 'concluida',
      'acao descricao': 'Construção concluída',
      data: '2026-09-03 09:00:00',
      usuario: 'Maria Souza',
      alteracoes: [],
      'tarefa bitrix': { id: 31, status: 'concluida', titulo: '[PED] Construir dashboard: PED Comercial' },
      observacao: null,
    },
    {
      acao: 'cadastro',
      'acao descricao': 'Cadastro',
      data: '2026-09-01 10:00:00',
      usuario: 'Maria Souza',
      alteracoes: [],
      'tarefa bitrix': 31,
      observacao: 'Usar a régua de faixas do ano passado.',
    },
  ]
}

/** Tarefas (`GET .../{id}/tarefas`) do PED Gerentes (id 2), da mais antiga à mais recente. */
export function tarefasDashboardApi(): TarefaDashboardApiFalsa[] {
  return [
    {
      id: 21,
      tipo: 'construcao',
      status: 'concluida',
      titulo: '[PED] Construir dashboard: PED Gerentes',
      descricao: 'Construir o dashboard “PED Gerentes” no PED.',
      'criada em': '2026-08-01 10:00:00',
    },
    {
      id: 25,
      tipo: 'modificacao',
      status: 'concluida',
      titulo: '[PED] Modificar dashboard: PED Gerentes',
      descricao: 'Modificar o dashboard “PED Gerentes” no PED.',
      'criada em': '2026-09-10 14:00:00',
    },
  ]
}

/** Prévia (`POST .../previa-tarefa`) da tarefa de construção de um dashboard com o nome informado. */
export function previaTarefaApi(nome: string) {
  return {
    titulo: `[PED] Construir dashboard: ${nome}`,
    descricao: `Construir o dashboard “${nome}” no PED.\nPeriodicidade: Trimestral\nPontuação base máxima: 100 pts`,
  }
}

/** Tarefa devolvida no POST/PUT (sem número enquanto o Bitrix24 não está integrado — A-12). */
export function tarefaGravacaoApi(titulo: string, id: number | string | null = null): TarefaGravacaoApiFalsa {
  return { id, status: 'aguardando_envio', titulo, descricao: 'Descrição gerada pela API.' }
}

/**
 * Tarefa do POST/PUT no formato publicado em 06/11/2026: `{ titulo, descricao, status, "id bitrix" }`.
 * Com `idBitrix`, `status` é `enviada`; sem ele (`null`), `aguardando_envio` (na fila do back-end).
 */
export function tarefaBitrixGravacaoApi(titulo: string, idBitrix: number | string | null = null): TarefaGravacaoApiFalsa {
  return { titulo, descricao: 'Descrição gerada pela API.', status: idBitrix === null ? 'aguardando_envio' : 'enviada', 'id bitrix': idBitrix }
}

/** Resposta de `POST /api/ped/dashboards` e `PUT .../{id}`: o dashboard gravado e a tarefa (quando há). */
export function respostaGravacaoApi(dashboard: DashboardApiFalso, tarefa: TarefaGravacaoApiFalsa | null = null) {
  return { dashboard, tarefa }
}

/** Resposta de `PUT .../concluir` e `PUT .../situacao`: o dashboard atualizado. */
export function respostaDashboardApi(dashboard: DashboardApiFalso) {
  return { dashboard }
}

// ---------------------------------------------------------------------------
// Listas de vínculo (GET /api/ped/vinculos?tipo=&busca=) — INT-02
// ---------------------------------------------------------------------------

/** Filiais; a 103 não tem colaborador (RF-50: "Filial (sem colaborador vinculado)"). */
export const FILIAIS_VINCULO_API: FilialVinculoApiFalsa[] = [
  { filial: '100', 'nome filial': 'MATRIZ' },
  { filial: '101', 'nome filial': 'CAMPO GRANDE' },
  { filial: '102', 'nome filial': 'DOURADOS' },
  { filial: '103', 'nome filial': 'TRÊS LAGOAS' },
]

export const CARGOS_VINCULO_API: CargoVinculoApiFalso[] = [
  { cargo: 'Gerente de Loja', colaboradores: 2 },
  { cargo: 'Supervisor Comercial', colaboradores: 1 },
  { cargo: 'Vendedor', colaboradores: 3 },
]

/** Colaboradores ativos: 100 tem 2, 101 tem 2, 102 tem 2 e 103 nenhum. */
export const COLABORADORES_VINCULO_API: ColaboradorVinculoApiFalso[] = [
  { 'id colaborador': 11, nome: 'Ana Souza', cargo: 'Gerente de Loja', filial: '100' },
  { 'id colaborador': 12, nome: 'Bruno Lima', cargo: 'Vendedor', filial: '101' },
  { 'id colaborador': 13, nome: 'Carla Dias', cargo: 'Vendedor', filial: '101' },
  { 'id colaborador': 14, nome: 'Diego Rocha', cargo: 'Gerente de Loja', filial: '102' },
  { 'id colaborador': 15, nome: 'Elisa Prado', cargo: 'Vendedor', filial: '102' },
  { 'id colaborador': 16, nome: 'Fábio Nunes', cargo: 'Supervisor Comercial', filial: '100' },
]

/** As mesmas listas no formato do domínio (como o serviço as devolve), para os testes de componentes. */
export const FILIAIS_VINCULO = FILIAIS_VINCULO_API.map((filial) => ({ codigo: filial.filial, nome: filial['nome filial'] }))
export const CARGOS_VINCULO = CARGOS_VINCULO_API.map((cargo) => ({ cargo: cargo.cargo, colaboradores: cargo.colaboradores }))
export const COLABORADORES_VINCULO = COLABORADORES_VINCULO_API.map((colaborador) => ({
  id: colaborador['id colaborador'],
  nome: colaborador.nome,
  cargo: colaborador.cargo as string | null,
  filial: colaborador.filial as string | null,
}))

/**
 * Rota falsa de `GET /api/ped/vinculos`: devolve a lista do `tipo` da query (lista pura), filtrada
 * pela `busca` (sem acento/maiúsculas) por nome, cargo ou filial. Tipo desconhecido responde 400.
 */
export function rotaVinculos(): RotaFalsa {
  return (_init, url) => {
    const tipo = url.searchParams.get('tipo')
    const busca = normalizarBusca(url.searchParams.get('busca'))
    const casa = (...campos: string[]) => busca === '' || campos.some((campo) => normalizarBusca(campo).includes(busca))
    if (tipo === 'filiais') return respostaJson(FILIAIS_VINCULO_API.filter((f) => casa(f.filial, f['nome filial'])))
    if (tipo === 'cargos') return respostaJson(CARGOS_VINCULO_API.filter((c) => casa(c.cargo)))
    if (tipo === 'colaboradores') return respostaJson(COLABORADORES_VINCULO_API.filter((c) => casa(c.nome, c.cargo, c.filial)))
    return respostaJson({ mensagem: 'Tipo de vínculo inválido.' }, 400)
  }
}

// ---------------------------------------------------------------------------
// Indicadores e dados externos usados no formulário (RF-51 a RF-54)
// ---------------------------------------------------------------------------

/** Dado externo por Zona de venda (RF-53: não entra em dashboard por filiais). */
export const DADO_VENDAS_ZONA_API: DadoExternoApiFalso = {
  ...DADO_FATURAMENTO_API,
  id: 20,
  nome: 'Vendas por zona (dado externo)',
  identificador: 'VENDAS_ZONA',
  referencia: 'zona',
  indicadores: [],
}

/** Indicador ativo, com meta, composto pelo dado externo por Zona de venda. */
export const INDICADOR_VENDAS_ZONA_API: IndicadorApiFalso = {
  ...INDICADOR_FATURAMENTO_API,
  id: 8,
  nome: 'Vendas por zona',
  descricao: null,
  composicao: { tipo: 'dado_externo', itens: [{ id: 20, nome: 'Vendas por zona (dado externo)', ativo: true }] },
  meta: 500000,
  dashboards: [],
  'vinculado a dashboard': false,
}

/**
 * Indicadores oferecidos no formulário: os 7 de `indicadoresApi()` + "Vendas por zona" (8).
 * Disponíveis: Cobertura de visitas (1), Faturamento líquido mensal (3) e Vendas por zona (8, só
 * fora do vínculo por filiais). Indisponíveis: Rotinas financeiras em dia (2), Custo de frete por
 * entrega (6) e Cobertura da carteira (7) — componente desativado; Devoluções de venda (4) — meta a
 * definir; Capacitação (5) — inativo.
 */
export function indicadoresParaDashboardApi(): IndicadorApiFalso[] {
  return [
    ...indicadoresApi(),
    {
      ...INDICADOR_VENDAS_ZONA_API,
      composicao: { tipo: 'dado_externo', itens: INDICADOR_VENDAS_ZONA_API.composicao.itens.map((item) => ({ ...item })) },
      tipos: [...INDICADOR_VENDAS_ZONA_API.tipos],
      dashboards: [],
    },
  ]
}

/** Dados externos usados para saber a referência de cada indicador por dado externo (RF-53). */
export function dadosExternosParaDashboardApi(): DadoExternoApiFalso[] {
  return [...dadosExternosApi(), { ...DADO_VENDAS_ZONA_API, indicadores: [] }]
}
