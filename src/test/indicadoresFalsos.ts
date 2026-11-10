/**
 * Indicadores no formato devolvido por `GET /api/ped/indicadores-cadastro` (chaves com espaço),
 * para os testes da F6.
 *
 * A lista padrão cobre os casos da tela (RF-32 a RF-40):
 * - Cobertura de visitas — ativo, dois apontamentos ativos, cálculo média, vinculado ao dashboard
 *   "PED Comercial" com 40 pontos base (não pode ser excluído — RN-11);
 * - Rotinas financeiras em dia — ativo, dois apontamentos (um desativado: problema
 *   `apontamentos_parcialmente_desativados`), soma, meta editável, sem dashboard (pode ser excluído);
 * - Faturamento líquido mensal — ativo, composto por dado externo ativo (dourado), meta editável,
 *   vinculado a dois dashboards (60 e 30 pontos base);
 * - Devoluções de venda — criado automaticamente (RF-28), dado externo, sem meta nem sentido
 *   ("meta a definir"), oferece "Definir meta";
 * - Capacitação — inativo, um apontamento ativo, situação já alterada (quem e quando), pode ser
 *   reativado e excluído;
 * - Custo de frete por entrega — ativo, "Menor é melhor (custo)", todos os apontamentos desativados
 *   (`todos_apontamentos_desativados`), vinculado ao "PED Gerentes" com 20 pontos base;
 * - Cobertura da carteira — ativo, dado externo desativado (`dado_externo_desativado`), sem dashboard.
 *
 * `alertas` da listagem contam só indicadores **ativos**: na lista padrão, 1 aguardando meta
 * (Devoluções de venda) e 3 com componente desativado (Rotinas, Custo de frete, Cobertura da carteira).
 *
 * `rotaListarIndicadores` reproduz a filtragem da API (`busca` por indicador, apontamento ou dado
 * externo; `situacao` = todas | ativos | inativos | meta | problemas) a partir da query string. Os
 * alertas são sempre calculados sobre a lista completa (sinal do menu independe do filtro).
 *
 * Formatos assumidos (ver dúvidas da F6 em `docs/plano-implementacao.md`):
 * - listagem: `{ indicadores: [...], alertas: { "aguardando meta", "com componente desativado" } }`;
 * - POST: `{ indicador: {...} }` (o serviço também aceita o indicador na raiz);
 * - PUT meta: `{ indicador: {...} }` (ou na raiz);
 * - PUT situação: `{ indicador: {...}, "dashboards afetados": [{ id, nome, "pontos base" }] }` (ou na raiz);
 * - metas-historico: lista pura (o serviço também aceita `{ historico: [...] }`).
 */
import { normalizarBusca } from '../utils/formato'
import type { RotaFalsa } from './apiFalsa'
import { respostaJson } from './apiFalsa'

export interface ComponenteIndicadorApiFalso {
  id: number
  nome: string
  ativo: boolean
}

export interface ComposicaoIndicadorApiFalsa {
  tipo: 'apontamentos' | 'dado_externo'
  itens: ComponenteIndicadorApiFalso[]
}

export interface ProblemaIndicadorApiFalso {
  tipo: 'dado_externo_desativado' | 'todos_apontamentos_desativados' | 'apontamentos_parcialmente_desativados' | string
  mensagem: string
}

export interface DashboardDoIndicadorApiFalso {
  id: number
  nome: string
  'pontos base': number
}

export interface IndicadorApiFalso {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
  composicao: ComposicaoIndicadorApiFalsa
  tipos: string[]
  sentido: 'maior_melhor' | 'menor_melhor' | null
  'sentido descricao': string | null
  calculo: 'soma' | 'media' | null
  meta: number | null
  'meta a definir': boolean
  'origem da meta': 'manual' | 'terceiro' | null
  'meta editavel no preenchimento': boolean
  'criado automaticamente': boolean
  'componentes desativados': boolean
  problema: ProblemaIndicadorApiFalso | null
  dashboards: DashboardDoIndicadorApiFalso[]
  'vinculado a dashboard': boolean
  'cadastrado em': string | null
  'cadastrado por': string | null
  'situacao alterada em': string | null
  'situacao alterada por': string | null
  /** Proposta de contrato (F6.10): metas de cada filial; ausente na API atual. */
  'metas por filial'?: MetaPorFilialApiFalsa[]
  /** Proposta de contrato (F6.10): códigos das filiais ainda sem meta; ausente na API atual. */
  'filiais sem meta'?: string[]
  /** API (26), 2026-11-10: `true` quando o indicador tem metas por filial; ausente nas fixtures antigas. */
  'meta por filial'?: boolean
  // Proposta de contrato (F6.11 — meta buscada via API): só o Admin recebe; ausentes na API atual.
  /** Identificador da consulta da meta; `null` enquanto a integração não foi configurada. */
  identificador?: string | null
  url?: string | null
  'parametros de saida'?: unknown
  'parametros de entrada'?: unknown
  'variaveis usadas'?: string[] | null
  /** `true` quando `origem da meta = terceiro` e não há integração salva. */
  'integracao pendente'?: boolean
  'integracao alterada em'?: string | null
  'integracao alterada por'?: string | null
  // Contrato final da meta via API (RESPOSTA-FINAL-meta-via-api.md, seção 2.4 — 10/11/2026).
  /** `dado_externo` ou `integracao` nos indicadores `terceiro`; `null` nos de meta manual. */
  'fonte da meta'?: 'dado_externo' | 'integracao' | null
  /** `ok`, `sem_meta_no_mes`, `integracao_pendente`, `aguardando_consulta` ou `erro` (texto livre nos testes de formato). */
  'situacao da meta via api'?: string | null
  /** Tarefa do Bitrix da fonte `integracao` (mesmo formato do dado externo). */
  tarefa?: TarefaIndicadorApiFalsa | null
  /** Só o Admin, fonte `dado_externo`: integração do dado externo, só para leitura. */
  'integracao do dado externo'?: IntegracaoDoDadoExternoApiFalsa | null
}

