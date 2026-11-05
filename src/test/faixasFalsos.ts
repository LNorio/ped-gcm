/**
 * Tabelas de faixas no formato devolvido por `GET /api/ped/faixas` (chaves com espaço), para os
 * testes da F8 (RF-41 a RF-46). Ver `docs/backend/API (24).md`, seção "fase 5: faixas".
 *
 * Lista padrão (na ordem da API):
 * - (1) PED Comercial · Filial 101 (CAMPO GRANDE) — "Resultado operacional", versão vigente v2
 *   (20/10/2026 15:30 por Ana Costa), 3 faixas: 0–1.000 (0%), 1.000,01–2.000 (1,5%), 2.000,01–5.000 (3%);
 * - (2) PED Comercial · Filial 102 (DOURADOS) — sem descrição, v1 (01/09/2026 10:00 por Maria Souza),
 *   2 faixas: 0–5.000 (1%), 5.000,01–10.000 (2%);
 * - (3) PED Gerentes · Filial 100 (MATRIZ) — sem descrição, v1 (01/08/2026 10:00 por Maria Souza),
 *   1 faixa: 0–3.000 (0,5%);
 * - (4) PED Antigo · Filial 101 (CAMPO GRANDE) — dashboard **excluído** ("dashboard excluido": true,
 *   nome guardado em "dashboard"), "Régua 2025", v3 (10/05/2026 09:00 por João Lima), 1 faixa: 0–1.000 (1%).
 *   É a única que pode ser excluída (RF-46).
 *
 * Histórico (`GET .../1/historico`): v2 vigente "Reajuste do trimestre" e v1 "Cadastro inicial".
 * Versões (`GET .../1/versoes/{v}`): v2 = faixas vigentes; v1 = 0–1.000 (0%), 1.000,01–3.000 (2%).
 *
 * Formatos assumidos enquanto a API não documenta (ver dúvidas da F8 em `docs/plano-implementacao.md`):
 * - listagem e histórico: lista pura (o serviço também aceita `{ tabelas }` e `{ historico }`);
 * - versão: objeto com `versao` e `faixas` (o serviço também aceita a lista pura de faixas);
 * - POST/PUT: `{ tabela }` (o serviço também aceita `{ faixa }`, a tabela na raiz ou qualquer 2xx sem
 *   tabela reconhecível — regra "2xx = gravado");
 * - DELETE: 204 sem corpo.
 */
import type { Faixa } from '../types/dominio'
import type { RotaFalsa } from './apiFalsa'
import { respostaJson } from './apiFalsa'

export interface FaixaApiFalsa {
  de: number
  ate: number
  aliquota: number
}

export interface TabelaFaixasApiFalsa {
  id: number
  'id dashboard': number
  dashboard: string
  'dashboard excluido': boolean
  filial: string
  'nome filial': string
  descricao: string | null
  'versao vigente': number
  'data da versao': string | null
  'autor da versao': string | null
  'quantidade de faixas': number
  faixas: FaixaApiFalsa[]
}

export interface VersaoFaixasApiFalsa {
  versao: number
  vigente: boolean
  motivo: string
  data: string
  usuario: string
  'quantidade de faixas': number
}

export const TABELA_COMERCIAL_101_API: TabelaFaixasApiFalsa = {
  id: 1,
  'id dashboard': 1,
  dashboard: 'PED Comercial',
  'dashboard excluido': false,
  filial: '101',
  'nome filial': 'CAMPO GRANDE',
  descricao: 'Resultado operacional',
  'versao vigente': 2,
  'data da versao': '2026-10-20 15:30:00',
  'autor da versao': 'Ana Costa',
  'quantidade de faixas': 3,
  faixas: [
    { de: 0, ate: 1000, aliquota: 0 },
    { de: 1000.01, ate: 2000, aliquota: 1.5 },
    { de: 2000.01, ate: 5000, aliquota: 3 },
  ],
}

export const TABELA_COMERCIAL_102_API: TabelaFaixasApiFalsa = {
  id: 2,
  'id dashboard': 1,
  dashboard: 'PED Comercial',
  'dashboard excluido': false,
  filial: '102',
  'nome filial': 'DOURADOS',
  descricao: null,
  'versao vigente': 1,
  'data da versao': '2026-09-01 10:00:00',
  'autor da versao': 'Maria Souza',
  'quantidade de faixas': 2,
  faixas: [
    { de: 0, ate: 5000, aliquota: 1 },
    { de: 5000.01, ate: 10000, aliquota: 2 },
  ],
}

