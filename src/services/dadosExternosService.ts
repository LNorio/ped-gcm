/**
 * Serviço de dados externos (F5.1) e da integração do dado externo (F5.7, F5.15–F5.18).
 *
 * Rotas de `docs/backend/API (25).md`, seções "Cadastro e Preenchimento — fase 3: dados externos" e
 * "Integração do dado externo (2026-11-09)", e de `docs/backend/FRONT-integracao-dado-externo.md`:
 * - `GET    /api/ped/dados-externos-cadastro`                       lista filtrada (`busca`, `situacao`, inclusive
 *   `integracao_pendente`); para o Admin cada item traz os campos da integração
 * - `GET    /api/ped/dados-externos-cadastro/identificadores`       coletas existentes (Admin e Validador)
 * - `GET    /api/ped/dados-externos-cadastro/integracoes-pendentes` ativos/inativos sem integração — Admin
 * - `POST   /api/ped/dados-externos-cadastro`                       cadastro (Admin) ou pedido de construção à TI
 * - `PUT    /api/ped/dados-externos-cadastro/{id}/concluir`         integração completa (4 campos) — Admin
 * - `PUT    /api/ped/dados-externos-cadastro/{id}/integracao`       mesmo corpo do concluir (Configurações) — Admin
 * - `PUT    /api/ped/dados-externos-cadastro/{id}/situacao`         `{ ativo }` — Admin e Validador
 * - `DELETE /api/ped/dados-externos-cadastro/{id}`                  Admin — recusa (400) se compõe indicador
 * - `GET    /api/ped/dados-externos-cadastro/{id}/realizado`        `filial`, `mes_de_referencia` (RN-05)
 * - `GET    /api/ped/integracao/variaveis`                          variáveis da integração (F5.15) — Admin
 * - `POST   /api/ped/integracao/validar`                            validação dos JSONs, sem gravar (F5.18) — Admin
 *
 * Erros 400 da integração (`concluir` e `integracao`) vêm como `{ mensagem, erros: [...] }`; a
 * `ApiError` traz o corpo em `dados`, e `errosDaIntegracao` lê os erros por campo.
 *
 * Os formatos das respostas não estão documentados na API; o serviço aceita os dois formatos
 * prováveis em cada rota (ver `src/test/dadosExternosFalsos.ts`):
 * - listagem: `{ "dados externos": [...] }` ou a lista pura; `"tarefa bitrix"` opcional (ausente ou
 *   `null`), no formato `{ id, status, titulo }`. O número da tarefa (`id`) só vem quando ela é enviada
 *   ao Bitrix24; enquanto está só registrada (ex.: `aguardando_envio`), `id` é `null`. A API real manda o
 *   número como texto (ex.: `"328439"`): número ou texto só com dígitos (após `trim()`) é aceito e vira
 *   número; texto não numérico (`"abc"`, `""`, `"31a"`, `"31.5"`, `"-31"`) é inválido (na listagem vira
 *   `ApiError`; no POST deixa a tarefa `null`);
 * - identificadores: lista pura ou `{ identificadores: [...] }`;
 * - POST: `{ "dado externo": {...}, tarefa }` ou o dado na raiz com `tarefa` ao lado (ex.: `{ mensagem, id,
 *   situacao, tarefa }`). A tarefa é criada pelo back-end (Validador e Preenchedor; o Admin não gera
 *   tarefa, `tarefa: null`) e, desde 06/11/2026 (`FRONT-tarefas-bitrix.md`), vem como `{ titulo,
 *   descricao, status, "id bitrix" }`: `enviada` traz o número em `"id bitrix"`, `aguardando_envio` traz
 *   `null`. Com a chave `"id bitrix"` presente, ela prevalece sobre o `id` do formato anterior, mesmo
 *   `null`; sem ela, `id` continua aceito. Como a resposta
 *   do POST não é documentada e um 2xx significa que o dado foi gravado, ela é lida de forma
 *   tolerante: corpo vazio, fora do formato ou incompleto vira `dadoExterno: null` (e tarefa fora do
 *   formato vira `tarefa: null`), sem erro;
 * - concluir: `{ "dado externo": {...}, "indicador criado" }` ou o dado na raiz com `"indicador criado"` ao lado.
 *   Como a resposta não é documentada e um 2xx significa que a conclusão foi gravada, ela é lida de forma
 *   tolerante: dado não reconhecível resolve `null`, sem erro; dado válido com `"indicador criado"`
 *   malformado ou ausente resolve `indicadorCriado: null`, sem erro;
 * - situação: o dado na raiz ou dentro de `"dado externo"`. Como a resposta não é documentada e um 2xx
 *   significa que a situação foi gravada, ela é lida de forma tolerante: dado não reconhecível resolve
 *   `null`, sem erro.
 *
 * Erros HTTP e de rede chegam como `ApiError` (ver `api.ts`) e são propagados sem alteração.
 * Nas demais rotas (listagem, identificadores, realizado, variáveis, pendentes e validação), respostas 2xx fora
 * do formato esperado viram `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; um único item inválido rejeita a resposta inteira.
 */

