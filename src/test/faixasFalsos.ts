/**
 * Tabelas de faixas no formato devolvido por `GET /api/ped/faixas` (chaves com espaço), para os
 * testes da F8 (RF-41 a RF-46). Ver `docs/backend/API (28).md`, seção "fase 5: faixas", e o guia
 * `docs/backend/FRONT-faixa-geral-e-situacao.md` (F8.7 e F8.8 — faixa geral, situação ativa/inativa,
 * motivo obrigatório e "Ver motivo"; contrato final de 12/11/2026, F8.12*).
 *
 * Contrato final (F8.12*): datas no formato `2026-11-12 14:05:00-04:00`; `acao` sempre presente no
 * histórico (5 valores, com `exclusao`); linhas de inativação/reativação/exclusão com `vigente: false`
 * e "quantidade de faixas" `null`; `POST` responde `{ mensagem, id, versao, geral }`, `PUT`
 * `{ mensagem, versao }` e `PUT .../situacao` `{ mensagem, situacao }` (sem a tabela); a mensagem de
 * conflito não cita o dashboard; faixa de dashboard excluído não muda de situação (`400`).
 *
 * Lista padrão (na ordem da API) — formato atual do back-end, **sem** os campos novos da proposta
 * (`geral`, `situacao`, "motivo/data/usuario da situacao"): o front lê como `geral: false` e `ativa`:
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
 * Tabelas com os campos novos (F8.7), em `tabelasFaixasComSituacaoApi()` (lista padrão + estas três):
 * - (5) PED Supervisores · Geral — faixa **geral** ativa (filial e nome filial `null`), "Régua única",
 *   v1 (01/11/2026 10:00 por Ana Costa), 1 faixa: 0–2.000 (1%);
 * - (6) PED Comercial · Filial 100 (MATRIZ) — **inativa** desde 10/11/2026 08:00 (`-04:00`) por Ana Costa, motivo
 *   "Filial passou a usar outra régua", v2 (01/10/2026 09:00 por Maria Souza), 1 faixa: 0–4.000 (1%);
 * - (7) PED Gerentes · Geral — faixa **geral inativa** desde 12/11/2026 14:05 por admin, motivo
 *   "passou a valer faixa por filial", v2 (01/11/2026 10:00 por admin), 1 faixa: 0–1.000 (0%).
 *   Reativá-la gera conflito: a filial 100 do PED Gerentes (3) está ativa.
 *
 * Histórico (`GET .../{id}/historico`):
 * - tabela 1: v2 vigente "Reajuste do trimestre" e v1 "Cadastro inicial" (sem `acao`, formato atual);
 * - tabela 6: inativação (v2, `vigente: false`, sem quantidade, data com `-04:00`), alteração (v2) e
 *   cadastro (v1), com `acao`;
 * - demais: uma linha de cadastro da versão vigente (`acao: "cadastro"`).
 * Versões (`GET .../1/versoes/{v}`): v2 = faixas vigentes; v1 = 0–1.000 (0%), 1.000,01–3.000 (2%).
 *
 * Formatos assumidos enquanto a API não documenta (ver dúvidas da F8 em `docs/plano-implementacao.md`):
 * - listagem e histórico: lista pura (o serviço também aceita `{ tabelas }` e `{ historico }`);
 * - versão: objeto com `versao` e `faixas` (o serviço também aceita a lista pura de faixas);
 * - POST/PUT na API falsa (`criarApiFaixasFalsa`): no formato final, sem a tabela (regra "2xx =
 *   gravado"; a tela recarrega a lista). `respostaGravacaoFaixasApi` (`{ tabela }`) fica só para os
 *   testes de tolerância do serviço;
 * - DELETE: 204 sem corpo.
 */
import type { Faixa } from '../types/dominio'
import type { RotaFalsa } from './apiFalsa'
import { respostaErro, respostaJson } from './apiFalsa'

export interface FaixaApiFalsa {
  de: number
  ate: number
  aliquota: number
}

export type SituacaoTabelaFaixasApiFalsa = 'ativa' | 'inativa'