export const TABELA_GERENTES_100_API: TabelaFaixasApiFalsa = {
  id: 3,
  'id dashboard': 2,
  dashboard: 'PED Gerentes',
  'dashboard excluido': false,
  filial: '100',
  'nome filial': 'MATRIZ',
  descricao: null,
  'versao vigente': 1,
  'data da versao': '2026-08-01 10:00:00',
  'autor da versao': 'Maria Souza',
  'quantidade de faixas': 1,
  faixas: [{ de: 0, ate: 3000, aliquota: 0.5 }],
}

export const TABELA_EXCLUIDO_101_API: TabelaFaixasApiFalsa = {
  id: 4,
  'id dashboard': 9,
  dashboard: 'PED Antigo',
  'dashboard excluido': true,
  filial: '101',
  'nome filial': 'CAMPO GRANDE',
  descricao: 'Régua 2025',
  'versao vigente': 3,
  'data da versao': '2026-05-10 09:00:00',
  'autor da versao': 'João Lima',
  'quantidade de faixas': 1,
  faixas: [{ de: 0, ate: 1000, aliquota: 1 }],
}

/** Nomes das tabelas ("{dashboard} · Filial {filial}"), na ordem da lista padrão. */
export const NOMES_TABELAS_FAIXAS = [
  'PED Comercial · Filial 101',
  'PED Comercial · Filial 102',
  'PED Gerentes · Filial 100',
  'PED Antigo · Filial 101',
] as const

/** Faixas da versão 1 da tabela 1 (antes do reajuste). */
export const FAIXAS_V1_COMERCIAL_101: FaixaApiFalsa[] = [
  { de: 0, ate: 1000, aliquota: 0 },
  { de: 1000.01, ate: 3000, aliquota: 2 },
]

export function copiarTabelaFaixas(tabela: TabelaFaixasApiFalsa): TabelaFaixasApiFalsa {
  return { ...tabela, faixas: tabela.faixas.map((faixa) => ({ ...faixa })) }
}

/** Lista padrão (4 tabelas), na ordem acima. Devolve sempre cópias novas. */
export function tabelasFaixasApi(): TabelaFaixasApiFalsa[] {
  return [TABELA_COMERCIAL_101_API, TABELA_COMERCIAL_102_API, TABELA_GERENTES_100_API, TABELA_EXCLUIDO_101_API].map(
    copiarTabelaFaixas,
  )
}

/** Histórico de versões da tabela 1, da mais recente para a mais antiga (ordem da API). */
export function historicoFaixasApi(): VersaoFaixasApiFalsa[] {
  return [
    {
      versao: 2,
      vigente: true,
      motivo: 'Reajuste do trimestre',
      data: '2026-10-20 15:30:00',
      usuario: 'Ana Costa',
      'quantidade de faixas': 3,
    },
    {
      versao: 1,
      vigente: false,
      motivo: 'Cadastro inicial',
      data: '2026-09-01 10:00:00',
      usuario: 'Maria Souza',
      'quantidade de faixas': 2,
    },
  ]
}

/** Resposta de `GET .../1/versoes/{versao}` (v1 ou v2 da tabela 1). */
export function versaoFaixasApi(versao: 1 | 2) {
  const faixas = versao === 1 ? FAIXAS_V1_COMERCIAL_101 : TABELA_COMERCIAL_101_API.faixas
  return { versao, faixas: faixas.map((faixa) => ({ ...faixa })) }
}

/** Resposta de `POST /api/ped/faixas` e `PUT .../{id}`: a tabela gravada em `{ tabela }`. */
export function respostaGravacaoFaixasApi(tabela: TabelaFaixasApiFalsa) {
  return { tabela }
}

/**
 * Aplica à lista o filtro da query string como a API faz para o Admin: `filial` (omitida ou `todas`
 * = todas) e `dashboard` (id).
 */
export function filtrarTabelasFaixasApi(lista: TabelaFaixasApiFalsa[], url: URL): TabelaFaixasApiFalsa[] {
  const filial = url.searchParams.get('filial')
  const dashboard = url.searchParams.get('dashboard')
  return lista.filter(
    (tabela) =>
      (filial === null || filial === '' || filial === 'todas' || tabela.filial === filial) &&
      (dashboard === null || String(tabela['id dashboard']) === dashboard),
  )
}