import {
  COLETAS,
  type CalculoEntradaServidor,
  type CampoSaidaServidor,
  type DadoExterno,
  type DadoIntegracaoPendente,
  type ErroIntegracao,
  type IdentificadorColeta,
  type IntegracaoDadoExterno,
  type IntegracoesPendentes,
  JANELAS_RETROATIVAS,
  type MesConsiderado,
  type NovoDadoExterno,
  type ParametrosValidacaoIntegracao,
  REFERENCIAS,
  type RealizadoDadoExterno,
  type ReferenciaNomeada,
  type ResultadoValidacaoEntradaServidor,
  type ResultadoValidacaoIntegracao,
  type ResultadoValidacaoSaidaServidor,
  SENTIDOS_CALCULO,
  SISTEMAS_ORIGEM,
  SITUACOES_DADO_EXTERNO,
  TIPOS_VARIAVEL_INTEGRACAO,
  type TarefaConstrucao,
  type VariavelIntegracao,
} from '../types/dominio'
import { type DadoExternoApi, numeroDaTarefaBitrix, paraCorpoNovoDadoExterno, paraDadoExterno } from './adaptadores'
import { ApiError, MENSAGEM_RESPOSTA_INVALIDA, type ValorQuery, apiFetch } from './api'

const ROTA_DADOS_EXTERNOS = '/ped/dados-externos-cadastro'
const ROTA_INTEGRACAO = '/ped/integracao'

/** Nome do campo da modal usado nos erros do JSON de entrada. */
const CAMPO_PARAMETROS_ENTRADA = 'parametros de entrada'

/**
 * Situações aceitas pelo filtro da API, na ordem exibida na tela. `integracao_pendente` (09/11/2026)
 * é só do Admin: quem mostra o filtro deve ocultá-la para os demais perfis.
 */
export const SITUACOES_FILTRO_DADO_EXTERNO = [
  'todas',
  'ativos',
  'inativos',
  'construcao',
  'problemas',
  'integracao_pendente',
] as const

export type SituacaoFiltroDadoExterno = (typeof SITUACOES_FILTRO_DADO_EXTERNO)[number]

export const ROTULOS_SITUACAO_FILTRO_DADO_EXTERNO: Readonly<Record<SituacaoFiltroDadoExterno, string>> = {
  todas: 'Todas',
  ativos: 'Ativos',
  inativos: 'Inativos',
  construcao: 'Em construção',
  problemas: 'Com problemas',
  integracao_pendente: 'Integração pendente (TI)',
}

/** Filtros de `listarDadosExternos`; só os informados entram na query. */
export interface FiltrosDadosExternos {
  /** Texto livre; vazio ou só com espaços é omitido. A API ignora acentos e maiúsculas. */
  busca?: string
  situacao?: SituacaoFiltroDadoExterno
}

/**
 * Resultado de `criarDadoExterno`: o dado gravado (ou `null` quando a resposta não o traz completo)
 * e a tarefa gerada para a TI (ou `null`).
 */
export interface ResultadoCriacaoDadoExterno {
  dadoExterno: DadoExterno | null
  tarefa: TarefaConstrucao | null
}

/** Resultado de `concluirConstrucao`: o dado ativado e o indicador criado automaticamente (ou `null`). */
export interface ResultadoConclusaoDadoExterno {
  dadoExterno: DadoExterno
  indicadorCriado: ReferenciaNomeada | null
}