/** Tarefa do Bitrix no indicador (`{ titulo, status, "id bitrix" }`, mesmo formato do dado externo). */
export interface TarefaIndicadorApiFalsa {
  titulo: string
  status: string
  'id bitrix': number | string | null
}

/** Integração do dado externo exibida (só leitura) no indicador da fonte `dado_externo`. */
export interface IntegracaoDoDadoExternoApiFalsa {
  identificador: string | null
  url: string | null
  'parametros de saida': unknown
  'parametros de entrada': unknown
}

/** Meta de uma filial na listagem (proposta de contrato — F6.10). */
export interface MetaPorFilialApiFalsa {
  filial: string
  'nome filial'?: string
  meta: number | null
}

export interface AlertasIndicadoresApiFalsos {
  'aguardando meta': number
  'com componente desativado': number
  /** Proposta de contrato (F6.10): indicadores ativos com alguma filial sem meta; ausente na API atual. */
  'meta pendente por filial'?: number
  /** Proposta de contrato (F6.11, opcional): indicadores ativos com a integração da meta pendente. */
  'integracao pendente'?: number
}

/** Topo da listagem (contrato final, seção 2.4): `integracao: false` = a consulta da fonte `integracao` ainda não roda. */
export interface MetaViaApiDisponivelApiFalsa {
  'dado externo': boolean
  integracao: boolean
}

export interface RespostaIndicadoresApiFalsa {
  indicadores: IndicadorApiFalso[]
  alertas: AlertasIndicadoresApiFalsos
  'meta via api'?: MetaViaApiDisponivelApiFalsa
}

export interface HistoricoMetaApiFalso {
  data: string
  filial: string
  'mes de referencia': string
  de: number | null
  para: number
  usuario: string
  motivo: string
}

/** Dashboards usados nos vínculos dos indicadores. */
export const DASHBOARD_COMERCIAL = { id: 1, nome: 'PED Comercial' }
export const DASHBOARD_GERENTES = { id: 2, nome: 'PED Gerentes' }

