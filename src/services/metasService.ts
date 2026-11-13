/**
 * Serviço das metas no preenchimento — janela "Editar metas" (F9.1 — RF-71 a RF-74).
 *
 * Rotas de `docs/backend/API (28).md`, seção "Metas no preenchimento (RF-71 a RF-74)":
 * - `GET /api/ped/metas?filial=&mes_de_referencia=AAAA-MM&tipo=`  indicadores ativos, com meta editável
 *                                                                 e meta cadastrada para a filial
 * - `PUT /api/ped/metas`                                          ajuste da meta só para a filial e o mês
 *                                                                 (tudo ou nada)
 * O histórico de ajustes usa `listarHistoricoMetas` (`indicadoresService`) com `mesDeReferencia`.
 *
 * Filial e mês seguem as regras do preenchimento (validação local em `preenchimentoService`:
 * `MENSAGEM_FILIAL_OBRIGATORIA` e `MENSAGEM_MES_INVALIDO`).
 *
 * Leitura (formato assumido: `{ "situacao do mes", editavel, indicadores }`): `editavel` ausente segue
 * a situação do mês; metas em número ou texto decimal canônico (`"2000.25"`; pt-BR é inválido); `tipos`
 * em nomes ou `{ id, nome }` (vira o nome); `composicao`, `sentido` e `"meta do cadastro origem"`
 * desconhecidos viram `null`, sem rejeitar a lista. Respostas 2xx fora do formato viram
 * `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único indicador inválido rejeita a resposta inteira.
 *
 * Regra "2xx = gravado" no `PUT`: qualquer 2xx resolve; `ajustadas` ausente ou inválida vira `0` e a
 * mensagem, `null`. Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`); os erros por item são
 * lidos por `errosDoAjusteMetas`.
 */

import {
  type AjusteMetas,
  type ComponenteIndicador,
  type ComposicaoIndicador,
  type IndicadorMetaPreenchimento,
  type JanelaMetas,
  ORIGENS_META_DO_CADASTRO,
  SENTIDOS,
  type SituacaoMesConsultado,
  TIPOS_COMPOSICAO,
} from '../types/dominio'
import { paraCorpoAjusteMetas } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'
import { filialDoPreenchimento, mesParaCorpo, mesParaQuery } from './preenchimentoService'

const ROTA_METAS = '/ped/metas'

/** Filtros de `listarMetasPreenchimento`; sem mês, a API usa o mês aberto. */
export interface FiltrosMetasPreenchimento {
  filial: string
  /** `AAAA-MM` ou `AAAA-MM-DD`. */
  mesDeReferencia?: string
  /** Id do tipo de apontamento. */
  tipo?: number
}

/** Resultado do `PUT /api/ped/metas`. */
export interface ResultadoAjusteMetas {
  mensagem: string | null
  ajustadas: number
}

