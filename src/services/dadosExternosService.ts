/**
 * Serviço de dados externos (F5.1).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Cadastro e Preenchimento — fase 3: dados externos":
 * - `GET    /api/ped/dados-externos-cadastro`                    lista filtrada (`busca`, `situacao`)
 * - `GET    /api/ped/dados-externos-cadastro/identificadores`    coletas existentes (Admin e Validador)
 * - `POST   /api/ped/dados-externos-cadastro`                    cadastro (Admin) ou pedido de construção à TI
 * - `PUT    /api/ped/dados-externos-cadastro/{id}/concluir`      `{ identificador }` — Admin
 * - `PUT    /api/ped/dados-externos-cadastro/{id}/situacao`      `{ ativo }` — Admin e Validador
 * - `DELETE /api/ped/dados-externos-cadastro/{id}`               Admin — recusa (400) se compõe indicador
 * - `GET    /api/ped/dados-externos-cadastro/{id}/realizado`     `filial`, `mes_de_referencia` (RN-05)
 *
 * Os formatos das respostas não estão documentados na API; o serviço aceita os dois formatos
 * prováveis em cada rota (ver `src/test/dadosExternosFalsos.ts`):
 * - listagem: `{ "dados externos": [...] }` ou a lista pura; `"tarefa bitrix"` opcional (ausente ou
 *   `null`), no formato `{ id, status, titulo }`. O número da tarefa (`id`) só vem quando ela é enviada
 *   ao Bitrix24; enquanto está só registrada (ex.: `aguardando_envio`), `id` é `null`. A API real manda o
 *   número como texto (ex.: `"328439"`): número ou texto só com dígitos (após `trim()`) é aceito e vira
 *   número; texto não numérico (`"abc"`, `""`, `"31a"`, `"31.5"`, `"-31"`) é inválido (na listagem vira
 *   `ApiError`; no POST deixa a tarefa `null`);
 * - identificadores: lista pura ou `{ identificadores: [...] }`;
 * - POST: `{ "dado externo": {...}, tarefa }` ou o dado na raiz com `tarefa` ao lado (ex.: `{ mensagem, id,
 *   situacao, tarefa }`). A tarefa é criada pelo back-end (Validador e Preenchedor; o Admin não gera
 *   tarefa, `tarefa: null`) e, desde 06/11/2026 (`FRONT-tarefas-bitrix.md`), vem como `{ titulo,
 *   descricao, status, "id bitrix" }`: `enviada` traz o número em `"id bitrix"`, `aguardando_envio` traz
 *   `null`. Com a chave `"id bitrix"` presente, ela prevalece sobre o `id` do formato anterior, mesmo
 *   `null`; sem ela, `id` continua aceito. Como a resposta
 *   do POST não é documentada e um 2xx significa que o dado foi gravado, ela é lida de forma
 *   tolerante: corpo vazio, fora do formato ou incompleto vira `dadoExterno: null` (e tarefa fora do
 *   formato vira `tarefa: null`), sem erro;
 * - concluir: `{ "dado externo": {...}, "indicador criado" }` ou o dado na raiz com `"indicador criado"` ao lado.
 *   Como a resposta não é documentada e um 2xx significa que a conclusão foi gravada, ela é lida de forma
 *   tolerante: dado não reconhecível resolve `null`, sem erro; dado válido com `"indicador criado"`
 *   malformado ou ausente resolve `indicadorCriado: null`, sem erro;
 * - situação: o dado na raiz ou dentro de `"dado externo"`. Como a resposta não é documentada e um 2xx
 *   significa que a situação foi gravada, ela é lida de forma tolerante: dado não reconhecível resolve
 *   `null`, sem erro.
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 * Nas demais rotas (listagem, identificadores e realizado), respostas 2xx fora do formato esperado viram
 * `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único item inválido rejeita a resposta inteira.
 */

import {
  COLETAS,
  type DadoExterno,
  type IdentificadorColeta,
  JANELAS_RETROATIVAS,
  type MesConsiderado,
  type NovoDadoExterno,
  REFERENCIAS,
  type RealizadoDadoExterno,
  type ReferenciaNomeada,
  SENTIDOS_CALCULO,
  SISTEMAS_ORIGEM,
  SITUACOES_DADO_EXTERNO,
  type TarefaConstrucao,
} from '../types/dominio'
import { type DadoExternoApi, numeroDaTarefaBitrix, paraCorpoNovoDadoExterno, paraDadoExterno } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, type ValorQuery, apiFetch } from './api'