/** Rota falsa de `GET /api/ped/faixas` com filtragem pela query; `obterLista` é lida a cada chamada. */
export function rotaListarFaixas(obterLista: () => TabelaFaixasApiFalsa[]): RotaFalsa {
  return (_init, url) => respostaJson(filtrarTabelasFaixasApi(obterLista(), url))
}

interface CorpoCadastroFalso {
  dashboard: number
  filial: string
  descricao: string | null
  faixas: Faixa[]
}

interface CorpoAlteracaoFalso {
  motivo: string
  faixas: Faixa[]
}

/** Nomes dos dashboards conhecidos pela API falsa (os de `dashboardsFalsos.ts`). */
const NOMES_DASHBOARDS_FALSOS: Readonly<Record<number, string>> = {
  1: 'PED Comercial',
  2: 'PED Gerentes',
  3: 'PED Supervisores',
  4: 'PED Logística',
  5: 'PED Financeiro',
}

const NOMES_FILIAIS_FALSOS: Readonly<Record<string, string>> = {
  '100': 'MATRIZ',
  '101': 'CAMPO GRANDE',
  '102': 'DOURADOS',
}

/**
 * Back-end falso das faixas para os testes de integração: guarda a lista em memória e atende
 * `GET /api/ped/faixas` (com filtro), `POST /api/ped/faixas` (versão 1, por "Fulano"),
 * `PUT /api/ped/faixas/{id}` (versão seguinte), `DELETE /api/ped/faixas/{id}` (204),
 * `GET .../1/historico` e `GET .../1/versoes/{1|2}`. Devolve as rotas e um leitor da lista atual.
 */
export function criarApiFaixasFalsa(inicial: TabelaFaixasApiFalsa[] = tabelasFaixasApi()) {
  let lista = inicial.map(copiarTabelaFaixas)
  let proximoId = 50

  const rotas: Record<string, RotaFalsa> = {
    'GET /api/ped/faixas': rotaListarFaixas(() => lista),
    'POST /api/ped/faixas': (init) => {
      const corpo = JSON.parse(String(init?.body)) as CorpoCadastroFalso
      const nova: TabelaFaixasApiFalsa = {
        id: proximoId++,
        'id dashboard': corpo.dashboard,
        dashboard: NOMES_DASHBOARDS_FALSOS[corpo.dashboard] ?? `Dashboard ${corpo.dashboard}`,
        'dashboard excluido': false,
        filial: corpo.filial,
        'nome filial': NOMES_FILIAIS_FALSOS[corpo.filial] ?? corpo.filial,
        descricao: corpo.descricao,
        'versao vigente': 1,
        'data da versao': '2026-11-05 09:00:00',
        'autor da versao': 'Fulano',
        'quantidade de faixas': corpo.faixas.length,
        faixas: corpo.faixas.map((faixa) => ({ ...faixa })),
      }
      lista = [...lista, nova]
      return respostaJson(respostaGravacaoFaixasApi(nova), 201)
    },
  }

  for (const tabela of lista) {
    const id = tabela.id
    rotas[`PUT /api/ped/faixas/${id}`] = (init) => {
      const corpo = JSON.parse(String(init?.body)) as CorpoAlteracaoFalso
      lista = lista.map((atual) =>
        atual.id === id
          ? {
              ...atual,
              'versao vigente': atual['versao vigente'] + 1,
              'data da versao': '2026-11-05 09:00:00',
              'autor da versao': 'Fulano',
              'quantidade de faixas': corpo.faixas.length,
              faixas: corpo.faixas.map((faixa) => ({ ...faixa })),
            }
          : atual,
      )
      return respostaJson(respostaGravacaoFaixasApi(lista.find((atual) => atual.id === id)!))
    }
    rotas[`DELETE /api/ped/faixas/${id}`] = () => {
      lista = lista.filter((atual) => atual.id !== id)
      return new Response(null, { status: 204 })
    }
  }

  rotas['GET /api/ped/faixas/1/historico'] = () => respostaJson(historicoFaixasApi())
  rotas['GET /api/ped/faixas/1/versoes/1'] = () => respostaJson(versaoFaixasApi(1))
  rotas['GET /api/ped/faixas/1/versoes/2'] = () => respostaJson(versaoFaixasApi(2))

  return { rotas, tabelas: () => lista }
}