/** Filtros de `obterRealizado`; só os informados entram na query. */
export interface FiltrosRealizado {
  /** Código da filial (só lido para o Admin). */
  filial?: string
  /** Qualquer data do mês desejado (`aaaa-mm-dd`). Padrão da API: mês atual. */
  mesDeReferencia?: string
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

function ehUmDe<T extends string | number>(opcoes: readonly T[], valor: unknown): valor is T {
  return opcoes.some((opcao) => opcao === valor)
}

/** Campo opcional: ausente, `null` ou do tipo esperado. */
function opcional(valor: unknown, validar: (v: unknown) => boolean): boolean {
  return valor === undefined || valor === null || validar(valor)
}

const ehTexto = (v: unknown): v is string => typeof v === 'string'
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const ehListaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto)

function ehReferenciaNomeada(valor: unknown): valor is ReferenciaNomeada {
  return ehObjeto(valor) && ehNumero(valor.id) && ehTexto(valor.nome)
}

/** Número da tarefa do Bitrix24: número ou texto só com dígitos (ver `numeroDaTarefaBitrix`). */
const ehNumeroDaTarefa = (v: unknown): boolean => numeroDaTarefaBitrix(v) !== undefined

/** Tarefa do Bitrix24: `id` numérico, texto numérico ou `null` (só registrada, ainda não enviada). */
function ehTarefaBitrixApi(valor: unknown): boolean {
  return (
    ehObjeto(valor) &&
    (ehNumeroDaTarefa(valor.id) || valor.id === null) &&
    ehTexto(valor.status) &&
    ehTexto(valor.titulo)
  )
}

function ehDadoExternoApi(valor: unknown): valor is DadoExternoApi {
  if (!ehObjeto(valor)) return false
  return (
    ehNumero(valor.id) &&
    ehTexto(valor.nome) &&
    ehNumero(valor['id tipo']) &&
    ehTexto(valor.tipo) &&
    ehUmDe(SITUACOES_DADO_EXTERNO, valor.situacao) &&
    ehUmDe(SISTEMAS_ORIGEM, valor['sistema de origem']) &&
    ehUmDe(REFERENCIAS, valor.referencia) &&
    ehUmDe(COLETAS, valor.coleta) &&
    ehUmDe(SENTIDOS_CALCULO, valor['sentido do calculo']) &&
    ehTexto(valor['tipo de valor']) &&
    opcional(valor['situacao descricao'], ehTexto) &&
    opcional(valor['tarefa bitrix'], ehTarefaBitrixApi) &&
    opcional(valor.identificador, ehTexto) &&
    opcional(valor['campo calculo'], ehTexto) &&
    opcional(valor['dia da coleta'], ehNumero) &&
    opcional(valor['coleta descricao'], ehTexto) &&
    opcional(valor['janela retroativa'], (v) => ehUmDe(JANELAS_RETROATIVAS, v)) &&
    opcional(valor.comentarios, ehTexto) &&
    opcional(valor['coleta disponivel'], (v) => typeof v === 'boolean') &&
    opcional(valor.indicadores, ehListaDeTextos) &&
    // Integração (só para o Admin; ausentes nos demais perfis). Os parâmetros são JSON livre.
    opcional(valor.url, ehTexto) &&
    opcional(valor['variaveis usadas'], ehListaDeTextos) &&
    opcional(valor['integracao pendente'], (v) => typeof v === 'boolean') &&
    opcional(valor['integracao alterada em'], ehTexto) &&
    opcional(valor['integracao alterada por'], ehTexto) &&
    // Meta via API (10/11/2026; todos os perfis).
    opcional(valor['fornece meta'], (v) => typeof v === 'boolean')
  )
}

/** Converte um dado externo da resposta; fora do formato (inclusive tipo de valor desconhecido) vira `ApiError`. */
function converterDadoExterno(resposta: unknown): DadoExterno {
  if (!ehDadoExternoApi(resposta)) throw respostaInvalida()
  try {
    return paraDadoExterno(resposta)
  } catch {
    throw respostaInvalida()
  }
}

/** Converte um dado externo completo e válido; caso contrário devolve `null` (uso nas respostas tolerantes). */
function converterDadoExternoOuNulo(valor: unknown): DadoExterno | null {
  if (!ehDadoExternoApi(valor)) return null
  try {
    return paraDadoExterno(valor)
  } catch {
    return null
  }
}

