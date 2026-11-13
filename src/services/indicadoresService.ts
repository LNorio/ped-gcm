/**
 * Serviço de indicadores (F6.1).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Cadastro e Preenchimento — indicadores":
 * - `GET    /api/ped/indicadores-cadastro`                       lista filtrada (`busca`, `situacao`) e alertas
 * - `POST   /api/ped/indicadores-cadastro`                       cadastro (`paraCorpoNovoIndicador`)
 * - `PUT    /api/ped/indicadores-cadastro/{id}/meta`             `{ meta, sentido, "meta editavel" }` (RF-36) ou,
 *                                                                 com meta por filial, `"metas por filial"` no lugar de `meta` (F6.10)
 * - `PUT    /api/ped/indicadores-cadastro/{id}/situacao`         `{ ativo }` — Admin e Validador (RF-38)
 * - `DELETE /api/ped/indicadores-cadastro/{id}`                  Admin — recusa (400) se já esteve vinculado a dashboard (RN-11, RF-37)
 * - `GET    /api/ped/indicadores-cadastro/{id}/metas-historico`  `filial` (RF-39) e `mes_de_referencia` (F9.1, RF-74)
 * - `PUT    /api/ped/indicadores-cadastro/{id}/metas-filiais`    `{ "metas por filial": [...] }` — define a meta das
 *                                                                 filiais pendentes (F6.12, `API (26).md`)
 * - `PUT    /api/ped/indicadores-cadastro/{id}/integracao`       Admin — integração da meta via API (F6.11, proposta);
 *                                                                 mesmo corpo da integração do dado externo
 *
 * Os formatos das respostas seguem o adotado para a F6 (ver `src/test/indicadoresFalsos.ts` e as
 * dúvidas em `docs/plano-implementacao.md`):
 * - listagem: `{ indicadores: [...], alertas: { "aguardando meta", "com componente desativado",
 *   "meta pendente por filial" } }`. Lista pura ou objeto sem `indicadores` é resposta inválida;
 *   alertas ausentes viram zeros;
 * - meta por filial (F6.10, contrato real em `docs/backend/FRONT-meta-por-filial.md` e `API (26).md`):
 *   cada indicador pode trazer `"metas por filial"`, `"filiais sem meta"` e `"meta por filial"`
 *   (booleano); listas ausentes ou `null` viram `[]`, sem erro; `"meta por filial"` ausente/`null` é
 *   derivado de `"metas por filial"` não vazia e, fora do formato, rejeita a resposta. O 400 da meta por
 *   filial traz `erros: [{ filial, mensagem }]`, lidos por `errosPorFilial`;
 * - meta via API (F6.11, contrato PROPOSTO na seção 5 do mesmo documento): `"origem da meta": "terceiro"`
 *   no cadastro e no `PUT .../meta` (sem `meta` nem `"metas por filial"`, `"meta editavel": false`); na
 *   listagem, `identificador`, `url`, `parametros de saida/entrada`, `variaveis usadas`,
 *   `integracao pendente` e `integracao alterada em/por` (ausentes viram `null`/`[]`/`false`; fora do
 *   formato rejeitam a resposta) e o alerta opcional `"integracao pendente"`;
 * - executor das integrações (F6.11, fase 2 — `docs/backend/FRONT-meta-via-api-fase2.md`): na listagem
 *   (Admin, fonte `integracao`), `"ultima consulta em"` e `"erro da ultima consulta"` (texto ou `null`,
 *   opcionais) e `"tipo de servico"` (`soap`/`rest`/`null`, opcional, aceito mas não usado nem enviado);
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
  FONTES_META,
  ORIGENS_META,
  SENTIDOS,
  SITUACOES_META_VIA_API,
  TIPOS_COMPOSICAO,
  type DashboardDoIndicador,
  type FonteMeta,
  type HistoricoMeta,
  type Indicador,
  type IntegracaoDadoExterno,
  type MetaDaFilial,
  type NovoIndicador,
  type OrigemMeta,
  type Sentido,
} from '../types/dominio'
import {
  type DashboardDoIndicadorApi,
  type HistoricoMetaApi,
  type IndicadorApi,
  paraCorpoMetasPorFilial,
  paraCorpoNovoIndicador,
  paraHistoricoMeta,
  paraIndicador,
  paraTarefaDoIndicador,
  numeroDaTarefaBitrix,
  type TarefaIndicadorApi,
  TIPOS_SERVICO_INTEGRACAO_API,
} from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, type ValorQuery, apiFetch } from './api'
import { corpoIntegracao } from './dadosExternosService'
import { mesParaQuery } from './preenchimentoService'

const ROTA_INDICADORES = '/ped/indicadores-cadastro'

/** Situações aceitas pelo filtro da API, na ordem exibida na tela. */
export const SITUACOES_FILTRO_INDICADOR = ['todas', 'ativos', 'inativos', 'meta', 'meta_filial_pendente', 'problemas'] as const

