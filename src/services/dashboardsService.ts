/**
 * Serviço de dashboards (F7.1 — RF-47 a RF-59, INT-02).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Cadastro e Preenchimento — fase 6: dashboards":
 * - `GET    /api/ped/dashboards`                   lista filtrada (`busca`, `situacao`)
 * - `GET    /api/ped/dashboards/{id}`              detalhe (pesos dos indicadores, base da faixa, fórmula)
 * - `POST   /api/ped/dashboards/previa-tarefa`     prévia da tarefa (mesmo corpo do cadastro; não grava)
 * - `POST   /api/ped/dashboards`                   cadastro (`paraCorpoDashboard`) — nasce `em_construcao`
 * - `PUT    /api/ped/dashboards/{id}`              edição (`"enviar tarefa ti"` quando informado)
 * - `PUT    /api/ped/dashboards/{id}/concluir`     conclui a construção ou a modificação — Admin
 * - `PUT    /api/ped/dashboards/{id}/situacao`     `{ ativo }` — Admin
 * - `DELETE /api/ped/dashboards/{id}`              exclusão — Admin
 * - `GET    /api/ped/dashboards/{id}/historico`    histórico de modificações
 * - `GET    /api/ped/dashboards/{id}/tarefas`      tarefas de construção e modificação
 * - `GET    /api/ped/vinculos?tipo=&busca=`        listas para montar o vínculo (filiais, cargos, colaboradores)
 *
 * Os formatos das respostas não estão todos documentados na API; o serviço aceita os formatos
 * prováveis em cada rota (ver `src/test/dashboardsFalsos.ts` e as dúvidas da F7 em
 * `docs/plano-implementacao.md`):
 * - listagem: lista pura ou `{ dashboards: [...] }`; `"tarefa bitrix"` opcional (ausente ou `null`), no
 *   formato `{ id, status, titulo }`. O número da tarefa (`id`) só vem quando ela é enviada ao Bitrix24;
 *   enquanto está só registrada (ex.: `aguardando_envio`), `id` é `null`;
 * - detalhe: o dashboard na raiz ou em `{ dashboard }`; `indicadores` com `id` (ou `"id indicador"`),
 *   `nome`, `"pontos base"`, `ativo` e `problema` (texto ou `{ mensagem }`); `"indicador base da faixa"`
 *   como id ou `{ id, nome }`; `"itens vinculados"` traz os rótulos (ex.: `"100 - Filial 100"`) e vira
 *   `itensVinculados`; `vinculos` traz os códigos que o POST/PUT espera e vira `codigosVinculados`, na
 *   ordem da API, conforme o `"tipo de vinculo"`: filiais `{ filial }` (texto ou número), cargos
 *   `{ cargo }` (texto) e colaboradores `{ "id colaborador" }` ou `{ id }` (texto ou número); números
 *   viram texto. Sem `vinculos` (ausente ou `null`), a lista fica vazia; `vinculos` fora de lista ou com
 *   item sem a chave do tipo vira `ApiError`. SUPOSIÇÃO: só o formato de filiais foi visto na API real;
 *   os de cargos e colaboradores são prováveis e precisam ser confirmados;
 * - prévia: `{ titulo, descricao }` na raiz ou em `{ tarefa }`;
 * - histórico: lista pura ou `{ historico: [...] }`; `"tarefa bitrix"` como objeto (vira o `id`) ou número;
 * - tarefas: lista pura ou `{ tarefas: [...] }`;
 * - vínculos: lista pura ou `{ [tipo]: [...] }` (ex.: `{ filiais: [...] }`); códigos numéricos viram texto;
 * - POST/PUT de cadastro e edição: `{ dashboard, tarefa }` ou o dashboard na raiz com `tarefa` ao lado
 *   (tarefa `{ id | null, status | null, titulo, descricao | null }`);
 * - PUT concluir e situação: `{ dashboard }` ou o dashboard na raiz.
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 * Nas leituras (listagem, detalhe, prévia, histórico, tarefas e vínculos), respostas 2xx fora do
 * formato esperado viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único item inválido rejeita
 * a resposta inteira.
 *
 * Regra "2xx = gravado": nos POSTs e PUTs de cadastro, edição, conclusão e situação, um 2xx já
 * significa que o dashboard foi gravado. A resposta é lida de forma tolerante: dashboard válido na raiz
 * ou dentro de `dashboard` é devolvido convertido; corpo vazio (200/201/204), só `mensagem`, `{ id }`,
 * incompleto, lista ou texto resolve `null` (ou `dashboard: null`), sem erro. A `tarefa` é lida da raiz
 * mesmo sem o dashboard; fora do formato vira `null`. Quem chama deve recarregar a lista para obter o
 * dado atualizado. Erros HTTP (400, 403, 500) continuam sendo `ApiError`.
 *
 * A exclusão resolve sem valor em 204 ou 200.
 */

