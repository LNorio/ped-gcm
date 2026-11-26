/**
 * Auxiliares para simular a API nos testes (somente `fetch` é simulado).
 *
 * `simularApi` casa cada chamada pela chave `"MÉTODO /caminho"` (ex.: `"POST /api/valida-usuario"`)
 * e devolve a resposta configurada; chamadas sem rota configurada recebem 404.
 *
 * Exceção (F2.12, 19/11/2026): `GET /api/ped/alertas-menu` é consultado pelo layout em toda sessão
 * autenticada. Quando o teste não configura essa rota, ela recebe a resposta padrão vazia
 * (`{ "abas": {} }`, nenhuma aba acesa) e a chamada **não** entra na lista de chamadas registradas, para
 * que os testes que não tratam dos alertas do menu não dependam dela. Configurada pelo teste, a rota é
 * tratada e registrada como qualquer outra.
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

/** Rota consultada pelo verificador dos alertas do menu (F2.12); ver `simularApi`. */
const CHAVE_ALERTAS_MENU = 'GET /api/ped/alertas-menu'

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
    const chave = `${metodo} ${url.pathname}`
    if (chave === CHAVE_ALERTAS_MENU && !rotas[chave]) return respostaJson({ abas: {} })
    chamadas.push({ metodo, caminho: url.pathname, init, url })
    const rota = rotas[chave]
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

/**
 * Rota que devolve as respostas em sequência, uma por chamada; a partir do fim da lista, repete a
 * última. Ex.: `GET /api/ped/acesso` com um acesso no login e outro na releitura (F2.1
 * `recarregarAcesso`, 18/11/2026).
 */
export function rotaEmSequencia(...rotas: RotaFalsa[]): RotaFalsa {
  if (rotas.length === 0) throw new Error('rotaEmSequencia precisa de ao menos uma rota')
  let indice = 0
  return (init, url) => {
    const rota = rotas[Math.min(indice, rotas.length - 1)]
    indice += 1
    return rota(init, url)
  }
}

/** Resposta que fica pendente até o teste chamar `responder` (ou `falhar`). */
export interface RespostaPendente {
  rota: RotaFalsa
  responder: (resposta: Response) => void
  falhar: (erro: unknown) => void
}

export function respostaPendente(): RespostaPendente {
  let responder: (resposta: Response) => void = () => {}
  let falhar: (erro: unknown) => void = () => {}
  const promessa = new Promise<Response>((resolve, reject) => {
    responder = resolve
    falhar = reject
  })
  return { rota: () => promessa, responder: (r) => responder(r), falhar: (e) => falhar(e) }
}

/**
 * Os 7 tipos fixos no formato de `acesso.tipos` (`GET /api/ped/acesso`), na ordem por nome
 * (docs/backend/PROPOSTA-tipos-no-acesso.md).
 */
export const TIPOS_FIXOS_ACESSO_API: Array<{ id: number; nome: string }> = [
  { id: 1, nome: 'Comercial' },
  { id: 7, nome: 'Contabilidade' },
  { id: 2, nome: 'Financeiro' },
  { id: 5, nome: 'Fiscal' },
  { id: 6, nome: 'Processos' },
  { id: 3, nome: 'Recursos Humanos' },
  { id: 4, nome: 'Tecnologia da Informação' },
]

/** Tipo personalizado criado depois do login (caso real de 18/11/2026). */
export const TIPO_DEPARTAMENTO_PESSOAL_ACESSO_API = { id: 8, nome: 'Departamento Pessoal' }

/** Os 7 fixos mais "Departamento Pessoal", na ordem por nome. */
export const TIPOS_COM_DEPARTAMENTO_PESSOAL_ACESSO_API: Array<{ id: number; nome: string }> = [
  TIPOS_FIXOS_ACESSO_API[0],
  TIPOS_FIXOS_ACESSO_API[1],
  TIPO_DEPARTAMENTO_PESSOAL_ACESSO_API,
  ...TIPOS_FIXOS_ACESSO_API.slice(2),
]