/**
 * Situações do filtro para o Admin (F6.11, contrato final): as padrão e, por último,
 * `integracao_pendente` (fonte `integracao` sem integração salva).
 */
export const SITUACOES_FILTRO_INDICADOR_ADMIN = [...SITUACOES_FILTRO_INDICADOR, 'integracao_pendente'] as const

export type SituacaoFiltroIndicador = (typeof SITUACOES_FILTRO_INDICADOR_ADMIN)[number]

type SituacaoFiltroIndicadorPadrao = (typeof SITUACOES_FILTRO_INDICADOR)[number]

export const ROTULOS_SITUACAO_FILTRO_INDICADOR: Readonly<Record<SituacaoFiltroIndicadorPadrao, string>> = {
  todas: 'Todas',
  ativos: 'Ativos',
  inativos: 'Inativos',
  meta: 'Aguardando meta',
  meta_filial_pendente: 'Meta pendente por filial',
  problemas: 'Com problemas',
}

export const ROTULOS_SITUACAO_FILTRO_INDICADOR_ADMIN: Readonly<Record<SituacaoFiltroIndicador, string>> = {
  ...ROTULOS_SITUACAO_FILTRO_INDICADOR,
  integracao_pendente: 'Integração pendente (TI)',
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
  /** Indicadores ativos com ao menos uma filial sem meta (F6.10); 0 quando a API não informa. */
  metaPendentePorFilial: number
  /**
   * Indicadores com a integração da meta via API pendente (F6.11, opcional): `undefined` quando a API
   * não informa (a tela trata como 0).
   */
  integracaoPendente?: number
}

/**
 * Erro do 400 da meta por filial (F6.10): `filial` é o código da filial (texto) ou `null` quando o erro
 * não é de uma filial específica.
 */
export interface ErroDeFilial {
  filial: string | null
  mensagem: string
}

/**
 * Resultado de `definirMetasPendentes` (F6.12): filiais gravadas e as que continuam sem meta
 * (`null` quando a API não informa ou manda fora do formato).
 */
export interface ResultadoMetasPendentes {
  filiaisDefinidas: string[]
  filiaisSemMeta: string[] | null
}

/**
 * Disponibilidade da meta via API por fonte (F6.11, topo `"meta via api"` da listagem); `null` quando a
 * API não informa a fonte.
 */
export interface MetaViaApiDisponivel {
  dadoExterno: boolean | null
  integracao: boolean | null
}

export interface ResultadoListagemIndicadores {
  indicadores: Indicador[]
  alertas: AlertasIndicadores
  /** `undefined` quando a API não traz `"meta via api"` (ou traz `null`). */
  metaViaApi?: MetaViaApiDisponivel
}

/**
 * Dados de `definirMeta` (RF-36). Informe exatamente um entre `meta` (meta única, replicada para todas
 * as filiais) e `metasPorFilial` (F6.10: só as filiais com meta). Os valores são números
 * (ex.: 12,5 do formulário → 12.5). Com `origemDaMeta: 'terceiro'` (F6.11, meta via API) a meta não é
 * enviada e `"meta editavel"` vai sempre `false`.
 */
