/**
 * Serviço de indicadores (F6.1).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Cadastro e Preenchimento — indicadores":
 * - `GET    /api/ped/indicadores-cadastro`                       lista filtrada (`busca`, `situacao`) e alertas
 * - `POST   /api/ped/indicadores-cadastro`                       cadastro (`paraCorpoNovoIndicador`)
 * - `PUT    /api/ped/indicadores-cadastro/{id}/meta`             `{ meta, sentido, "meta editavel" }` (RF-36)
 * - `PUT    /api/ped/indicadores-cadastro/{id}/situacao`         `{ ativo }` — Admin e Validador (RF-38)
 * - `DELETE /api/ped/indicadores-cadastro/{id}`                  Admin — recusa (400) se já esteve vinculado a dashboard (RN-11, RF-37)
 * - `GET    /api/ped/indicadores-cadastro/{id}/metas-historico`  `filial` (RF-39)
 *
 * Os formatos das respostas seguem o adotado para a F6 (ver `src/test/indicadoresFalsos.ts` e as
 * dúvidas em `docs/plano-implementacao.md`):
 * - listagem: `{ indicadores: [...], alertas: { "aguardando meta", "com componente desativado" } }`.
 *   Lista pura ou objeto sem `indicadores` é resposta inválida; alertas ausentes viram zeros;
 * - histórico de metas: lista pura ou `{ historico: [...] }`;
 * - situação: `{ indicador, "dashboards afetados": [{ id, nome, "pontos base" }] }` ou o indicador na
 *   raiz. Os dashboards afetados ausentes ou fora do formato viram `[]` (fase 4 da API);
 * - POST e PUT de meta: `{ indicador: {...} }` ou o indicador na raiz.
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 * Na listagem e no histórico, respostas 2xx fora do formato esperado viram
 * `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único item inválido rejeita a resposta inteira.
 *
 * Regra "2xx = gravado": nos POSTs e PUTs de cadastro, meta e situação, um 2xx já significa que o
 * indicador foi gravado. A resposta é lida de forma tolerante: indicador válido na raiz ou dentro de
 * `indicador` é devolvido convertido; corpo vazio (200/201/204), só `mensagem`, `{ id }`, incompleto,
 * lista ou texto resolve `null`, sem erro. Quem chama deve recarregar a lista para obter o dado
 * atualizado. Erros HTTP (400, 403, 500) continuam sendo `ApiError`.
 *
 * A exclusão resolve sem valor em 204 ou 200.
 */

import {
  CALCULOS,
  ORIGENS_META,
  SENTIDOS,
  TIPOS_COMPOSICAO,
  type DashboardDoIndicador,
  type HistoricoMeta,
  type Indicador,
  type NovoIndicador,
  type Sentido,
} from '../types/dominio'
import {
  type DashboardDoIndicadorApi,
  type HistoricoMetaApi,
  type IndicadorApi,
  paraCorpoNovoIndicador,
  paraHistoricoMeta,
  paraIndicador,
} from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, type ValorQuery, apiFetch } from './api'

const ROTA_INDICADORES = '/ped/indicadores-cadastro'

/** Situações aceitas pelo filtro da API, na ordem exibida na tela. */
export const SITUACOES_FILTRO_INDICADOR = ['todas', 'ativos', 'inativos', 'meta', 'problemas'] as const

export type SituacaoFiltroIndicador = (typeof SITUACOES_FILTRO_INDICADOR)[number]

export const ROTULOS_SITUACAO_FILTRO_INDICADOR: Readonly<Record<SituacaoFiltroIndicador, string>> = {
  todas: 'Todas',
  ativos: 'Ativos',
  inativos: 'Inativos',
  meta: 'Aguardando meta',
  problemas: 'Com problemas',
}

/** Filtros de `listarIndicadores`; só os informados entram na query. */
export interface FiltrosIndicadores {
  /** Texto livre; vazio ou só com espaços é omitido. A API ignora acentos e maiúsculas. */
  busca?: string
  situacao?: SituacaoFiltroIndicador
}

/** Alertas do menu: contam só indicadores ativos e independem do filtro aplicado. */
export interface AlertasIndicadores {
  aguardandoMeta: number
  comComponenteDesativado: number
}

export interface ResultadoListagemIndicadores {
  indicadores: Indicador[]
  alertas: AlertasIndicadores
}

/** Dados de `definirMeta` (RF-36). `meta` é número (ex.: 12,5 do formulário → 12.5). */
export interface DadosMeta {
  meta: number
  sentido: Sentido
  metaEditavel: boolean
}

/**
 * Resultado de `alterarSituacaoIndicador`: o indicador atualizado (ou `null` quando a resposta não o
 * traz completo) e os dashboards afetados pela mudança (`[]` quando ausentes ou fora do formato).
 */