/** Número informado na tarefa do POST/PUT: `"id bitrix"` quando a chave existe (mesmo `null`); senão, `id`. */
function numeroInformadoDaTarefa(valor: Record<string, unknown>): unknown {
  return 'id bitrix' in valor ? valor['id bitrix'] : valor.id
}

/**
 * Converte a tarefa da resposta do POST; ausente ou fora do formato vira `null`, sem erro.
 * O número vem de `"id bitrix"` (formato de 06/11/2026); quando a chave está presente ela prevalece,
 * mesmo `null` (tarefa na fila, `aguardando_envio`). Sem `"id bitrix"`, vale o `id` do formato anterior.
 */
function converterTarefaOuNula(valor: unknown): TarefaConstrucao | null {
  if (
    !ehObjeto(valor) ||
    !ehTexto(valor.titulo) ||
    !opcional(numeroInformadoDaTarefa(valor), ehNumeroDaTarefa) ||
    !opcional(valor.status, ehTexto) ||
    !opcional(valor.descricao, ehTexto)
  ) {
    return null
  }
  return {
    id: numeroDaTarefaBitrix(numeroInformadoDaTarefa(valor)) ?? null,
    status: ehTexto(valor.status) ? valor.status : null,
    titulo: valor.titulo,
    descricao: ehTexto(valor.descricao) ? valor.descricao : null,
  }
}

/** Indicador criado na conclusão; ausente ou fora do formato vira `null`, sem erro. */
function converterIndicadorCriadoOuNulo(valor: unknown): ReferenciaNomeada | null {
  if (!ehReferenciaNomeada(valor)) return null
  return { id: valor.id, nome: valor.nome }
}

function converterIdentificador(valor: unknown): IdentificadorColeta {
  if (!ehObjeto(valor) || !ehTexto(valor.identificador) || !ehNumero(valor.quantidade)) throw respostaInvalida()
  return { identificador: valor.identificador, quantidade: valor.quantidade }
}

function converterMes(valor: unknown): MesConsiderado {
  if (!ehObjeto(valor) || !ehTexto(valor.mes) || !ehNumero(valor.valor)) throw respostaInvalida()
  return { mes: valor.mes, valor: valor.valor }
}

function converterRealizado(resposta: unknown): RealizadoDadoExterno {
  if (!ehObjeto(resposta)) throw respostaInvalida()
  const valor = resposta.valor
  const meses = resposta['meses considerados']
  const janela = resposta['janela retroativa']
  const sentido = resposta['sentido do calculo']
  const coletaDisponivel = resposta['coleta disponivel']
  if (
    !opcional(valor, ehNumero) ||
    !opcional(meses, Array.isArray) ||
    !opcional(janela, (v) => ehUmDe(JANELAS_RETROATIVAS, v)) ||
    !ehUmDe(SENTIDOS_CALCULO, sentido) ||
    !opcional(coletaDisponivel, (v) => typeof v === 'boolean')
  ) {
    throw respostaInvalida()
  }
  return {
    valor: ehNumero(valor) ? valor : null,
    mesesConsiderados: Array.isArray(meses) ? meses.map(converterMes) : [],
    janelaRetroativa: ehUmDe(JANELAS_RETROATIVAS, janela) ? janela : null,
    sentidoCalculo: sentido,
    coletaDisponivel: coletaDisponivel === true,
  }
}

/** Nome de variável sem os `%` e sem espaços nas pontas (`"%filial%"` → `"filial"`). */
function semPercentual(nome: string): string {
  return nome.replaceAll('%', '').trim()
}

/**
 * Variável da integração (`{ variavel: "%filial%", nome: "filial", tipo, descricao, exemplo }`):
 * - nome: `nome` (ou, sem ele, `variavel`) em texto, sem os `%` e não vazio;
 * - `descricao` em texto, ausente ou `null` (vira `''`);
 * - `tipo` entre `numero`, `texto` e `data`;
 * - `exemplo` em texto (número também é aceito e vira texto), ausente ou `null` (vira `null`).
 */