export interface DadosMeta {
  /** F6.11: `'terceiro'` = meta buscada via API; ausente = meta manual. */
  origemDaMeta?: OrigemMeta
  /** F6.11 (contrato final): só vale com `origemDaMeta: 'terceiro'` (ausente → `integracao`). */
  fonteDaMeta?: FonteMeta
  meta?: number
  metasPorFilial?: MetaDaFilial[]
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
  /**
   * F9.1 (RF-74): mês do ajuste, `AAAA-MM` ou `AAAA-MM-DD`, enviado como `mes_de_referencia=AAAA-MM`.
   * Ausente ou vazio não entra na query; fora do formato rejeita com `ApiError(400, MENSAGEM_MES_INVALIDO)`.
   */
  mesDeReferencia?: string
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

const ehCodigoFilial = (v: unknown): v is string | number => ehTexto(v) || ehNumero(v)

/** Tarefa do Bitrix do indicador (F6.11): `titulo` e `status` em texto, `"id bitrix"` nulo, número ou dígitos. */
function ehTarefaIndicadorApi(valor: unknown): valor is TarefaIndicadorApi {
  if (!ehObjeto(valor)) return false
  const id = valor['id bitrix']
  return (
    ehTexto(valor.titulo) &&
    ehTexto(valor.status) &&
    (id === undefined || id === null || numeroDaTarefaBitrix(id) !== undefined)
  )
}

function ehIntegracaoDoDadoExternoApi(valor: unknown): boolean {
  return ehObjeto(valor) && opcional(valor.identificador, ehTexto) && opcional(valor.url, ehTexto)
}

function ehMetaPorFilialApi(valor: unknown): boolean {
  return ehObjeto(valor) && ehCodigoFilial(valor.filial) && opcional(valor['nome filial'], ehTexto) && opcional(valor.meta, ehNumero)
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
    opcional(valor['metas por filial'], (v) => Array.isArray(v) && v.every(ehMetaPorFilialApi)) &&
    opcional(valor['meta por filial'], ehBooleano) &&
    opcional(valor['filiais sem meta'], (v) => Array.isArray(v) && v.every(ehCodigoFilial)) &&
    opcional(valor.identificador, ehTexto) &&
    opcional(valor.url, ehTexto) &&
    opcional(valor['variaveis usadas'], (v) => Array.isArray(v) && v.every(ehTexto)) &&
    opcional(valor['integracao pendente'], ehBooleano) &&
    opcional(valor['integracao alterada em'], ehTexto) &&
    opcional(valor['integracao alterada por'], ehTexto) &&
    opcional(valor['fonte da meta'], (v) => ehUmDe(FONTES_META, v)) &&
    opcional(valor['situacao da meta via api'], (v) => ehUmDe(SITUACOES_META_VIA_API, v)) &&
    opcional(valor.tarefa, ehTarefaIndicadorApi) &&
    opcional(valor['integracao do dado externo'], ehIntegracaoDoDadoExternoApi) &&
    opcional(valor['ultima consulta em'], ehTexto) &&
    opcional(valor['erro da ultima consulta'], ehTexto) &&
    opcional(valor['tipo de servico'], (v) => ehUmDe(TIPOS_SERVICO_INTEGRACAO_API, v)) &&
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
  if (valor === undefined || valor === null) return { aguardandoMeta: 0, comComponenteDesativado: 0, metaPendentePorFilial: 0 }
  if (!ehObjeto(valor)) throw respostaInvalida()
  const aguardandoMeta = valor['aguardando meta'] ?? 0
  const comComponenteDesativado = valor['com componente desativado'] ?? 0
  const metaPendentePorFilial = valor['meta pendente por filial'] ?? 0
  if (!ehNumero(aguardandoMeta) || !ehNumero(comComponenteDesativado) || !ehNumero(metaPendentePorFilial)) {
    throw respostaInvalida()
  }
  const integracaoPendente = valor['integracao pendente']
  if (integracaoPendente === undefined || integracaoPendente === null) {
    return { aguardandoMeta, comComponenteDesativado, metaPendentePorFilial }
  }
  if (!ehNumero(integracaoPendente)) throw respostaInvalida()
  return { aguardandoMeta, comComponenteDesativado, metaPendentePorFilial, integracaoPendente }
}

/** Topo `"meta via api"` (F6.11): ausente/`null` → `undefined`; fonte ausente → `null`; fora do formato rejeita. */
function converterMetaViaApi(valor: unknown): MetaViaApiDisponivel | undefined {
  if (valor === undefined || valor === null) return undefined
  if (!ehObjeto(valor)) throw respostaInvalida()
  const dadoExterno = valor['dado externo'] ?? null
  const integracao = valor.integracao ?? null
  if (!opcional(dadoExterno, ehBooleano) || !opcional(integracao, ehBooleano)) throw respostaInvalida()
  return { dadoExterno: dadoExterno as boolean | null, integracao: integracao as boolean | null }
}

/**
 * Tarefa do Bitrix do indicador gravado (F6.11): `tarefa` dentro do indicador ou na raiz da resposta
 * (`{ indicador, tarefa }`); ausente ou fora do formato → `null`, sem erro.
 */
function extrairTarefaDoCadastro(resposta: unknown): Indicador['tarefaBitrix'] {
  if (!ehObjeto(resposta)) return null
  const candidatos = [ehObjeto(resposta.indicador) ? resposta.indicador.tarefa : undefined, resposta.tarefa]
  const tarefa = candidatos.find(ehTarefaIndicadorApi)
  return tarefa ? paraTarefaDoIndicador(tarefa) : null
}

/**
 * Resposta do POST sem a `tarefa` fora do formato (na raiz ou dentro de `indicador`), para que ela não
 * impeça a leitura do indicador gravado (regra "2xx = gravado").
 */
function semTarefaInvalida(resposta: unknown): unknown {
  if (!ehObjeto(resposta)) return resposta
  const limpar = (objeto: Record<string, unknown>) => {
    if (objeto.tarefa === undefined || objeto.tarefa === null || ehTarefaIndicadorApi(objeto.tarefa)) return objeto
    const copia = { ...objeto }
    delete copia.tarefa
    return copia
  }
  const raiz = limpar(resposta)
  return ehObjeto(raiz.indicador) ? { ...raiz, indicador: limpar(raiz.indicador) } : raiz
}

/**
 * Corpo de `PUT .../{id}/meta`: `meta` ou `"metas por filial"` (F6.10), nunca os dois. Com a meta via
 * API (F6.11): exatamente `{ "origem da meta": "terceiro", sentido, "meta editavel": false }`.
 */
function paraCorpoDefinirMeta(dados: DadosMeta): Record<string, unknown> {
  if (dados.origemDaMeta === 'terceiro') {
    return {
      'origem da meta': 'terceiro',
      'fonte da meta': dados.fonteDaMeta ?? 'integracao',
      sentido: dados.sentido,
      'meta editavel': false,
    }
  }
  const corpo: Record<string, unknown> = { sentido: dados.sentido, 'meta editavel': dados.metaEditavel }
  if (dados.metasPorFilial !== undefined) {
    corpo['metas por filial'] = paraCorpoMetasPorFilial(dados.metasPorFilial)
  } else if (dados.meta !== undefined) {
    corpo.meta = dados.meta
  }
  return corpo
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

/** Lista de códigos de filial (texto ou número → texto); fora do formato devolve `null`. */
function listaDeCodigosOuNulo(valor: unknown): string[] | null {
  if (!Array.isArray(valor) || !valor.every(ehCodigoFilial)) return null
  return valor.map((codigo: string | number) => String(codigo))
}

function erroDeFilialOuNulo(item: unknown): ErroDeFilial | null {
  if (!ehObjeto(item) || !ehTexto(item.mensagem)) return null
  return { filial: ehCodigoFilial(item.filial) ? String(item.filial) : null, mensagem: item.mensagem }
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
  const indicadores = lista.map((item) => converterIndicador(item))
  const alertas = converterAlertas(resposta.alertas)
  const metaViaApi = converterMetaViaApi(resposta['meta via api'])
  return metaViaApi === undefined ? { indicadores, alertas } : { indicadores, alertas, metaViaApi }
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
  const indicador = extrairIndicadorOuNulo(semTarefaInvalida(resposta))
  // F6.11: a tarefa do Bitrix pode vir dentro do indicador ou na raiz da resposta.
  if (indicador === null || indicador.origemDaMeta !== 'terceiro') return indicador
  return { ...indicador, tarefaBitrix: extrairTarefaDoCadastro(resposta) }
}

/**
 * Define a meta (única ou por filial — F6.10), o sentido e se a meta é editável no preenchimento (RF-36).
 */
export async function definirMeta(id: number, dados: DadosMeta): Promise<Indicador | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}/meta`, {
    method: 'PUT',
    body: paraCorpoDefinirMeta(dados),
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
  const mes = filtros.mesDeReferencia?.trim() ? mesParaQuery(filtros.mesDeReferencia) : undefined
  const resposta = await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}/metas-historico`, {
    query: { filial, mes_de_referencia: mes },
  })
  const lista: unknown = ehObjeto(resposta) ? resposta.historico : resposta
  if (!Array.isArray(lista) || !lista.every(ehHistoricoMetaApi)) throw respostaInvalida()
  return lista.map((item) => paraHistoricoMeta(item))
}

