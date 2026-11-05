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
}

export interface AlertasIndicadoresApiFalsos {
  'aguardando meta': number
  'com componente desativado': number
}

export interface RespostaIndicadoresApiFalsa {
  indicadores: IndicadorApiFalso[]
  alertas: AlertasIndicadoresApiFalsos
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
