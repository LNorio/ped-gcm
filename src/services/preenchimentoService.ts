/**
 * Serviço do preenchimento (F9.1 — RF-60 a RF-70).
 *
 * Rotas de `docs/backend/API (28).md`, seção "Cadastro e Preenchimento — fase 2 ... Preenchimento":
 * - `GET /api/ped/preenchimento/meses?ano=&filial=`                       os 12 meses do ano (RF-61)
 * - `GET /api/ped/preenchimento?filial=&mes_de_referencia=AAAA-MM&busca=` a tela do mês (padrão: mês aberto)
 * - `PUT /api/ped/preenchimento`                                          lançamento/correção em lote (tudo ou nada)
 * - `GET /api/ped/apontamentos/{id}/historico?filial=&mes_de_referencia=` lançamento e correções (RF-69)
 *
 * Validação local (sem chamar a API, `ApiError(400, ...)`):
 * - o preenchimento exige uma filial: vazia ou `todas` → `MENSAGEM_FILIAL_OBRIGATORIA` (RF-60);
 * - mês como `AAAA-MM` ou `AAAA-MM-DD` → `MENSAGEM_MES_INVALIDO`; vai na query como `AAAA-MM` e no
 *   corpo como `AAAA-MM-01`;
 * - ano dos meses entre 2000 e o ano atual → `MENSAGEM_ANO_INVALIDO`.
 * Essas regras também são usadas por `periodoService` e `metasService`.
 *
 * Formatos assumidos onde o documento não detalha (ver `src/test/preenchimentoFalsos.ts`):
 * - meses: lista pura ou `{ meses }`; o mês vem em `"mes de referencia"` (`AAAA-MM...`) ou em `mes` (número);
 * - tela: `filial` numérica vira texto; `situacao` do apontamento sem diferenciar maiúsculas nem
 *   acentos (`Nao lancado` → `nao_lancado`); `valor` número, booleano (no booleano, `1`/`0` também) ou
 *   texto decimal canônico (`"1234.50"`); texto em pt-BR (`"1.234,56"`) é inválido;
 * - `indicadores`, `dashboards` e `"imagens congeladas"` são lidos de forma tolerante (fases 4, 6 e 7):
 *   o que não for lista vira `[]` e itens irreconhecíveis são ignorados, sem rejeitar a tela;
 * - histórico: lista pura ou `{ historico }`.
 *
 * Nas leituras, respostas 2xx fora do formato esperado viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`;
 * um único item inválido rejeita a resposta inteira. Regra "2xx = gravado" no `PUT`: qualquer 2xx
 * resolve; contagens ausentes ou inválidas viram `0` e a mensagem, `null`. Erros HTTP e de rede chegam
 * como `ApiError` (ver `api.ts`); os erros por item do lote recusado são lidos por `errosDoPreenchimento`.
 */

import {
  ACOES_LANCAMENTO,
  type ApontamentoPreenchimento,
  type DashboardDoApontamento,
  type HistoricoLancamento,
  type ImagemCongeladaDoApontamento,
  type IndicadorDoApontamento,
  type MesPreenchimento,
  PERIODICIDADES,
  type Preenchimento,
  SITUACOES_LANCAMENTO,
  SITUACOES_MES_PREENCHIMENTO,
  type SituacaoMesConsultado,
  type TelaPreenchimento,
  TIPOS_VALOR,
  type TipoPreenchimento,
  type ValorLancamento,
} from '../types/dominio'
import { paraCorpoPreenchimento } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'

const ROTA_PREENCHIMENTO = '/ped/preenchimento'
const ROTA_APONTAMENTOS = '/ped/apontamentos'

export const MENSAGEM_FILIAL_OBRIGATORIA = 'Selecione uma filial para o preenchimento.'
export const MENSAGEM_MES_INVALIDO = 'Mês de referência inválido. Use o formato AAAA-MM.'
export const MENSAGEM_ANO_INVALIDO = 'Informe um ano entre 2000 e o ano atual.'

