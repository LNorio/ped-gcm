/**
 * Serviço das imagens congeladas (F10.1 — RF-83, RF-84, RN-18).
 *
 * Rotas de `docs/backend/API (28).md`, seção "fase 7: fechamentos, cálculo e imagens congeladas", e
 * `docs/backend/FRONT-PED-mudancas (1).md`, item 8 (`tipo` e "id colaborador"):
 * - `GET /api/ped/imagens?filial=&periodo=&dashboard=&tipo=&id_colaborador=&busca=` consulta retroativa
 *   (filial/tipo `todas` e textos vazios omitidos; lista pura ou `{ imagens }`);
 * - `GET /api/ped/imagens/{id}` detalhe (na raiz ou em `{ imagem }`).
 * Não existe rota para alterar ou excluir imagem (RN-18): o serviço só lê.
 *
 * `paraImagemCongelada` converte o conteúdo da imagem (RF-83) e é usado também nas imagens da prévia
 * (`fechamentosService.obterPreviaFechamento`). Regras de leitura:
 * - números aceitam número ou texto decimal canônico ("451590.62"); pt-BR ("451.590,62") ou outro tipo
 *   é resposta inválida; datas ficam como a API envia;
 * - `tipo` da raiz, senão `unidade.tipo`, senão "colaborador" quando há "id colaborador" e "filial" sem;
 * - `dashboard` em objeto (chaves alternativas "pontuacao base maxima", "vinculo", "formula"), em texto
 *   (só o nome) ou, ausente, `dashboard_nome` (dashboard excluído);
 * - `unidade` com filial/colaborador em objeto ou texto; sem `unidade`, os campos da raiz;
 * - indicador: `meta: null` = sem meta (nunca 0); realizado `null` ou `{ valor, "coleta disponivel" }`
 *   (`coletaDisponivel: false` = sem coleta ainda, não é erro; padrão `true`);
 * - pontuação com os passos (sem `calculada` = calculada), `{ calculada: false, motivo }`, ausente ou
 *   `null` (não calculada, sem motivo); "opcao selecionada" `a`/`B`/`opcao a`/`Opção B` → `A`/`B`;
 * - `faixas` `{ versao, descricao|nome, linhas }` ou `null`; pendências e avisos aceitam texto e
 *   `{ mensagem }` e ignoram o resto.
 *
 * Respostas 2xx fora do formato viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um item inválido
 * rejeita a resposta inteira. Erros HTTP e de rede chegam como `ApiError` sem alteração.
 */

import {
  type DashboardDaImagem,
  type Faixa,
  type FaixasDaImagem,
  type ImagemCongelada,
  type ImagemDaConsulta,
  type IndicadorDaImagem,
  type OpcaoDaPontuacao,
  PERIODICIDADES,
  type PeriodoDaImagem,
  type PontuacaoDaImagem,
  type ResultadoOperacional,
  TIPOS_IMAGEM,
  TIPOS_VINCULO,
  type TipoImagem,
  type UnidadeDaImagem,
} from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'

const ROTA_IMAGENS = '/ped/imagens'