/** Ativo, dois apontamentos ativos, média, vinculado ao PED Comercial (40 pontos base). */
export const INDICADOR_COBERTURA_VISITAS_API: IndicadorApiFalso = {
  id: 1,
  nome: 'Cobertura de visitas',
  descricao: 'Percentual de vendedores com roteiro e positivação em dia.',
  ativo: true,
  composicao: {
    tipo: 'apontamentos',
    itens: [
      { id: 1, nome: 'Roteiro de visitas elaborado', ativo: true },
      { id: 6, nome: 'Positivação de clientes', ativo: true },
    ],
  },
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: 'media',
  meta: 85,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [{ ...DASHBOARD_COMERCIAL, 'pontos base': 40 }],
  'vinculado a dashboard': true,
  'cadastrado em': '2026-10-02 09:30:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Ativo, um apontamento desativado (parcial), soma, meta editável, sem dashboard (excluível). */
export const INDICADOR_ROTINAS_API: IndicadorApiFalso = {
  id: 2,
  nome: 'Rotinas financeiras em dia',
  descricao: null,
  ativo: true,
  composicao: {
    tipo: 'apontamentos',
    itens: [
      { id: 2, nome: 'Conciliação bancária concluída', ativo: false },
      { id: 7, nome: 'Fechamento contábil entregue', ativo: true },
    ],
  },
  tipos: ['Financeiro'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: 'soma',
  meta: 100,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': true,
  'criado automaticamente': false,
  'componentes desativados': true,
  problema: {
    tipo: 'apontamentos_parcialmente_desativados',
    mensagem: 'Parte dos apontamentos está desativada; o cálculo segue sem eles e pode distorcer o resultado.',
  },
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-09-15 14:45:00',
  'cadastrado por': 'João Lima',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Ativo, dado externo ativo (dourado), meta editável, vinculado a dois dashboards. */
export const INDICADOR_FATURAMENTO_API: IndicadorApiFalso = {
  id: 3,
  nome: 'Faturamento líquido mensal',
  descricao: 'Faturamento líquido coletado do ERP.',
  ativo: true,
  composicao: { tipo: 'dado_externo', itens: [{ id: 1, nome: 'Faturamento líquido', ativo: true }] },
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: null,
  meta: 1500000.5,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': true,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [
    { ...DASHBOARD_COMERCIAL, 'pontos base': 60 },
    { ...DASHBOARD_GERENTES, 'pontos base': 30 },
  ],
  'vinculado a dashboard': true,
  'cadastrado em': '2026-10-05 10:00:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Criado automaticamente (RF-28): dado externo, sem meta nem sentido, aguardando "Definir meta". */
export const INDICADOR_DEVOLUCOES_API: IndicadorApiFalso = {
  id: 4,
  nome: 'Devoluções de venda',
  descricao: null,
  ativo: true,
  composicao: { tipo: 'dado_externo', itens: [{ id: 3, nome: 'Devoluções (dado externo)', ativo: true }] },
  tipos: ['Comercial'],
  sentido: null,
  'sentido descricao': null,
  calculo: null,
  meta: null,
  'meta a definir': true,
  'origem da meta': null,
  'meta editavel no preenchimento': false,
  'criado automaticamente': true,
  'componentes desativados': false,
  problema: null,
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-11-04 15:20:00',
  'cadastrado por': 'Sistema',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Inativo, um apontamento ativo; situação já alterada (quem e quando); pode ser reativado e excluído. */
export const INDICADOR_CAPACITACAO_API: IndicadorApiFalso = {
  id: 5,
  nome: 'Capacitação',
  descricao: 'Horas de treinamento por colaborador no mês.',
  ativo: false,
  composicao: { tipo: 'apontamentos', itens: [{ id: 3, nome: 'Horas de treinamento realizadas', ativo: true }] },
  tipos: ['Recursos Humanos'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: 'soma',
  meta: 40,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-08-01 10:00:00',
  'cadastrado por': 'Carla Nunes',
  'situacao alterada em': '2026-10-20 11:05:00',
  'situacao alterada por': 'Ana Costa',
}

/** Ativo, "Menor é melhor (custo)", todos os apontamentos desativados, vinculado ao PED Gerentes (20). */
export const INDICADOR_CUSTO_FRETE_API: IndicadorApiFalso = {
  id: 6,
  nome: 'Custo de frete por entrega',
  descricao: 'Frete pago dividido pelas entregas realizadas.',
  ativo: true,
  composicao: {
    tipo: 'apontamentos',
    itens: [
      { id: 8, nome: 'Frete pago', ativo: false },
      { id: 9, nome: 'Entregas realizadas', ativo: false },
    ],
  },
  tipos: ['Logística'],
  sentido: 'menor_melhor',
  'sentido descricao': 'Menor é melhor (custo)',
  calculo: 'media',
  meta: 12.5,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': true,
  problema: { tipo: 'todos_apontamentos_desativados', mensagem: 'Todos os apontamentos estão desativados; o indicador fica sem resultado.' },
  dashboards: [{ ...DASHBOARD_GERENTES, 'pontos base': 20 }],
  'vinculado a dashboard': true,
  'cadastrado em': '2026-09-20 08:15:00',
  'cadastrado por': 'Pedro Alves',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Ativo, dado externo desativado (sem resultado), sem dashboard. */
export const INDICADOR_COBERTURA_CARTEIRA_API: IndicadorApiFalso = {
  id: 7,
  nome: 'Cobertura da carteira',
  descricao: null,
  ativo: true,
  composicao: { tipo: 'dado_externo', itens: [{ id: 2, nome: 'Cobertura de clientes', ativo: false }] },
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: null,
  meta: 70,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': true,
  problema: { tipo: 'dado_externo_desativado', mensagem: 'O dado externo está desativado; o indicador fica sem resultado.' },
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-09-12 14:30:00',
  'cadastrado por': 'João Lima',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

export const NOMES_INDICADORES = [
  'Cobertura de visitas',
  'Rotinas financeiras em dia',
  'Faturamento líquido mensal',
  'Devoluções de venda',
  'Capacitação',
  'Custo de frete por entrega',
  'Cobertura da carteira',
] as const

function copiar(indicador: IndicadorApiFalso): IndicadorApiFalso {
  return {
    ...indicador,
    composicao: { tipo: indicador.composicao.tipo, itens: indicador.composicao.itens.map((item) => ({ ...item })) },
    tipos: [...indicador.tipos],
    problema: indicador.problema ? { ...indicador.problema } : null,
    dashboards: indicador.dashboards.map((dashboard) => ({ ...dashboard })),
  }
}

/** Lista padrão (7 indicadores), na ordem acima. Devolve sempre cópias novas. */
export function indicadoresApi(): IndicadorApiFalso[] {
  return [
    INDICADOR_COBERTURA_VISITAS_API,
    INDICADOR_ROTINAS_API,
    INDICADOR_FATURAMENTO_API,
    INDICADOR_DEVOLUCOES_API,
    INDICADOR_CAPACITACAO_API,
    INDICADOR_CUSTO_FRETE_API,
    INDICADOR_COBERTURA_CARTEIRA_API,
  ].map(copiar)
}

/** Alertas como a API calcula: contam só indicadores ativos. */
export function alertasApi(lista: IndicadorApiFalso[]): AlertasIndicadoresApiFalsos {
  return {
    'aguardando meta': lista.filter((i) => i.ativo && i['meta a definir']).length,
    'com componente desativado': lista.filter((i) => i.ativo && i['componentes desativados']).length,
  }
}

/** Corpo de `GET /api/ped/indicadores-cadastro` para a lista informada (sem filtro). */
export function respostaIndicadoresApi(lista: IndicadorApiFalso[] = indicadoresApi()): RespostaIndicadoresApiFalsa {
  return { indicadores: lista, alertas: alertasApi(lista) }
}

/** Resposta de `POST` e de `PUT .../meta`: o indicador gravado dentro de `indicador`. */
export function respostaIndicadorApi(indicador: IndicadorApiFalso) {
  return { indicador }
}

/** Resposta de `PUT .../{id}/situacao`: o indicador atualizado e os dashboards afetados. */
export function respostaSituacaoApi(indicador: IndicadorApiFalso, afetados: DashboardDoIndicadorApiFalso[] = indicador.dashboards) {
  return { indicador, 'dashboards afetados': afetados }
}

function casaBusca(indicador: IndicadorApiFalso, termo: string): boolean {
  const termoNormalizado = normalizarBusca(termo)
  if (termoNormalizado === '') return true
  return [indicador.nome, ...indicador.composicao.itens.map((item) => item.nome)].some((campo) =>
    normalizarBusca(campo).includes(termoNormalizado),
  )
}

function casaSituacao(indicador: IndicadorApiFalso, situacao: string | null): boolean {
  switch (situacao) {
    case 'ativos':
      return indicador.ativo
    case 'inativos':
      return !indicador.ativo
    case 'meta':
      return indicador.ativo && indicador['meta a definir']
    case 'problemas':
      return indicador.ativo && indicador.problema !== null
    default:
      return true
  }
}

/**
 * Aplica à lista os filtros da query string como a API faz: `busca` (indicador, apontamento ou dado
 * externo, sem acento/maiúsculas) e `situacao`. Os alertas consideram a lista completa.
 */
export function filtrarIndicadoresApi(lista: IndicadorApiFalso[], url: URL): RespostaIndicadoresApiFalsa {
  const busca = url.searchParams.get('busca') ?? ''
  const situacao = url.searchParams.get('situacao')
  return {
    indicadores: lista.filter((indicador) => casaBusca(indicador, busca) && casaSituacao(indicador, situacao)),
    alertas: alertasApi(lista),
  }
}

/**
 * Rota falsa de `GET /api/ped/indicadores-cadastro` com filtragem pela query. `obterLista` é chamada
 * a cada requisição, para refletir alterações (cadastro, meta, situação, exclusão) feitas pelos testes.
 */
export function rotaListarIndicadores(obterLista: () => IndicadorApiFalso[]): RotaFalsa {
  return (_init, url) => respostaJson(filtrarIndicadoresApi(obterLista(), url))
}

/**
 * Histórico de ajustes de meta do indicador "Faturamento líquido mensal" (id 3), do mais recente ao
 * mais antigo, em duas filiais. O ajuste mais antigo traz `de: null` (ver dúvida registrada no plano).
 */
export function historicoMetasApi(): HistoricoMetaApiFalso[] {
  return [
    {
      data: '2026-10-28 09:12:00',
      filial: '101',
      'mes de referencia': '2026-10-01',
      de: 1500000.5,
      para: 1600000,
      usuario: 'Ana Costa',
      motivo: 'Sazonalidade de outubro',
    },
    {
      data: '2026-10-15 16:40:00',
      filial: '102',
      'mes de referencia': '2026-10-01',
      de: 1500000.5,
      para: 1200000,
      usuario: 'Beltrano',
      motivo: 'Reforma na loja',
    },
    {
      data: '2026-09-02 08:05:00',
      filial: '101',
      'mes de referencia': '2026-09-01',
      de: null,
      para: 1450000,
      usuario: 'Maria Souza',
      motivo: 'Ajuste inicial',
    },
  ]
}

/** Aplica o filtro `filial` da query (ausente ou `todas` = todas as filiais) como a API faz para o Admin. */
export function filtrarHistoricoMetasApi(lista: HistoricoMetaApiFalso[], url: URL): HistoricoMetaApiFalso[] {
  const filial = url.searchParams.get('filial')
  if (filial === null || filial === 'todas') return lista
  return lista.filter((item) => item.filial === filial)
}

/** Rota falsa de `GET .../{id}/metas-historico` com filtragem por filial. */
export function rotaHistoricoMetas(obterLista: () => HistoricoMetaApiFalso[] = historicoMetasApi): RotaFalsa {
  return (_init, url) => respostaJson(filtrarHistoricoMetasApi(obterLista(), url))
}

// ---------------------------------------------------------------------------
// F6.10 — Meta por filial (proposta de contrato; o back-end implementa depois)
// ---------------------------------------------------------------------------
//
// Contrato proposto para a listagem `GET /api/ped/indicadores-cadastro`:
// - cada indicador pode trazer `"metas por filial": [{ "filial", "nome filial"?, "meta": number | null }]`
//   e `"filiais sem meta": ["101", ...]` (códigos; a fonte da pendência). Sem `"filiais sem meta"`,
//   o front deriva as pendentes dos itens de `"metas por filial"` com `meta: null`;
// - `alertas` pode trazer `"meta pendente por filial": N` (indicadores **ativos** com alguma filial sem meta);
// - indicador com metas por filial vem com `meta: null` (não há meta única);
// - campos ausentes (API atual) = sem metas por filial e sem pendência.
//
// Gravação (POST do cadastro e PUT .../{id}/meta): com "Replicar a meta para todas as filiais" envia
// `"meta"` (como hoje); com a lista ou na visão de uma filial envia
// `"metas por filial": [{ "filial": "101", "meta": 1500.5 }]` só com as filiais preenchidas e sem `"meta"`.
// O valor vai como número, como o `"meta"` atual (a API também aceita texto com vírgula decimal).
//
// As fixtures abaixo NÃO entram na lista padrão (`indicadoresApi()`), para não alterar as contagens
// dos testes das demais atividades da F6. Filiais: as de `FILIAIS_API` (100 MATRIZ, 101 CAMPO GRANDE,
// 102 DOURADOS).

/** Ativo, apontamentos, meta por filial: só a 100 tem meta; 101 e 102 pendentes ("Meta pendente em 2 filiais"). */
export const INDICADOR_TICKET_MEDIO_API: IndicadorApiFalso = {
  id: 8,
  nome: 'Ticket médio por filial',
  descricao: 'Valor médio das vendas por cupom.',
  ativo: true,
  composicao: { tipo: 'apontamentos', itens: [{ id: 6, nome: 'Positivação de clientes', ativo: true }] },
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: 'soma',
  meta: null,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-11-10 08:00:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
  'metas por filial': [
    { filial: '100', 'nome filial': 'MATRIZ', meta: 1500.5 },
    { filial: '101', 'nome filial': 'CAMPO GRANDE', meta: null },
    { filial: '102', 'nome filial': 'DOURADOS', meta: null },
  ],
  'filiais sem meta': ['101', '102'],
}

/** Ativo, dado externo, meta por filial completa (nenhuma pendente): 100 = 30, 101 = 32,5 e 102 = 28. */
export const INDICADOR_MARGEM_API: IndicadorApiFalso = {
  id: 9,
  nome: 'Margem bruta por filial',
  descricao: null,
  ativo: true,
  composicao: { tipo: 'dado_externo', itens: [{ id: 1, nome: 'Faturamento líquido', ativo: true }] },
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: null,
  meta: null,
  'meta a definir': false,
  'origem da meta': 'manual',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-11-10 08:30:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
  'metas por filial': [
    { filial: '100', 'nome filial': 'MATRIZ', meta: 30 },
    { filial: '101', 'nome filial': 'CAMPO GRANDE', meta: 32.5 },
    { filial: '102', 'nome filial': 'DOURADOS', meta: 28 },
  ],
  'filiais sem meta': [],
}

/** Cópia profunda de um indicador com metas por filial. */
export function copiarComMetas(indicador: IndicadorApiFalso): IndicadorApiFalso {
  return {
    ...copiar(indicador),
    ...(indicador['metas por filial'] ? { 'metas por filial': indicador['metas por filial'].map((item) => ({ ...item })) } : {}),
    ...(indicador['filiais sem meta'] ? { 'filiais sem meta': [...indicador['filiais sem meta']] } : {}),
  }
}

/** Lista padrão (7) seguida dos indicadores com meta por filial (Ticket médio e Margem bruta). Cópias novas. */
export function indicadoresComMetasPorFilialApi(): IndicadorApiFalso[] {
  return [...indicadoresApi(), INDICADOR_TICKET_MEDIO_API, INDICADOR_MARGEM_API].map(copiarComMetas)
}

/** Alertas no contrato proposto: os atuais mais `"meta pendente por filial"` (ativos com filial sem meta). */
export function alertasComMetaPendenteApi(lista: IndicadorApiFalso[]): AlertasIndicadoresApiFalsos {
  return {
    ...alertasApi(lista),
    'meta pendente por filial': lista.filter((i) => i.ativo && (i['filiais sem meta'] ?? []).length > 0).length,
  }
}

/** Corpo de `GET /api/ped/indicadores-cadastro` no contrato proposto (com `"meta pendente por filial"`). */
export function respostaIndicadoresComMetasApi(lista: IndicadorApiFalso[] = indicadoresComMetasPorFilialApi()): RespostaIndicadoresApiFalsa {
  return { indicadores: lista, alertas: alertasComMetaPendenteApi(lista) }
}

/** Rota falsa da listagem no contrato proposto: filtra como `rotaListarIndicadores` e usa os alertas com a pendência. */
export function rotaListarIndicadoresComMetas(obterLista: () => IndicadorApiFalso[]): RotaFalsa {
  return (_init, url) => {
    const lista = obterLista()
    return respostaJson({ ...filtrarIndicadoresApi(lista, url), alertas: alertasComMetaPendenteApi(lista) })
  }
}

// ---------------------------------------------------------------------------
// F6.11 — Meta buscada via API (proposta de contrato, seção 5 de
// docs/propostas-backend/PROPOSTA-meta-por-filial.md; o back-end implementa depois)
// ---------------------------------------------------------------------------
//
// - Cadastro (POST) e "Definir meta" (PUT .../{id}/meta) com "Buscar metas via API" marcado:
//   `"origem da meta": "terceiro"`, sem `meta` nem `metas por filial`, com `"meta editavel": false`.
// - `PUT /api/ped/indicadores-cadastro/{id}/integracao` (só Admin): mesmo corpo do dado externo
//   (`identificador`, `url`, `parametros de saida`, `parametros de entrada`); 2xx = gravado.
// - Listagem (Admin): `identificador`, `url`, `parametros de saida`, `parametros de entrada`,
//   `variaveis usadas`, `integracao pendente`, `integracao alterada em/por`; `alertas["integracao pendente"]`
//   é opcional.
//
// As fixtures abaixo NÃO entram na lista padrão (`indicadoresApi()`).

export const URL_META_VIA_API = 'https://ti.exemplo.com.br/api/metas'
/** Saída da integração da meta: lista com um item por filial (`filial` e `meta`), contrato final de 10/11/2026. */
export const SAIDA_META_VIA_API = [{ filial: '100', meta: '4600000' }]
export const ENTRADA_META_VIA_API = { filial: '%filial%', competencia: '%competencia%' }

/** Campos da integração da meta como o Admin recebe na listagem. */
export interface IntegracaoMetaApiFalsa {
  identificador: string | null
  url: string | null
  'parametros de saida': unknown
  'parametros de entrada': unknown
  'variaveis usadas': string[]
  'integracao pendente': boolean
  'integracao alterada em': string | null
  'integracao alterada por': string | null
}

/** Integração da meta ainda não configurada (pendente). */
export function integracaoMetaPendenteApi(): IntegracaoMetaApiFalsa {
  return {
    identificador: null,
    url: null,
    'parametros de saida': null,
    'parametros de entrada': null,
    'variaveis usadas': [],
    'integracao pendente': true,
    'integracao alterada em': null,
    'integracao alterada por': null,
  }
}

/** Integração da meta configurada (META_MARGEM, URL_META_VIA_API, saída e entrada). */
export function integracaoMetaConfiguradaApi(): IntegracaoMetaApiFalsa {
  return {
    identificador: 'META_MARGEM',
    url: URL_META_VIA_API,
    'parametros de saida': SAIDA_META_VIA_API.map((item) => ({ ...item })),
    'parametros de entrada': { ...ENTRADA_META_VIA_API },
    'variaveis usadas': ['competencia', 'filial'],
    'integracao pendente': false,
    'integracao alterada em': '2026-11-10 09:00:00',
    'integracao alterada por': 'Equipe TI',
  }
}

/** Ativo, dado externo, meta via API com a integração PENDENTE (Admin vê "Preencher integração"). */
export const INDICADOR_META_API_PENDENTE_API: IndicadorApiFalso = {
  id: 10,
  nome: 'Faturamento com meta da TI',
  descricao: null,
  ativo: true,
  composicao: { tipo: 'dado_externo', itens: [{ id: 1, nome: 'Faturamento líquido', ativo: true }] },
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: null,
  meta: null,
  'meta a definir': false,
  'origem da meta': 'terceiro',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-11-10 10:00:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
  ...integracaoMetaPendenteApi(),
  'fonte da meta': 'integracao',
  'situacao da meta via api': 'integracao_pendente',
  tarefa: { titulo: '[PED] Integração da meta: Faturamento com meta da TI', status: 'aguardando_envio', 'id bitrix': null },
}

/** Ativo, apontamentos, meta via API com a integração CONFIGURADA (Admin vê "Configurações"). */
export const INDICADOR_META_API_CONFIGURADO_API: IndicadorApiFalso = {
  id: 11,
  nome: 'Margem com meta da TI',
  descricao: null,
  ativo: true,
  composicao: { tipo: 'apontamentos', itens: [{ id: 6, nome: 'Positivação de clientes', ativo: true }] },
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  calculo: 'soma',
  meta: null,
  'meta a definir': false,
  'origem da meta': 'terceiro',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-11-10 10:30:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
  ...integracaoMetaConfiguradaApi(),
  'fonte da meta': 'integracao',
  'situacao da meta via api': 'ok',
  tarefa: null,
}

/** Cópia profunda (inclusive os parâmetros da integração). */
export function copiarComIntegracao(indicador: IndicadorApiFalso): IndicadorApiFalso {
  return JSON.parse(JSON.stringify(indicador)) as IndicadorApiFalso
}

/** Lista padrão (7) seguida dos dois indicadores com meta via API (pendente e configurado). Cópias novas. */
export function indicadoresComMetaViaApiApi(): IndicadorApiFalso[] {
  return [...indicadoresApi(), INDICADOR_META_API_PENDENTE_API, INDICADOR_META_API_CONFIGURADO_API].map(copiarComIntegracao)
}

/** Alertas no contrato proposto: os atuais mais `"integracao pendente"` (ativos com a integração da meta pendente). */
export function alertasComIntegracaoPendenteApi(lista: IndicadorApiFalso[]): AlertasIndicadoresApiFalsos {
  return {
    ...alertasApi(lista),
    'integracao pendente': lista.filter((i) => i.ativo && i['integracao pendente'] === true).length,
  }
}

/** Rota falsa da listagem com `alertas["integracao pendente"]`; filtra como `rotaListarIndicadores`. */
export function rotaListarIndicadoresComIntegracao(obterLista: () => IndicadorApiFalso[]): RotaFalsa {
  return (_init, url) => {
    const lista = obterLista()
    return respostaJson({ ...filtrarIndicadoresApi(lista, url), alertas: alertasComIntegracaoPendenteApi(lista) })
  }
}

/** Corpo de `PUT /api/ped/indicadores-cadastro/{id}/integracao` (mesmo do dado externo). */
export interface CorpoIntegracaoIndicadorApiFalso {
  identificador: string
  url: string
  'parametros de saida': string
  'parametros de entrada': string
}

// ---------------------------------------------------------------------------
// F6.10 (ajustes ao contrato real — API (26).md e FRONT-meta-por-filial.md, 2026-11-10) e
// F6.12 — "Definir metas pendentes" (`PUT /api/ped/indicadores-cadastro/{id}/metas-filiais`)
// ---------------------------------------------------------------------------
//
// - Listagem: cada indicador traz `"meta por filial": true | false`; `"metas por filial"` vem `null`
//   quando a meta é única; `?situacao=meta_filial_pendente` lista só os **ativos** com alguma filial
//   em `"filiais sem meta"`.
// - Erros 400 de meta por filial: `{ "mensagem": "<primeiro erro>", "erros": [{ "filial": "101" | null, "mensagem" }] }`.
// - `PUT .../{id}/metas-filiais` com `{ "metas por filial": [{ filial, meta }] }`; 200
//   `{ "mensagem": "metas definidas", "filiais definidas": [...], "filiais sem meta": [...restantes] }`.
//
// As fixtures abaixo NÃO entram na lista padrão (`indicadoresApi()`).

/** Erro de um item da meta por filial, como a API devolve em `erros`. */
export interface ErroDeFilialApiFalso {
  filial: string | number | null
  mensagem: string
}

/** Corpo do 400 de meta por filial: `mensagem` é o primeiro erro e `erros` traz todos. */
export function corpoErrosPorFilialApi(erros: ErroDeFilialApiFalso[], mensagem: string = erros[0]?.mensagem ?? 'dados invalidos') {
  return { mensagem, erros }
}

/** Resposta 400 com os erros por filial. */
export function respostaErrosPorFilial(erros: ErroDeFilialApiFalso[], mensagem?: string): Response {
  return respostaJson(corpoErrosPorFilialApi(erros, mensagem), 400)
}

/** Corpo de `PUT .../{id}/metas-filiais` (só as filiais preenchidas). */
export interface CorpoMetasPendentesApiFalso {
  'metas por filial': { filial: string; meta: number }[]
}

/** Resposta 200 de `PUT .../{id}/metas-filiais`. */
export function respostaMetasPendentesApi(definidas: string[], semMeta: string[]) {
  return { mensagem: 'metas definidas', 'filiais definidas': definidas, 'filiais sem meta': semMeta }
}

/**
 * Cópia do indicador com as metas informadas gravadas nas filiais pendentes, como a API faz:
 * preenche `meta` em `"metas por filial"` e tira as filiais de `"filiais sem meta"`.
 */
export function aplicarMetasPendentesApi(indicador: IndicadorApiFalso, metas: { filial: string; meta: number }[]): IndicadorApiFalso {
  const copia = copiarComMetas(indicador)
  const definidas = new Map(metas.map((item) => [String(item.filial), item.meta]))
  return {
    ...copia,
    'metas por filial': (copia['metas por filial'] ?? []).map((item) =>
      definidas.has(item.filial) ? { ...item, meta: definidas.get(item.filial) ?? null } : item,
    ),
    'filiais sem meta': (copia['filiais sem meta'] ?? []).filter((codigo) => !definidas.has(codigo)),
  }
}

/** Indicador com `"meta por filial"` informada como a API (26) faz (derivada de `"metas por filial"`). */
export function comCampoMetaPorFilial(indicador: IndicadorApiFalso): IndicadorApiFalso {
  return { ...copiarComMetas(indicador), 'meta por filial': (indicador['metas por filial'] ?? []).length > 0 }
}

/** Lista padrão (7) + Ticket médio (pendentes 101 e 102) + Margem bruta (completa), com `"meta por filial"`. */
export function indicadoresComMetaPendenteApi(): IndicadorApiFalso[] {
  return indicadoresComMetasPorFilialApi().map(comCampoMetaPorFilial)
}

/**
 * Rota falsa da listagem no contrato da API (26): filtra como `rotaListarIndicadores`, acrescenta
 * `situacao=meta_filial_pendente` (ativos com alguma filial sem meta) e usa os alertas com
 * `"meta pendente por filial"`. `obterLista` é chamada a cada requisição.
 */
export function rotaListarIndicadoresComMetaPendente(obterLista: () => IndicadorApiFalso[]): RotaFalsa {
  return (_init, url) => {
    const lista = obterLista()
    const alertas = alertasComMetaPendenteApi(lista)
    if (url.searchParams.get('situacao') === 'meta_filial_pendente') {
      const semSituacao = new URL(url.href)
      semSituacao.searchParams.delete('situacao')
      const { indicadores } = filtrarIndicadoresApi(lista, semSituacao)
      return respostaJson({ indicadores: indicadores.filter((i) => i.ativo && (i['filiais sem meta'] ?? []).length > 0), alertas })
    }
    return respostaJson({ ...filtrarIndicadoresApi(lista, url), alertas })
  }
}

// ---------------------------------------------------------------------------
// F6.11 — Contrato final da meta via API (docs/propostas-backend/RESPOSTA-FINAL-meta-via-api.md e
// CONFIRMACAO-FRONT-meta-via-api.md, 10/11/2026)
// ---------------------------------------------------------------------------
//
// - Cadastro e "Definir meta" com "Buscar metas via API": `"origem da meta": "terceiro"`,
//   `"fonte da meta": "dado_externo" | "integracao"`, `"meta editavel": false`, sem meta.
// - Listagem: `fonte da meta`, `situacao da meta via api`, `filiais sem meta`, `tarefa` (fonte
//   `integracao`) e, só para o Admin na fonte `dado_externo`, `integracao do dado externo`.
// - Topo da listagem: `"meta via api": { "dado externo": true, "integracao": false }` (fase 1).
// - `alertas["integracao pendente"]` conta só a fonte `integracao` sem integração salva.
// - Filtro `situacao=integracao_pendente` (fonte `integracao`).
//
// As fixtures abaixo NÃO entram na lista padrão (`indicadoresApi()`).

/** Fase 1 do back-end: a fonte `dado_externo` funciona; a consulta da fonte `integracao` ainda não roda. */
export const META_VIA_API_FASE_1: MetaViaApiDisponivelApiFalsa = { 'dado externo': true, integracao: false }

/** Fase 2: as duas fontes consultadas. */
export const META_VIA_API_COMPLETA: MetaViaApiDisponivelApiFalsa = { 'dado externo': true, integracao: true }

/** URL e parâmetros da integração do dado externo "Faturamento líquido" (só leitura no indicador). */
export const URL_INTEGRACAO_DADO_FATURAMENTO = 'https://erp.exemplo.com.br/g5-senior-services/sapiens_SyncFaturamento'
export const SAIDA_INTEGRACAO_DADO_FATURAMENTO = [{ filial: '100', valor: '1500000', meta: '1600000' }]
export const ENTRADA_INTEGRACAO_DADO_FATURAMENTO = { operacao: 'Faturamento', parametros: { ECodEmp: '%empresas%', EDatIni: '%dataInicial%' } }

/** Integração do dado externo "Faturamento líquido" como o Admin recebe no indicador da fonte `dado_externo`. */
export function integracaoDoDadoFaturamentoApi(): IntegracaoDoDadoExternoApiFalsa {
  return {
    identificador: 'FATURAMENTO',
    url: URL_INTEGRACAO_DADO_FATURAMENTO,
    'parametros de saida': JSON.parse(JSON.stringify(SAIDA_INTEGRACAO_DADO_FATURAMENTO)) as unknown,
    'parametros de entrada': JSON.parse(JSON.stringify(ENTRADA_INTEGRACAO_DADO_FATURAMENTO)) as unknown,
  }
}

/** Tarefa do Bitrix no formato do indicador (`"id bitrix"` `null` = aguardando envio). */
export function tarefaMetaApi(
  titulo: string,
  idBitrix: number | string | null = null,
  status: string = idBitrix === null ? 'aguardando_envio' : 'aberta',
): TarefaIndicadorApiFalsa {
  return { titulo, status, 'id bitrix': idBitrix }
}

/** Campos comuns de um indicador ativo com meta via API (sem a fonte e sem a integração). */
const BASE_META_VIA_API: Omit<IndicadorApiFalso, 'id' | 'nome' | 'composicao' | 'calculo'> = {
  descricao: null,
  ativo: true,
  tipos: ['Comercial'],
  sentido: 'maior_melhor',
  'sentido descricao': 'Maior é melhor',
  meta: null,
  'meta a definir': false,
  'origem da meta': 'terceiro',
  'meta editavel no preenchimento': false,
  'criado automaticamente': false,
  'componentes desativados': false,
  problema: null,
  dashboards: [],
  'vinculado a dashboard': false,
  'cadastrado em': '2026-11-10 11:00:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
  'filiais sem meta': [],
}

/** Fonte `dado_externo` (Faturamento líquido, `fornece meta: true`), situação `ok`; Admin recebe a integração do dado externo. */
export const INDICADOR_META_DADO_EXTERNO_API: IndicadorApiFalso = {
  ...BASE_META_VIA_API,
  id: 12,
  nome: 'Faturamento com meta do ERP',
  composicao: { tipo: 'dado_externo', itens: [{ id: 1, nome: 'Faturamento líquido', ativo: true }] },
  calculo: null,
  ...integracaoMetaPendenteApi(),
  'integracao pendente': false,
  'fonte da meta': 'dado_externo',
  'situacao da meta via api': 'ok',
  tarefa: null,
  'integracao do dado externo': integracaoDoDadoFaturamentoApi(),
}

/** Fonte `dado_externo`, situação `sem_meta_no_mes`, com as filiais 101 e 102 sem meta no mês aberto. */
export const INDICADOR_META_SEM_META_NO_MES_API: IndicadorApiFalso = {
  ...BASE_META_VIA_API,
  id: 13,
  nome: 'Volume Mann com meta do ERP',
  composicao: { tipo: 'dado_externo', itens: [{ id: 6, nome: 'Volume de vendas', ativo: true }] },
  calculo: null,
  ...integracaoMetaPendenteApi(),
  'integracao pendente': false,
  'fonte da meta': 'dado_externo',
  'situacao da meta via api': 'sem_meta_no_mes',
  'filiais sem meta': ['101', '102'],
  tarefa: null,
  'integracao do dado externo': integracaoDoDadoFaturamentoApi(),
}

/** Fonte `integracao` com a integração salva, aguardando a primeira consulta; tarefa #4521 enviada. */
export const INDICADOR_META_AGUARDANDO_API: IndicadorApiFalso = {
  ...BASE_META_VIA_API,
  id: 14,
  nome: 'Novos clientes com meta da TI',
  composicao: { tipo: 'apontamentos', itens: [{ id: 6, nome: 'Positivação de clientes', ativo: true }] },
  calculo: 'soma',
  ...integracaoMetaConfiguradaApi(),
  identificador: 'META_NOVOS_CLIENTES',
  'fonte da meta': 'integracao',
  'situacao da meta via api': 'aguardando_consulta',
  tarefa: tarefaMetaApi('[PED] Integração da meta: Novos clientes com meta da TI', 4521),
}

/** Fonte `integracao` com erro na última consulta; tarefa #4522 (número em texto) concluída. */
export const INDICADOR_META_ERRO_API: IndicadorApiFalso = {
  ...BASE_META_VIA_API,
  id: 15,
  nome: 'Cobertura com meta da TI',
  composicao: { tipo: 'apontamentos', itens: [{ id: 6, nome: 'Positivação de clientes', ativo: true }] },
  calculo: 'soma',
  ...integracaoMetaConfiguradaApi(),
  identificador: 'META_COBERTURA',
  'fonte da meta': 'integracao',
  'situacao da meta via api': 'erro',
  tarefa: tarefaMetaApi('[PED] Integração da meta: Cobertura com meta da TI', '4522', 'concluida'),
}

/**
 * Lista padrão (7) + os dois da F6.11 (10 pendente e 11 ok, fonte `integracao`) + fonte `dado_externo`
 * (12 ok e 13 sem meta no mês) + fonte `integracao` (14 aguardando consulta e 15 erro). Cópias novas.
 */
export function indicadoresComFonteDaMetaApi(): IndicadorApiFalso[] {
  return [
    ...indicadoresComMetaViaApiApi(),
    INDICADOR_META_DADO_EXTERNO_API,
    INDICADOR_META_SEM_META_NO_MES_API,
    INDICADOR_META_AGUARDANDO_API,
    INDICADOR_META_ERRO_API,
  ].map(copiarComIntegracao)
}

/** Alertas do contrato final: `"integracao pendente"` conta só os ativos da fonte `integracao` sem integração salva. */
export function alertasComFonteDaMetaApi(lista: IndicadorApiFalso[]): AlertasIndicadoresApiFalsos {
  return {
    ...alertasApi(lista),
    'integracao pendente': lista.filter(
      (i) => i.ativo && i['fonte da meta'] === 'integracao' && i['situacao da meta via api'] === 'integracao_pendente',
    ).length,
  }
}

/**
 * Rota falsa da listagem no contrato final: filtra como `rotaListarIndicadores`, acrescenta
 * `situacao=integracao_pendente` (fonte `integracao` com a situação `integracao_pendente`), usa os
 * alertas de `alertasComFonteDaMetaApi` e traz `"meta via api"` no topo (padrão: fase 1; `null` = sem o
 * campo). `obterLista` é chamada a cada requisição.
 */
export function rotaListarIndicadoresComFonteDaMeta(
  obterLista: () => IndicadorApiFalso[],
  metaViaApi: MetaViaApiDisponivelApiFalsa | null = META_VIA_API_FASE_1,
): RotaFalsa {
  return (_init, url) => {
    const lista = obterLista()
    const alertas = alertasComFonteDaMetaApi(lista)
    const topo = metaViaApi === null ? {} : { 'meta via api': { ...metaViaApi } }
    if (url.searchParams.get('situacao') === 'integracao_pendente') {
      const semSituacao = new URL(url.href)
      semSituacao.searchParams.delete('situacao')
      const { indicadores } = filtrarIndicadoresApi(lista, semSituacao)
      return respostaJson({
        indicadores: indicadores.filter(
          (i) => i['fonte da meta'] === 'integracao' && i['situacao da meta via api'] === 'integracao_pendente',
        ),
        alertas,
        ...topo,
      })
    }
    return respostaJson({ ...filtrarIndicadoresApi(lista, url), alertas, ...topo })
  }
}