const ANO_MINIMO = 2000

/** Filtros de `obterPreenchimento`; sem mês, a API devolve o mês aberto. */
export interface FiltrosPreenchimento {
  filial: string
  /** `AAAA-MM` ou `AAAA-MM-DD`. */
  mesDeReferencia?: string
  /** Texto da busca; vazio ou só com espaços não entra na query. */
  busca?: string
}

/** Filial e mês do histórico de um apontamento. */
export interface FiltrosHistoricoApontamento {
  filial: string
  /** `AAAA-MM` ou `AAAA-MM-DD`. */
  mesDeReferencia: string
}

/** Resultado do `PUT /api/ped/preenchimento`. */
export interface ResultadoPreenchimento {
  mensagem: string | null
  lancados: number
  corrigidos: number
}

/** Erro de um item do lote recusado; `idApontamento` `null` quando o erro não é de um apontamento. */
export interface ErroDeApontamento {
  idApontamento: number | null
  mensagem: string
}

// ---------------------------------------------------------------------------
// Validação local (compartilhada com periodoService e metasService)
// ---------------------------------------------------------------------------

/** Filial do preenchimento sem espaços nas pontas; vazia ou `todas` rejeita com `ApiError(400)`. */
export function filialDoPreenchimento(filial: string): string {
  const codigo = (filial ?? '').trim()
  if (codigo === '' || codigo.toLowerCase() === 'todas') throw new ApiError(400, MENSAGEM_FILIAL_OBRIGATORIA)
  return codigo
}

const FORMATO_MES = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/

/** Mês `AAAA-MM` ou `AAAA-MM-DD` convertido para `AAAA-MM`; fora do formato rejeita com `ApiError(400)`. */
export function mesParaQuery(mesDeReferencia: string): string {
  const partes = FORMATO_MES.exec((mesDeReferencia ?? '').trim())
  if (!partes) throw new ApiError(400, MENSAGEM_MES_INVALIDO)
  const [, ano, mes, dia] = partes
  const numeroMes = Number(mes)
  const diaValido = dia === undefined || (Number(dia) >= 1 && Number(dia) <= 31)
  if (numeroMes < 1 || numeroMes > 12 || !diaValido) throw new ApiError(400, MENSAGEM_MES_INVALIDO)
  return `${ano}-${mes}`
}