function converterVariavelIntegracao(valor: unknown): VariavelIntegracao {
  if (!ehObjeto(valor)) throw respostaInvalida()
  const bruto = valor.nome ?? valor.variavel
  if (!ehTexto(bruto) || !opcional(valor.descricao, ehTexto)) throw respostaInvalida()
  if (!ehUmDe(TIPOS_VARIAVEL_INTEGRACAO, valor.tipo)) throw respostaInvalida()
  if (!opcional(valor.exemplo, (v) => ehTexto(v) || ehNumero(v))) throw respostaInvalida()
  const nome = semPercentual(bruto)
  if (nome === '') throw respostaInvalida()
  const exemplo = ehTexto(valor.exemplo) || ehNumero(valor.exemplo) ? String(valor.exemplo) : null
  return { nome, descricao: ehTexto(valor.descricao) ? valor.descricao : '', tipo: valor.tipo, exemplo }
}

/** Item de `integracoes-pendentes`: `id`, `nome`, `identificador` (texto ou `null`) e `situacao` conhecida. */
function converterDadoPendente(valor: unknown): DadoIntegracaoPendente {
  if (
    !ehObjeto(valor) ||
    !ehNumero(valor.id) ||
    !ehTexto(valor.nome) ||
    !opcional(valor.identificador, ehTexto) ||
    !ehUmDe(SITUACOES_DADO_EXTERNO, valor.situacao)
  ) {
    throw respostaInvalida()
  }
  return {
    id: valor.id,
    nome: valor.nome,
    identificador: ehTexto(valor.identificador) ? valor.identificador : null,
    situacao: valor.situacao,
  }
}

function converterIntegracoesPendentes(resposta: unknown): IntegracoesPendentes {
  if (!ehObjeto(resposta) || !ehNumero(resposta.quantidade) || !Array.isArray(resposta.dados)) throw respostaInvalida()
  return { quantidade: resposta.quantidade, dados: resposta.dados.map(converterDadoPendente) }
}

function numeroOuNulo(valor: unknown): number | null {
  return ehNumero(valor) ? valor : null
}

function textoOuNulo(valor: unknown): string | null {
  return ehTexto(valor) ? valor : null
}

/** Converte um erro da integração; sem `mensagem` em texto devolve `null`. Campos ausentes viram `null`. */
function erroDaIntegracaoOuNulo(valor: unknown): ErroIntegracao | null {
  if (!ehObjeto(valor) || !ehTexto(valor.mensagem)) return null
  return {
    campo: textoOuNulo(valor.campo),
    mensagem: valor.mensagem,
    linha: numeroOuNulo(valor.linha),
    coluna: numeroOuNulo(valor.coluna),
    caminho: textoOuNulo(valor.caminho),
    expressao: textoOuNulo(valor.expressao),
  }
}

/**
 * Corpo de `concluir` e de `integracao`: identificador em maiúsculas, URL aparada e os JSONs como digitados.
 * Também usado pela integração da meta do indicador (F6.11, `atualizarIntegracaoIndicador`).
 */
export function corpoIntegracao(integracao: IntegracaoDadoExterno): Record<string, string> {
  return {
    identificador: integracao.identificador.trim().toUpperCase(),
    url: integracao.url.trim(),
    'parametros de saida': integracao.parametrosSaida,
    [CAMPO_PARAMETROS_ENTRADA]: integracao.parametrosEntrada,
  }
}

/** Campo da saída validada: `campo` (ou `nome`) e `tipo` em texto. */
function converterCampoSaida(valor: unknown): CampoSaidaServidor {
  if (!ehObjeto(valor)) throw respostaInvalida()
  const nome = valor.campo ?? valor.nome
  if (!ehTexto(nome) || !ehTexto(valor.tipo)) throw respostaInvalida()
  return { nome, tipo: valor.tipo }
}

/** Saída de `validar`: `null`/ausente → `null`; válida com `campos`; inválida com `erro { mensagem, linha?, coluna? }`. */
function converterValidacaoSaida(valor: unknown): ResultadoValidacaoSaidaServidor | null {
  if (valor === undefined || valor === null) return null
  if (!ehObjeto(valor) || typeof valor.valido !== 'boolean') throw respostaInvalida()
  if (valor.valido) {
    if (!Array.isArray(valor.campos)) throw respostaInvalida()
    return { valido: true, campos: valor.campos.map(converterCampoSaida) }
  }
  const erro = valor.erro
  if (!ehObjeto(erro) || !ehTexto(erro.mensagem)) throw respostaInvalida()
  return {
    valido: false,
    erro: { mensagem: erro.mensagem, linha: numeroOuNulo(erro.linha), coluna: numeroOuNulo(erro.coluna) },
  }
}

