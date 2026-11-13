/**
 * Serviço dos fechamentos (F10.1 — RF-77 a RF-82, RN-17).
 *
 * Rotas de `docs/backend/API (28).md`, seção "fase 7: fechamentos, cálculo e imagens congeladas":
 * - `GET  /api/ped/fechamentos?periodicidade=&situacao=&busca=` lista (`todas` e busca vazia omitidas;
 *   lista pura ou `{ fechamentos }`; cada linha pelo adaptador `paraFechamento` da F1.3);
 * - `GET  /api/ped/fechamentos/{id}/previa`   prévia do encerramento (um GET, nada é gravado);
 * - `POST /api/ped/fechamentos/{id}/encerrar` encerramento, sem corpo.
 *
 * Formatos aceitos onde o contrato não detalha (ver `src/test/fechamentosFalsos.ts`):
 * - "indicadores com problema" em texto ou `{ indicador }` (vira o nome); filiais numéricas viram texto;
 * - imagem da prévia como `{ chave, ...conteúdo }` ou `{ chave, imagem }`; o conteúdo é convertido por
 *   `paraImagemCongelada` (o mesmo do detalhe da imagem);
 * - resumo com contagens numéricas ou listas (códigos em texto, número ou `{ filial }`); sem resumo,
 *   "imagens a gerar" é o número de imagens;
 * - "imagens geradas" do encerramento como número ou lista de códigos (texto ou `{ codigo }`).
 *
 * Números aceitam número ou texto decimal canônico; pt-BR ou outro tipo é inválido. Nas leituras,
 * respostas 2xx fora do formato viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)` e um item inválido
 * rejeita a resposta inteira. Regra "2xx = gravado" no encerramento: qualquer 2xx resolve; o que não
 * for reconhecido vira `null`, `0`, `[]` ou o resumo vazio. Erros HTTP e de rede chegam como `ApiError`
 * sem alteração (a chamada nunca é repetida).
 */

import {
  type ContagemUnidades,
  type Fechamento,
  type ImagemCongelada,
  PERIODICIDADES,
  type Periodicidade,
  type PeriodoDaImagem,
  type PreviaFechamento,
  type ResultadoEncerramento,
  type ResumoFechamento,
  SITUACOES_PERIODO,
  type SituacaoPeriodo,
  TIPOS_VINCULO,
} from '../types/dominio'
import { type FechamentoApi, paraFechamento } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'
import { paraDashboardDaImagem, paraImagemCongelada, paraPeriodoDaImagem } from './imagensService'

const ROTA_FECHAMENTOS = '/ped/fechamentos'

