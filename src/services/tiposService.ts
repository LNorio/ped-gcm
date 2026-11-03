/**
 * Serviço de tipos de apontamento (F3.1 — RF-12 a RF-15).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Tipos de apontamento":
 * - `GET    /api/ped/tipos-apontamento`        qualquer perfil do PED
 * - `POST   /api/ped/tipos-apontamento`        Admin — `{ nome, usuarios }`
 * - `PUT    /api/ped/tipos-apontamento/{id}`   Admin — `{ usuarios }`
 * - `DELETE /api/ped/tipos-apontamento/{id}`   Admin — só personalizado e sem apontamentos
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 */

import type { OrigemTipo, TipoApontamento } from '../types/dominio'
import { type TipoApontamentoApi, paraTipoApontamento } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'

const ROTA_TIPOS = '/ped/tipos-apontamento'

/** Os 7 tipos fixos da plataforma, na ordem da API; nascem na migration e não podem ser excluídos. */
export const TIPOS_FIXOS = [
  'Comercial',
  'Financeiro',
  'Recursos Humanos',
  'Tecnologia da Informação',
  'Fiscal',
  'Processos',
  'Contabilidade',
] as const

/** Valores de `origem` devolvidos pela API. */
export const ORIGEM_FIXO = 'Fixo' satisfies OrigemTipo
export const ORIGEM_PERSONALIZADO = 'Personalizado' satisfies OrigemTipo

/** Dados para criar um tipo personalizado (RF-14). */
export interface NovoTipo {
  nome: string
  /** Ids dos colaboradores vinculados; a API exige ao menos um. */
  usuarios: number[]
}

/** Dados para atualizar os usuários de um tipo (fixo ou personalizado); o nome não muda. */
export interface AtualizacaoTipo {
  usuarios: number[]
}

function ehTipoApontamentoApi(valor: unknown): valor is TipoApontamentoApi {
  if (!valor || typeof valor !== 'object') return false
  const { id, nome, origem } = valor as Partial<TipoApontamentoApi>
  return typeof id === 'number' && typeof nome === 'string' && typeof origem === 'string'
}

/** Converte um tipo da resposta; corpo ausente ou fora do formato vira `ApiError` de resposta inválida. */
function converterTipoDaResposta(resposta: unknown): TipoApontamento {
  if (!ehTipoApontamentoApi(resposta)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  return paraTipoApontamento(resposta)
}

/**
 * Lista os tipos visíveis ao usuário (RF-12), na ordem devolvida pela API.
 * Resposta que não é lista, ou com qualquer item fora do formato, rejeita com `ApiError` de
 * resposta inválida (nenhum item é ignorado silenciosamente).
 */
export async function listarTipos(): Promise<TipoApontamento[]> {
  const resposta = await apiFetch<unknown>(ROTA_TIPOS)
  if (!Array.isArray(resposta)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  return resposta.map(converterTipoDaResposta)
}

/** Exclui um tipo personalizado sem apontamentos (RF-13). Resolve sem valor em 204 ou 200. */
export async function excluirTipo(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_TIPOS}/${id}`, { method: 'DELETE' })
}

/** Cria um tipo personalizado (RF-14). */
export async function criarTipo(dados: NovoTipo): Promise<TipoApontamento> {
  const resposta = await apiFetch<unknown>(ROTA_TIPOS, {
    method: 'POST',
    body: { nome: dados.nome, usuarios: dados.usuarios },
  })
  return converterTipoDaResposta(resposta)
}

/** Troca os usuários vinculados a um tipo (RF-15). */
export async function atualizarTipo(id: number, dados: AtualizacaoTipo): Promise<TipoApontamento> {
  const resposta = await apiFetch<unknown>(`${ROTA_TIPOS}/${id}`, {
    method: 'PUT',
    body: { usuarios: dados.usuarios },
  })
  return converterTipoDaResposta(resposta)
}