import {
  PERIODICIDADES,
  SITUACOES_DASHBOARD,
  TIPOS_VINCULO,
  type DadosDashboard,
  type Dashboard,
  type TarefaConstrucao,
  type TipoVinculo,
} from '../types/dominio'
import { type DashboardApi, paraCorpoDashboard, paraDashboard } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, type ValorQuery, apiFetch } from './api'

const ROTA_DASHBOARDS = '/ped/dashboards'
const ROTA_VINCULOS = '/ped/vinculos'

/** Situações aceitas pelo filtro da API, na ordem exibida na tela. */
export const SITUACOES_FILTRO_DASHBOARD = ['todas', 'ativos', 'inativos', 'construcao', 'problemas'] as const

export type SituacaoFiltroDashboard = (typeof SITUACOES_FILTRO_DASHBOARD)[number]

export const ROTULOS_SITUACAO_FILTRO_DASHBOARD: Readonly<Record<SituacaoFiltroDashboard, string>> = {
  todas: 'Todas',
  ativos: 'Ativos',
  inativos: 'Inativos',
  construcao: 'Em construção/modificação (TI)',
  problemas: 'Com problemas',
}

/** Filtros de `listarDashboards`; só os informados entram na query. */
export interface FiltrosDashboards {
  /** Texto livre (dashboard, item vinculado ou indicador); vazio ou só com espaços é omitido. */
  busca?: string
  situacao?: SituacaoFiltroDashboard
}

/** Indicador do detalhe do dashboard, com o peso (pontos base) e o problema atual, se houver. */
export interface IndicadorDetalheDashboard {
  id: number
  nome: string
  pontosBase: number
  ativo: boolean
  /** Motivo do problema (indicador inativo ou com componente desativado); `null` sem problema. */
  problema: string | null
}

/** Período atual do dashboard no detalhe. */
export interface PeriodoDashboard {
  codigo: string
  inicio: string
  fim: string
}

/** Detalhe de `GET /api/ped/dashboards/{id}`: os campos da listagem e os do detalhe. */
export interface DetalheDashboard extends Dashboard {
  /**
   * Códigos dos itens vinculados (chave `vinculos`), na ordem da API: código da filial, nome do cargo
   * ou id do colaborador, sempre em texto. `[]` quando a API não informa. `itensVinculados` mantém os rótulos.
   */
  codigosVinculados: string[]
  pontuacaoBaseMaxima: number
  /** `null` quando a API não informa. */
  indicadorBaseDaFaixa: number | null
  /** `""` quando a API não informa. */
  formulaDePontuacao: string
  observacaoParaTi: string | null
  indicadores: IndicadorDetalheDashboard[]
  periodo: PeriodoDashboard | null
}

/** Prévia da tarefa de construção/modificação (RF-55). */
export interface PreviaTarefa {
  titulo: string
  descricao: string
}

