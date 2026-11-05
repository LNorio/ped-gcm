/**
 * Serviço de faixas (F8.1 — RF-41 a RF-46).
 *
 * Rotas de `docs/backend/API (24).md`, seção "Cadastro e Preenchimento — fase 5: faixas":
 * - `GET    /api/ped/faixas?filial=&dashboard=`     lista as tabelas com as faixas vigentes
 *                                                   (`filial` omitida ou `todas` = todas)
 * - `GET    /api/ped/faixas/{id}`                   uma tabela, com as faixas vigentes
 * - `POST   /api/ped/faixas`                        cadastro (versão 1 — `paraCorpoNovaTabelaFaixas`)
 * - `PUT    /api/ped/faixas/{id}`                   "Alterar faixas" `{ motivo, faixas }` — gera a versão seguinte
 * - `GET    /api/ped/faixas/{id}/historico`         versões, da mais recente para a mais antiga
 * - `GET    /api/ped/faixas/{id}/versoes/{versao}`  as faixas de uma versão
 * - `DELETE /api/ped/faixas/{id}`                   exclusão (só depois que o dashboard foi excluído)
 *
 * As faixas são enviadas como números já convertidos pelo front (a API leria um texto como "2.000"
 * como 2).
 *
 * Os formatos das respostas não estão todos documentados na API; o serviço aceita os formatos
 * prováveis em cada rota (ver `src/test/faixasFalsos.ts` e as dúvidas da F8 em
 * `docs/plano-implementacao.md`):
 * - listagem: lista pura ou `{ tabelas: [...] }`;
 * - detalhe: a tabela na raiz, em `{ tabela }` ou em `{ faixa }`;
 * - histórico: lista pura ou `{ historico: [...] }`; "quantidade de faixas" ausente vira `null`;
 * - versão: objeto com `faixas` (ex.: `{ versao, faixas }`) ou a lista pura de faixas;
 * - tabela: `filial` numérica vira texto; `de`, `ate` e `aliquota` numéricos ou em texto decimal
 *   canônico ("1000.00", cast decimal do Laravel), que vira número — texto em pt-BR ("1.000,00")
 *   é inválido; opcionais ausentes viram `null` (descrição, data e autor da versão), `false`
 *   ("dashboard excluido") e `[]` (faixas), com a quantidade igual ao tamanho da lista.
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 * Nas leituras (listagem, detalhe, histórico e versão), respostas 2xx fora do formato esperado viram
 * `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único item inválido rejeita a resposta inteira.
 *
 * Regra "2xx = gravado": no POST de cadastro e no PUT de alteração, um 2xx já significa que a tabela
 * foi gravada. A resposta é lida de forma tolerante: tabela válida na raiz, em `{ tabela }` ou em
 * `{ faixa }` é devolvida convertida; corpo vazio (200/201/204), só `mensagem`, `{ id }`, tabela
 * incompleta, lista ou texto resolve `null`, sem erro. Quem chama deve recarregar a lista para obter o
 * dado atualizado. A exclusão resolve sem valor em qualquer 2xx (204, 200 com ou sem corpo).
 */

import type { Faixa, NovaTabelaFaixas, TabelaFaixas } from '../types/dominio'
import { type FaixaApi, type TabelaFaixasApi, paraCorpoNovaTabelaFaixas, paraTabelaFaixas } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, type ValorQuery, apiFetch } from './api'

const ROTA_FAIXAS = '/ped/faixas'

/** Filtros de `listarTabelasFaixas`; só os informados entram na query. */
export interface FiltrosFaixas {
  /** Código da filial; "todas", vazia ou ausente é omitida (todas as filiais). */
  filial?: string
  /** Id do dashboard. */
  dashboard?: number
}

/** Corpo de "Alterar faixas" (RF-44): gera a versão seguinte da tabela. */
export interface AlteracaoFaixas {
  motivo: string
  faixas: Faixa[]
}

/** Versão do histórico de uma tabela de faixas (RF-45). */
export interface VersaoFaixas {
  versao: number
  vigente: boolean
  motivo: string
  data: string
  usuario: string
  /** `null` quando a API não informa. */
  quantidadeDeFaixas: number | null
}

// ---------------------------------------------------------------------------
// Validação das respostas
// ---------------------------------------------------------------------------

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
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const ehBooleano = (v: unknown): v is boolean => typeof v === 'boolean'

function textoOuNulo(valor: unknown): string | null {
  return ehTexto(valor) ? valor : null
}

