/**
 * Serviço de tipos de apontamento (F3.1 — RF-12 a RF-15; A-02 resolvida em 06/11/2026).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Tipos de apontamento", com as mudanças de
 * `docs/backend/FRONT-PED-mudancas (1).md`, item 4 (vínculo por grupos do ERP):
 * - `GET    /api/ped/tipos-apontamento`        qualquer perfil; Admin/Validador recebem `grupos` e
 *                                              `usuarios`, o Preenchedor recebe `null`. Grupos vêm como
 *                                              `[{ id, nome }]`; usuários vêm como `[{ "id colaborador", nome }]`
 *                                              (resposta real, 06/11/2026) ou `[{ id, nome }]` — os dois formatos
 *                                              são aceitos e, se vierem as duas chaves, vale `"id colaborador"`
 * - `POST   /api/ped/tipos-apontamento`        Admin e Validador — `{ nome, grupos, usuarios }`
 * - `PUT    /api/ped/tipos-apontamento/{id}`   Admin e Validador — `{ grupos?, usuarios? }` (só as chaves informadas)
 * - `DELETE /api/ped/tipos-apontamento/{id}`   Admin e Validador — só personalizado e sem apontamentos
 * - `GET    /api/ped/grupos[?busca=]`          Admin e Validador — grupos do ERP com os tipos vinculados
 *
 * POST e PUT seguem "2xx = gravado": devolvem o tipo convertido quando a resposta o traz (na raiz
 * ou em `{ tipo }`) e `null` em qualquer outro 2xx.
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 */

import type { OrigemTipo, ReferenciaNomeada, TipoApontamento } from '../types/dominio'
import { type TipoApontamentoApi, paraTipoApontamento } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'

const ROTA_TIPOS = '/ped/tipos-apontamento'
const ROTA_GRUPOS = '/ped/grupos'

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

/** Grupo do ERP (`GET /api/ped/grupos`), com os tipos a que já está vinculado. */
export interface GrupoErp {
  id: number
  nome: string
  quantidadeUsuarios: number
  tipos: ReferenciaNomeada[]
}

/** Filtros de `listarGrupos`; `busca` vazia ou só com espaços é omitida. */
export interface FiltrosGrupos {
  busca?: string
}

/** Dados para criar um tipo personalizado (RF-14); a API exige ao menos um grupo ou usuário. */
export interface NovoTipo {
  nome: string
  /** Ids dos grupos do ERP vinculados. */
  grupos: number[]
  /** Ids dos colaboradores vinculados diretamente. */
  usuarios: number[]
}

/**
 * Dados para atualizar os vínculos de um tipo (fixo ou personalizado); o nome não muda.
 * Só as chaves informadas são enviadas (lista vazia é enviada como `[]`).
 */
