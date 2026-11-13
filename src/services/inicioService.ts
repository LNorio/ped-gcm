/**
 * Serviço da tela Início (F11.1 — RF-06 a RF-11).
 *
 * Rota de `docs/backend/API (28).md`, seção "Cadastro e Preenchimento — fase 9: tela Início":
 * - `GET /api/ped/inicio?filial=` tudo o que a tela precisa, numa chamada só.
 *
 * A filial do cabeçalho (RF-01) vai em `?filial=<código>`; `undefined`, `null`, vazia ou `todas` não entram
 * na query (todas as filiais). Só o Admin escolhe; os demais perfis têm o parâmetro ignorado pela API.
 *
 * Conversão (ver `src/test/inicioFalsos.ts`):
 * - `filial` numérica (na lista de filiais e nas alterações) vira texto; `empresa` fica `null`;
 * - `"periodo aberto"` e `"aviso de acesso"` podem ser `null`; no aviso, `tipos`/`filiais` ausentes viram `[]`;
 * - listas ausentes (`filiais`, `resumo`, `"periodos em aberto"`, `"ultimas alteracoes"`) viram `[]`;
 * - `periodicidade` sem diferenciar maiúsculas; valores das alterações: número, booleano ou `null`.
 *
 * Respostas 2xx fora do formato esperado viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único item
 * inválido rejeita a resposta inteira. Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`).
 */

import {
  ACOES_LANCAMENTO,
  type AvisoDeAcessoInicio,
  type Filial,
  type Inicio,
  type ItemResumoInicio,
  PERFIS,
  PERIODICIDADES,
  type PeriodoAbertoInicio,
  type PeriodoEmAbertoInicio,
  type UltimaAlteracaoInicio,
  type ValorLancamento,
} from '../types/dominio'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, apiFetch } from './api'

const ROTA_INICIO = '/ped/inicio'

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
const ehCodigo = (v: unknown): v is string | number => ehTexto(v) || ehNumero(v)

function ehUmDe<T extends string>(valores: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (valores as readonly string[]).includes(valor)
}

function textoOuNulo(valor: unknown): string | null {
  return ehTexto(valor) ? valor : null
}

/** Lista opcional: ausente ou `null` vira `[]`; outro formato que não lista rejeita a resposta. */
function listaOpcional<T>(valor: unknown, converter: (item: unknown) => T): T[] {
  if (valor === undefined || valor === null) return []
  if (!Array.isArray(valor)) throw respostaInvalida()
  return valor.map(converter)
}

/** Lista de textos opcional: ausente ou `null` vira `[]`; itens que não são texto rejeitam a resposta. */
function listaDeTextos(valor: unknown): string[] {
  return listaOpcional(valor, (item) => {
    if (!ehTexto(item)) throw respostaInvalida()
    return item
  })
}

/** Valor das alterações: ausente/`null` → `null`; número ou booleano → o valor; outro → inválido. */
function valorAlteracao(valor: unknown): ValorLancamento | null {
  if (valor === undefined || valor === null) return null
  if (ehNumero(valor) || ehBooleano(valor)) return valor
  throw respostaInvalida()
}

// ---------------------------------------------------------------------------
// Conversões (API → domínio)
// ---------------------------------------------------------------------------

function paraFilial(item: unknown): Filial {
  if (!ehObjeto(item) || !ehCodigo(item.filial) || !ehTexto(item['nome filial'])) throw respostaInvalida()
  return { codigo: String(item.filial), nome: item['nome filial'], empresa: null }
}

function paraPeriodoAberto(valor: unknown): PeriodoAbertoInicio | null {
  if (valor === undefined || valor === null) return null
  if (
    !ehObjeto(valor) ||
    !ehTexto(valor['mes de referencia']) ||
    !['aberto por', 'aberto em', 'aviso'].every((chave) => opcional(valor[chave], ehTexto))
  ) {
    throw respostaInvalida()
  }
  return {
    mesDeReferencia: valor['mes de referencia'],
    abertoPor: textoOuNulo(valor['aberto por']),
    abertoEm: textoOuNulo(valor['aberto em']),
    aviso: textoOuNulo(valor.aviso),
  }
}