/**
 * Erros por filial do 400 da meta por filial (F6.10): `{ mensagem, erros: [{ filial, mensagem }] }`,
 * na ordem devolvida. Código numérico vira texto; `filial` ausente ou fora do formato vira `null`; itens
 * sem `mensagem` em texto são ignorados. Falha que não é `ApiError`, sem `dados` ou sem a lista `erros`
 * devolve `[]`.
 */
export function errosPorFilial(falha: unknown): ErroDeFilial[] {
  if (!(falha instanceof ApiError) || !ehObjeto(falha.dados) || !Array.isArray(falha.dados.erros)) return []
  const erros: unknown[] = falha.dados.erros
  return erros.map(erroDeFilialOuNulo).filter((erro): erro is ErroDeFilial => erro !== null)
}

/**
 * Define a meta das filiais pendentes de um indicador com meta por filial (F6.12): `PUT
 * .../{id}/metas-filiais` com exatamente `{ "metas por filial": [{ filial, meta }] }`, na ordem recebida
 * (meta como número JSON). Regra "2xx = gravado": devolve `"filiais definidas"` e `"filiais sem meta"`
 * (códigos em texto); ausentes ou fora do formato viram `[]` e `null`, sem erro. Erros HTTP (400 com
 * `erros` por filial — ver `errosPorFilial` —, 403, 404) são propagados como `ApiError`.
 */