/** Resultado do cadastro e da edição (regra "2xx = gravado"). */
export interface ResultadoGravacaoDashboard {
  /** `null` quando a resposta não traz o dashboard completo. */
  dashboard: Dashboard | null
  /** `null` quando a resposta não traz tarefa ou ela está fora do formato. */
  tarefa: TarefaConstrucao | null
}

/** Linha do histórico de modificações (RF-57). */
export interface HistoricoDashboard {
  /** `cadastro`, `edicao`, `desativado`, `reativado` ou `concluida`. */
  acao: string
  /** `""` quando ausente. */
  acaoDescricao: string
  data: string
  usuario: string
  alteracoes: string[]
  /** Número da tarefa no Bitrix24; `null` quando não há. */
  tarefa: number | null
  observacao: string | null
}

/** Tarefa de construção ou modificação do dashboard (RF-56). Campos ausentes viram `null`, menos o título. */
export interface TarefaDashboard {
  id: number | null
  /** `construcao` ou `modificacao`. */
  tipo: string | null
  status: string | null
  titulo: string
  descricao: string | null
  criadaEm: string | null
}

export interface FilialVinculo {
  codigo: string
  nome: string
}

export interface CargoVinculo {
  cargo: string
  /** Quantidade de colaboradores ativos no cargo (0 quando ausente). */
  colaboradores: number
}