function paraAvisoDeAcesso(valor: unknown): AvisoDeAcessoInicio | null {
  if (valor === undefined || valor === null) return null
  if (!ehObjeto(valor) || !ehTexto(valor.tipo) || !opcional(valor.mensagem, ehTexto)) throw respostaInvalida()
  return {
    tipo: valor.tipo,
    mensagem: textoOuNulo(valor.mensagem),
    tipos: listaDeTextos(valor.tipos),
    filiais: listaDeTextos(valor.filiais),
  }
}

function paraItemResumo(item: unknown): ItemResumoInicio {
  if (!ehObjeto(item) || !ehTexto(item.chave) || !ehTexto(item.rotulo) || !ehNumero(item.valor)) throw respostaInvalida()
  return { chave: item.chave, rotulo: item.rotulo, valor: item.valor }
}

function paraPeriodoEmAberto(item: unknown): PeriodoEmAbertoInicio {
  if (!ehObjeto(item)) throw respostaInvalida()
  const periodicidade = ehTexto(item.periodicidade) ? item.periodicidade.trim().toLowerCase() : null
  const progresso = item.progresso
  if (
    !ehNumero(item.id) ||
    !ehTexto(item.nome) ||
    !ehUmDe(PERIODICIDADES, periodicidade) ||
    !ehTexto(item['periodo atual']) ||
    !ehBooleano(item['periodo encerrado']) ||
    !ehNumero(item['filiais abertas']) ||
    !ehObjeto(progresso) ||
    !ehNumero(progresso.preenchidos) ||
    !ehNumero(progresso.total)
  ) {
    throw respostaInvalida()
  }
  return {
    id: item.id,
    nome: item.nome,
    periodicidade,
    periodoAtual: item['periodo atual'],
    periodoEncerrado: item['periodo encerrado'],
    filiaisAbertas: item['filiais abertas'],
    progresso: { preenchidos: progresso.preenchidos, total: progresso.total },
  }
}

function paraUltimaAlteracao(item: unknown): UltimaAlteracaoInicio {
  if (
    !ehObjeto(item) ||
    !ehUmDe(ACOES_LANCAMENTO, item.acao) ||
    !ehTexto(item.apontamento) ||
    !ehTexto(item.competencia) ||
    !ehCodigo(item.filial) ||
    !ehTexto(item.data) ||
    !opcional(item.usuario, ehTexto)
  ) {
    throw respostaInvalida()
  }
  return {
    acao: item.acao,
    apontamento: item.apontamento,
    competencia: item.competencia,
    filial: String(item.filial),
    valorAnterior: valorAlteracao(item['valor anterior']),
    valorNovo: valorAlteracao(item['valor novo']),
    data: item.data,
    usuario: textoOuNulo(item.usuario),
  }
}

function paraInicio(resposta: unknown): Inicio {
  if (!ehObjeto(resposta) || !ehUmDe(PERFIS, resposta.perfil)) throw respostaInvalida()
  return {
    perfil: resposta.perfil,
    filiais: listaOpcional(resposta.filiais, paraFilial),
    periodoAberto: paraPeriodoAberto(resposta['periodo aberto']),
    avisoDeAcesso: paraAvisoDeAcesso(resposta['aviso de acesso']),
    resumo: listaOpcional(resposta.resumo, paraItemResumo),
    periodosEmAberto: listaOpcional(resposta['periodos em aberto'], paraPeriodoEmAberto),
    ultimasAlteracoes: listaOpcional(resposta['ultimas alteracoes'], paraUltimaAlteracao),
  }
}

// ---------------------------------------------------------------------------
// Chamadas
// ---------------------------------------------------------------------------

/** Código da filial para a query; `undefined` quando a tela é de todas as filiais. */
function filialDaQuery(filial: string | null | undefined): string | undefined {
  const codigo = (filial ?? '').trim()
  return codigo === '' || codigo.toLowerCase() === 'todas' ? undefined : codigo
}

/**
 * A tela Início (RF-06 a RF-11) na filial do cabeçalho: `GET /api/ped/inicio`, com `?filial=` só quando há
 * uma filial escolhida (sem filial, vazia ou `todas` = todas as filiais).
 */
export async function obterInicio(filial?: string | null): Promise<Inicio> {
  const resposta = await apiFetch<unknown>(ROTA_INICIO, { query: { filial: filialDaQuery(filial) } })
  return paraInicio(resposta)
}