export type AcaoHistoricoFaixasApiFalsa = 'cadastro' | 'alteracao' | 'inativacao' | 'reativacao' | 'exclusao'

export interface TabelaFaixasApiFalsa {
  id: number
  'id dashboard': number
  dashboard: string
  'dashboard excluido': boolean
  /** F8.7: `true` na faixa geral (todas as filiais). Ausente no formato atual = `false`. */
  geral?: boolean
  /** `null` na faixa geral. */
  filial: string | null
  /** `null` na faixa geral. */
  'nome filial': string | null
  /** F8.7: ausente no formato atual = `ativa`. */
  situacao?: SituacaoTabelaFaixasApiFalsa
  'motivo da situacao'?: string | null
  'data da situacao'?: string | null
  'usuario da situacao'?: string | null
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
  /** `null` nas linhas de inativação, reativação e exclusão (não são versões). */
  'quantidade de faixas': number | null
  /** F8.5/F8.7: sempre presente no contrato final; ausente = alteração das faixas (tolerância). */
  acao?: AcaoHistoricoFaixasApiFalsa
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

/** (5) Faixa geral ativa do PED Supervisores (F8.7). */
export const TABELA_GERAL_SUPERVISORES_API: TabelaFaixasApiFalsa = {
  id: 5,
  'id dashboard': 3,
  dashboard: 'PED Supervisores',
  'dashboard excluido': false,
  geral: true,
  filial: null,
  'nome filial': null,
  situacao: 'ativa',
  'motivo da situacao': null,
  'data da situacao': null,
  'usuario da situacao': null,
  descricao: 'Régua única',
  'versao vigente': 1,
  'data da versao': '2026-11-01 10:00:00',
  'autor da versao': 'Ana Costa',
  'quantidade de faixas': 1,
  faixas: [{ de: 0, ate: 2000, aliquota: 1 }],
}

/** (6) Faixa da filial 100 do PED Comercial, inativa (F8.7). */
export const TABELA_COMERCIAL_100_INATIVA_API: TabelaFaixasApiFalsa = {
  id: 6,
  'id dashboard': 1,
  dashboard: 'PED Comercial',
  'dashboard excluido': false,
  geral: false,
  filial: '100',
  'nome filial': 'MATRIZ',
  situacao: 'inativa',
  'motivo da situacao': 'Filial passou a usar outra régua',
  'data da situacao': '2026-11-10 08:00:00-04:00',
  'usuario da situacao': 'Ana Costa',
  descricao: null,
  'versao vigente': 2,
  'data da versao': '2026-10-01 09:00:00',
  'autor da versao': 'Maria Souza',
  'quantidade de faixas': 1,
  faixas: [{ de: 0, ate: 4000, aliquota: 1 }],
}

/** (7) Faixa geral inativa do PED Gerentes (F8.7); reativá-la conflita com a filial 100 ativa. */
export const TABELA_GERAL_GERENTES_INATIVA_API: TabelaFaixasApiFalsa = {
  id: 7,
  'id dashboard': 2,
  dashboard: 'PED Gerentes',
  'dashboard excluido': false,
  geral: true,
  filial: null,
  'nome filial': null,
  situacao: 'inativa',
  'motivo da situacao': 'passou a valer faixa por filial',
  'data da situacao': '2026-11-12 14:05:00-04:00',
  'usuario da situacao': 'admin',
  descricao: null,
  'versao vigente': 2,
  'data da versao': '2026-11-01 10:00:00',
  'autor da versao': 'admin',
  'quantidade de faixas': 1,
  faixas: [{ de: 0, ate: 1000, aliquota: 0 }],
}

/** Nomes das tabelas ("{dashboard} · Filial {filial}"), na ordem da lista padrão. */
export const NOMES_TABELAS_FAIXAS = [
  'PED Comercial · Filial 101',
  'PED Comercial · Filial 102',
  'PED Gerentes · Filial 100',
  'PED Antigo · Filial 101',
] as const

/** Nomes das tabelas 5, 6 e 7 (faixa geral = "{dashboard} · Geral"). */
export const NOME_GERAL_SUPERVISORES = 'PED Supervisores · Geral'
export const NOME_COMERCIAL_100_INATIVA = 'PED Comercial · Filial 100'
export const NOME_GERAL_GERENTES_INATIVA = 'PED Gerentes · Geral'

/** Faixas da versão 1 da tabela 1 (antes do reajuste). */
export const FAIXAS_V1_COMERCIAL_101: FaixaApiFalsa[] = [
  { de: 0, ate: 1000, aliquota: 0 },
  { de: 1000.01, ate: 3000, aliquota: 2 },
]

export function copiarTabelaFaixas(tabela: TabelaFaixasApiFalsa): TabelaFaixasApiFalsa {
  return { ...tabela, faixas: tabela.faixas.map((faixa) => ({ ...faixa })) }
}

/** Lista padrão (4 tabelas, formato atual), na ordem acima. Devolve sempre cópias novas. */
export function tabelasFaixasApi(): TabelaFaixasApiFalsa[] {
  return [TABELA_COMERCIAL_101_API, TABELA_COMERCIAL_102_API, TABELA_GERENTES_100_API, TABELA_EXCLUIDO_101_API].map(
    copiarTabelaFaixas,
  )
}

/** Lista padrão + tabelas 5 (geral ativa), 6 (inativa) e 7 (geral inativa). Cópias novas. */
export function tabelasFaixasComSituacaoApi(): TabelaFaixasApiFalsa[] {
  return [
    ...tabelasFaixasApi(),
    ...[TABELA_GERAL_SUPERVISORES_API, TABELA_COMERCIAL_100_INATIVA_API, TABELA_GERAL_GERENTES_INATIVA_API].map(copiarTabelaFaixas),
  ]
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

/** Histórico da tabela 6 (inativa), com `acao`, da mais recente para a mais antiga. */
export function historicoComAcaoFaixasApi(): VersaoFaixasApiFalsa[] {
  return [
    {
      versao: 2,
      vigente: false,
      motivo: 'Filial passou a usar outra régua',
      data: '2026-11-10 08:00:00-04:00',
      usuario: 'Ana Costa',
      'quantidade de faixas': null,
      acao: 'inativacao',
    },
    {
      versao: 2,
      vigente: true,
      motivo: 'Ajuste da alíquota',
      data: '2026-10-01 09:00:00',
      usuario: 'Maria Souza',
      'quantidade de faixas': 1,
      acao: 'alteracao',
    },
    {
      versao: 1,
      vigente: false,
      motivo: 'Cadastro inicial',
      data: '2026-09-01 10:00:00',
      usuario: 'Maria Souza',
      'quantidade de faixas': 1,
      acao: 'cadastro',
    },
  ]
}

/** Histórico de uma linha (cadastro da versão vigente), usado nas tabelas sem histórico próprio. */
export function historicoCadastroFaixasApi(tabela: TabelaFaixasApiFalsa): VersaoFaixasApiFalsa[] {
  return [
    {
      versao: tabela['versao vigente'],
      vigente: true,
      motivo: 'Cadastro inicial',
      data: tabela['data da versao'] ?? '2026-09-01 10:00:00',
      usuario: tabela['autor da versao'] ?? 'Maria Souza',
      'quantidade de faixas': tabela['quantidade de faixas'],
      acao: 'cadastro',
    },
  ]
}

/**
 * Histórico de uma tabela já excluída (contrato final): só os eventos do log, com `acao: "exclusao"`
 * na linha mais recente (`vigente: false`, sem quantidade).
 */
export function historicoExcluidaFaixasApi(): VersaoFaixasApiFalsa[] {
  return [
    {
      versao: 3,
      vigente: false,
      motivo: 'Dashboard encerrado em 2025',
      data: '2026-11-12 14:05:00-04:00',
      usuario: 'admin',
      'quantidade de faixas': null,
      acao: 'exclusao',
    },
    {
      versao: 3,
      vigente: true,
      motivo: 'Reajuste 2025',
      data: '2026-05-10 09:00:00-04:00',
      usuario: 'João Lima',
      'quantidade de faixas': 1,
      acao: 'alteracao',
    },
    {
      versao: 1,
      vigente: false,
      motivo: 'Cadastro inicial',
      data: '2025-01-10 09:00:00-04:00',
      usuario: 'João Lima',
      'quantidade de faixas': 1,
      acao: 'cadastro',
    },
  ]
}

/** Resposta de `GET .../1/versoes/{versao}` (v1 ou v2 da tabela 1). */
export function versaoFaixasApi(versao: 1 | 2) {
  const faixas = versao === 1 ? FAIXAS_V1_COMERCIAL_101 : TABELA_COMERCIAL_101_API.faixas
  return { versao, faixas: faixas.map((faixa) => ({ ...faixa })) }
}

/**
 * Resposta antiga/tolerada de `POST /api/ped/faixas` e `PUT .../{id}`: a tabela gravada em `{ tabela }`.
 * O contrato final não devolve a tabela (ver as três respostas abaixo).
 */
export function respostaGravacaoFaixasApi(tabela: TabelaFaixasApiFalsa) {
  return { tabela }
}

/** Contrato final do `201` de `POST /api/ped/faixas`: `{ mensagem, id, versao, geral }` (sem a tabela). */
export function respostaCadastroFaixasApi(tabela: Pick<TabelaFaixasApiFalsa, 'id' | 'versao vigente' | 'geral'>) {
  return { mensagem: 'tabela de faixas cadastrada', id: tabela.id, versao: tabela['versao vigente'], geral: tabela.geral === true }
}

/** Contrato final do `200` de `PUT /api/ped/faixas/{id}`: `{ mensagem, versao }` (sem a tabela). */
export function respostaAlteracaoFaixasApi(versao: number) {
  return { mensagem: 'faixas alteradas', versao }
}

/** Contrato final do `200` de `PUT /api/ped/faixas/{id}/situacao`: `{ mensagem, situacao }` (sem a tabela). */
export function respostaSituacaoFaixasApi(situacao: SituacaoTabelaFaixasApiFalsa) {
  return { mensagem: situacao === 'ativa' ? 'tabela de faixas reativada' : 'tabela de faixas inativada', situacao }
}

/** `400` da API ao inativar/reativar faixa de dashboard já excluído (contrato final). */
export const MENSAGEM_SITUACAO_DASHBOARD_EXCLUIDO = 'faixa de dashboard excluido nao muda de situacao'

/** `400` da API ao listar com `situacao` fora de `ativas|inativas|todas`. */
export const MENSAGEM_SITUACAO_INVALIDA = 'situacao invalida'

const ehGeral = (tabela: TabelaFaixasApiFalsa) => tabela.geral === true
const ehAtiva = (tabela: TabelaFaixasApiFalsa) => (tabela.situacao ?? 'ativa') === 'ativa'

function casaSituacaoFaixas(tabela: TabelaFaixasApiFalsa, situacao: string | null): boolean {
  if (situacao === 'ativas') return ehAtiva(tabela)
  if (situacao === 'inativas') return !ehAtiva(tabela)
  return true
}

/**
 * Aplica à lista o filtro da query string como a API faz para o Admin: `filial` (omitida ou `todas`
 * = todas; uma filial também traz as faixas gerais — F8.7), `dashboard` (id) e `situacao` (`ativas`,
 * `inativas`, `todas` ou omitida = todas — F8.7).
 */
export function filtrarTabelasFaixasApi(lista: TabelaFaixasApiFalsa[], url: URL): TabelaFaixasApiFalsa[] {
  const filial = url.searchParams.get('filial')
  const dashboard = url.searchParams.get('dashboard')
  const situacao = url.searchParams.get('situacao')
  return lista.filter(
    (tabela) =>
      (filial === null || filial === '' || filial === 'todas' || tabela.filial === filial || ehGeral(tabela)) &&
      (dashboard === null || String(tabela['id dashboard']) === dashboard) &&
      casaSituacaoFaixas(tabela, situacao),
  )
}

/**
 * Rota falsa de `GET /api/ped/faixas` com filtragem pela query; `obterLista` é lida a cada chamada.
 * `situacao` fora de `ativas|inativas|todas` responde `400` (contrato final).
 */
export function rotaListarFaixas(obterLista: () => TabelaFaixasApiFalsa[]): RotaFalsa {
  return (_init, url) => {
    const situacao = url.searchParams.get('situacao')
    if (situacao !== null && !['ativas', 'inativas', 'todas'].includes(situacao)) return respostaErro(400, MENSAGEM_SITUACAO_INVALIDA)
    return respostaJson(filtrarTabelasFaixasApi(obterLista(), url))
  }
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

interface CorpoSituacaoFalso {
  ativa: boolean
  motivo?: string
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

/** Data (formato final, com fuso) e autor gravados pela API falsa nas mudanças de situação (F8.7). */
export const DATA_SITUACAO_FALSA = '2026-11-12 09:00:00-04:00'
export const USUARIO_SITUACAO_FALSO = 'Fulano'

/**
 * Mensagens do `400` de conflito (contrato final, `API (28).md`): **não** citam o dashboard (o front
 * acrescenta o nome).
 * - faixa por filial com geral ativa no dashboard;
 * - faixa geral com outras faixas ativas no dashboard;
 * - filial repetida;
 * - corrida entre duas gravações (sem `conflitos`).
 */
export const MENSAGEM_CONFLITO_GERAL_ATIVA =
  'o dashboard tem uma tabela de faixas geral ativa; inative-a antes de usar tabelas por filial'
export const MENSAGEM_CONFLITO_FAIXAS_ATIVAS =
  'ja existe tabela de faixas ativa neste dashboard; para usar a tabela geral, inative as demais antes'
export const MENSAGEM_CONFLITO_FILIAL_ATIVA =
  'ja existe uma tabela de faixas ativa para este dashboard e filial; use "Alterar faixas" ou inative-a antes'
export const MENSAGEM_CONFLITO_CORRIDA =
  'ja existe uma tabela de faixas ativa em conflito com esta; atualize a tela e tente de novo'

/** Corpo do `400` de conflito (`mensagem` + `conflitos`), ou `null` sem conflito. */
function conflitoAoAtivar(
  lista: TabelaFaixasApiFalsa[],
  alvo: { id: number | null; idDashboard: number; geral: boolean; filial: string | null },
): { mensagem: string; conflitos: unknown[] } | null {
  const ativasDoDashboard = lista.filter(
    (tabela) => tabela.id !== alvo.id && tabela['id dashboard'] === alvo.idDashboard && ehAtiva(tabela),
  )
  const paraConflito = (tabela: TabelaFaixasApiFalsa) => ({
    id: tabela.id,
    geral: ehGeral(tabela),
    filial: tabela.filial,
    'nome filial': tabela['nome filial'],
  })
  if (alvo.geral) {
    if (ativasDoDashboard.length === 0) return null
    return { mensagem: MENSAGEM_CONFLITO_FAIXAS_ATIVAS, conflitos: ativasDoDashboard.map(paraConflito) }
  }
  const geralAtiva = ativasDoDashboard.filter(ehGeral)
  if (geralAtiva.length > 0) {
    return { mensagem: MENSAGEM_CONFLITO_GERAL_ATIVA, conflitos: geralAtiva.map(paraConflito) }
  }
  const mesmaFilial = ativasDoDashboard.filter((tabela) => tabela.filial === alvo.filial)
  if (mesmaFilial.length === 0) return null
  return { mensagem: MENSAGEM_CONFLITO_FILIAL_ATIVA, conflitos: mesmaFilial.map(paraConflito) }
}

function lerCorpo<T>(init: RequestInit | undefined): T | null {
  if (typeof init?.body !== 'string' || init.body === '') return null
  return JSON.parse(init.body) as T
}

/**
 * Back-end falso das faixas para os testes de integração (contrato final — F8.12*): guarda a lista
 * em memória e atende
 * - `GET /api/ped/faixas` (com filtro de filial, dashboard e situação; situação inválida = `400`);
 * - `POST /api/ped/faixas` (versão 1, por "Fulano"; `"filial": "todas"` cria a faixa geral; `400`
 *   com `mensagem` e `conflitos` quando a regra "geral OU por filial" é violada — F8.7); `201`
 *   `{ mensagem, id, versao, geral }`, sem a tabela;
 * - `PUT /api/ped/faixas/{id}` (versão seguinte; `200` `{ mensagem, versao }`, sem a tabela);
 * - `PUT /api/ped/faixas/{id}/situacao` `{ ativa, motivo }` (F8.7: motivo obrigatório; reativar
 *   segue as regras de conflito; faixa de dashboard excluído ou já na situação pedida = `400`;
 *   acrescenta a linha de inativação/reativação ao histórico; `200` `{ mensagem, situacao }`);
 * - `DELETE /api/ped/faixas/{id}` (204; `400` sem `motivo` no corpo ou com o dashboard existente — F8.6;
 *   acrescenta a linha `exclusao` ao histórico, que continua respondendo);
 * - `GET .../{id}/historico` (tabela 1: `historicoFaixasApi`; 6: `historicoComAcaoFaixasApi`; demais:
 *   `historicoCadastroFaixasApi`) e `GET .../1/versoes/{1|2}`.
 * Devolve as rotas, um leitor da lista atual e um leitor do histórico de uma tabela.
 */
export function criarApiFaixasFalsa(inicial: TabelaFaixasApiFalsa[] = tabelasFaixasApi()) {
  let lista = inicial.map(copiarTabelaFaixas)
  let proximoId = 50
  const historicos = new Map<number, VersaoFaixasApiFalsa[]>()
  for (const tabela of lista) {
    historicos.set(
      tabela.id,
      tabela.id === 1 ? historicoFaixasApi() : tabela.id === 6 ? historicoComAcaoFaixasApi() : historicoCadastroFaixasApi(tabela),
    )
  }

  const atual = (id: number) => lista.find((tabela) => tabela.id === id)

  const rotas: Record<string, RotaFalsa> = {
    'GET /api/ped/faixas': rotaListarFaixas(() => lista),
    'POST /api/ped/faixas': (init) => {
      const corpo = lerCorpo<CorpoCadastroFalso>(init)!
      const geral = corpo.filial === 'todas'
      const nomeDashboard = NOMES_DASHBOARDS_FALSOS[corpo.dashboard] ?? `Dashboard ${corpo.dashboard}`
      const conflito = conflitoAoAtivar(lista, {
        id: null,
        idDashboard: corpo.dashboard,
        geral,
        filial: geral ? null : corpo.filial,
      })
      if (conflito) return respostaJson(conflito, 400)
      const nova: TabelaFaixasApiFalsa = {
        id: proximoId++,
        'id dashboard': corpo.dashboard,
        dashboard: nomeDashboard,
        'dashboard excluido': false,
        geral,
        filial: geral ? null : corpo.filial,
        'nome filial': geral ? null : (NOMES_FILIAIS_FALSOS[corpo.filial] ?? corpo.filial),
        situacao: 'ativa',
        'motivo da situacao': null,
        'data da situacao': null,
        'usuario da situacao': null,
        descricao: corpo.descricao,
        'versao vigente': 1,
        'data da versao': '2026-11-05 09:00:00',
        'autor da versao': 'Fulano',
        'quantidade de faixas': corpo.faixas.length,
        faixas: corpo.faixas.map((faixa) => ({ ...faixa })),
      }
      lista = [...lista, nova]
      historicos.set(nova.id, historicoCadastroFaixasApi(nova))
      return respostaJson(respostaCadastroFaixasApi(nova), 201)
    },
  }

  for (const tabela of lista) {
    const id = tabela.id
    rotas[`PUT /api/ped/faixas/${id}`] = (init) => {
      const corpo = lerCorpo<CorpoAlteracaoFalso>(init)!
      if (!ehAtiva(atual(id)!)) return respostaErro(400, 'a tabela de faixas esta inativa; reative a faixa antes de alterar')
      lista = lista.map((item) =>
        item.id === id
          ? {
              ...item,
              'versao vigente': item['versao vigente'] + 1,
              'data da versao': '2026-11-05 09:00:00',
              'autor da versao': 'Fulano',
              'quantidade de faixas': corpo.faixas.length,
              faixas: corpo.faixas.map((faixa) => ({ ...faixa })),
            }
          : item,
      )
      return respostaJson(respostaAlteracaoFaixasApi(atual(id)!['versao vigente']))
    }
    rotas[`PUT /api/ped/faixas/${id}/situacao`] = (init) => {
      const corpo = lerCorpo<CorpoSituacaoFalso>(init)
      const motivo = corpo?.motivo?.trim() ?? ''
      if (corpo === null || motivo === '') return respostaErro(400, 'Informe o motivo.')
      const tabelaAtual = atual(id)!
      if (tabelaAtual['dashboard excluido']) return respostaErro(400, MENSAGEM_SITUACAO_DASHBOARD_EXCLUIDO)
      if (corpo.ativa === ehAtiva(tabelaAtual)) {
        return respostaErro(400, `a tabela de faixas ja esta ${corpo.ativa ? 'ativa' : 'inativa'}`)
      }
      if (corpo.ativa) {
        const conflito = conflitoAoAtivar(lista, {
          id,
          idDashboard: tabelaAtual['id dashboard'],
          geral: ehGeral(tabelaAtual),
          filial: tabelaAtual.filial,
        })
        if (conflito) return respostaJson(conflito, 400)
      }
      lista = lista.map((item) =>
        item.id === id
          ? {
              ...item,
              situacao: corpo.ativa ? 'ativa' : 'inativa',
              'motivo da situacao': motivo,
              'data da situacao': DATA_SITUACAO_FALSA,
              'usuario da situacao': USUARIO_SITUACAO_FALSO,
            }
          : item,
      )
      historicos.set(id, [
        {
          versao: tabelaAtual['versao vigente'],
          vigente: false,
          motivo,
          data: DATA_SITUACAO_FALSA,
          usuario: USUARIO_SITUACAO_FALSO,
          'quantidade de faixas': null,
          acao: corpo.ativa ? 'reativacao' : 'inativacao',
        },
        ...(historicos.get(id) ?? []),
      ])
      return respostaJson(respostaSituacaoFaixasApi(corpo.ativa ? 'ativa' : 'inativa'))
    }
    rotas[`DELETE /api/ped/faixas/${id}`] = (init) => {
      const corpo = lerCorpo<{ motivo?: string }>(init)
      if ((corpo?.motivo?.trim() ?? '') === '') return respostaErro(400, 'Informe o motivo da exclusão.')
      const tabelaAtual = atual(id)
      if (tabelaAtual && !tabelaAtual['dashboard excluido']) {
        return respostaErro(400, `a faixa está vinculada ao dashboard ${tabelaAtual.dashboard}; inative-a`)
      }
      lista = lista.filter((item) => item.id !== id)
      historicos.set(id, [
        {
          versao: tabelaAtual?.['versao vigente'] ?? 1,
          vigente: false,
          motivo: corpo?.motivo?.trim() ?? '',
          data: DATA_SITUACAO_FALSA,
          usuario: USUARIO_SITUACAO_FALSO,
          'quantidade de faixas': null,
          acao: 'exclusao',
        },
        ...(historicos.get(id) ?? []),
      ])
      return new Response(null, { status: 204 })
    }
    rotas[`GET /api/ped/faixas/${id}/historico`] = () => respostaJson(historicos.get(id) ?? [])
  }

  rotas['GET /api/ped/faixas/1/versoes/1'] = () => respostaJson(versaoFaixasApi(1))
  rotas['GET /api/ped/faixas/1/versoes/2'] = () => respostaJson(versaoFaixasApi(2))

  return { rotas, tabelas: () => lista, historico: (id: number) => historicos.get(id) ?? [] }
}