function numeroOuNulo(valor: unknown): number | null {
  return ehNumero(valor) ? valor : null
}

/** Texto decimal canônico (ponto como separador decimal, sem milhar): "1000.00", "0.5", "3000". */
const DECIMAL_CANONICO = /^-?\d+(\.\d+)?$/

/** Número, ou texto decimal canônico convertido; qualquer outro valor (inclusive pt-BR) vira `null`. */
function valorDecimal(valor: unknown): number | null {
  if (ehNumero(valor)) return valor
  if (ehTexto(valor) && DECIMAL_CANONICO.test(valor.trim())) {
    const numero = Number(valor.trim())
    return Number.isFinite(numero) ? numero : null
  }
  return null
}

/** Faixa válida convertida; fora do formato devolve `null`. */
function faixaOuNula(valor: unknown): FaixaApi | null {
  if (!ehObjeto(valor)) return null
  const de = valorDecimal(valor.de)
  const ate = valorDecimal(valor.ate)
  const aliquota = valorDecimal(valor.aliquota)
  if (de === null || ate === null || aliquota === null) return null
  return { de, ate, aliquota }
}

/** Lista de faixas válida convertida; um item inválido (ou fora de lista) devolve `null`. */
function faixasOuNulo(valor: unknown): FaixaApi[] | null {
  if (!Array.isArray(valor)) return null
  const faixas: FaixaApi[] = []
  for (const item of valor) {
    const faixa = faixaOuNula(item)
    if (faixa === null) return null
    faixas.push(faixa)
  }
  return faixas
}

/**
 * Tabela completa e válida, normalizada para `TabelaFaixasApi` (filial em texto, faixas numéricas);
 * fora do formato devolve `null`.
 */
function tabelaApiOuNula(valor: unknown): TabelaFaixasApi | null {
  if (!ehObjeto(valor)) return null
  const id = valor.id
  const idDashboard = valor['id dashboard']
  const { dashboard, filial, descricao } = valor
  const nomeFilial = valor['nome filial']
  const versaoVigente = valor['versao vigente']
  const dashboardExcluido = valor['dashboard excluido']
  const dataDaVersao = valor['data da versao']
  const autorDaVersao = valor['autor da versao']
  const quantidade = valor['quantidade de faixas']

  if (
    !ehNumero(id) ||
    !ehNumero(idDashboard) ||
    !ehTexto(dashboard) ||
    !(ehTexto(filial) || ehNumero(filial)) ||
    !ehTexto(nomeFilial) ||
    !ehNumero(versaoVigente) ||
    !opcional(dashboardExcluido, ehBooleano) ||
    !opcional(descricao, ehTexto) ||
    !opcional(dataDaVersao, ehTexto) ||
    !opcional(autorDaVersao, ehTexto) ||
    !opcional(quantidade, ehNumero)
  ) {
    return null
  }

  let faixas: FaixaApi[] = []
  if (valor.faixas !== undefined && valor.faixas !== null) {
    const convertidas = faixasOuNulo(valor.faixas)
    if (convertidas === null) return null
    faixas = convertidas
  }

  return {
    id,
    'id dashboard': idDashboard,
    dashboard,
    'dashboard excluido': dashboardExcluido === true,
    filial: String(filial),
    'nome filial': nomeFilial,
    descricao: textoOuNulo(descricao),
    'versao vigente': versaoVigente,
    'data da versao': textoOuNulo(dataDaVersao),
    'autor da versao': textoOuNulo(autorDaVersao),
    'quantidade de faixas': numeroOuNulo(quantidade),
    faixas,
  }
}

/** Converte uma tabela das leituras; fora do formato vira `ApiError`. */
function converterTabela(valor: unknown): TabelaFaixas {
  const tabela = tabelaApiOuNula(valor)
  if (tabela === null) throw respostaInvalida()
  return paraTabelaFaixas(tabela)
}

/** Tabela na raiz, em `{ tabela }` ou em `{ faixa }`; sem tabela reconhecível, `null`. */
function extrairTabelaOuNula(resposta: unknown): TabelaFaixas | null {
  if (!ehObjeto(resposta)) return null
  const tabela = tabelaApiOuNula(resposta) ?? tabelaApiOuNula(resposta.tabela) ?? tabelaApiOuNula(resposta.faixa)
  return tabela === null ? null : paraTabelaFaixas(tabela)
}