export interface ResultadoSituacaoIndicador {
  indicador: Indicador | null
  dashboardsAfetados: DashboardDoIndicador[]
}

/** Filtros de `listarHistoricoMetas`; só os informados entram na query. */
export interface FiltrosHistoricoMetas {
  /** Código da filial. Ausente ou `todas` não entra na query (todas as filiais, só Admin). */
  filial?: string
}

// ---------------------------------------------------------------------------
// Validação das respostas
// ---------------------------------------------------------------------------

function respostaInvalida(): ApiError {
  return new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function ehUmDe<T extends string | number>(opcoes: readonly T[], valor: unknown): valor is T {
  return opcoes.some((opcao) => opcao === valor)
}

/** Campo opcional: ausente, `null` ou do tipo esperado. */
function opcional(valor: unknown, validar: (v: unknown) => boolean): boolean {
  return valor === undefined || valor === null || validar(valor)
}

const ehTexto = (v: unknown): v is string => typeof v === 'string'
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const ehBooleano = (v: unknown): v is boolean => typeof v === 'boolean'

function ehComponenteApi(valor: unknown): boolean {
  return ehObjeto(valor) && ehNumero(valor.id) && ehTexto(valor.nome) && ehBooleano(valor.ativo)
}

function ehComposicaoApi(valor: unknown): boolean {
  return (
    ehObjeto(valor) &&
    ehUmDe(TIPOS_COMPOSICAO, valor.tipo) &&
    opcional(valor.itens, (v) => Array.isArray(v) && v.every(ehComponenteApi))
  )
}

function ehProblemaApi(valor: unknown): boolean {
  return ehObjeto(valor) && ehTexto(valor.tipo) && ehTexto(valor.mensagem)
}

function ehDashboardApi(valor: unknown): valor is DashboardDoIndicadorApi {
  return ehObjeto(valor) && ehNumero(valor.id) && ehTexto(valor.nome) && ehNumero(valor['pontos base'])
}

/** Indicador completo e válido no formato da API. Campos opcionais aceitam ausência ou `null`. */
function ehIndicadorApi(valor: unknown): valor is IndicadorApi {
  if (!ehObjeto(valor)) return false
  return (
    ehNumero(valor.id) &&
    ehTexto(valor.nome) &&
    opcional(valor.descricao, ehTexto) &&
    ehBooleano(valor.ativo) &&
    ehComposicaoApi(valor.composicao) &&
    opcional(valor.tipos, (v) => Array.isArray(v) && v.every(ehTexto)) &&
    opcional(valor.sentido, (v) => ehUmDe(SENTIDOS, v)) &&
    opcional(valor.calculo, (v) => ehUmDe(CALCULOS, v)) &&
    opcional(valor.meta, ehNumero) &&
    opcional(valor['meta a definir'], ehBooleano) &&
    opcional(valor['origem da meta'], (v) => ehUmDe(ORIGENS_META, v)) &&
    opcional(valor['meta editavel no preenchimento'], ehBooleano) &&
    opcional(valor['criado automaticamente'], ehBooleano) &&
    opcional(valor['componentes desativados'], ehBooleano) &&
    opcional(valor.problema, ehProblemaApi) &&
    opcional(valor.dashboards, (v) => Array.isArray(v) && v.every(ehDashboardApi)) &&
    opcional(valor['vinculado a dashboard'], ehBooleano) &&
    opcional(valor['cadastrado em'], ehTexto) &&
    opcional(valor['cadastrado por'], ehTexto) &&
    opcional(valor['situacao alterada em'], ehTexto) &&
    opcional(valor['situacao alterada por'], ehTexto)
  )
}

function ehHistoricoMetaApi(valor: unknown): valor is HistoricoMetaApi {
  if (!ehObjeto(valor)) return false
  return (
    ehTexto(valor.data) &&
    (ehTexto(valor.filial) || ehNumero(valor.filial)) &&
    ehTexto(valor['mes de referencia']) &&
    opcional(valor.de, ehNumero) &&
    ehNumero(valor.para) &&
    ehTexto(valor.usuario) &&
    ehTexto(valor.motivo)
  )
}

/** Converte um indicador da listagem; fora do formato vira `ApiError`. */
function converterIndicador(valor: unknown): Indicador {
  if (!ehIndicadorApi(valor)) throw respostaInvalida()
  return paraIndicador(valor)
}

/** Converte o indicador se ele estiver completo e válido; caso contrário devolve `null` (uso nas gravações). */
function converterIndicadorOuNulo(valor: unknown): Indicador | null {
  if (!ehIndicadorApi(valor)) return null
  return paraIndicador(valor)
}

/** Indicador gravado: na raiz ou dentro de `indicador`; sem indicador reconhecível, `null`. */
function extrairIndicadorOuNulo(resposta: unknown): Indicador | null {
  if (!ehObjeto(resposta)) return null
  return converterIndicadorOuNulo(resposta) ?? converterIndicadorOuNulo(resposta.indicador)
}

function converterAlertas(valor: unknown): AlertasIndicadores {
  if (valor === undefined || valor === null) return { aguardandoMeta: 0, comComponenteDesativado: 0 }
  if (!ehObjeto(valor)) throw respostaInvalida()
  const aguardandoMeta = valor['aguardando meta'] ?? 0
  const comComponenteDesativado = valor['com componente desativado'] ?? 0
  if (!ehNumero(aguardandoMeta) || !ehNumero(comComponenteDesativado)) throw respostaInvalida()
  return { aguardandoMeta, comComponenteDesativado }
}

/** Dashboards afetados: lista só com itens válidos; ausente ou fora do formato vira `[]`, sem erro. */
function converterDashboardsAfetados(valor: unknown): DashboardDoIndicador[] {
  if (!Array.isArray(valor) || !valor.every(ehDashboardApi)) return []
  return valor.map((dashboard: DashboardDoIndicadorApi) => ({
    id: dashboard.id,
    nome: dashboard.nome,
    pontosBase: dashboard['pontos base'],
  }))
}

function montarQuery(filtros: FiltrosIndicadores): Record<string, ValorQuery> {
  const busca = filtros.busca?.trim() ? filtros.busca : undefined
  const situacao = filtros.situacao === 'todas' ? undefined : filtros.situacao
  return { busca, situacao }
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/**
 * Lista os indicadores visíveis ao usuário, filtrados pela API, com os alertas do menu.
 * Nenhum item inválido é ignorado silenciosamente: a resposta inteira é rejeitada.
 */
export async function listarIndicadores(filtros: FiltrosIndicadores = {}): Promise<ResultadoListagemIndicadores> {
  const resposta = await apiFetch<unknown>(ROTA_INDICADORES, { query: montarQuery(filtros) })
  if (!ehObjeto(resposta) || !Array.isArray(resposta.indicadores)) throw respostaInvalida()
  const lista: unknown[] = resposta.indicadores
  return {
    indicadores: lista.map((item) => converterIndicador(item)),
    alertas: converterAlertas(resposta.alertas),
  }
}

/**
 * Cadastra um indicador (nasce ativo). Ver a regra "2xx = gravado" no topo do arquivo: a resposta é
 * lida de forma tolerante e, sem indicador reconhecível, resolve `null`.
 */
export async function criarIndicador(dados: NovoIndicador): Promise<Indicador | null> {
  const resposta = await apiFetch<unknown>(ROTA_INDICADORES, {
    method: 'POST',
    body: paraCorpoNovoIndicador(dados),
  })
  return extrairIndicadorOuNulo(resposta)
}

/** Define a meta, o sentido e se a meta é editável no preenchimento (RF-36). */
export async function definirMeta(id: number, dados: DadosMeta): Promise<Indicador | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}/meta`, {
    method: 'PUT',
    body: { meta: dados.meta, sentido: dados.sentido, 'meta editavel': dados.metaEditavel },
  })
  return extrairIndicadorOuNulo(resposta)
}

/**
 * Ativa ou desativa um indicador (RF-38). Devolve o indicador atualizado e os dashboards afetados;
 * ver a regra "2xx = gravado" no topo do arquivo.
 */
export async function alterarSituacaoIndicador(id: number, ativo: boolean): Promise<ResultadoSituacaoIndicador> {
  const resposta = await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}/situacao`, {
    method: 'PUT',
    body: { ativo },
  })
  if (!ehObjeto(resposta)) return { indicador: null, dashboardsAfetados: [] }
  return {
    indicador: extrairIndicadorOuNulo(resposta),
    dashboardsAfetados: converterDashboardsAfetados(resposta['dashboards afetados']),
  }
}

/**
 * Exclui um indicador (RF-37). Resolve sem valor em 204 ou 200. Quando ele já esteve vinculado a
 * dashboard (RN-11), a API responde 400 e a `ApiError` traz a mensagem da API.
 */
export async function excluirIndicador(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}`, { method: 'DELETE' })
}

/** Histórico de ajustes de meta do indicador (RF-39), na ordem devolvida pela API. */
export async function listarHistoricoMetas(id: number, filtros: FiltrosHistoricoMetas = {}): Promise<HistoricoMeta[]> {
  const filial = filtros.filial === 'todas' ? undefined : filtros.filial
  const resposta = await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}/metas-historico`, { query: { filial } })
  const lista: unknown = ehObjeto(resposta) ? resposta.historico : resposta
  if (!Array.isArray(lista) || !lista.every(ehHistoricoMetaApi)) throw respostaInvalida()
  return lista.map((item) => paraHistoricoMeta(item))
}
