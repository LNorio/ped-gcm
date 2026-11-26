/**
 * Serviço dos alertas das abas do menu (F2.12).
 *
 * Rota de `docs/backend/FRONT-alertas-menu.md` e `docs/backend/API (31).md`, seção "Alertas das abas do menu":
 * - `GET /api/ped/alertas-menu` (sem parâmetros) devolve `{ abas: { <aba>: { total, itens: [...] } } }`.
 *
 * Conversão:
 * - só as abas conhecidas do menu (`ABAS` de `src/sessao/permissoes.ts`) entram no resultado; chaves
 *   desconhecidas são ignoradas, mesmo malformadas; abas ausentes na resposta ficam ausentes;
 * - `itens` ausente ou `null` vira `[]`; itens malformados (sem `codigo` texto ou `quantidade` numérica)
 *   são ignorados; a ordem dos itens é mantida; `descricao` ausente ou `null` vira `null`.
 *
 * Respostas 2xx fora do formato (corpo/`abas` não objeto, aba conhecida não objeto, `total` não numérico)
 * viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`. Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`).
 */

import { ABAS, type Aba } from '../sessao/permissoes'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'

const ROTA_ALERTAS_MENU = '/ped/alertas-menu'

export interface ItemAlertaMenu {
  codigo: string
  quantidade: number
  descricao: string | null
}

export interface AlertasDaAba {
  total: number
  itens: ItemAlertaMenu[]
}

/** Alertas por aba; abas que o usuário não acessa (ou que não vieram na resposta) ficam ausentes. */
export type AlertasMenu = Partial<Record<Aba, AlertasDaAba>>

// ---------------------------------------------------------------------------
// Validação das respostas
// ---------------------------------------------------------------------------

function respostaInvalida(): ApiError {
  return new ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

const ehTexto = (v: unknown): v is string => typeof v === 'string'
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// ---------------------------------------------------------------------------
// Conversões (API → domínio)
// ---------------------------------------------------------------------------

/** Item válido convertido, ou `null` quando malformado (ignorado). */
function paraItem(item: unknown): ItemAlertaMenu | null {
  if (!ehObjeto(item) || !ehTexto(item.codigo) || !ehNumero(item.quantidade)) return null
  return {
    codigo: item.codigo,
    quantidade: item.quantidade,
    descricao: ehTexto(item.descricao) ? item.descricao : null,
  }
}

function paraItens(valor: unknown): ItemAlertaMenu[] {
  if (!Array.isArray(valor)) return []
  return valor.map(paraItem).filter((item): item is ItemAlertaMenu => item !== null)
}

function paraAlertasDaAba(valor: unknown): AlertasDaAba {
  if (!ehObjeto(valor) || !ehNumero(valor.total)) throw respostaInvalida()
  return { total: valor.total, itens: paraItens(valor.itens) }
}

function paraAlertasMenu(resposta: unknown): AlertasMenu {
  if (!ehObjeto(resposta) || !ehObjeto(resposta.abas)) throw respostaInvalida()
  const abas = resposta.abas
  const alertas: AlertasMenu = {}
  for (const aba of ABAS) {
    if (Object.hasOwn(abas, aba)) alertas[aba] = paraAlertasDaAba(abas[aba])
  }
  return alertas
}

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

/** Alertas das abas do menu do usuário logado: `GET /api/ped/alertas-menu`, sem parâmetros. */
export async function obterAlertasMenu(opcoes: { signal?: AbortSignal } = {}): Promise<AlertasMenu> {
  const resposta = await apiFetch<unknown>(ROTA_ALERTAS_MENU, { signal: opcoes.signal })
  return paraAlertasMenu(resposta)
}