/** Cálculo da entrada validada: `caminho` (ou `campo`), `expressao` e `resultado` (número vira texto). */
function converterCalculo(valor: unknown): CalculoEntradaServidor {
  if (!ehObjeto(valor)) throw respostaInvalida()
  const caminho = valor.caminho ?? valor.campo
  const resultado = ehNumero(valor.resultado) ? String(valor.resultado) : valor.resultado
  if (!ehTexto(caminho) || !ehTexto(valor.expressao) || !ehTexto(resultado)) throw respostaInvalida()
  return { caminho, expressao: valor.expressao, resultado }
}

/**
 * Erro da entrada em `validar`: o `campo` do back-end é o ponto do JSON (como em `calculos`), e `caminho`,
 * quando vem, prevalece; o nome do campo da modal (`parametros de entrada`) não é caminho. No domínio,
 * `campo` é sempre `parametros de entrada`. Sem `mensagem` em texto, a resposta inteira é inválida.
 */
function converterErroEntrada(valor: unknown): ErroIntegracao {
  const erro = erroDaIntegracaoOuNulo(valor)
  if (erro === null) throw respostaInvalida()
  const campoComoCaminho = erro.campo !== null && erro.campo !== CAMPO_PARAMETROS_ENTRADA ? erro.campo : null
  return { ...erro, campo: CAMPO_PARAMETROS_ENTRADA, caminho: erro.caminho ?? campoComoCaminho }
}

/**
 * Entrada de `validar`: `null`/ausente → `null`; válida com `variaveis usadas` (sem os `%`), `calculos`
 * e `previa` (ausentes → `[]`, `[]` e `null`); inválida com a lista `erros`.
 */
function converterValidacaoEntrada(valor: unknown): ResultadoValidacaoEntradaServidor | null {
  if (valor === undefined || valor === null) return null
  if (!ehObjeto(valor) || typeof valor.valido !== 'boolean') throw respostaInvalida()
  if (!valor.valido) {
    if (!Array.isArray(valor.erros)) throw respostaInvalida()
    return { valido: false, erros: valor.erros.map(converterErroEntrada) }
  }
  const variaveis = valor['variaveis usadas']
  const calculos = valor.calculos
  if (!opcional(variaveis, ehListaDeTextos) || !opcional(calculos, Array.isArray)) throw respostaInvalida()
  return {
    valido: true,
    variaveisUsadas: ehListaDeTextos(variaveis) ? variaveis.map(semPercentual) : [],
    calculos: Array.isArray(calculos) ? calculos.map(converterCalculo) : [],
    previa: valor.previa ?? null,
  }
}