/** Lista de uma resposta: a própria lista ou a lista dentro de `chave`; fora disso, `ApiError`. */
function extrairLista(resposta: unknown, chave: string): unknown[] {
  const lista: unknown = ehObjeto(resposta) ? resposta[chave] : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista
}

function converterVersao(valor: unknown): VersaoFaixas {
  if (
    !ehObjeto(valor) ||
    !ehNumero(valor.versao) ||
    !ehBooleano(valor.vigente) ||
    !ehTexto(valor.motivo) ||
    !ehTexto(valor.data) ||
    !ehTexto(valor.usuario) ||
    !opcional(valor['quantidade de faixas'], ehNumero)
  ) {
    throw respostaInvalida()
  }
  return {
    versao: valor.versao,
    vigente: valor.vigente,
    motivo: valor.motivo,
    data: valor.data,
    usuario: valor.usuario,
    quantidadeDeFaixas: numeroOuNulo(valor['quantidade de faixas']),
  }
}

/** Faixas de uma versão: objeto com `faixas` ou a lista pura; fora disso, `ApiError`. */
function converterFaixasDaVersao(resposta: unknown): Faixa[] {
  const lista: unknown = ehObjeto(resposta) ? resposta.faixas : resposta
  const faixas = faixasOuNulo(lista)
  if (faixas === null) throw respostaInvalida()
  return faixas.map((faixa) => ({ de: faixa.de, ate: faixa.ate, aliquota: faixa.aliquota }))
}

function montarQuery(filtros: FiltrosFaixas): Record<string, ValorQuery> {
  const filial = filtros.filial && filtros.filial !== 'todas' ? filtros.filial : undefined
  return { filial, dashboard: filtros.dashboard }
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/**
 * Lista as tabelas de faixas com as faixas vigentes (RF-41). Nenhum item inválido é ignorado
 * silenciosamente: a resposta inteira é rejeitada.
 */
export async function listarTabelasFaixas(filtros: FiltrosFaixas = {}): Promise<TabelaFaixas[]> {
  const resposta = await apiFetch<unknown>(ROTA_FAIXAS, { query: montarQuery(filtros) })
  return extrairLista(resposta, 'tabelas').map((item) => converterTabela(item))
}

/** Uma tabela de faixas, com as faixas vigentes. */
export async function obterTabelaFaixas(id: number): Promise<TabelaFaixas> {
  const resposta = await apiFetch<unknown>(`${ROTA_FAIXAS}/${id}`)
  const tabela = extrairTabelaOuNula(resposta)
  if (tabela === null) throw respostaInvalida()
  return tabela
}

/** Cadastra uma tabela de faixas (RF-42, versão 1). Ver a regra "2xx = gravado" no topo do arquivo. */
export async function criarTabelaFaixas(dados: NovaTabelaFaixas): Promise<TabelaFaixas | null> {
  const resposta = await apiFetch<unknown>(ROTA_FAIXAS, { method: 'POST', body: paraCorpoNovaTabelaFaixas(dados) })
  return extrairTabelaOuNula(resposta)
}

/**
 * "Alterar faixas" (RF-44): grava a versão seguinte com o motivo. Ver a regra "2xx = gravado" no
 * topo do arquivo.
 */
export async function alterarFaixas(id: number, dados: AlteracaoFaixas): Promise<TabelaFaixas | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_FAIXAS}/${id}`, {
    method: 'PUT',
    body: {
      motivo: dados.motivo,
      faixas: dados.faixas.map((faixa) => ({ de: faixa.de, ate: faixa.ate, aliquota: faixa.aliquota })),
    },
  })
  return extrairTabelaOuNula(resposta)
}

/** Histórico de versões da tabela (RF-45), na ordem devolvida pela API (mais recente primeiro). */
export async function listarHistoricoFaixas(id: number): Promise<VersaoFaixas[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_FAIXAS}/${id}/historico`)
  return extrairLista(resposta, 'historico').map((item) => converterVersao(item))
}

/** As faixas de uma versão da tabela (RF-45). */
export async function obterFaixasDaVersao(id: number, versao: number): Promise<Faixa[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_FAIXAS}/${id}/versoes/${versao}`)
  return converterFaixasDaVersao(resposta)
}

/** Exclui a tabela de faixas (RF-46). Resolve sem valor em qualquer 2xx. */
export async function excluirTabelaFaixas(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_FAIXAS}/${id}`, { method: 'DELETE' })
}