/** Mês para o corpo das requisições: sempre o dia 01 (`AAAA-MM-01`). */
export function mesParaCorpo(mesDeReferencia: string): string {
  return `${mesParaQuery(mesDeReferencia)}-01`
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

function ehUmDe<T extends string>(valores: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (valores as readonly string[]).includes(valor)
}

function textoOuNulo(valor: unknown): string | null {
  return ehTexto(valor) ? valor : null
}

/** Lista na raiz ou dentro de `{ <chave> }`; qualquer outro formato rejeita a resposta. */
function listaDaResposta(resposta: unknown, chave: string): unknown[] {
  const lista: unknown = ehObjeto(resposta) ? resposta[chave] : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista
}

/** Texto decimal canônico (ponto como separador decimal, sem milhar): "1234.50", "80". */
const DECIMAL_CANONICO = /^-?\d+(\.\d+)?$/

/**
 * Valor lançado vindo da API: `null`/ausente → `null`; número, booleano ou texto decimal canônico →
 * o valor; qualquer outro (inclusive pt-BR, objeto) → `undefined` (inválido).
 */
function valorLancamento(valor: unknown): ValorLancamento | null | undefined {
  if (valor === undefined || valor === null) return null
  if (ehBooleano(valor) || ehNumero(valor)) return valor
  if (ehTexto(valor) && DECIMAL_CANONICO.test(valor.trim())) return Number(valor.trim())
  return undefined
}

/** Id em número ou texto só com dígitos; senão `null`. */
function idOuNulo(valor: unknown): number | null {
  if (ehNumero(valor)) return valor
  if (ehTexto(valor) && /^\d+$/.test(valor.trim())) return Number(valor.trim())
  return null
}

/** Remove acentos, passa para minúsculas e troca espaços por `_` (`"Não lançado"` → `"nao_lancado"`). */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

// ---------------------------------------------------------------------------
// Conversões (API → domínio)
// ---------------------------------------------------------------------------

function paraMesPreenchimento(item: unknown, ano: number): MesPreenchimento {
  if (!ehObjeto(item) || !ehUmDe(SITUACOES_MES_PREENCHIMENTO, item.situacao) || !opcional(item.pendentes, ehNumero)) {
    throw respostaInvalida()
  }
  const referencia = item['mes de referencia']
  let anoDoMes = ano
  let mes: number
  if (ehTexto(referencia) && /^\d{4}-\d{2}/.test(referencia)) {
    anoDoMes = Number(referencia.slice(0, 4))
    mes = Number(referencia.slice(5, 7))
  } else if (ehNumero(item.mes) && Number.isInteger(item.mes)) {
    mes = item.mes
  } else {
    throw respostaInvalida()
  }
  if (mes < 1 || mes > 12) throw respostaInvalida()
  return {
    mes,
    mesDeReferencia: `${anoDoMes}-${String(mes).padStart(2, '0')}-01`,
    situacao: item.situacao,
    pendentes: ehNumero(item.pendentes) ? item.pendentes : null,
  }
}

function indicadorOuNulo(item: unknown): IndicadorDoApontamento | null {
  if (ehTexto(item)) return { id: null, nome: item }
  if (ehObjeto(item) && ehTexto(item.nome)) return { id: ehNumero(item.id) ? item.id : null, nome: item.nome }
  return null
}

function dashboardOuNulo(item: unknown): DashboardDoApontamento | null {
  if (ehTexto(item)) return { id: null, nome: item, periodicidade: null }
  if (!ehObjeto(item) || !ehTexto(item.nome)) return null
  const periodicidade = ehTexto(item.periodicidade) ? item.periodicidade.trim().toLowerCase() : null
  return {
    id: ehNumero(item.id) ? item.id : null,
    nome: item.nome,
    periodicidade: ehUmDe(PERIODICIDADES, periodicidade) ? periodicidade : null,
  }
}

function imagemOuNula(item: unknown): ImagemCongeladaDoApontamento | null {
  if (ehTexto(item)) return { codigo: item, dashboard: null, periodo: null }
  if (!ehObjeto(item)) return null
  return { codigo: textoOuNulo(item.codigo), dashboard: textoOuNulo(item.dashboard), periodo: textoOuNulo(item.periodo) }
}

/** Lista tolerante: o que não é lista vira `[]` e itens irreconhecíveis são ignorados. */
function listaTolerante<T>(valor: unknown, converter: (item: unknown) => T | null): T[] {
  if (!Array.isArray(valor)) return []
  return valor.map(converter).filter((item): item is T => item !== null)
}

function paraApontamentoPreenchimento(item: unknown): ApontamentoPreenchimento {
  if (!ehObjeto(item) || !ehNumero(item.id) || !ehTexto(item.nome) || !opcional(item.descricao, ehTexto)) throw respostaInvalida()
  const tipoValor = ehTexto(item['tipo de valor']) ? item['tipo de valor'].trim().toLowerCase() : null
  const situacao = ehTexto(item.situacao) ? normalizar(item.situacao) : null
  if (!ehUmDe(TIPOS_VALOR, tipoValor) || !ehUmDe(SITUACOES_LANCAMENTO, situacao)) throw respostaInvalida()

  let valor = valorLancamento(item.valor)
  if (valor === undefined) throw respostaInvalida()
  if (tipoValor === 'booleano' && typeof valor === 'number') {
    if (valor !== 0 && valor !== 1) throw respostaInvalida()
    valor = valor === 1
  } else if (tipoValor !== 'booleano' && typeof valor === 'boolean') {
    throw respostaInvalida()
  }

  return {
    id: item.id,
    nome: item.nome,
    descricao: textoOuNulo(item.descricao),
    tipoValor,
    situacao,
    valor,
    indicadores: listaTolerante(item.indicadores, indicadorOuNulo),
    dashboards: listaTolerante(item.dashboards, dashboardOuNulo),
    imagensCongeladas: listaTolerante(item['imagens congeladas'], imagemOuNula),
  }
}

function paraTipoPreenchimento(item: unknown): TipoPreenchimento {
  if (!ehObjeto(item) || !ehNumero(item.id) || !ehTexto(item.nome) || !opcional(item.quantidade, ehNumero)) throw respostaInvalida()
  if (!opcional(item.apontamentos, Array.isArray)) throw respostaInvalida()
  const apontamentos = Array.isArray(item.apontamentos) ? item.apontamentos.map(paraApontamentoPreenchimento) : []
  return {
    id: item.id,
    nome: item.nome,
    quantidade: ehNumero(item.quantidade) ? item.quantidade : apontamentos.length,
    apontamentos,
  }
}

const SITUACOES_MES_CONSULTADO: readonly SituacaoMesConsultado[] = ['aberto', 'fechado']

function ehProgressoApi(valor: unknown): boolean {
  return ehObjeto(valor) && ehNumero(valor.preenchidos) && ehNumero(valor.total)
}

function paraTelaPreenchimento(resposta: unknown): TelaPreenchimento {
  if (
    !ehObjeto(resposta) ||
    !(ehTexto(resposta.filial) || ehNumero(resposta.filial)) ||
    !ehTexto(resposta['mes de referencia']) ||
    !ehUmDe(SITUACOES_MES_CONSULTADO, resposta['situacao do mes']) ||
    !Array.isArray(resposta.tipos) ||
    !opcional(resposta.editavel, ehBooleano) ||
    !opcional(resposta.progresso, ehProgressoApi) ||
    !['nome filial', 'periodo aberto', 'aberto por', 'aberto em'].every((chave) => opcional(resposta[chave], ehTexto))
  ) {
    throw respostaInvalida()
  }
  const situacaoDoMes = resposta['situacao do mes']
  const progresso = ehObjeto(resposta.progresso) ? resposta.progresso : null
  return {
    filial: String(resposta.filial),
    nomeFilial: textoOuNulo(resposta['nome filial']),
    mesDeReferencia: resposta['mes de referencia'],
    situacaoDoMes,
    editavel: ehBooleano(resposta.editavel) ? resposta.editavel : situacaoDoMes === 'aberto',
    periodoAberto: textoOuNulo(resposta['periodo aberto']),
    abertoPor: textoOuNulo(resposta['aberto por']),
    abertoEm: textoOuNulo(resposta['aberto em']),
    progresso: {
      preenchidos: progresso && ehNumero(progresso.preenchidos) ? progresso.preenchidos : 0,
      total: progresso && ehNumero(progresso.total) ? progresso.total : 0,
    },
    tipos: resposta.tipos.map(paraTipoPreenchimento),
  }
}

function paraHistoricoLancamento(item: unknown): HistoricoLancamento {
  if (
    !ehObjeto(item) ||
    !ehUmDe(ACOES_LANCAMENTO, item.acao) ||
    !ehTexto(item.data) ||
    !opcional(item.usuario, ehTexto) ||
    !opcional(item.motivo, ehTexto)
  ) {
    throw respostaInvalida()
  }
  const valorAnterior = valorLancamento(item['valor anterior'])
  const valorNovo = valorLancamento(item['valor novo'])
  if (valorAnterior === undefined || valorNovo === undefined) throw respostaInvalida()
  return {
    data: item.data,
    acao: item.acao,
    valorAnterior,
    valorNovo,
    usuario: textoOuNulo(item.usuario),
    motivo: textoOuNulo(item.motivo),
  }
}

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

/** Os 12 meses do ano da filial (RF-61): `aberto` (com pendentes), `fechado` ou `futuro`. */
export async function listarMesesPreenchimento(ano: number, filial: string): Promise<MesPreenchimento[]> {
  const codigo = filialDoPreenchimento(filial)
  if (!Number.isInteger(ano) || ano < ANO_MINIMO || ano > new Date().getFullYear()) {
    throw new ApiError(400, MENSAGEM_ANO_INVALIDO)
  }
  const resposta = await apiFetch<unknown>(`${ROTA_PREENCHIMENTO}/meses`, { query: { ano, filial: codigo } })
  return listaDaResposta(resposta, 'meses').map((item) => paraMesPreenchimento(item, ano))
}

/** A tela do preenchimento de uma filial e mês (RF-62 a RF-65); sem mês, a do mês aberto. */
export async function obterPreenchimento(filtros: FiltrosPreenchimento): Promise<TelaPreenchimento> {
  const filial = filialDoPreenchimento(filtros.filial)
  const mes = filtros.mesDeReferencia === undefined ? undefined : mesParaQuery(filtros.mesDeReferencia)
  const busca = filtros.busca?.trim() ? filtros.busca : undefined
  const resposta = await apiFetch<unknown>(ROTA_PREENCHIMENTO, { query: { filial, mes_de_referencia: mes, busca } })
  return paraTelaPreenchimento(resposta)
}

/**
 * Lança ou corrige valores em lote (RF-66 a RF-68): `PUT /api/ped/preenchimento`, com o mês no dia 01,
 * os valores já convertidos (número ou booleano JSON) e o `motivo` só na correção. Tudo ou nada: o
 * `400`/`403` chega como `ApiError`, com os erros por item em `dados` (ver `errosDoPreenchimento`).
 */
export async function salvarPreenchimento(dados: Preenchimento): Promise<ResultadoPreenchimento> {
  const filial = filialDoPreenchimento(dados.filial)
  const mesDeReferencia = mesParaCorpo(dados.mesDeReferencia)
  const resposta = await apiFetch<unknown>(ROTA_PREENCHIMENTO, {
    method: 'PUT',
    body: paraCorpoPreenchimento({ ...dados, filial, mesDeReferencia }),
  })
  if (!ehObjeto(resposta)) return { mensagem: null, lancados: 0, corrigidos: 0 }
  return {
    mensagem: textoOuNulo(resposta.mensagem),
    lancados: ehNumero(resposta.lancados) ? resposta.lancados : 0,
    corrigidos: ehNumero(resposta.corrigidos) ? resposta.corrigidos : 0,
  }
}

/**
 * Erros por item do lote recusado (`dados.erros: [{ "id apontamento", mensagem }]`), na ordem devolvida.
 * Id em número ou dígitos em texto; senão `null`. Itens sem `mensagem` em texto são ignorados. Falha que
 * não é `ApiError`, sem `dados` ou sem a lista `erros` devolve `[]`.
 */
export function errosDoPreenchimento(falha: unknown): ErroDeApontamento[] {
  if (!(falha instanceof ApiError) || !ehObjeto(falha.dados) || !Array.isArray(falha.dados.erros)) return []
  const erros: unknown[] = falha.dados.erros
  return erros.flatMap((erro): ErroDeApontamento[] =>
    ehObjeto(erro) && ehTexto(erro.mensagem) ? [{ idApontamento: idOuNulo(erro['id apontamento']), mensagem: erro.mensagem }] : [],
  )
}

/** Lançamento e correções de um apontamento na filial e mês (RF-69), do mais recente ao mais antigo. */
export async function listarHistoricoApontamento(id: number, filtros: FiltrosHistoricoApontamento): Promise<HistoricoLancamento[]> {
  const filial = filialDoPreenchimento(filtros.filial)
  const mes = mesParaQuery(filtros.mesDeReferencia)
  const resposta = await apiFetch<unknown>(`${ROTA_APONTAMENTOS}/${id}/historico`, { query: { filial, mes_de_referencia: mes } })
  return listaDaResposta(resposta, 'historico').map(paraHistoricoLancamento)
}