export interface ColaboradorVinculo {
  id: number
  nome: string
  cargo: string | null
  filial: string | null
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
const ehTextoOuNumero = (v: unknown): v is string | number => ehTexto(v) || ehNumero(v)

function ehListaDe(valor: unknown, validar: (v: unknown) => boolean): valor is unknown[] {
  return Array.isArray(valor) && valor.every(validar)
}

/** Número informado direto ou como `{ id }` (indicador base da faixa, tarefa do histórico). */
function ehIdOuReferencia(valor: unknown): boolean {
  return ehNumero(valor) || (ehObjeto(valor) && ehNumero(valor.id))
}

function idOuReferencia(valor: unknown): number | null {
  if (ehNumero(valor)) return valor
  if (ehObjeto(valor) && ehNumero(valor.id)) return valor.id
  return null
}

function textoOuNulo(valor: unknown): string | null {
  return ehTexto(valor) ? valor : null
}

function numeroOuNulo(valor: unknown): number | null {
  return ehNumero(valor) ? valor : null
}

/** Tarefa do Bitrix24: `id` numérico ou `null` (só registrada, ainda não enviada). */
function ehTarefaBitrixApi(valor: unknown): boolean {
  return (
    ehObjeto(valor) &&
    (ehNumero(valor.id) || valor.id === null) &&
    ehTexto(valor.status) &&
    ehTexto(valor.titulo)
  )
}

function ehPontosApi(valor: unknown): boolean {
  return ehObjeto(valor) && ehNumero(valor.soma) && ehNumero(valor.maximo)
}

function ehAlertaApi(valor: unknown): boolean {
  return ehObjeto(valor) && ehTexto(valor.indicador) && ehTexto(valor.motivo) && ehNumero(valor['pontos afetados'])
}

/** Dashboard completo e válido no formato da listagem. Campos opcionais aceitam ausência ou `null`. */
function ehDashboardApi(valor: unknown): valor is DashboardApi {
  if (!ehObjeto(valor)) return false
  return (
    ehNumero(valor.id) &&
    ehTexto(valor.nome) &&
    ehUmDe(SITUACOES_DASHBOARD, valor.situacao) &&
    ehUmDe(TIPOS_VINCULO, valor['tipo de vinculo']) &&
    ehUmDe(PERIODICIDADES, valor.periodicidade) &&
    ehTexto(valor['periodo atual']) &&
    opcional(valor['situacao descricao'], ehTexto) &&
    opcional(valor['tarefa bitrix'], ehTarefaBitrixApi) &&
    opcional(valor['itens vinculados'], (v) => ehListaDe(v, ehTextoOuNumero)) &&
    opcional(valor['unidades de imagem'], ehNumero) &&
    opcional(valor['quantidade de indicadores'], ehNumero) &&
    opcional(valor.pontos, ehPontosApi) &&
    opcional(valor.alertas, (v) => ehListaDe(v, ehAlertaApi)) &&
    opcional(valor['cadastrado em'], ehTexto) &&
    opcional(valor['ultima alteracao'], ehTexto)
  )
}

/** Converte um dashboard das leituras; fora do formato vira `ApiError`. */
function converterDashboard(valor: unknown): Dashboard {
  if (!ehDashboardApi(valor)) throw respostaInvalida()
  return paraDashboard(valor)
}

/** Converte o dashboard se ele estiver completo e válido; caso contrário devolve `null` (uso nas gravações). */
function converterDashboardOuNulo(valor: unknown): Dashboard | null {
  if (!ehDashboardApi(valor)) return null
  return paraDashboard(valor)
}

/** Dashboard gravado: na raiz ou dentro de `dashboard`; sem dashboard reconhecível, `null`. */
function extrairDashboardOuNulo(resposta: unknown): Dashboard | null {
  if (!ehObjeto(resposta)) return null
  return converterDashboardOuNulo(resposta) ?? converterDashboardOuNulo(resposta.dashboard)
}

/** Tarefa da resposta do POST/PUT; ausente ou fora do formato vira `null`, sem erro. */
function converterTarefaOuNula(valor: unknown): TarefaConstrucao | null {
  if (
    !ehObjeto(valor) ||
    !ehTexto(valor.titulo) ||
    !opcional(valor.id, ehNumero) ||
    !opcional(valor.status, ehTexto) ||
    !opcional(valor.descricao, ehTexto)
  ) {
    return null
  }
  return {
    id: numeroOuNulo(valor.id),
    status: textoOuNulo(valor.status),
    titulo: valor.titulo,
    descricao: textoOuNulo(valor.descricao),
  }
}

/** Lista de uma resposta: a própria lista ou a lista dentro de `chave`; fora disso, `ApiError`. */
function extrairLista(resposta: unknown, chave: string): unknown[] {
  const lista: unknown = ehObjeto(resposta) ? resposta[chave] : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista
}

// --- Detalhe ---------------------------------------------------------------

function converterIndicadorDetalhe(valor: unknown): IndicadorDetalheDashboard {
  if (!ehObjeto(valor)) throw respostaInvalida()
  const id = numeroOuNulo(valor.id) ?? numeroOuNulo(valor['id indicador'])
  const { nome, ativo, problema } = valor
  const pontosBase = valor['pontos base']
  if (id === null || !ehTexto(nome) || !ehNumero(pontosBase) || !ehBooleano(ativo)) throw respostaInvalida()

  let motivo: string | null
  if (problema === undefined || problema === null) motivo = null
  else if (ehTexto(problema)) motivo = problema
  else if (ehObjeto(problema) && ehTexto(problema.mensagem)) motivo = problema.mensagem
  else throw respostaInvalida()

  return { id, nome, pontosBase, ativo, problema: motivo }
}

function converterPeriodo(valor: unknown): PeriodoDashboard | null {
  if (valor === undefined || valor === null) return null
  if (!ehObjeto(valor) || !ehTexto(valor.codigo) || !ehTexto(valor.inicio) || !ehTexto(valor.fim)) {
    throw respostaInvalida()
  }
  return { codigo: valor.codigo, inicio: valor.inicio, fim: valor.fim }
}

/** Código de um item de `vinculos` conforme o tipo de vínculo; fora do formato vira `ApiError`. */
function converterCodigoVinculado(tipo: TipoVinculo, valor: unknown): string {
  if (!ehObjeto(valor)) throw respostaInvalida()
  let codigo: unknown
  if (tipo === 'filiais') codigo = ehTextoOuNumero(valor.filial) ? valor.filial : undefined
  else if (tipo === 'cargos') codigo = ehTexto(valor.cargo) ? valor.cargo : undefined
  else codigo = ehTextoOuNumero(valor['id colaborador']) ? valor['id colaborador'] : valor.id
  if (!ehTextoOuNumero(codigo)) throw respostaInvalida()
  return String(codigo)
}

/** Códigos de `vinculos`; ausente ou `null` vira `[]`, fora de lista vira `ApiError`. */
function converterCodigosVinculados(tipo: TipoVinculo, valor: unknown): string[] {
  if (valor === undefined || valor === null) return []
  if (!Array.isArray(valor)) throw respostaInvalida()
  return valor.map((item: unknown) => converterCodigoVinculado(tipo, item))
}

/** Detalhe na raiz ou dentro de `dashboard`; qualquer campo fora do formato vira `ApiError`. */
function converterDetalhe(resposta: unknown): DetalheDashboard {
  const valor: unknown =
    ehObjeto(resposta) && !ehDashboardApi(resposta) && ehObjeto(resposta.dashboard) ? resposta.dashboard : resposta
  if (!ehDashboardApi(valor) || !ehObjeto(valor)) throw respostaInvalida()

  const pontuacaoBaseMaxima = valor['pontuacao base maxima']
  const indicadorBase = valor['indicador base da faixa']
  const formula = valor['formula de pontuacao']
  const observacao = valor['observacao para ti']
  const indicadores: unknown = valor.indicadores
  if (
    !ehNumero(pontuacaoBaseMaxima) ||
    !opcional(indicadorBase, ehIdOuReferencia) ||
    !opcional(formula, ehTexto) ||
    !opcional(observacao, ehTexto) ||
    !Array.isArray(indicadores)
  ) {
    throw respostaInvalida()
  }

  return {
    ...paraDashboard(valor),
    codigosVinculados: converterCodigosVinculados(valor['tipo de vinculo'], valor.vinculos),
    pontuacaoBaseMaxima,
    indicadorBaseDaFaixa: idOuReferencia(indicadorBase),
    formulaDePontuacao: textoOuNulo(formula) ?? '',
    observacaoParaTi: textoOuNulo(observacao),
    indicadores: indicadores.map((item: unknown) => converterIndicadorDetalhe(item)),
    periodo: converterPeriodo(valor.periodo),
  }
}

// --- Prévia, histórico e tarefas -------------------------------------------

function converterPreviaOuNula(valor: unknown): PreviaTarefa | null {
  if (!ehObjeto(valor) || !ehTexto(valor.titulo) || !ehTexto(valor.descricao)) return null
  return { titulo: valor.titulo, descricao: valor.descricao }
}

function converterHistorico(valor: unknown): HistoricoDashboard {
  if (
    !ehObjeto(valor) ||
    !ehTexto(valor.acao) ||
    !ehTexto(valor.data) ||
    !ehTexto(valor.usuario) ||
    !opcional(valor['acao descricao'], ehTexto) ||
    !opcional(valor.alteracoes, (v) => ehListaDe(v, ehTexto)) ||
    !opcional(valor['tarefa bitrix'], ehIdOuReferencia) ||
    !opcional(valor.observacao, ehTexto)
  ) {
    throw respostaInvalida()
  }
  const alteracoes: unknown = valor.alteracoes
  return {
    acao: valor.acao,
    acaoDescricao: textoOuNulo(valor['acao descricao']) ?? '',
    data: valor.data,
    usuario: valor.usuario,
    alteracoes: Array.isArray(alteracoes) ? alteracoes.filter(ehTexto) : [],
    tarefa: idOuReferencia(valor['tarefa bitrix']),
    observacao: textoOuNulo(valor.observacao),
  }
}

function converterTarefaDashboard(valor: unknown): TarefaDashboard {
  if (
    !ehObjeto(valor) ||
    !ehTexto(valor.titulo) ||
    !opcional(valor.id, ehNumero) ||
    !opcional(valor.tipo, ehTexto) ||
    !opcional(valor.status, ehTexto) ||
    !opcional(valor.descricao, ehTexto) ||
    !opcional(valor['criada em'], ehTexto)
  ) {
    throw respostaInvalida()
  }
  return {
    id: numeroOuNulo(valor.id),
    tipo: textoOuNulo(valor.tipo),
    status: textoOuNulo(valor.status),
    titulo: valor.titulo,
    descricao: textoOuNulo(valor.descricao),
    criadaEm: textoOuNulo(valor['criada em']),
  }
}

// --- Vínculos ---------------------------------------------------------------

function converterFilialVinculo(valor: unknown): FilialVinculo {
  if (!ehObjeto(valor)) throw respostaInvalida()
  const codigo = valor.filial
  const nome = valor['nome filial']
  if (!ehTextoOuNumero(codigo) || !ehTexto(nome)) throw respostaInvalida()
  return { codigo: String(codigo), nome }
}

function converterCargoVinculo(valor: unknown): CargoVinculo {
  if (!ehObjeto(valor) || !ehTexto(valor.cargo) || !opcional(valor.colaboradores, ehNumero)) throw respostaInvalida()
  return { cargo: valor.cargo, colaboradores: numeroOuNulo(valor.colaboradores) ?? 0 }
}

function converterColaboradorVinculo(valor: unknown): ColaboradorVinculo {
  if (!ehObjeto(valor)) throw respostaInvalida()
  const id = valor['id colaborador']
  const { nome, cargo, filial } = valor
  if (!ehNumero(id) || !ehTexto(nome) || !opcional(cargo, ehTexto) || !opcional(filial, ehTextoOuNumero)) {
    throw respostaInvalida()
  }
  return {
    id,
    nome,
    cargo: textoOuNulo(cargo),
    filial: ehTextoOuNumero(filial) ? String(filial) : null,
  }
}

async function listarVinculos<T>(
  tipo: TipoVinculo,
  busca: string | undefined,
  converter: (valor: unknown) => T,
): Promise<T[]> {
  const resposta = await apiFetch<unknown>(ROTA_VINCULOS, {
    query: { tipo, busca: busca?.trim() ? busca : undefined },
  })
  return extrairLista(resposta, tipo).map((item) => converter(item))
}

function montarQuery(filtros: FiltrosDashboards): Record<string, ValorQuery> {
  const busca = filtros.busca?.trim() ? filtros.busca : undefined
  const situacao = filtros.situacao === 'todas' ? undefined : filtros.situacao
  return { busca, situacao }
}

/** Resposta de cadastro/edição lida pela regra "2xx = gravado". */
function lerGravacao(resposta: unknown): ResultadoGravacaoDashboard {
  if (!ehObjeto(resposta)) return { dashboard: null, tarefa: null }
  return { dashboard: extrairDashboardOuNulo(resposta), tarefa: converterTarefaOuNula(resposta.tarefa) }
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/**
 * Lista os dashboards, filtrados pela API (RF-47). Nenhum item inválido é ignorado silenciosamente:
 * a resposta inteira é rejeitada.
 */
export async function listarDashboards(filtros: FiltrosDashboards = {}): Promise<Dashboard[]> {
  const resposta = await apiFetch<unknown>(ROTA_DASHBOARDS, { query: montarQuery(filtros) })
  return extrairLista(resposta, 'dashboards').map((item) => converterDashboard(item))
}

/** Detalhe do dashboard, com os pesos dos indicadores, a base da faixa, a fórmula e o período atual. */
export async function obterDashboard(id: number): Promise<DetalheDashboard> {
  const resposta = await apiFetch<unknown>(`${ROTA_DASHBOARDS}/${id}`)
  return converterDetalhe(resposta)
}

/** Prévia da tarefa que seria gerada com os dados informados (RF-55); não grava nada. */
export async function obterPreviaTarefa(dados: DadosDashboard): Promise<PreviaTarefa> {
  const resposta = await apiFetch<unknown>(`${ROTA_DASHBOARDS}/previa-tarefa`, {
    method: 'POST',
    body: paraCorpoDashboard(dados),
  })
  const previa = converterPreviaOuNula(resposta) ?? (ehObjeto(resposta) ? converterPreviaOuNula(resposta.tarefa) : null)
  if (previa === null) throw respostaInvalida()
  return previa
}

/**
 * Cadastra um dashboard (nasce `em_construcao` e gera a tarefa de construção — RF-55). Ver a regra
 * "2xx = gravado" no topo do arquivo.
 */
export async function criarDashboard(dados: DadosDashboard): Promise<ResultadoGravacaoDashboard> {
  const resposta = await apiFetch<unknown>(ROTA_DASHBOARDS, { method: 'POST', body: paraCorpoDashboard(dados) })
  return lerGravacao(resposta)
}

/**
 * Edita um dashboard (RF-56). Com `enviarTarefaTi: true`, a API gera a tarefa de modificação. Ver a
 * regra "2xx = gravado" no topo do arquivo.
 */
export async function atualizarDashboard(id: number, dados: DadosDashboard): Promise<ResultadoGravacaoDashboard> {
  const resposta = await apiFetch<unknown>(`${ROTA_DASHBOARDS}/${id}`, {
    method: 'PUT',
    body: paraCorpoDashboard(dados),
  })
  return lerGravacao(resposta)
}

/** Conclui a construção ou a modificação (Admin). Ver a regra "2xx = gravado" no topo do arquivo. */
export async function concluirDashboard(id: number): Promise<Dashboard | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_DASHBOARDS}/${id}/concluir`, { method: 'PUT' })
  return extrairDashboardOuNulo(resposta)
}

/** Ativa ou desativa um dashboard (Admin — RF-58). Ver a regra "2xx = gravado" no topo do arquivo. */
export async function alterarSituacaoDashboard(id: number, ativo: boolean): Promise<Dashboard | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_DASHBOARDS}/${id}/situacao`, {
    method: 'PUT',
    body: { ativo },
  })
  return extrairDashboardOuNulo(resposta)
}

