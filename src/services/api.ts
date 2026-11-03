/**
 * Cliente HTTP central da API PED (INT-01, RNF-08).
 *
 * - URL base lida de `VITE_API_URL` (ausente ou vazia → `/api`, atendido pelo proxy do Vite).
 * - Sempre pede JSON; serializa corpos objeto como JSON.
 * - Envia `Authorization: Bearer <token>` quando há token na sessão (`sessao.ts`).
 * - Converte respostas de erro e falhas de rede em `ApiError` com mensagem em pt-BR.
 * - Em 401 de requisição autenticada, dispara `EVENTO_SESSAO_EXPIRADA` em `window`.
 */

import { obterToken } from './sessao'

/** Nome do evento disparado em `window` quando a API recusa o token da sessão (401). */
export const EVENTO_SESSAO_EXPIRADA = 'sessao-expirada'

const URL_BASE_PADRAO = '/api'

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ValorQuery = string | number | boolean | null | undefined

export interface ApiOpcoes {
  method?: MetodoHttp
  /** Objeto serializado como JSON. Aceita também `BodyInit` (ex.: FormData), enviado como está. */
  body?: unknown
  /** Parâmetros da query string; valores `null`/`undefined` são omitidos. */
  query?: Record<string, ValorQuery>
  headers?: Record<string, string>
  signal?: AbortSignal
}

const MENSAGENS_POR_STATUS: Readonly<Record<number, string>> = {
  400: 'Dados inválidos. Verifique as informações e tente novamente.',
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Registro não encontrado.',
  500: 'Erro interno do servidor. Tente novamente mais tarde.',
}

export const MENSAGEM_SEM_CONEXAO = 'Não foi possível conectar ao servidor.'
export const MENSAGEM_RESPOSTA_INVALIDA = 'Resposta inválida do servidor.'

/** Mensagem padrão em pt-BR para um status HTTP de erro. */
export function mensagemPadraoPorStatus(status: number): string {
  return MENSAGENS_POR_STATUS[status] ?? `Erro inesperado (${status}).`
}

/**
 * Erro lançado por `apiFetch` para respostas HTTP de erro ou falhas de rede.
 * `status === 0` indica falha de conexão. `mensagem` é exibível ao usuário.
 */
export class ApiError extends Error {
  readonly status: number
  readonly mensagem: string
  readonly dados?: unknown

  constructor(status: number, mensagem: string, dados?: unknown) {
    super(mensagem)
    this.name = 'ApiError'
    this.status = status
    this.mensagem = mensagem
    this.dados = dados
  }
}

/** Lê a URL base da API no momento da chamada (permite trocar a env em testes). */
function obterUrlBase(): string {
  const valor: unknown = import.meta.env.VITE_API_URL
  if (typeof valor !== 'string' || valor.trim() === '') return URL_BASE_PADRAO
  return valor.trim()
}

function montarUrl(caminho: string, query?: Record<string, ValorQuery>): string {
  const base = obterUrlBase().replace(/\/+$/, '')
  const rota = caminho.replace(/^\/+/, '')
  let url = `${base}/${rota}`

  if (query) {
    const parametros = new URLSearchParams()
    for (const [chave, valor] of Object.entries(query)) {
      if (valor === null || valor === undefined) continue
      parametros.append(chave, String(valor))
    }
    const texto = parametros.toString()
    if (texto) url += (url.includes('?') ? '&' : '?') + texto
  }

  return url
}

function ehBodyInit(valor: unknown): valor is BodyInit {
  return (
    typeof valor === 'string' ||
    valor instanceof Blob ||
    valor instanceof FormData ||
    valor instanceof URLSearchParams ||
    valor instanceof ArrayBuffer ||
    ArrayBuffer.isView(valor) ||
    (typeof ReadableStream !== 'undefined' && valor instanceof ReadableStream)
  )
}

function montarCorpo(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) return undefined
  if (ehBodyInit(body)) return body
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return JSON.stringify(body)
}

interface CorpoErro {
  mensagem?: unknown
}

async function lerCorpoErro(response: Response): Promise<unknown> {
  try {
    const texto = await response.text()
    if (!texto) return undefined
    return JSON.parse(texto) as unknown
  } catch {
    return undefined
  }
}

function extrairMensagem(dados: unknown, status: number): string {
  if (dados && typeof dados === 'object') {
    const { mensagem } = dados as CorpoErro
    if (typeof mensagem === 'string' && mensagem.trim() !== '') return mensagem
  }
  return mensagemPadraoPorStatus(status)
}

function notificarSessaoExpirada(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA))
}

/**
 * Executa uma chamada à API e devolve o JSON da resposta tipado como `T`.
 * Lança `ApiError` em respostas de erro (status >= 400) e em falhas de rede (status 0).
 */
export async function apiFetch<T = unknown>(caminho: string, opcoes: ApiOpcoes = {}): Promise<T> {
  const { method = 'GET', body, query, headers: cabecalhosExtras, signal } = opcoes

  const headers = new Headers(cabecalhosExtras)
  headers.set('Accept', 'application/json')

  const token = obterToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const corpo = montarCorpo(body, headers)
  const url = montarUrl(caminho, query)

  let response: Response
  try {
    response = await fetch(url, { method, headers, body: corpo, signal })
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') throw erro
    throw new ApiError(0, MENSAGEM_SEM_CONEXAO, erro)
  }

  if (!response.ok) {
    const dados = await lerCorpoErro(response)
    const mensagem = extrairMensagem(dados, response.status)
    if (response.status === 401 && token) notificarSessaoExpirada()
    throw new ApiError(response.status, mensagem, dados)
  }

  return (await lerCorpoSucesso(response)) as T
}

/**
 * Lê o corpo de uma resposta 2xx: `undefined` em 204 ou corpo vazio; JSON nos demais casos.
 * Corpo não-JSON (ex.: HTML de proxy) vira `ApiError` com mensagem em pt-BR, nunca `SyntaxError`.
 */
async function lerCorpoSucesso(response: Response): Promise<unknown> {
  const texto = await response.text()
  if (response.status === 204 || texto === '') return undefined
  try {
    return JSON.parse(texto) as unknown
  } catch {
    throw new ApiError(response.status, MENSAGEM_RESPOSTA_INVALIDA)
  }
}