/** Erro de um item do ajuste recusado; `idIndicador` `null` quando o erro não é de um indicador. */
export interface ErroDeIndicador {
  idIndicador: number | null
  mensagem: string
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

/** Campo opcional: ausente, `null` ou do tipo esperado. */
function opcional(valor: unknown, validar: (v: unknown) => boolean): boolean {
  return valor === undefined || valor === null || validar(valor)
}

const ehTexto = (v: unknown): v is string => typeof v === 'string'
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const ehBooleano = (v: unknown): v is boolean => typeof v === 'boolean'

function ehUmDe<T extends string>(valores: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (valores as readonly string[]).includes(valor)
}

/** Texto decimal canônico (ponto como separador decimal, sem milhar): "2000.25", "1500". */
const DECIMAL_CANONICO = /^-?\d+(\.\d+)?$/

/** Meta da API: ausente/`null` → `null`; número ou texto decimal canônico → número; senão inválida. */
function meta(valor: unknown): number | null {
  if (valor === undefined || valor === null) return null
  if (ehNumero(valor)) return valor
  if (ehTexto(valor) && DECIMAL_CANONICO.test(valor.trim())) return Number(valor.trim())
  throw respostaInvalida()
}

/** Id em número ou texto só com dígitos; senão `null`. */
function idOuNulo(valor: unknown): number | null {
  if (ehNumero(valor)) return valor
  if (ehTexto(valor) && /^\d+$/.test(valor.trim())) return Number(valor.trim())
  return null
}

function nomeDoTipo(item: unknown): string | null {
  if (ehTexto(item)) return item
  if (ehObjeto(item) && ehTexto(item.nome)) return item.nome
  return null
}

function componenteOuNulo(item: unknown): ComponenteIndicador | null {
  if (!ehObjeto(item) || !ehNumero(item.id) || !ehTexto(item.nome)) return null
  return { id: item.id, nome: item.nome, ativo: item.ativo !== false }
}

/** Composição reconhecida (`apontamentos`/`dado_externo`); qualquer outro formato vira `null`. */
function composicaoOuNula(valor: unknown): ComposicaoIndicador | null {
  if (!ehObjeto(valor) || !ehUmDe(TIPOS_COMPOSICAO, valor.tipo)) return null
  const itens = Array.isArray(valor.itens) ? valor.itens.map(componenteOuNulo).filter((item) => item !== null) : []
  return { tipo: valor.tipo, itens }
}

function paraIndicadorMeta(item: unknown): IndicadorMetaPreenchimento {
  if (!ehObjeto(item) || !ehNumero(item.id) || !ehTexto(item.nome) || !opcional(item.ajustada, ehBooleano)) throw respostaInvalida()
  const origem = item['meta do cadastro origem']
  return {
    id: item.id,
    nome: item.nome,
    tipos: Array.isArray(item.tipos) ? item.tipos.map(nomeDoTipo).filter((nome) => nome !== null) : [],
    composicao: composicaoOuNula(item.composicao),
    sentido: ehUmDe(SENTIDOS, item.sentido) ? item.sentido : null,
    metaDoCadastro: meta(item['meta do cadastro']),
    metaDoCadastroOrigem: ehUmDe(ORIGENS_META_DO_CADASTRO, origem) ? origem : null,
    metaVigente: meta(item['meta vigente']),
    ajustada: item.ajustada === true,
  }
}

const SITUACOES_MES_CONSULTADO: readonly SituacaoMesConsultado[] = ['aberto', 'fechado']

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

/** Indicadores da janela "Editar metas" para a filial e o mês (RF-71, RF-72). */
export async function listarMetasPreenchimento(filtros: FiltrosMetasPreenchimento): Promise<JanelaMetas> {
  const filial = filialDoPreenchimento(filtros.filial)
  const mes = filtros.mesDeReferencia === undefined ? undefined : mesParaQuery(filtros.mesDeReferencia)
  const resposta = await apiFetch<unknown>(ROTA_METAS, { query: { filial, mes_de_referencia: mes, tipo: filtros.tipo } })
  if (
    !ehObjeto(resposta) ||
    !Array.isArray(resposta.indicadores) ||
    !ehUmDe(SITUACOES_MES_CONSULTADO, resposta['situacao do mes']) ||
    !opcional(resposta.editavel, ehBooleano)
  ) {
    throw respostaInvalida()
  }
  const situacaoDoMes = resposta['situacao do mes']
  return {
    situacaoDoMes,
    editavel: ehBooleano(resposta.editavel) ? resposta.editavel : situacaoDoMes === 'aberto',
    indicadores: resposta.indicadores.map(paraIndicadorMeta),
  }
}

/**
 * Ajusta a meta dos indicadores só para a filial e o mês (RF-73): `PUT /api/ped/metas`, com o mês no
 * dia 01 e a meta como número JSON. Tudo ou nada: o `400`/`403` chega como `ApiError`, com os erros por
 * item em `dados` (ver `errosDoAjusteMetas`).
 */
export async function ajustarMetas(dados: AjusteMetas): Promise<ResultadoAjusteMetas> {
  const filial = filialDoPreenchimento(dados.filial)
  const mesDeReferencia = mesParaCorpo(dados.mesDeReferencia)
  const resposta = await apiFetch<unknown>(ROTA_METAS, { method: 'PUT', body: paraCorpoAjusteMetas({ ...dados, filial, mesDeReferencia }) })
  if (!ehObjeto(resposta)) return { mensagem: null, ajustadas: 0 }
  return {
    mensagem: ehTexto(resposta.mensagem) ? resposta.mensagem : null,
    ajustadas: ehNumero(resposta.ajustadas) ? resposta.ajustadas : 0,
  }
}

/**
 * Erros por item do ajuste recusado (`dados.erros: [{ "id indicador", mensagem }]`), na ordem devolvida.
 * Id em número ou dígitos em texto; senão `null`. Itens sem `mensagem` em texto são ignorados. Falha que
 * não é `ApiError`, sem `dados` ou sem a lista `erros` devolve `[]`.
 */
export function errosDoAjusteMetas(falha: unknown): ErroDeIndicador[] {
  if (!(falha instanceof ApiError) || !ehObjeto(falha.dados) || !Array.isArray(falha.dados.erros)) return []
  const erros: unknown[] = falha.dados.erros
  return erros.flatMap((erro): ErroDeIndicador[] =>
    ehObjeto(erro) && ehTexto(erro.mensagem) ? [{ idIndicador: idOuNulo(erro['id indicador']), mensagem: erro.mensagem }] : [],
  )
}