const ROTA_DADOS_EXTERNOS = '/ped/dados-externos-cadastro'

/** Situações aceitas pelo filtro da API, na ordem exibida na tela. */
export const SITUACOES_FILTRO_DADO_EXTERNO = ['todas', 'ativos', 'inativos', 'construcao', 'problemas'] as const

export type SituacaoFiltroDadoExterno = (typeof SITUACOES_FILTRO_DADO_EXTERNO)[number]

export const ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO: Readonly<Record<SituacaoFiltroDadoExterno, string>> = {
  todas: 'Todas',
  ativos: 'Ativos',
  inativos: 'Inativos',
  construcao: 'Em construção',
  problemas: 'Com problemas',
}

/** Filtros de `listarDadosExternos`; só os informados entram na query. */
export interface FiltrosDadosExternos {
  /** Texto livre; vazio ou só com espaços é omitido. A API ignora acentos e maiúsculas. */
  busca?: string
  situacao?: SituacaoFiltroDadoExterno
}

/**
 * Resultado de `criarDadoExterno`: o dado gravado (ou `null` quando a resposta não o traz completo)
 * e a tarefa gerada para a TI (ou `null`).
 */
export interface ResultadoCriacaoDadoExterno {
  dadoExterno: DadoExterno | null
  tarefa: TarefaConstrucao | null
}

/** Resultado de `concluirConstrucao`: o dado ativado e o indicador criado automaticamente (ou `null`). */
export interface ResultadoConclusaoDadoExterno {
  dadoExterno: DadoExterno
  indicadorCriado: ReferenciaNomeada | null
}

