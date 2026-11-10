/**
 * Serviço de apontamentos (F4.1).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Apontamentos":
 * - `GET    /api/ped/apontamentos`               lista filtrada (`busca`, `situacao`, `tipo`) e contagem por tipo
 * - `POST   /api/ped/apontamentos`               `{ nome, "id tipo", "tipo de valor", descricao }`
 * - `PUT    /api/ped/apontamentos/{id}/situacao` `{ ativo }` — Admin e Validador
 * - `DELETE /api/ped/apontamentos/{id}`          Admin — só sem indicadores (400 traz `indicadores`)
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 * Na listagem, respostas 2xx fora do formato esperado viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`.
 *
 * Exceção: o POST de cadastro e a troca de situação. Os corpos dessas respostas não são
 * documentados, e um 2xx já significa que a alteração foi gravada. Rejeitar a resposta faria a tela
 * mostrar erro e não recarregar a lista mesmo com a gravação feita. Por isso `criarApontamento` e
 * `alterarSituacao` aceitam o apontamento na raiz ou em `resposta.apontamento` e, sem um apontamento
 * reconhecível, resolvem `null`, sem lançar erro.
 */

import type { Apontamento, NovoApontamento } from '../types/dominio'
import { type ApontamentoApi, paraApontamento, paraCorpoNovoApontamento } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, type ValorQuery, apiFetch } from './api'

const ROTA_APONTAMENTOS = '/ped/apontamentos'

/** Situações aceitas pelo filtro da API, na ordem exibida na tela. */
export const SITUACOES_FILTRO = ['todas', 'ativos', 'inativos', 'problemas'] as const

export type SituacaoFiltro = (typeof SITUACOES_FILTRO)[number]

export const ROTULOS_SITUACAO_FILTRO: Readonly<Record<SituacaoFiltro, string>> = {
  todas: 'Todas',
  ativos: 'Ativos',
  inativos: 'Inativos',
  problemas: 'Com problemas',
}

/** Filtros de `listarApontamentos`; só os informados entram na query. */
export interface FiltrosApontamentos {
  /** Texto livre; vazio ou só com espaços é omitido. A API ignora acentos e maiúsculas. */
  busca?: string
  situacao?: SituacaoFiltro
  /** Id do tipo de apontamento. */
  tipo?: number
}

/** Quantidade de apontamentos por tipo (considera busca e situação, não o filtro de tipo). */
export interface ContagemPorTipo {
  id: number
  nome: string
  quantidade: number
}