function montarQuery(filtros: FiltrosDadosExternos): Record<string, ValorQuery> {
  const busca = filtros.busca?.trim() ? filtros.busca : undefined
  return { busca, situacao: filtros.situacao }
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

/** Lista os dados externos dos tipos do usuário, filtrados pela API, na ordem devolvida. */
export async function listarDadosExternos(filtros: FiltrosDadosExternos = {}): Promise<DadoExterno[]> {
  const resposta = await apiFetch<unknown>(ROTA_DADOS_EXTERNOS, { query: montarQuery(filtros) })
  const lista: unknown = ehObjeto(resposta) ? resposta['dados externos'] : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista.map(converterDadoExterno)
}

/** Coletas existentes que um identificador pode apontar (Admin e Validador). */
export async function listarIdentificadores(): Promise<IdentificadorColeta[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/identificadores`)
  const lista: unknown = ehObjeto(resposta) ? resposta.identificadores : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista.map(converterIdentificador)
}

/**
 * Cadastra um dado externo. Admin: nasce ativo, sem tarefa. Validador e Preenchedor: nasce em
 * construção e a API devolve a tarefa gerada para a TI.
 *
 * A resposta do POST não é documentada na API, e um 2xx significa que o dado foi gravado.
 * Por isso a resposta não é validada de forma estrita:
 * - dado válido na raiz ou em `"dado externo"`: devolvido convertido;
 * - corpo vazio (201/204) ou sem dado reconhecível (só `mensagem`, `{ id }`, incompleto, tipo de
 *   valor desconhecido, lista, texto): `dadoExterno: null`, sem erro. Quem chama deve recarregar a
 *   lista para obter o dado criado;
 * - `tarefa` é lida da raiz mesmo sem o dado; fora do formato vira `null`, sem erro.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração.
 */
export async function criarDadoExterno(dados: NovoDadoExterno): Promise<ResultadoCriacaoDadoExterno> {
  const resposta = await apiFetch<unknown>(ROTA_DADOS_EXTERNOS, {
    method: 'POST',
    body: paraCorpoNovoDadoExterno(dados),
  })
  if (!ehObjeto(resposta)) return { dadoExterno: null, tarefa: null }
  return {
    dadoExterno: converterDadoExternoOuNulo(resposta) ?? converterDadoExternoOuNulo(resposta['dado externo']),
    tarefa: converterTarefaOuNula(resposta.tarefa),
  }
}

/**
 * Conclui a construção (Admin): grava a integração completa, ativa o dado e cria o indicador (RF-28).
 *
 * Corpo (contrato de 09/11/2026; só o identificador agora dá 400): `{ identificador, url,
 * "parametros de saida", "parametros de entrada" }` — identificador em maiúsculas e URL sem espaços nas
 * pontas; os JSONs vão como digitados (o back-end aceita o texto e o valida).
 *
 * A resposta não é documentada, e um 2xx significa que a conclusão foi gravada. Por isso não é validada
 * de forma estrita:
 * - dado válido na raiz ou em `"dado externo"`: devolve o dado e o indicador criado (ou
 *   `indicadorCriado: null` quando ausente ou malformado);
 * - dado não reconhecível (corpo vazio, 204, só `mensagem`, `{ id }`, incompleto, tipo de valor
 *   desconhecido, lista ou texto): devolve `null`, sem erro. Quem chama deve recarregar a lista.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração; no 400 da integração,
 * `errosDaIntegracao` lê os erros por campo.
 */
export async function concluirConstrucao(
  id: number,
  integracao: IntegracaoDadoExterno,
): Promise<ResultadoConclusaoDadoExterno | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}/concluir`, {
    method: 'PUT',
    body: corpoIntegracao(integracao),
  })
  if (!ehObjeto(resposta)) return null
  const dadoExterno = converterDadoExternoOuNulo(resposta) ?? converterDadoExternoOuNulo(resposta['dado externo'])
  if (dadoExterno === null) return null
  return {
    dadoExterno,
    indicadorCriado: converterIndicadorCriadoOuNulo(resposta['indicador criado']),
  }
}

/**
 * Atualiza a integração de um dado `ativo` ou `inativo` (botão Configurações, F5.16), sem mudar a
 * situação nem criar indicador. Mesmo corpo de `concluirConstrucao`.
 *
 * A resposta documentada (`{ mensagem, "variaveis usadas" }`) não é usada: qualquer 2xx significa que
 * a integração foi gravada e resolve sem valor. Erros HTTP (inclusive o 400 de dado em construção e o
 * 400 com `erros`, ver `errosDaIntegracao`) e de rede são propagados como `ApiError`.
 */
export async function atualizarIntegracao(id: number, integracao: IntegracaoDadoExterno): Promise<void> {
  await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}/integracao`, {
    method: 'PUT',
    body: corpoIntegracao(integracao),
  })
}

/**
 * Erros por campo do 400 da integração (`{ mensagem, erros: [{ campo, mensagem, linha?, coluna?,
 * caminho?, expressao? }] }`), na ordem devolvida. Campos ausentes viram `null`; itens sem `mensagem`
 * em texto são ignorados. Falha que não é `ApiError`, ou sem a lista `erros`, devolve `[]`.
 */
export function errosDaIntegracao(falha: unknown): ErroIntegracao[] {
  if (!(falha instanceof ApiError) || !ehObjeto(falha.dados) || !Array.isArray(falha.dados.erros)) return []
  return falha.dados.erros.map(erroDaIntegracaoOuNulo).filter((erro): erro is ErroIntegracao => erro !== null)
}

/**
 * Ativa ou desativa um dado externo; devolve o dado atualizado (com quem alterou e quando).
 *
 * A resposta não é documentada, e um 2xx significa que a situação foi gravada. Por isso não é validada
 * de forma estrita: dado válido na raiz ou em `"dado externo"` é devolvido convertido; qualquer outro 2xx
 * (corpo vazio, 204, só `mensagem`, `{ id }`, incompleto, tipo de valor desconhecido, lista ou texto)
 * resolve `null`, sem erro. Quem chama deve recarregar a lista para obter a situação gravada.
 *
 * Erros HTTP e de rede são propagados como `ApiError`, sem alteração.
 */
export async function alterarSituacaoDadoExterno(id: number, ativo: boolean): Promise<DadoExterno | null> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}/situacao`, {
    method: 'PUT',
    body: { ativo },
  })
  if (!ehObjeto(resposta)) return null
  return converterDadoExternoOuNulo(resposta) ?? converterDadoExternoOuNulo(resposta['dado externo'])
}