/** Filtros de `obterRealizado`; só os informados entram na query. */
export interface FiltrosRealizado {
  /** Código da filial (só lido para o Admin). */
  filial?: string
  /** Qualquer data do mês desejado (`aaaa-mm-dd`). Padrão da API: mês atual. */
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

function ehReferenciaNomeada(valor: unknown): valor is ReferenciaNomeada {
  return ehObjeto(valor) && ehNumero(valor.id) && ehTexto(valor.nome)
}

/** Número da tarefa do Bitrix24: número ou texto só com dígitos (ver `numeroDaTarefaBitrix`). */
const ehNumeroDaTarefa = (v: unknown): boolean => numeroDaTarefaBitrix(v) !== undefined

/** Tarefa do Bitrix24: `id` numérico, texto numérico ou `null` (só registrada, ainda não enviada). */
function ehTarefaBitrixApi(valor: unknown): boolean {
  return (
    ehObjeto(valor) &&
    (ehNumeroDaTarefa(valor.id) || valor.id === null) &&
    ehTexto(valor.status) &&
    ehTexto(valor.titulo)
  )
}

function ehDadoExternoApi(valor: unknown): valor is DadoExternoApi {
  if (!ehObjeto(valor)) return false
  return (
    ehNumero(valor.id) &&
    ehTexto(valor.nome) &&
    ehNumero(valor['id tipo']) &&
    ehTexto(valor.tipo) &&
    ehUmDe(SITUACOES_DADO_EXTERNO, valor.situacao) &&
    ehUmDe(SISTEMAS_ORIGEM, valor['sistema de origem']) &&
    ehUmDe(REFERENCIAS, valor.referencia) &&
    ehUmDe(COLETAS, valor.coleta) &&
    ehUmDe(SENTIDOS_CALCULO, valor['sentido do calculo']) &&
    ehTexto(valor['tipo de valor']) &&
    opcional(valor['situacao descricao'], ehTexto) &&
    opcional(valor['tarefa bitrix'], ehTarefaBitrixApi) &&
    opcional(valor.identificador, ehTexto) &&
    opcional(valor['campo calculo'], ehTexto) &&
    opcional(valor['dia da coleta'], ehNumero) &&
    opcional(valor['coleta descricao'], ehTexto) &&
    opcional(valor['janela retroativa'], (v) => ehUmDe(JANELAS_RETROATIVAS, v)) &&
    opcional(valor.comentarios, ehTexto) &&
    opcional(valor['coleta disponivel'], (v) => typeof v === 'boolean') &&
    opcional(valor.indicadores, (v) => Array.isArray(v) && v.every(ehTexto))
  )
}

/** Converte um dado externo da resposta; fora do formato (inclusive tipo de valor desconhecido) vira `ApiError`. */
function converterDadoExterno(resposta: unknown): DadoExterno {
  if (!ehDadoExternoApi(resposta)) throw respostaInvalida()
  try {
    return paraDadoExterno(resposta)
  } catch {
    throw respostaInvalida()
  }
}

/** Converte um dado externo completo e válido; caso contrário devolve `null` (uso nas respostas tolerantes). */
function converterDadoExternoOuNulo(valor: unknown): DadoExterno | null {
  if (!ehDadoExternoApi(valor)) return null
  try {
    return paraDadoExterno(valor)
  } catch {
    return null
  }
}

/** Número informado na tarefa do POST/PUT: `"id bitrix"` quando a chave existe (mesmo `null`); senão, `id`. */
function numeroInformadoDaTarefa(valor: Record<string, unknown>): unknown {
  return 'id bitrix' in valor ? valor['id bitrix'] : valor.id
}

/**
 * Converte a tarefa da resposta do POST; ausente ou fora do formato vira `null`, sem erro.
 * O número vem de `"id bitrix"` (formato de 06/11/2026); quando a chave está presente ela prevalece,
 * mesmo `null` (tarefa na fila, `aguardando_envio`). Sem `"id bitrix"`, vale o `id` do formato anterior.
 */
function converterTarefaOuNula(valor: unknown): TarefaConstrucao | null {
  if (
    !ehObjeto(valor) ||
    !ehTexto(valor.titulo) ||
    !opcional(numeroInformadoDaTarefa(valor), ehNumeroDaTarefa) ||
    !opcional(valor.status, ehTexto) ||
    !opcional(valor.descricao, ehTexto)
  ) {
    return null
  }
  return {
    id: numeroDaTarefaBitrix(numeroInformadoDaTarefa(valor)) ?? null,
    status: ehTexto(valor.status) ? valor.status : null,
    titulo: valor.titulo,
    descricao: ehTexto(valor.descricao) ? valor.descricao : null,
  }
}

/** Indicador criado na conclusão; ausente ou fora do formato vira `null`, sem erro. */
function converterIndicadorCriadoOuNulo(valor: unknown): ReferenciaNomeada | null {
  if (!ehReferenciaNomeada(valor)) return null
  return { id: valor.id, nome: valor.nome }
}

function converterIdentificador(valor: unknown): IdentificadorColeta {
  if (!ehObjeto(valor) || !ehTexto(valor.identificador) || !ehNumero(valor.quantidade)) throw respostaInvalida()
  return { identificador: valor.identificador, quantidade: valor.quantidade }
}

function converterMes(valor: unknown): MesConsiderado {
  if (!ehObjeto(valor) || !ehTexto(valor.mes) || !ehNumero(valor.valor)) throw respostaInvalida()
  return { mes: valor.mes, valor: valor.valor }
}

function converterRealizado(resposta: unknown): RealizadoDadoExterno {
  if (!ehObjeto(resposta)) throw respostaInvalida()
  const valor = resposta.valor
  const meses = resposta['meses considerados']
  const janela = resposta['janela retroativa']
  const sentido = resposta['sentido do calculo']
  const coletaDisponivel = resposta['coleta disponivel']
  if (
    !opcional(valor, ehNumero) ||
    !opcional(meses, Array.isArray) ||
    !opcional(janela, (v) => ehUmDe(JANELAS_RETROATIVAS, v)) ||
    !ehUmDe(SENTIDOS_CALCULO, sentido) ||
    !opcional(coletaDisponivel, (v) => typeof v === 'boolean')
  ) {
    throw respostaInvalida()
  }
  return {
    valor: ehNumero(valor) ? valor : null,
    mesesConsiderados: Array.isArray(meses) ? meses.map(converterMes) : [],
    janelaRetroativa: ehUmDe(JANELAS_RETROATIVAS, janela) ? janela : null,
    sentidoCalculo: sentido,
    coletaDisponivel: coletaDisponivel === true,
  }
}

function montarQuery(filtros: FiltrosDadosExternos): Record<string, ValorQuery> {
  const busca = filtros.busca?.trim() ? filtros.busca : undefined
  return { busca, situacao: filtros.situacao }
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/** Lista os dados externos dos tipos do usuário, filtrados pela API, na ordem devolvida. */
export async function listarDadosExternos(filtros: FiltrosDadosExternos = {}): Promise<DadoExterno[]> {
  const resposta = await apiFetch<unknown>(ROTA_DADOS_EXTERNOS, { query: montarQuery(filtros) })
  const lista: unknown = ehObjeto(resposta) ? resposta['dados externos'] : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista.map(converterDadoExterno)
}

/** Coletas existentes que um identificador pode apontar (Admin e Validador). */
export async function listarIdentificadores(): Promise<IdentificadorColeta[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/identificadores`)
  const lista: unknown = ehObjeto(resposta) ? resposta.identificadores : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista.map(converterIdentificador)
}

/**
 * Cadastra um dado externo. Admin: nasce ativo, sem tarefa. Validador e Preenchedor: nasce em
 * construção e a API devolve a tarefa gerada para a TI.
 *
 * A resposta do POST não é documentada na API, e um 2xx significa que o dado foi gravado.
 * Por isso a resposta não é validada de forma estrita:
 * - dado válido na raiz ou em `"dado externo"`: devolvido convertido;
 * - corpo vazio (201/204) ou sem dado reconhecível (só `mensagem`, `{ id }`, incompleto, tipo de
 *   valor desconhecido, lista, texto): `dadoExterno: null`, sem erro. Quem chama deve recarregar a
 *   lista para obter o dado criado;
 * - `tarefa` é lida da raiz mesmo sem o dado; fora do formato vira `null`, sem erro.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração.
 */
export async function criarDadoExterno(dados: NovoDadoExterno): Promise<ResultadoCriacaoDadoExterno> {
  const resposta = await apiFetch<unknown>(ROTA_DADOS_EXTERNOS, {
    method: 'POST',
    body: paraCorpoNovoDadoExterno(dados),
  })
  if (!ehObjeto(resposta)) return { dadoExterno: null, tarefa: null }
  return {
    dadoExterno: converterDadoExternoOuNulo(resposta) ?? converterDadoExternoOuNulo(resposta['dado externo']),
    tarefa: converterTarefaOuNula(resposta.tarefa),
  }
}

/**
 * Conclui a construção (Admin): grava o identificador (maiúsculas, sem espaços nas pontas) e ativa o dado.
 *
 * A resposta não é documentada, e um 2xx significa que a conclusão foi gravada. Por isso não é validada
 * de forma estrita:
 * - dado válido na raiz ou em `"dado externo"`: devolve o dado e o indicador criado (ou
 *   `indicadorCriado: null` quando ausente ou malformado);
 * - dado não reconhecível (corpo vazio, 204, só `mensagem`, `{ id }`, incompleto, tipo de valor
 *   desconhecido, lista ou texto): devolve `null`, sem erro. Quem chama deve recarregar a lista.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração.
 */
export async function concluirConstrucao(
  id: number,
  identificador: string,
): Promise<ResultadoConclusaoDadoExterno | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}/concluir`, {
    method: 'PUT',
    body: { identificador: identificador.trim().toUpperCase() },
  })
  if (!ehObjeto(resposta)) return null
  const dadoExterno = converterDadoExternoOuNulo(resposta) ?? converterDadoExternoOuNulo(resposta['dado externo'])
  if (dadoExterno === null) return null
  return {
    dadoExterno,
    indicadorCriado: converterIndicadorCriadoOuNulo(resposta['indicador criado']),
  }
}

/**
 * Ativa ou desativa um dado externo; devolve o dado atualizado (com quem alterou e quando).
 *
 * A resposta não é documentada, e um 2xx significa que a situação foi gravada. Por isso não é validada
 * de forma estrita: dado válido na raiz ou em `"dado externo"` é devolvido convertido; qualquer outro 2xx
 * (corpo vazio, 204, só `mensagem`, `{ id }`, incompleto, tipo de valor desconhecido, lista ou texto)
 * resolve `null`, sem erro. Quem chama deve recarregar a lista para obter a situação gravada.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração.
 */
export async function alterarSituacaoDadoExterno(id: number, ativo: boolean): Promise<DadoExterno | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}/situacao`, {
    method: 'PUT',
    body: { ativo },
  })
  if (!ehObjeto(resposta)) return null
  return converterDadoExternoOuNulo(resposta) ?? converterDadoExternoOuNulo(resposta['dado externo'])
}

/**
 * Exclui um dado externo. Resolve sem valor em 204 ou 200. Quando ele compõe (ou já compôs)
 * indicadores, a API responde 400 e a `ApiError` traz `dados.indicadores`.
 */
export async function excluirDadoExterno(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}`, { method: 'DELETE' })
}

/** Realizado do dado externo na filial e mês informados (RN-05). */
export async function obterRealizado(id: number, filtros: FiltrosRealizado = {}): Promise<RealizadoDadoExterno> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}/realizado`, {
    query: { filial: filtros.filial, mes_de_referencia: filtros.mesDeReferencia },
  })
  return converterRealizado(resposta)
}