export interface AtualizacaoTipo {
  grupos?: number[]
  usuarios?: number[]
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function ehReferencia(valor: unknown): valor is ReferenciaNomeada {
  return ehObjeto(valor) && typeof valor.id === 'number' && typeof valor.nome === 'string'
}

/**
 * Converte um usuário vinculado: aceita `{ "id colaborador": number, nome }` (formato real da API) ou
 * `{ id: number, nome }`; se vierem as duas chaves, prefere `"id colaborador"`. Fora disso, `null`.
 */
function paraUsuarioVinculado(valor: unknown): ReferenciaNomeada | null {
  if (!ehObjeto(valor) || typeof valor.nome !== 'string') return null
  const idColaborador = valor['id colaborador']
  if (typeof idColaborador === 'number') return { id: idColaborador, nome: valor.nome }
  if (typeof valor.id === 'number') return { id: valor.id, nome: valor.nome }
  return null
}

function ehUsuarioVinculado(valor: unknown): boolean {
  return paraUsuarioVinculado(valor) !== null
}

/** Lista válida segundo `ehItem`, ausente (`undefined`) ou `null`; qualquer outra coisa é inválida. */
function ehListaOuNula(valor: unknown, ehItem: (item: unknown) => boolean): boolean {
  if (valor === undefined || valor === null) return true
  return Array.isArray(valor) && valor.every(ehItem)
}

/** Lista de referências `{ id, nome }` válida, ausente ou `null`. */
function ehListaDeReferenciasOuNula(valor: unknown): boolean {
  return ehListaOuNula(valor, ehReferencia)
}

/** Converte a lista mantendo só `id` e `nome`; ausente ou `null` vira `null`. */
function paraReferenciasOuNulo(valor: unknown): ReferenciaNomeada[] | null {
  if (!Array.isArray(valor)) return null
  return valor.filter(ehReferencia).map((item) => ({ id: item.id, nome: item.nome }))
}

/** Converte os usuários vinculados (só `id` e `nome`); ausente ou `null` vira `null`. */
function paraUsuariosOuNulo(valor: unknown): ReferenciaNomeada[] | null {
  if (!Array.isArray(valor)) return null
  return valor.map(paraUsuarioVinculado).filter((item): item is ReferenciaNomeada => item !== null)
}

function ehTipoApontamentoApi(valor: unknown): valor is TipoApontamentoApi {
  if (!ehObjeto(valor)) return false
  const { id, nome, origem, grupos, usuarios } = valor
  return (
    typeof id === 'number' &&
    typeof nome === 'string' &&
    typeof origem === 'string' &&
    ehListaDeReferenciasOuNula(grupos) &&
    ehListaOuNula(usuarios, ehUsuarioVinculado)
  )
}

/** Converte um tipo já validado, incluindo os grupos e usuários vinculados (A-02). */
function converterTipo(tipo: TipoApontamentoApi): TipoApontamento {
  return {
    ...paraTipoApontamento(tipo),
    grupos: paraReferenciasOuNulo(tipo.grupos),
    usuarios: paraUsuariosOuNulo(tipo.usuarios),
  }
}

/** Converte um tipo da lista; item fora do formato vira `ApiError` de resposta inválida. */
function converterTipoDaLista(resposta: unknown): TipoApontamento {
  if (!ehTipoApontamentoApi(resposta)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  return converterTipo(resposta)
}

/** "2xx = gravado": tipo válido na raiz ou em `{ tipo }` é convertido; qualquer outro corpo vira `null`. */
function converterTipoGravado(resposta: unknown): TipoApontamento | null {
  if (ehTipoApontamentoApi(resposta)) return converterTipo(resposta)
  if (ehObjeto(resposta) && ehTipoApontamentoApi(resposta.tipo)) return converterTipo(resposta.tipo)
  return null
}

/** Converte um grupo do ERP; item fora do formato vira `ApiError` de resposta inválida. */
function converterGrupo(valor: unknown): GrupoErp {
  if (!ehObjeto(valor) || typeof valor.id !== 'number' || typeof valor.nome !== 'string') {
    throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  }
  const quantidade = valor['quantidade usuarios']
  if (quantidade !== undefined && quantidade !== null && typeof quantidade !== 'number') {
    throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  }
  if (!ehListaDeReferenciasOuNula(valor.tipos)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  return {
    id: valor.id,
    nome: valor.nome,
    quantidadeUsuarios: quantidade ?? 0,
    tipos: paraReferenciasOuNulo(valor.tipos) ?? [],
  }
}

/**
 * Lista os tipos visíveis ao usuário (RF-12), na ordem devolvida pela API.
 * Resposta que não é lista, ou com qualquer item fora do formato, rejeita com `ApiError` de
 * resposta inválida (nenhum item é ignorado silenciosamente).
 */
export async function listarTipos(): Promise<TipoApontamento[]> {
  const resposta = await apiFetch<unknown>(ROTA_TIPOS)
  if (!Array.isArray(resposta)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  return resposta.map(converterTipoDaLista)
}

/**
 * Lista os grupos do ERP (A-02), na ordem da API, com filtro opcional por texto.
 * Resposta que não é lista, ou com qualquer item fora do formato, rejeita com `ApiError` de
 * resposta inválida.
 */
export async function listarGrupos(filtros: FiltrosGrupos = {}): Promise<GrupoErp[]> {
  const busca = filtros.busca?.trim() ? filtros.busca : undefined
  const resposta = await apiFetch<unknown>(ROTA_GRUPOS, { query: { busca } })
  if (!Array.isArray(resposta)) throw new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
  return resposta.map(converterGrupo)
}

/** Exclui um tipo personalizado sem apontamentos (RF-13). Resolve sem valor em 204 ou 200. */
export async function excluirTipo(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_TIPOS}/${id}`, { method: 'DELETE' })
}

/** Cria um tipo personalizado (RF-14). Resolve o tipo gravado, ou `null` se o 2xx não o trouxer. */
export async function criarTipo(dados: NovoTipo): Promise<TipoApontamento | null> {
  const resposta = await apiFetch<unknown>(ROTA_TIPOS, {
    method: 'POST',
    body: { nome: dados.nome, grupos: dados.grupos, usuarios: dados.usuarios },
  })
  return converterTipoGravado(resposta)
}

/**
 * Troca os grupos e/ou usuários vinculados a um tipo (RF-15), enviando só as chaves informadas.
 * Resolve o tipo gravado, ou `null` se o 2xx não o trouxer.
 */
export async function atualizarTipo(id: number, dados: AtualizacaoTipo): Promise<TipoApontamento | null> {
  const corpo: AtualizacaoTipo = {}
  if (dados.grupos !== undefined) corpo.grupos = dados.grupos
  if (dados.usuarios !== undefined) corpo.usuarios = dados.usuarios
  const resposta = await apiFetch<unknown>(`${ROTA_TIPOS}/${id}`, { method: 'PUT', body: corpo })
  return converterTipoGravado(resposta)
}