export async function definirMetasPendentes(id: number, metas: readonly MetaDaFilial[]): Promise<ResultadoMetasPendentes> {
  const resposta = await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}/metas-filiais`, {
    method: 'PUT',
    body: { 'metas por filial': paraCorpoMetasPorFilial(metas) },
  })
  if (!ehObjeto(resposta)) return { filiaisDefinidas: [], filiaisSemMeta: null }
  return {
    filiaisDefinidas: listaDeCodigosOuNulo(resposta['filiais definidas']) ?? [],
    filiaisSemMeta: listaDeCodigosOuNulo(resposta['filiais sem meta']),
  }
}

/**
 * Grava a integração da meta via API do indicador (F6.11; só Admin): `PUT .../{id}/integracao` com
 * os quatro campos do dado externo (`corpoIntegracao`: identificador em maiúsculas e sem espaços nas pontas,
 * url sem espaços nas pontas, JSONs como digitados). Desde 11/11/2026 (saída sem mapeamento —
 * `RESPOSTA-FRONT-saida-sem-mapeamento.md`) não vão `"campo da filial"`, `"campo da meta"` nem
 * `"campo da competencia"`. Qualquer 2xx significa gravado e resolve sem valor (a resposta não é lida);
 * quem chama recarrega a lista. Erros HTTP e de rede são propagados como `ApiError` — o 400 traz
 * `dados.erros`, lidos por `errosDaIntegracao`.
 */
export async function atualizarIntegracaoIndicador(id: number, integracao: IntegracaoDadoExterno): Promise<void> {
  await apiFetch<unknown>(`${ROTA_INDICADORES}/${id}/integracao`, {
    method: 'PUT',
    body: corpoIntegracao(integracao),
  })
}
