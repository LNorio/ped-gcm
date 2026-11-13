/**
 * Serviço do período aberto (F9.1 — RF-75, RF-76).
 *
 * Rotas de `docs/backend/API (28).md`, seção "Período aberto":
 * - `GET  /api/ped/periodo`            o mês aberto para preenchimento (único, comum a todas as filiais)
 * - `GET  /api/ped/periodo/historico`  aberturas, da mais recente para a mais antiga, com `reaberto`
 * - `POST /api/ped/periodo/abrir`      Admin: `{ "mes de referencia": "AAAA-MM-01" }` — abre um mês novo
 *                                      ou reabre um mês passado (`"periodo aberto"`/`"periodo reaberto"`)
 *
 * Formatos aceitos: o período na raiz ou em `{ periodo }`; o histórico em lista pura ou `{ historico }`.
 * `"aberto por"`/`"aberto em"` ausentes viram `null` e `reaberto` ausente vira `false`. Respostas 2xx
 * fora do formato viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único item inválido rejeita o
 * histórico inteiro. Os campos comuns são convertidos por `paraPeriodo` (`adaptadores.ts`), e o
 * `reaberto` é tratado aqui.
 *
 * Regra "2xx = gravado" na abertura: qualquer 2xx resolve. A reabertura é reconhecida por
 * `"reaberto": true` ou pela mensagem `"periodo reaberto"`; sem corpo, vale o mês enviado, `reaberto`
 * `false` e mensagem `null`. O mês é validado localmente (`MENSAGEM_MES_INVALIDO`, ver
 * `preenchimentoService`). Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`).
 */

import type { PeriodoAberto } from '../types/dominio'
import { type PeriodoApi, paraPeriodo } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'
import { mesParaCorpo } from './preenchimentoService'

const ROTA_PERIODO = '/ped/periodo'

/** Resultado de `abrirPeriodo`. */
export interface ResultadoAberturaPeriodo {
  /** `true` quando um mês passado foi reaberto. */
  reaberto: boolean
  /** Mês aberto (`AAAA-MM-01`): o devolvido pela API ou, sem ele, o enviado. */
  mesDeReferencia: string
  mensagem: string | null
}

interface PeriodoAbertoApi extends PeriodoApi {
  reaberto?: boolean | null
}

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
const ehBooleano = (v: unknown): v is boolean => typeof v === 'boolean'

function ehPeriodoAbertoApi(valor: unknown): valor is PeriodoAbertoApi {
  return (
    ehObjeto(valor) &&
    ehTexto(valor['mes de referencia']) &&
    opcional(valor['aberto por'], ehTexto) &&
    opcional(valor['aberto em'], ehTexto) &&
    opcional(valor.reaberto, ehBooleano)
  )
}

function paraPeriodoAberto(valor: unknown): PeriodoAberto {
  if (!ehPeriodoAbertoApi(valor)) throw respostaInvalida()
  return { ...paraPeriodo(valor), reaberto: valor.reaberto === true }
}

/** O mês aberto para preenchimento (RF-75). */
export async function obterPeriodo(): Promise<PeriodoAberto> {
  const resposta = await apiFetch<unknown>(ROTA_PERIODO)
  return paraPeriodoAberto(ehObjeto(resposta) && ehObjeto(resposta.periodo) ? resposta.periodo : resposta)
}

/** Aberturas de período (RF-76): mês, quem abriu, quando e se foi reabertura. */
export async function listarHistoricoPeriodos(): Promise<PeriodoAberto[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_PERIODO}/historico`)
  const lista: unknown = ehObjeto(resposta) ? resposta.historico : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista.map(paraPeriodoAberto)
}

/**
 * Abre (ou reabre) o mês informado (RF-76, só Admin). Aceita `AAAA-MM` ou `AAAA-MM-DD`; envia sempre o
 * dia 01. Mês já aberto ou futuro chega como `ApiError(400)` com a mensagem da API.
 */
export async function abrirPeriodo(mesDeReferencia: string): Promise<ResultadoAberturaPeriodo> {
  const mes = mesParaCorpo(mesDeReferencia)
  const resposta = await apiFetch<unknown>(`${ROTA_PERIODO}/abrir`, { method: 'POST', body: { 'mes de referencia': mes } })
  if (!ehObjeto(resposta)) return { reaberto: false, mesDeReferencia: mes, mensagem: null }
  const mensagem = ehTexto(resposta.mensagem) ? resposta.mensagem : null
  return {
    reaberto: resposta.reaberto === true || /reaberto/i.test(mensagem ?? ''),
    mesDeReferencia: ehTexto(resposta['mes de referencia']) ? resposta['mes de referencia'] : mes,
    mensagem,
  }
}
