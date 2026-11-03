/**
 * Auxiliares para simular a API nos testes (somente `fetch` é simulado).
 *
 * `simularApi` casa cada chamada pela chave `"MÉTODO /caminho"` (ex.: `"POST /api/valida-usuario"`)
 * e devolve a resposta configurada; chamadas sem rota configurada recebem 404.
 */
import type { MockInstance } from 'vitest'

export type FetchFalso = MockInstance<typeof fetch>

export function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function respostaErro(status: number, mensagem?: string): Response {
  return respostaJson(mensagem ? { mensagem } : {}, status)
}

/** Filial no formato devolvido por `GET /api/ped/acesso`. */
export interface FilialApiFalsa {
  filial: string
  'nome filial': string
}

/** Resposta de `GET /api/ped/acesso` no formato da API (chaves com espaço). */
export interface AcessoApiFalso {
  'id colaborador': number
  nome: string
  perfil: 'admin' | 'validador' | 'preenchedor' | null
  tipos: Array<{ id: number; nome: string }>
  'todas as filiais': boolean
  filiais: FilialApiFalsa[]
  'periodo aberto': string | null
}

export const FILIAIS_API: FilialApiFalsa[] = [
  { filial: '100', 'nome filial': 'MATRIZ' },
  { filial: '101', 'nome filial': 'CAMPO GRANDE' },
  { filial: '102', 'nome filial': 'DOURADOS' },
]

export function acessoApi(sobrescrever: Partial<AcessoApiFalso> = {}): AcessoApiFalso {
  return {
    'id colaborador': 12,
    nome: 'Fulano',
    perfil: 'preenchedor',
    tipos: [{ id: 1, nome: 'Comercial' }],
    'todas as filiais': false,
    filiais: [FILIAIS_API[1]],
    'periodo aberto': '2026-10-01',
    ...sobrescrever,
  }
}

export type RotaFalsa = (init: RequestInit | undefined, url: URL) => Response | Promise<Response>

export interface ChamadaRegistrada {
  metodo: string
  caminho: string
  init: RequestInit | undefined
  url: URL
}

/**
 * Configura o `fetch` simulado com rotas `"MÉTODO /caminho"`. Devolve a lista de chamadas
 * registradas (método, caminho, init) para asserções.
 */
export function simularApi(fetchFalso: FetchFalso, rotas: Record<string, RotaFalsa>): ChamadaRegistrada[] {
  const chamadas: ChamadaRegistrada[] = []
  fetchFalso.mockImplementation(async (entrada, init) => {
    const urlTexto = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
    const url = new URL(urlTexto, 'http://localhost')
    const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase()
    chamadas.push({ metodo, caminho: url.pathname, init, url })
    const rota = rotas[`${metodo} ${url.pathname}`]
    if (!rota) return respostaErro(404, `Rota não simulada: ${metodo} ${url.pathname}`)
    return rota(init, url)
  })
  return chamadas
}

/** Lê um cabeçalho de uma chamada registrada. */
export function cabecalhoDaChamada(chamada: ChamadaRegistrada, nome: string): string | null {
  return new Headers(chamada.init?.headers).get(nome)
}

/** Lê o corpo JSON enviado em uma chamada registrada. */
export function corpoDaChamada(chamada: ChamadaRegistrada): unknown {
  const corpo = chamada.init?.body
  if (typeof corpo !== 'string') return undefined
  return JSON.parse(corpo) as unknown
}