export interface ResultadoListagemApontamentos {
  apontamentos: Apontamento[]
  contagemPorTipo: ContagemPorTipo[]
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Campo opcional: ausente, `null` ou do tipo esperado. */
function opcional(valor: unknown, validar: (v: unknown) => boolean): boolean {
  return valor === undefined || valor === null || validar(valor)
}

/** Indicador vinculado: o nome (formato real da API) ou um objeto com `nome` textual. */
function ehIndicadorDoApontamentoApi(valor: unknown): boolean {
  return typeof valor === 'string' || (ehObjeto(valor) && typeof valor.nome === 'string')
}

/**
 * `indicadores` pode estar ausente, ser `null` ou ser uma lista de nomes e/ou objetos `{ id, nome }`;
 * qualquer outro formato (inclusive texto ou objeto solto no lugar da lista) invalida o apontamento.
 */
function ehApontamentoApi(valor: unknown): valor is ApontamentoApi {
  if (!ehObjeto(valor)) return false
  return (
    typeof valor.id === 'number' &&
    typeof valor.nome === 'string' &&
    typeof valor.ativo === 'boolean' &&
    typeof valor['id tipo'] === 'number' &&
    typeof valor.tipo === 'string' &&
    typeof valor['tipo de valor'] === 'string' &&
    opcional(valor.indicadores, (v) => Array.isArray(v) && v.every(ehIndicadorDoApontamentoApi))
  )
}

function ehContagemPorTipo(valor: unknown): valor is ContagemPorTipo {
  if (!ehObjeto(valor)) return false
  return typeof valor.id === 'number' && typeof valor.nome === 'string' && typeof valor.quantidade === 'number'
}

/** Converte um apontamento da resposta; fora do formato (inclusive tipo de valor desconhecido) vira `ApiError`. */
function converterApontamentoDaResposta(resposta: unknown): Apontamento {
  if (!ehApontamentoApi(resposta)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  try {
    return paraApontamento(resposta)
  } catch {
    throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  }
}

function converterContagem(valor: unknown): ContagemPorTipo[] {
  if (valor === undefined || valor === null) return []
  if (!Array.isArray(valor)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  return valor.map((item: unknown) => {
    if (!ehContagemPorTipo(item)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
    return { id: item.id, nome: item.nome, quantidade: item.quantidade }
  })
}

function montarQuery(filtros: FiltrosApontamentos): Record<string, ValorQuery> {
  const busca = filtros.busca?.trim() ? filtros.busca : undefined
  return { busca, situacao: filtros.situacao, tipo: filtros.tipo }
}

/**
 * Lista os apontamentos visíveis ao usuário, filtrados pela API, com a contagem por tipo.
 * Nenhum item inválido é ignorado silenciosamente: a resposta inteira é rejeitada.
 */
export async function listarApontamentos(filtros: FiltrosApontamentos = {}): Promise<ResultadoListagemApontamentos> {
  const resposta = await apiFetch<unknown>(ROTA_APONTAMENTOS, { query: montarQuery(filtros) })
  if (!ehObjeto(resposta) || !Array.isArray(resposta.apontamentos)) {
    throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  }
  const lista: unknown[] = resposta.apontamentos
  return {
    apontamentos: lista.map(converterApontamentoDaResposta),
    contagemPorTipo: converterContagem(resposta['contagem por tipo']),
  }
}

/** Converte o apontamento se ele estiver completo e válido; caso contrário devolve `null`. */
function converterApontamentoOuNulo(valor: unknown): Apontamento | null {
  if (!ehApontamentoApi(valor)) return null
  try {
    return paraApontamento(valor)
  } catch {
    return null
  }
}

/**
 * Cadastra um apontamento (nasce ativo).
 *
 * A resposta do POST não é documentada na API, e um 2xx significa que o apontamento foi gravado.
 * Por isso a resposta não é validada de forma estrita:
 * - apontamento válido na raiz ou em `resposta.apontamento` (com ou sem `mensagem`): devolve o
 *   apontamento convertido;
 * - corpo vazio (201/204) ou sem apontamento reconhecível (só `mensagem`, `{ id }`, incompleto,
 *   tipo de valor desconhecido, lista, texto): devolve `null`, sem erro. Quem chama deve recarregar
 *   a lista para obter o apontamento criado.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração.
 */
export async function criarApontamento(dados: NovoApontamento): Promise<Apontamento | null> {
  const resposta = await apiFetch<unknown>(ROTA_APONTAMENTOS, {
    method: 'POST',
    body: paraCorpoNovoApontamento(dados),
  })
  if (!ehObjeto(resposta)) return null
  return converterApontamentoOuNulo(resposta) ?? converterApontamentoOuNulo(resposta.apontamento)
}

/**
 * Ativa ou desativa um apontamento; devolve o apontamento atualizado (com quem alterou e quando).
 *
 * A resposta não é documentada, e um 2xx significa que a situação foi gravada. Por isso não é
 * validada de forma estrita:
 * - apontamento válido na raiz ou em `resposta.apontamento` (com ou sem `mensagem`): devolve o
 *   apontamento convertido;
 * - qualquer outro 2xx (corpo vazio, 204, só `mensagem`, `{ id }`, incompleto, tipo de valor
 *   desconhecido, lista ou texto): devolve `null`, sem erro. Quem chama deve recarregar a lista
 *   para obter a situação gravada.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração.
 */
export async function alterarSituacao(id: number, ativo: boolean): Promise<Apontamento | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_APONTAMENTOS}/${id}/situacao`, {
    method: 'PUT',
    body: { ativo },
  })
  if (!ehObjeto(resposta)) return null
  return converterApontamentoOuNulo(resposta) ?? converterApontamentoOuNulo(resposta.apontamento)
}

/**
 * Exclui um apontamento. Resolve sem valor em 204 ou 200. Quando ele compõe indicadores, a API
 * responde 400 e a `ApiError` traz `dados.indicadores`.
 */
export async function excluirApontamento(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_APONTAMENTOS}/${id}`, { method: 'DELETE' })
}