/** Exclui um dashboard (Admin — RF-59). Resolve sem valor em 204 ou 200. */
export async function excluirDashboard(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_DASHBOARDS}/${id}`, { method: 'DELETE' })
}

/** Histórico de modificações do dashboard (RF-57), na ordem devolvida pela API. */
export async function listarHistoricoDashboard(id: number): Promise<HistoricoDashboard[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_DASHBOARDS}/${id}/historico`)
  return extrairLista(resposta, 'historico').map((item) => converterHistorico(item))
}

/** Tarefas de construção e modificação do dashboard (RF-56), na ordem devolvida pela API. */
export async function listarTarefasDashboard(id: number): Promise<TarefaDashboard[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_DASHBOARDS}/${id}/tarefas`)
  return extrairLista(resposta, 'tarefas').map((item) => converterTarefaDashboard(item))
}

/** Filiais para o vínculo (INT-02). A busca vazia ou só com espaços é omitida. */
export async function listarFiliaisVinculo(busca?: string): Promise<FilialVinculo[]> {
  return listarVinculos('filiais', busca, converterFilialVinculo)
}

/** Cargos para o vínculo, com a quantidade de colaboradores ativos (INT-02). */
export async function listarCargosVinculo(busca?: string): Promise<CargoVinculo[]> {
  return listarVinculos('cargos', busca, converterCargoVinculo)
}

/** Colaboradores ativos para o vínculo (INT-02). */
export async function listarColaboradoresVinculo(busca?: string): Promise<ColaboradorVinculo[]> {
  return listarVinculos('colaboradores', busca, converterColaboradorVinculo)
}