/**
 * Exclui um dado externo. Resolve sem valor em 204 ou 200. Quando ele compõe (ou já compôs)
 * indicadores, a API responde 400 e a `ApiError` traz `dados.indicadores`.
 */
export async function excluirDadoExterno(id: number): Promise<void> {
  await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}`, { method: 'DELETE' })
}

/** Realizado do dado externo na filial e mês informados (RN-05). */
export async function obterRealizado(id: number, filtros: FiltrosRealizado = {}): Promise<RealizadoDadoExterno> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/${id}/realizado`, {
    query: { filial: filtros.filial, mes_de_referencia: filtros.mesDeReferencia },
  })
  return converterRealizado(resposta)
}

/**
 * Variáveis que podem ser usadas nos parâmetros de entrada da integração (F5.15), na ordem devolvida.
 *
 * Rota documentada pelo back-end em 09/11/2026: `GET /api/ped/integracao/variaveis` (só Admin), lista
 * de `{ variavel: "%filial%", nome: "filial", tipo, descricao, exemplo: "100" }`; também aceita
 * `{ "variaveis": [...] }`. O nome vem de `nome` (ou, sem ele, de `variavel`), sem os `%`; a descrição
 * ausente ou `null` vira `''` e o exemplo ausente ou `null` vira `null`. Corpo ou item fora do formato
 * (inclusive tipo desconhecido) rejeita a resposta inteira com `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`.
 *
 * Erros HTTP e de rede são propagados como `ApiError`.
 */
export async function listarVariaveisIntegracao(): Promise<VariavelIntegracao[]> {
  const resposta = await apiFetch<unknown>(`${ROTA_INTEGRACAO}/variaveis`)
  const lista: unknown = ehObjeto(resposta) ? resposta.variaveis : resposta
  if (!Array.isArray(lista)) throw respostaInvalida()
  return lista.map(converterVariavelIntegracao)
}

/**
 * Dados `ativo`/`inativo` sem integração (F5.17, só Admin): `{ quantidade, dados: [{ id, nome,
 * identificador, situacao }] }`. `quantidade` é a informada pela API. Fora do formato vira
 * `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; erros HTTP e de rede são propagados.
 */
export async function listarIntegracoesPendentes(): Promise<IntegracoesPendentes> {
  const resposta = await apiFetch<unknown>(`${ROTA_DADOS_EXTERNOS}/integracoes-pendentes`)
  return converterIntegracoesPendentes(resposta)
}

/**
 * Valida os JSONs da integração no back-end, sem gravar (F5.18): `POST /api/ped/integracao/validar`.
 *
 * Só os textos não vazios (após `trim()`) vão no corpo, como digitados; com os dois vazios a API não é
 * chamada e resolve `{ saida: null, entrada: null }`. Na resposta, `saida`/`entrada` `null` ou ausentes
 * viram `null`. Fora do formato vira `ApiError(200, MENSAGEM_RESPOSTA_INVALIDA)`; erros HTTP e de rede
 * são propagados.
 */
export async function validarIntegracao(
  parametros: ParametrosValidacaoIntegracao,
): Promise<ResultadoValidacaoIntegracao> {
  const corpo: Record<string, string> = {}
  if (parametros.parametrosSaida?.trim()) corpo['parametros de saida'] = parametros.parametrosSaida
  if (parametros.parametrosEntrada?.trim()) corpo[CAMPO_PARAMETROS_ENTRADA] = parametros.parametrosEntrada
  if (Object.keys(corpo).length === 0) return { saida: null, entrada: null }

  const resposta = await apiFetch<unknown>(`${ROTA_INTEGRACAO}/validar`, { method: 'POST', body: corpo })
  if (!ehObjeto(resposta)) throw respostaInvalida()
  return { saida: converterValidacaoSaida(resposta.saida), entrada: converterValidacaoEntrada(resposta.entrada) }
}