/** Filtros da lista de fechamentos (RF-79). */
export interface FiltrosFechamentos {
  periodicidade?: Periodicidade | 'todas'
  situacao?: SituacaoPeriodo | 'todas'
  /** Texto da busca; vazio ou só com espaços não entra na query. */
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

/** Número, texto decimal canônico → número; ausente → `null`; o resto → `undefined` (inválido). */
function numeroLido(valor: unknown): number | null | undefined {
  if (ausente(valor)) return null
  if (ehNumero(valor)) return valor
  if (ehTexto(valor) && DECIMAL_CANONICO.test(valor.trim())) return Number(valor.trim())
  return undefined
}

/** Número opcional estrito: ausente → `null`; inválido rejeita a resposta. */
function numeroOuNulo(valor: unknown): number | null {
  const numero = numeroLido(valor)
  if (numero === undefined) throw respostaInvalida()
  return numero
}

/** Lista na raiz ou dentro de `{ <chave> }`; qualquer outro formato rejeita a resposta. */
function listaDaResposta(resposta: unknown, chave: string): unknown[] {
  const lista: unknown = ehObjeto(resposta) ? resposta[chave] : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista
}

/** Lista opcional: ausente → `[]`; não lista rejeita. */
function listaOpcional(valor: unknown): unknown[] {
  if (ausente(valor)) return []
  if (!Array.isArray(valor)) throw respostaInvalida()
  return valor
}

/** Código de filial em texto, número ou `{ filial }` → texto; o resto → `null`. */
function codigoDaUnidade(item: unknown): string | null {
  if (ehTexto(item)) return item
  if (ehNumero(item)) return String(item)
  if (ehObjeto(item)) return codigoDaUnidade(item.filial)
  return null
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

// ---------------------------------------------------------------------------
// Conversões (API → domínio)
// ---------------------------------------------------------------------------

function contagem(valor: unknown): number {
  const numero = numeroOuNulo(valor)
  return numero ?? 0
}

function codigoObrigatorio(item: unknown): string {
  const codigo = ehTexto(item) || ehNumero(item) ? String(item) : null
  if (codigo === null) throw respostaInvalida()
  return codigo
}

function nomeDoIndicador(item: unknown): string {
  if (ehTexto(item)) return item
  if (ehObjeto(item) && ehTexto(item.indicador)) return item.indicador
  if (ehObjeto(item) && ehTexto(item.nome)) return item.nome
  throw respostaInvalida()
}

function paraLinhaFechamento(item: unknown): Fechamento {
  if (
    !ehObjeto(item) ||
    !ehNumero(item.id) ||
    !ehTexto(item.nome) ||
    !ehUmDe(TIPOS_VINCULO, item['tipo de vinculo']) ||
    !ehUmDe(PERIODICIDADES, item.periodicidade) ||
    !ehTexto(item['periodo atual']) ||
    !ehUmDe(SITUACOES_PERIODO, item['situacao do periodo']) ||
    !(ausente(item.progresso) || ehObjeto(item.progresso))
  ) {
    throw respostaInvalida()
  }
  const progresso = ehObjeto(item.progresso) ? item.progresso : {}
  const linha: FechamentoApi = {
    id: item.id,
    nome: item.nome,
    'tipo de vinculo': item['tipo de vinculo'],
    'itens vinculados': listaOpcional(item['itens vinculados']).map(codigoObrigatorio),
    periodicidade: item.periodicidade,
    'periodo atual': item['periodo atual'],
    'situacao do periodo': item['situacao do periodo'],
    'unidades de imagem': contagem(item['unidades de imagem']),
    'unidades encerradas': contagem(item['unidades encerradas']),
    'unidades com pendencias': contagem(item['unidades com pendencias']),
    progresso: { preenchidos: contagem(progresso.preenchidos), total: contagem(progresso.total) },
    'indicadores com problema': listaOpcional(item['indicadores com problema']).map(nomeDoIndicador),
    'unidades sem tabela de faixas': listaOpcional(item['unidades sem tabela de faixas']).map(codigoObrigatorio),
  }
  return paraFechamento(linha)
}

const CONTAGEM_VAZIA: ContagemUnidades = { quantidade: 0, unidades: [] }

function resumoVazio(imagensAGerar: number): ResumoFechamento {
  return {
    imagensAGerar,
    unidadesJaEncerradas: { ...CONTAGEM_VAZIA, unidades: [] },
    unidadesComPendencias: { ...CONTAGEM_VAZIA, unidades: [] },
    unidadesSemTabelaDeFaixas: { ...CONTAGEM_VAZIA, unidades: [] },
    avisos: [],
  }
}

/** Contagem numérica ou lista de unidades; `undefined` quando fora do formato. */
function contagemDeUnidades(valor: unknown): ContagemUnidades | undefined {
  if (ausente(valor)) return { quantidade: 0, unidades: [] }
  if (Array.isArray(valor)) {
    const unidades = valor.map(codigoDaUnidade)
    if (unidades.some((codigo) => codigo === null)) return undefined
    return { quantidade: unidades.length, unidades: unidades.filter((codigo): codigo is string => codigo !== null) }
  }
  const quantidade = numeroLido(valor)
  return quantidade === undefined || quantidade === null ? undefined : { quantidade, unidades: [] }
}

/**
 * Resumo da prévia/encerramento. `estrito` (prévia, leitura): fora do formato rejeita a resposta; no
 * encerramento ("2xx = gravado") o que não for reconhecido fica vazio.
 */
function paraResumo(valor: unknown, imagensAGerarPadrao: number, estrito: boolean): ResumoFechamento {
  if (ausente(valor)) return resumoVazio(imagensAGerarPadrao)
  if (!ehObjeto(valor)) {
    if (estrito) throw respostaInvalida()
    return resumoVazio(imagensAGerarPadrao)
  }
  const ler = (chave: string): ContagemUnidades => {
    const lida = contagemDeUnidades(valor[chave])
    if (lida !== undefined) return lida
    if (estrito) throw respostaInvalida()
    return { quantidade: 0, unidades: [] }
  }
  const imagensAGerar = numeroLido(valor['imagens a gerar'])
  if (imagensAGerar === undefined && estrito) throw respostaInvalida()
  return {
    imagensAGerar: imagensAGerar ?? imagensAGerarPadrao,
    unidadesJaEncerradas: ler('unidades ja encerradas'),
    unidadesComPendencias: ler('unidades com pendencias'),
    unidadesSemTabelaDeFaixas: ler('unidades sem tabela de faixas'),
    avisos: mensagens(valor.avisos),
  }
}

function paraImagemDaPrevia(item: unknown): ImagemCongelada {
  if (!ehObjeto(item)) throw respostaInvalida()
  const conteudo = ehObjeto(item.imagem) ? item.imagem : item
  return paraImagemCongelada(conteudo, textoOuNulo(item.chave))
}

function paraPrevia(resposta: unknown): PreviaFechamento {
  if (!ehObjeto(resposta)) throw respostaInvalida()
  const imagens = listaOpcional(resposta.imagens).map(paraImagemDaPrevia)
  return {
    dashboard: paraDashboardDaImagem(resposta.dashboard, resposta.dashboard_nome),
    periodo: paraPeriodoDaImagem(resposta.periodo),
    resumo: paraResumo(resposta.resumo, imagens.length, true),
    imagens,
  }
}

/** Período do encerramento, lido de forma tolerante (fora do formato → `null`). */
function periodoTolerante(valor: unknown): PeriodoDaImagem | null {
  try {
    return paraPeriodoDaImagem(valor)
  } catch {
    return null
  }
}

function codigoDaImagem(item: unknown): string | null {
  if (ehTexto(item)) return item
  if (ehObjeto(item) && ehTexto(item.codigo)) return item.codigo
  return null
}

function paraResultadoEncerramento(resposta: unknown): ResultadoEncerramento {
  if (!ehObjeto(resposta)) {
    return { mensagem: null, lote: null, periodo: null, imagensGeradas: 0, codigosDasImagens: [], resumo: resumoVazio(0) }
  }
  const geradas = resposta['imagens geradas']
  let imagensGeradas = 0
  let codigosDasImagens: string[] = []
  if (Array.isArray(geradas)) {
    imagensGeradas = geradas.length
    codigosDasImagens = geradas.map(codigoDaImagem).filter((codigo): codigo is string => codigo !== null)
  } else {
    imagensGeradas = numeroLido(geradas) ?? 0
  }
  return {
    mensagem: textoOuNulo(resposta.mensagem),
    lote: textoOuNulo(resposta.lote),
    periodo: periodoTolerante(resposta.periodo),
    imagensGeradas,
    codigosDasImagens,
    resumo: paraResumo(resposta.resumo, 0, false),
  }
}

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

/** Dashboards ativos com o período atual e a situação do fechamento (RF-78, RF-79), na ordem da API. */
export async function listarFechamentos(filtros: FiltrosFechamentos = {}): Promise<Fechamento[]> {
  const resposta = await apiFetch<unknown>(ROTA_FECHAMENTOS, {
    query: {
      periodicidade: filtros.periodicidade === 'todas' ? undefined : filtros.periodicidade,
      situacao: filtros.situacao === 'todas' ? undefined : filtros.situacao,
      busca: filtros.busca?.trim() ? filtros.busca : undefined,
    },
  })
  return listaDaResposta(resposta, 'fechamentos').map(paraLinhaFechamento)
}

/** Prévia do encerramento do período atual (RF-80): um GET, nada é gravado. */
export async function obterPreviaFechamento(id: number): Promise<PreviaFechamento> {
  const resposta = await apiFetch<unknown>(`${ROTA_FECHAMENTOS}/${id}/previa`)
  return paraPrevia(resposta)
}

/**
 * Encerra o período atual do dashboard (RF-81, RF-82): `POST` sem corpo. Regra "2xx = gravado": qualquer
 * 2xx resolve, inclusive corpo vazio ou fora do formato. O `400` (todas as unidades já encerradas,
 * dashboard não ativo) chega como `ApiError`, sem repetir a chamada.
 */
export async function encerrarFechamento(id: number): Promise<ResultadoEncerramento> {
  let resposta: unknown
  try {
    resposta = await apiFetch<unknown>(`${ROTA_FECHAMENTOS}/${id}/encerrar`, { method: 'POST' })
  } catch (erro) {
    // Corpo 2xx que não é JSON: já foi gravado.
    if (erro instanceof ApiError && erro.status >= 200 && erro.status < 300) resposta = undefined
    else throw erro
  }
  return paraResultadoEncerramento(resposta)
}