/** Filtros da consulta retroativa (RF-84). */
export interface FiltrosImagens {
  /** Código da filial; `todas` ou vazio = todas. */
  filial?: string
  periodo?: string
  /** Id do dashboard. */
  dashboard?: number
  tipo?: TipoImagem | 'todas'
  idColaborador?: number
  busca?: string
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

const ehTexto = (v: unknown): v is string => typeof v === 'string'
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const ausente = (v: unknown): v is null | undefined => v === undefined || v === null

function ehUmDe<T extends string>(valores: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (valores as readonly string[]).includes(valor)
}

function textoOuNulo(valor: unknown): string | null {
  return ehTexto(valor) ? valor : null
}

/** Texto decimal canônico (ponto como separador decimal, sem milhar): "451590.62", "80". */
const DECIMAL_CANONICO = /^-?\d+(\.\d+)?$/

/** Número opcional: ausente → `null`; número ou texto decimal canônico → número; o resto rejeita. */
function numeroOuNulo(valor: unknown): number | null {
  if (ausente(valor)) return null
  if (ehNumero(valor)) return valor
  if (ehTexto(valor) && DECIMAL_CANONICO.test(valor.trim())) return Number(valor.trim())
  throw respostaInvalida()
}

/** Id opcional: ausente → `null`; número ou texto só com dígitos → número; o resto rejeita. */
function idOuNulo(valor: unknown): number | null {
  if (ausente(valor)) return null
  if (ehNumero(valor)) return valor
  if (ehTexto(valor) && /^\d+$/.test(valor.trim())) return Number(valor.trim())
  throw respostaInvalida()
}

/** Código (filial) em texto ou número → texto; ausente → `null`; o resto rejeita. */
function codigoOuNulo(valor: unknown): string | null {
  if (ausente(valor)) return null
  if (ehTexto(valor)) return valor
  if (ehNumero(valor)) return String(valor)
  throw respostaInvalida()
}

/** O primeiro valor presente (não `undefined` nem `null`). */
function primeiro(...valores: unknown[]): unknown {
  return valores.find((valor) => !ausente(valor))
}

/** Lista na raiz ou dentro de `{ <chave> }`; qualquer outro formato rejeita a resposta. */
function listaDaResposta(resposta: unknown, chave: string): unknown[] {
  const lista: unknown = ehObjeto(resposta) ? resposta[chave] : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista
}

/** Textos de uma lista tolerante: aceita texto e `{ mensagem }` e ignora o resto. */
function mensagens(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor.flatMap((item: unknown): string[] => {
    if (ehTexto(item)) return [item]
    if (ehObjeto(item) && ehTexto(item.mensagem)) return [item.mensagem]
    return []
  })
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

// ---------------------------------------------------------------------------
// Partes do conteúdo (exportadas para a prévia em fechamentosService)
// ---------------------------------------------------------------------------

/** Período em objeto `{ codigo, inicio, fim }` ou em texto (só o código); ausente → `null`. */
export function paraPeriodoDaImagem(valor: unknown): PeriodoDaImagem | null {
  if (ausente(valor)) return null
  if (ehTexto(valor)) return { codigo: valor, inicio: null, fim: null }
  if (!ehObjeto(valor) || !ehTexto(valor.codigo)) throw respostaInvalida()
  const inicio = textoOuNulo(valor.inicio)
  const fim = textoOuNulo(valor.fim)
  return { codigo: valor.codigo, inicio: inicio === '' ? null : inicio, fim: fim === '' ? null : fim }
}

/**
 * Dashboard da imagem em objeto (com as chaves alternativas), em texto (só o nome) ou, ausente, o nome
 * guardado em `dashboard_nome` (dashboard excluído); sem nenhum → `null`.
 */
export function paraDashboardDaImagem(valor: unknown, nomeGuardado?: unknown): DashboardDaImagem | null {
  const vazio = { id: null, periodicidade: null, pontuacaoMaxima: null, tipoVinculo: null, formulaDePontuacao: null }
  if (ausente(valor)) return ehTexto(nomeGuardado) ? { ...vazio, nome: nomeGuardado } : null
  if (ehTexto(valor)) return { ...vazio, nome: valor }
  if (!ehObjeto(valor)) throw respostaInvalida()
  const nome = primeiro(valor.nome, nomeGuardado)
  if (!ehTexto(nome)) throw respostaInvalida()
  const periodicidade = ehTexto(valor.periodicidade) ? normalizar(valor.periodicidade) : null
  const vinculo = primeiro(valor['tipo de vinculo'], valor.vinculo)
  const tipoVinculo = ehTexto(vinculo) ? normalizar(vinculo) : null
  return {
    id: idOuNulo(valor.id),
    nome,
    periodicidade: ehUmDe(PERIODICIDADES, periodicidade) ? periodicidade : null,
    pontuacaoMaxima: numeroOuNulo(primeiro(valor['pontuacao maxima'], valor['pontuacao base maxima'])),
    tipoVinculo: ehUmDe(TIPOS_VINCULO, tipoVinculo) ? tipoVinculo : null,
    formulaDePontuacao: textoOuNulo(primeiro(valor['formula de pontuacao'], valor.formula)),
  }
}

function paraFaixa(valor: unknown): Faixa {
  if (!ehObjeto(valor)) throw respostaInvalida()
  const de = numeroOuNulo(valor.de)
  const ate = numeroOuNulo(valor.ate)
  const aliquota = numeroOuNulo(valor.aliquota)
  if (de === null || ate === null || aliquota === null) throw respostaInvalida()
  return { de, ate, aliquota }
}

function faixaOuNula(valor: unknown): Faixa | null {
  return ausente(valor) ? null : paraFaixa(valor)
}

function paraUnidade(conteudo: Record<string, unknown>): UnidadeDaImagem {
  const unidade = ehObjeto(conteudo.unidade) ? conteudo.unidade : {}
  const filial = primeiro(unidade.filial, conteudo.filial)
  const colaborador = primeiro(unidade.colaborador, conteudo.colaborador)
  const filialEmObjeto = ehObjeto(filial) ? filial : null
  const colaboradorEmObjeto = ehObjeto(colaborador) ? colaborador : null
  return {
    filial: codigoOuNulo(filialEmObjeto ? filialEmObjeto.filial : filial),
    nomeFilial: textoOuNulo(primeiro(filialEmObjeto?.['nome filial'], unidade['nome filial'], conteudo['nome filial'])),
    colaborador: textoOuNulo(colaboradorEmObjeto ? colaboradorEmObjeto.nome : colaborador),
    cargo: textoOuNulo(primeiro(colaboradorEmObjeto?.cargo, unidade.cargo, conteudo.cargo)),
  }
}

function paraResultadoOperacional(valor: unknown): ResultadoOperacional | null {
  if (!ehObjeto(valor)) return null
  const indicador = ehObjeto(valor.indicador) ? valor.indicador.nome : valor.indicador
  return {
    indicador: textoOuNulo(indicador),
    valor: numeroOuNulo(valor.valor),
    observacao: textoOuNulo(valor.observacao),
  }
}

function paraIndicadorDaImagem(item: unknown): IndicadorDaImagem {
  if (!ehObjeto(item)) throw respostaInvalida()
  const nome = primeiro(item.indicador, item.nome)
  if (!ehTexto(nome)) throw respostaInvalida()
  const realizadoEmObjeto = ehObjeto(item.realizado) ? item.realizado : null
  const coleta = primeiro(item['coleta disponivel'], realizadoEmObjeto?.['coleta disponivel'])
  return {
    indicador: nome,
    meta: numeroOuNulo(item.meta),
    realizado: numeroOuNulo(realizadoEmObjeto ? realizadoEmObjeto.valor : item.realizado),
    coletaDisponivel: typeof coleta === 'boolean' ? coleta : true,
    atingimento: numeroOuNulo(item.atingimento),
    pontosBase: numeroOuNulo(item['pontos base']),
    pontosRealizados: numeroOuNulo(item['pontos realizados']),
    observacao: textoOuNulo(item.observacao),
  }
}

/** "a", "B", "opcao a", "Opção B" → `A`/`B`; qualquer outro → `null`. */
function paraOpcao(valor: unknown): OpcaoDaPontuacao | null {
  if (!ehTexto(valor)) return null
  const opcao = normalizar(valor).replace(/^opcao\s*/, '')
  if (opcao === 'a') return 'A'
  if (opcao === 'b') return 'B'
  return null
}

function pontuacaoNaoCalculada(motivo: string | null): PontuacaoDaImagem {
  return {
    calculada: false,
    motivo,
    faixaAtual: null,
    faixaAnterior: null,
    aliquotaAnterior: null,
    aliquotaAtual: null,
    pisoDaFaixa: null,
    opcaoA: null,
    opcaoB: null,
    opcaoSelecionada: null,
    baseDeCalculo: null,
    valor: null,
  }
}

function paraPontuacao(valor: unknown): PontuacaoDaImagem {
  if (ausente(valor)) return pontuacaoNaoCalculada(null)
  if (!ehObjeto(valor) || !(ausente(valor.calculada) || typeof valor.calculada === 'boolean')) throw respostaInvalida()
  if (valor.calculada === false) return pontuacaoNaoCalculada(textoOuNulo(valor.motivo))
  return {
    calculada: true,
    motivo: null,
    faixaAtual: faixaOuNula(valor['faixa atual']),
    faixaAnterior: faixaOuNula(valor['faixa anterior']),
    aliquotaAnterior: numeroOuNulo(valor['aliquota anterior']),
    aliquotaAtual: numeroOuNulo(valor['aliquota atual']),
    pisoDaFaixa: numeroOuNulo(valor['piso da faixa']),
    opcaoA: numeroOuNulo(valor['opcao a']),
    opcaoB: numeroOuNulo(valor['opcao b']),
    opcaoSelecionada: paraOpcao(valor['opcao selecionada']),
    baseDeCalculo: numeroOuNulo(valor['base de calculo']),
    valor: numeroOuNulo(valor.valor),
  }
}

function paraFaixas(valor: unknown): FaixasDaImagem | null {
  if (ausente(valor)) return null
  if (!ehObjeto(valor) || !(ausente(valor.linhas) || Array.isArray(valor.linhas))) throw respostaInvalida()
  const linhas: unknown[] = Array.isArray(valor.linhas) ? valor.linhas : []
  return {
    nome: textoOuNulo(primeiro(valor.descricao, valor.nome)),
    versao: numeroOuNulo(valor.versao),
    linhas: linhas.map(paraFaixa),
  }
}

/** Tipo informado (raiz, senão `unidade.tipo`); valor desconhecido rejeita; ausente → `undefined`. */
function tipoInformado(...valores: unknown[]): TipoImagem | undefined {
  const tipo = primeiro(...valores)
  if (tipo === undefined) return undefined
  const normalizado = ehTexto(tipo) ? normalizar(tipo) : null
  if (!ehUmDe(TIPOS_IMAGEM, normalizado)) throw respostaInvalida()
  return normalizado
}

/**
 * Conteúdo da imagem congelada (RF-83), da imagem gravada ou de uma imagem da prévia. `chave` é a da
 * prévia (se não vier, lida do próprio conteúdo; senão `null`). Fora do formato rejeita com
 * `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`.
 */
export function paraImagemCongelada(conteudo: unknown, chave?: string | null): ImagemCongelada {
  if (!ehObjeto(conteudo)) throw respostaInvalida()
  const unidade = ehObjeto(conteudo.unidade) ? conteudo.unidade : {}
  const colaborador = ehObjeto(unidade.colaborador) ? unidade.colaborador : {}
  const idColaborador = idOuNulo(primeiro(conteudo['id colaborador'], colaborador['id colaborador']))
  const tipo = tipoInformado(conteudo.tipo, unidade.tipo) ?? (idColaborador === null ? 'filial' : 'colaborador')
  if (!(ausente(conteudo.indicadores) || Array.isArray(conteudo.indicadores))) throw respostaInvalida()
  const indicadores: unknown[] = Array.isArray(conteudo.indicadores) ? conteudo.indicadores : []
  return {
    id: idOuNulo(conteudo.id),
    codigo: textoOuNulo(conteudo.codigo),
    lote: textoOuNulo(conteudo.lote),
    chave: chave ?? textoOuNulo(conteudo.chave),
    tipo,
    idColaborador,
    dashboard: paraDashboardDaImagem(conteudo.dashboard, conteudo.dashboard_nome),
    periodo: paraPeriodoDaImagem(conteudo.periodo),
    unidade: paraUnidade(conteudo),
    resultadoOperacional: paraResultadoOperacional(conteudo['resultado operacional']),
    pedPercentual: numeroOuNulo(conteudo['ped percentual']),
    pontosBaseTotal: numeroOuNulo(conteudo['pontos base total']),
    indicadores: indicadores.map(paraIndicadorDaImagem),
    pontuacao: paraPontuacao(conteudo.pontuacao),
    faixas: paraFaixas(conteudo.faixas),
    pendencias: mensagens(conteudo.pendencias),
    avisos: mensagens(conteudo.avisos),
    geradoEm: textoOuNulo(conteudo['gerado em']),
    usuario: textoOuNulo(conteudo.usuario),
  }
}

// ---------------------------------------------------------------------------
// Linha da consulta
// ---------------------------------------------------------------------------

/** Pontuação da linha: número, texto decimal, `{ valor }` ou `{ calculada: false }` (→ `null`). */
function pontuacaoDaLinha(valor: unknown): number | null {
  if (ehObjeto(valor)) return valor.calculada === false ? null : numeroOuNulo(valor.valor)
  return numeroOuNulo(valor)
}

function paraImagemDaConsulta(item: unknown): ImagemDaConsulta {
  if (!ehObjeto(item) || !ehNumero(item.id) || !ehTexto(item.codigo)) throw respostaInvalida()
  const dashboard = ehObjeto(item.dashboard) ? item.dashboard : null
  const periodo = ehObjeto(item.periodo) ? item.periodo.codigo : item.periodo
  const filial = ehObjeto(item.filial) ? item.filial : null
  const colaborador = ehObjeto(item.colaborador) ? item.colaborador : null
  const idColaborador = idOuNulo(primeiro(item['id colaborador'], colaborador?.['id colaborador']))
  const tipo = tipoInformado(item.tipo) ?? (idColaborador === null ? 'filial' : 'colaborador')
  return {
    id: item.id,
    codigo: item.codigo,
    lote: textoOuNulo(item.lote),
    tipo,
    idColaborador,
    idDashboard: idOuNulo(primeiro(item['id dashboard'], dashboard?.id)),
    dashboard: textoOuNulo(dashboard ? dashboard.nome : primeiro(item.dashboard, item.dashboard_nome)),
    periodo: textoOuNulo(periodo),
    filial: codigoOuNulo(filial ? filial.filial : item.filial),
    nomeFilial: textoOuNulo(primeiro(filial?.['nome filial'], item['nome filial'])),
    colaborador: textoOuNulo(colaborador ? colaborador.nome : item.colaborador),
    cargo: textoOuNulo(primeiro(colaborador?.cargo, item.cargo)),
    geradoEm: textoOuNulo(item['gerado em']),
    usuario: textoOuNulo(item.usuario),
    pedPercentual: numeroOuNulo(item['ped percentual']),
    pontuacao: pontuacaoDaLinha(item.pontuacao),
  }
}

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

function textoDoFiltro(valor: string | undefined): string | undefined {
  return valor !== undefined && valor.trim() !== '' ? valor : undefined
}

/** Consulta retroativa das imagens congeladas (RF-84), na ordem da API. */
export async function listarImagens(filtros: FiltrosImagens = {}): Promise<ImagemDaConsulta[]> {
  const filial = textoDoFiltro(filtros.filial)
  const resposta = await apiFetch<unknown>(ROTA_IMAGENS, {
    query: {
      filial: filial !== undefined && filial.trim().toLowerCase() !== 'todas' ? filial.trim() : undefined,
      periodo: textoDoFiltro(filtros.periodo),
      dashboard: filtros.dashboard,
      tipo: filtros.tipo === 'todas' ? undefined : filtros.tipo,
      id_colaborador: filtros.idColaborador,
      busca: textoDoFiltro(filtros.busca),
    },
  })
  return listaDaResposta(resposta, 'imagens').map(paraImagemDaConsulta)
}

/** Detalhe de uma imagem congelada (RF-83), na raiz ou em `{ imagem }`. */
export async function obterImagem(id: number): Promise<ImagemCongelada> {
  const resposta = await apiFetch<unknown>(`${ROTA_IMAGENS}/${id}`)
  if (!ehObjeto(resposta)) throw respostaInvalida()
  if ('imagem' in resposta && !ausente(resposta.imagem)) {
    if (!ehObjeto(resposta.imagem)) throw respostaInvalida()
    return paraImagemCongelada(resposta.imagem)
  }
  return paraImagemCongelada(resposta)
}
