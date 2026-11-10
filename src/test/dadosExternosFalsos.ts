/**
 * Dados externos no formato devolvido por `GET /api/ped/dados-externos-cadastro` (chaves com
 * espaço), para os testes da F5.
 *
 * A lista padrão cobre os casos da tela:
 * - Faturamento líquido — ativo, coleta no dia 15, sem indicador (pode ser desativado e excluído);
 * - Cobertura de clientes — inativo, usado em indicador (filtro "Com problemas"), já teve a situação alterada;
 * - Devoluções de venda — em construção (TI) com a tarefa #1044 (enviada ao Bitrix24), sem identificador;
 * - Prazo médio de recebimento — em construção (TI) sem tarefa (sem número), sem `coleta descricao`;
 * - Chamados atendidos no prazo — "Outro sistema" com comentário, ativo, sentido "último valor";
 * - Volume de vendas — ativo, compõe dois indicadores (exclusão bloqueada).
 *
 * `indicadores` é a lista de NOMES em texto, como a API devolve na listagem (ex.: `["teste externo"]`).
 * `RESPOSTA_REAL_LISTAGEM_API` é a resposta real colada pelo usuário em 05/11/2026 (bug da aba).
 * `DADO_TAREFA_SEM_NUMERO_API` é um dado em construção com a tarefa registrada e ainda sem número no
 * Bitrix24 (`"tarefa bitrix": { "id": null, ... }`), como a API devolve antes da integração.
 * `DADO_TAREFA_ENVIADA_API` é um dado em construção com a tarefa já enviada ao Bitrix24: o número vem
 * em **texto** (`"tarefa bitrix": { "id": "328440", "status": "enviada", ... }`), no mesmo formato da
 * resposta real da listagem de dashboards de 06/11/2026.
 *
 * `rotaListarDadosExternos` reproduz a filtragem da API (busca e situação) a partir da query string.
 *
 * Formatos assumidos (não documentados em `docs/backend/API (24).md`; ver dúvidas da F5):
 * - listagem: `{ "dados externos": [...] }` (o serviço também aceita a lista pura);
 * - identificadores: lista de `{ identificador, quantidade }`;
 * - POST: `{ "dado externo": {...}, "tarefa": {...} | null }`;
 * - concluir: `{ "dado externo": {...}, "indicador criado": { id, nome } | null }`.
 *
 * Integração (contrato de 09/11/2026, `docs/backend/FRONT-integracao-dado-externo.md`): as constantes
 * padrão vêm sem os campos da integração (como para Validador e Preenchedor); `dadosExternosAdminApi`
 * traz a lista como o Admin a recebe (URL, parâmetros, variáveis usadas, integração pendente).
 * Variáveis: `variaveisIntegracaoApi` no formato real de `GET /api/ped/integracao/variaveis`.
 */
import type { VariavelIntegracao } from '../types/dominio'
import { normalizarBusca } from '../utils/formato'
import type { RotaFalsa } from './apiFalsa'
import { respostaJson } from './apiFalsa'

export interface TarefaBitrixApiFalsa {
  /**
   * `null` enquanto a tarefa só está registrada localmente (`aguardando_envio`), antes do Bitrix24.
   * Depois de enviada, a API real devolve o número em texto (ex.: `"328440"`).
   */
  id: number | string | null
  status: string
  titulo: string
}

export interface DadoExternoApiFalso {
  id: number
  nome: string
  'id tipo': number
  tipo: string
  situacao: 'ativo' | 'inativo' | 'em_construcao'
  'situacao descricao': string
  'tarefa bitrix': TarefaBitrixApiFalsa | null
  'sistema de origem': 'senior_erp' | 'senior_hcm' | 'bitrix24' | 'outro'
  'sistema de origem descricao': string
  identificador: string | null
  'campo calculo': string | null
  referencia: 'filial' | 'colaborador' | 'zona'
  coleta: 'diaria' | 'dia do mes'
  'dia da coleta': number | null
  'coleta descricao': string | null
  'sentido do calculo': 'soma' | 'media' | 'ultimo'
  'janela retroativa': 1 | 2 | 3 | 6 | 12 | 24 | null
  comentarios: string | null
  'tipo de valor': 'Porcentagem' | 'Numeral' | 'Booleano'
  'coleta disponivel': boolean
  indicadores: string[]
  'cadastrado em': string | null
  'cadastrado por': string | null
  'situacao alterada em': string | null
  'situacao alterada por': string | null
  // Campos da integração (09/11/2026): só o Admin os recebe na listagem; ausentes para Validador e
  // Preenchedor. As constantes padrão abaixo não os trazem (ver `dadosExternosAdminApi`).
  url?: string | null
  'parametros de saida'?: unknown
  'parametros de entrada'?: unknown
  'variaveis usadas'?: string[] | null
  'integracao pendente'?: boolean
  'integracao alterada em'?: string | null
  'integracao alterada por'?: string | null
  /**
   * Alteração de 10/11/2026 (seção 2.5 de `RESPOSTA-FINAL-meta-via-api.md`): para todos os perfis,
   * `true` quando a coleta do dado fornece meta (faturamento e os 6 volumes). Opcional aqui para testar
   * a ausência (→ `forneceMeta: false`). Nas constantes: Faturamento líquido e Volume de vendas
   * `true`, Cobertura de clientes `false`, demais ausentes.
   */
  'fornece meta'?: boolean
}

export interface IdentificadorApiFalso {
  identificador: string
  quantidade: number
}

/** Tarefa devolvida pela API ao pedir a construção (POST de Validador/Preenchedor). */
export interface TarefaCriadaApiFalsa {
  /**
   * Número da tarefa no Bitrix24, no formato publicado em 06/11/2026 (`FRONT-tarefas-bitrix.md`):
   * texto numérico (`"328169"`) com `status` `enviada`; `null` com `status` `aguardando_envio`.
   */
  'id bitrix'?: number | string | null
  /** Formato anterior a 06/11/2026; o front continua aceitando `id` quando não há `"id bitrix"`. */
  id?: number | string | null
  status?: string | null
  titulo: string
  descricao?: string | null
}

/** Ativo, coleta no dia 15, sem indicador: pode ser desativado e excluído. */
export const DADO_FATURAMENTO_API: DadoExternoApiFalso = {
  id: 1,
  nome: 'Faturamento líquido',
  'id tipo': 1,
  tipo: 'Comercial',
  situacao: 'ativo',
  'situacao descricao': 'Ativo',
  'tarefa bitrix': null,
  'sistema de origem': 'senior_erp',
  'sistema de origem descricao': 'Senior ERP (Sapiens)',
  identificador: 'FATURAMENTO',
  'campo calculo': null,
  referencia: 'filial',
  coleta: 'dia do mes',
  'dia da coleta': 15,
  'coleta descricao': 'Todo dia 15 do mês',
  'sentido do calculo': 'soma',
  'janela retroativa': 3,
  comentarios: null,
  'tipo de valor': 'Numeral',
  'coleta disponivel': true,
  indicadores: [],
  'cadastrado em': '2026-10-05 09:00:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
  'fornece meta': true,
}

/** Inativo e usado em indicador (filtro "Com problemas"); já teve a situação alterada. */
export const DADO_COBERTURA_API: DadoExternoApiFalso = {
  id: 2,
  nome: 'Cobertura de clientes',
  'id tipo': 1,
  tipo: 'Comercial',
  situacao: 'inativo',
  'situacao descricao': 'Inativo',
  'tarefa bitrix': null,
  'sistema de origem': 'senior_erp',
  'sistema de origem descricao': 'Senior ERP (Sapiens)',
  identificador: 'COBERTURA',
  'campo calculo': null,
  referencia: 'filial',
  coleta: 'diaria',
  'dia da coleta': null,
  'coleta descricao': 'Diária',
  'sentido do calculo': 'media',
  'janela retroativa': 1,
  comentarios: null,
  'tipo de valor': 'Porcentagem',
  'coleta disponivel': true,
  indicadores: ['Cobertura da carteira'],
  'cadastrado em': '2026-09-12 14:30:00',
  'cadastrado por': 'João Lima',
  'situacao alterada em': '2026-10-20 11:05:00',
  'situacao alterada por': 'Ana Costa',
  'fornece meta': false,
}

/** Em construção (TI) com a tarefa #1044 já enviada ao Bitrix24 (`enviada`); identificador a definir pela TI. */
export const DADO_DEVOLUCOES_API: DadoExternoApiFalso = {
  id: 3,
  nome: 'Devoluções de venda',
  'id tipo': 1,
  tipo: 'Comercial',
  situacao: 'em_construcao',
  'situacao descricao': 'Em construção (TI)',
  'tarefa bitrix': { id: 1044, status: 'enviada', titulo: '[PED] Construir dado externo: Devoluções de venda' },
  'sistema de origem': 'senior_erp',
  'sistema de origem descricao': 'Senior ERP (Sapiens)',
  identificador: null,
  'campo calculo': 'Soma do valor líquido das notas de devolução de venda, por filial, no período.',
  referencia: 'filial',
  coleta: 'diaria',
  'dia da coleta': null,
  'coleta descricao': 'Diária',
  'sentido do calculo': 'soma',
  'janela retroativa': 1,
  comentarios: null,
  'tipo de valor': 'Numeral',
  'coleta disponivel': false,
  indicadores: [],
  'cadastrado em': '2026-10-03 11:05:00',
  'cadastrado por': 'Pedro Alves',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Em construção (TI) sem tarefa registrada (sem número); sem `coleta descricao` (usa o rótulo). */
export const DADO_PRAZO_API: DadoExternoApiFalso = {
  id: 4,
  nome: 'Prazo médio de recebimento',
  'id tipo': 2,
  tipo: 'Financeiro',
  situacao: 'em_construcao',
  'situacao descricao': 'Em construção (TI)',
  'tarefa bitrix': null,
  'sistema de origem': 'senior_erp',
  'sistema de origem descricao': 'Senior ERP (Sapiens)',
  identificador: null,
  'campo calculo': 'Média ponderada (valor × dias) entre a emissão e a baixa dos títulos liquidados.',
  referencia: 'filial',
  coleta: 'dia do mes',
  'dia da coleta': 3,
  'coleta descricao': null,
  'sentido do calculo': 'media',
  'janela retroativa': 6,
  comentarios: null,
  'tipo de valor': 'Numeral',
  'coleta disponivel': false,
  indicadores: [],
  'cadastrado em': '2026-09-28 15:40:00',
  'cadastrado por': 'Carla Nunes',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** "Outro sistema" com comentário; ativo, sem indicador, sentido "último valor" (sem janela). */
export const DADO_CHAMADOS_API: DadoExternoApiFalso = {
  id: 5,
  nome: 'Chamados atendidos no prazo',
  'id tipo': 4,
  tipo: 'Tecnologia da Informação',
  situacao: 'ativo',
  'situacao descricao': 'Ativo',
  'tarefa bitrix': null,
  'sistema de origem': 'outro',
  'sistema de origem descricao': 'Outro sistema',
  identificador: 'CHAMADOS_SLA',
  'campo calculo': null,
  referencia: 'filial',
  coleta: 'diaria',
  'dia da coleta': null,
  'coleta descricao': 'Diária',
  'sentido do calculo': 'ultimo',
  'janela retroativa': null,
  comentarios: 'Sistema GLPI, relatório de SLA mensal.',
  'tipo de valor': 'Porcentagem',
  'coleta disponivel': true,
  indicadores: [],
  'cadastrado em': '2026-10-25 16:45:00',
  'cadastrado por': 'Pedro Alves',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Ativo e compõe dois indicadores: exclusão bloqueada listando os dois (RF-31, RN-12). */
export const DADO_VOLUME_API: DadoExternoApiFalso = {
  id: 6,
  nome: 'Volume de vendas',
  'id tipo': 1,
  tipo: 'Comercial',
  situacao: 'ativo',
  'situacao descricao': 'Ativo',
  'tarefa bitrix': null,
  'sistema de origem': 'senior_erp',
  'sistema de origem descricao': 'Senior ERP (Sapiens)',
  identificador: 'VOLUME_VENDAS',
  'campo calculo': null,
  referencia: 'filial',
  coleta: 'diaria',
  'dia da coleta': null,
  'coleta descricao': 'Diária',
  'sentido do calculo': 'soma',
  'janela retroativa': 12,
  comentarios: null,
  'tipo de valor': 'Numeral',
  'coleta disponivel': true,
  indicadores: ['Volume mensal', 'Crescimento de vendas'],
  'cadastrado em': '2026-08-01 10:00:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
  'fornece meta': true,
}

/** Resposta real de GET /api/ped/dados-externos-cadastro (05/11/2026): `indicadores` em texto. */
export const RESPOSTA_REAL_LISTAGEM_API: DadoExternoApiFalso[] = [
  {
    id: 2,
    nome: 'teste',
    'id tipo': 7,
    tipo: 'Contabilidade',
    situacao: 'ativo',
    'situacao descricao': 'Ativo',
    'tarefa bitrix': null,
    'sistema de origem': 'senior_erp',
    'sistema de origem descricao': 'Senior ERP (Sapiens)',
    identificador: 'TESTE',
    'campo calculo': null,
    referencia: 'filial',
    coleta: 'diaria',
    'dia da coleta': null,
    'coleta descricao': 'Diaria',
    'sentido do calculo': 'soma',
    'janela retroativa': 2,
    comentarios: 'teste',
    'tipo de valor': 'Porcentagem',
    'coleta disponivel': false,
    indicadores: [],
    'cadastrado em': '2026-11-04 14:40:53-04:00',
    'cadastrado por': 'master',
    'situacao alterada em': null,
    'situacao alterada por': null,
  },
  {
    id: 3,
    nome: 'teste 2',
    'id tipo': 7,
    tipo: 'Contabilidade',
    situacao: 'ativo',
    'situacao descricao': 'Ativo',
    'tarefa bitrix': null,
    'sistema de origem': 'senior_hcm',
    'sistema de origem descricao': 'Senior HCM',
    identificador: 'TESTE2',
    'campo calculo': 'teste teste',
    referencia: 'filial',
    coleta: 'dia do mes',
    'dia da coleta': 12,
    'coleta descricao': 'Dia 12 do mes',
    'sentido do calculo': 'soma',
    'janela retroativa': 1,
    comentarios: 'teste',
    'tipo de valor': 'Porcentagem',
    'coleta disponivel': false,
    indicadores: ['teste externo'],
    'cadastrado em': '2026-11-04 16:18:35-04:00',
    'cadastrado por': 'master',
    'situacao alterada em': null,
    'situacao alterada por': null,
  },
]

/**
 * Em construção (TI) com a tarefa registrada localmente e ainda sem número no Bitrix24
 * (`"tarefa bitrix": { "id": null, "status": "aguardando_envio", ... }`). Fora da lista padrão.
 */
export const DADO_TAREFA_SEM_NUMERO_API: DadoExternoApiFalso = {
  id: 7,
  nome: 'Bonificações pagas',
  'id tipo': 2,
  tipo: 'Financeiro',
  situacao: 'em_construcao',
  'situacao descricao': 'Em construcao (TI)',
  'tarefa bitrix': { id: null, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Bonificações pagas' },
  'sistema de origem': 'senior_hcm',
  'sistema de origem descricao': 'Senior HCM',
  identificador: null,
  'campo calculo': 'Soma das bonificações pagas no mês, por colaborador.',
  referencia: 'colaborador',
  coleta: 'diaria',
  'dia da coleta': null,
  'coleta descricao': 'Diaria',
  'sentido do calculo': 'soma',
  'janela retroativa': 1,
  comentarios: null,
  'tipo de valor': 'Numeral',
  'coleta disponivel': false,
  indicadores: [],
  'cadastrado em': '2026-11-05 16:30:00-04:00',
  'cadastrado por': 'master',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/**
 * Em construção (TI) com a tarefa já enviada ao Bitrix24 e o número em texto
 * (`"tarefa bitrix": { "id": "328440", "status": "enviada", ... }`). Fora da lista padrão.
 */
export const DADO_TAREFA_ENVIADA_API: DadoExternoApiFalso = {
  ...DADO_TAREFA_SEM_NUMERO_API,
  id: 8,
  nome: 'Comissões pagas',
  'tarefa bitrix': { id: '328440', status: 'enviada', titulo: '[PED] Construir dado externo: Comissões pagas' },
  'campo calculo': 'Soma das comissões pagas no mês, por colaborador.',
}

export const NOMES_DADOS_EXTERNOS = [
  'Faturamento líquido',
  'Cobertura de clientes',
  'Devoluções de venda',
  'Prazo médio de recebimento',
  'Chamados atendidos no prazo',
  'Volume de vendas',
] as const

function copiar(dado: DadoExternoApiFalso): DadoExternoApiFalso {
  const copia: DadoExternoApiFalso = {
    ...dado,
    'tarefa bitrix': dado['tarefa bitrix'] ? { ...dado['tarefa bitrix'] } : null,
    indicadores: [...dado.indicadores],
  }
  if (Array.isArray(dado['variaveis usadas'])) copia['variaveis usadas'] = [...dado['variaveis usadas']]
  return copia
}

/** Lista padrão (6 dados externos), na ordem acima. Devolve sempre cópias novas. */
export function dadosExternosApi(): DadoExternoApiFalso[] {
  return [
    DADO_FATURAMENTO_API,
    DADO_COBERTURA_API,
    DADO_DEVOLUCOES_API,
    DADO_PRAZO_API,
    DADO_CHAMADOS_API,
    DADO_VOLUME_API,
  ].map(copiar)
}

/** Corpo de `GET /api/ped/dados-externos-cadastro` para a lista informada (sem filtro). */
export function respostaDadosExternosApi(lista: DadoExternoApiFalso[] = dadosExternosApi()) {
  return { 'dados externos': lista }
}

/**
 * Coletas existentes devolvidas por `GET .../identificadores` (códigos do catálogo de coleta, em
 * minúsculas como em `GET /api/ped/indicadores`), com quantos dados usam cada uma.
 */
export function identificadoresApi(): IdentificadorApiFalso[] {
  return [
    { identificador: 'faturamento', quantidade: 1 },
    { identificador: 'cobertura', quantidade: 1 },
    { identificador: 'volume_vendas', quantidade: 2 },
    { identificador: 'novos_clientes', quantidade: 0 },
  ]
}

/**
 * Tarefa da resposta do POST no formato publicado em 06/11/2026: `{ titulo, descricao, status, "id bitrix" }`.
 * Com `idBitrix`, `status` é `enviada`; sem ele (`null`), `aguardando_envio` (na fila do back-end).
 */
export function tarefaBitrixCriadaApi(
  titulo: string,
  idBitrix: number | string | null = null,
  descricao: string | null = 'Descrição gerada pela API.',
): TarefaCriadaApiFalsa {
  return { titulo, descricao, status: idBitrix === null ? 'aguardando_envio' : 'enviada', 'id bitrix': idBitrix }
}

/** Resposta de POST: o dado gravado e a tarefa gerada (ou `null`). */
export function respostaCriacaoApi(dado: DadoExternoApiFalso, tarefa: TarefaCriadaApiFalsa | null = null) {
  return { 'dado externo': dado, tarefa }
}

/** Resposta de `PUT .../{id}/concluir`: o dado ativado e o indicador criado automaticamente (ou `null`). */
export function respostaConclusaoApi(
  dado: DadoExternoApiFalso,
  indicadorCriado: { id: number; nome: string } | null = null,
) {
  return { 'dado externo': dado, 'indicador criado': indicadorCriado }
}

function casaBusca(dado: DadoExternoApiFalso, termo: string): boolean {
  const termoNormalizado = normalizarBusca(termo)
  if (termoNormalizado === '') return true
  const referencias: Record<DadoExternoApiFalso['referencia'], string> = {
    filial: 'Filial',
    colaborador: 'Colaborador',
    zona: 'Zona de venda',
  }
  return [
    dado.nome,
    dado['sistema de origem'],
    dado['sistema de origem descricao'],
    dado.identificador ?? '',
    dado.url ?? '',
    dado['campo calculo'] ?? '',
    dado.tipo,
    dado.referencia,
    referencias[dado.referencia],
  ].some((campo) => normalizarBusca(campo).includes(termoNormalizado))
}

function casaSituacao(dado: DadoExternoApiFalso, situacao: string | null): boolean {
  switch (situacao) {
    case 'ativos':
      return dado.situacao === 'ativo'
    case 'inativos':
      return dado.situacao === 'inativo'
    case 'construcao':
      return dado.situacao === 'em_construcao'
    case 'problemas':
      return dado.situacao === 'inativo' && dado.indicadores.length > 0
    case 'integracao_pendente':
      return dado['integracao pendente'] === true
    default:
      return true
  }
}

/**
 * Aplica à lista os filtros da query string como a API faz: `busca` (nome, origem, identificador,
 * campo/cálculo, tipo ou referência, sem acento/maiúsculas) e `situacao`.
 */
export function filtrarDadosExternosApi(lista: DadoExternoApiFalso[], url: URL) {
  const busca = url.searchParams.get('busca') ?? ''
  const situacao = url.searchParams.get('situacao')
  return respostaDadosExternosApi(lista.filter((dado) => casaBusca(dado, busca) && casaSituacao(dado, situacao)))
}

/**
 * Rota falsa de `GET /api/ped/dados-externos-cadastro` com filtragem pela query. `obterLista` é
 * chamada a cada requisição, para refletir alterações (cadastro, conclusão, situação, exclusão).
 */
export function rotaListarDadosExternos(obterLista: () => DadoExternoApiFalso[]): RotaFalsa {
  return (_init, url) => respostaJson(filtrarDadosExternosApi(obterLista(), url))
}


// ---------------------------------------------------------------------------
// Integração do dado externo (F5.7, F5.16, F5.17 — contrato de 09/11/2026)
// ---------------------------------------------------------------------------

/**
 * URL e parâmetros gravados da integração de "Faturamento líquido" (lista do Admin). Desde 10/11/2026 a
 * saída é uma lista com um item por filial (`filial` e `valor`; `competencia` opcional).
 */
export const URL_FATURAMENTO = 'https://ti.exemplo.com.br/api/faturamento'
export const SAIDA_FATURAMENTO_API = [{ filial: '101', valor: '0' }]
export const ENTRADA_FATURAMENTO_API = { filial: '%filial%', inicio: '%dataInicial% - 3m', fim: '%dataFinal%' }

/** URL e parâmetros gravados da integração de "Volume de vendas" (lista do Admin). */
export const URL_VOLUME = 'https://ti.exemplo.com.br/api/volume'
export const SAIDA_VOLUME_API = [{ filial: '101', valor: '0', competencia: '10/2026' }]
export const ENTRADA_VOLUME_API = { filial: '%filial%', competencia: '%competencia%' }

/** Campos da integração como o Admin recebe na listagem. */
export interface IntegracaoApiFalsa {
  url: string | null
  'parametros de saida': unknown
  'parametros de entrada': unknown
  'variaveis usadas': string[]
  'integracao pendente': boolean
  'integracao alterada em': string | null
  'integracao alterada por': string | null
}

/** Integração ainda não gravada; `pendente` = dado ativo/inativo sem integração. */
export function semIntegracaoApi(pendente: boolean): IntegracaoApiFalsa {
  return {
    url: null,
    'parametros de saida': null,
    'parametros de entrada': null,
    'variaveis usadas': [],
    'integracao pendente': pendente,
    'integracao alterada em': null,
    'integracao alterada por': null,
  }
}

/** O dado com os campos da integração do Admin (padrão: sem integração e não pendente). */
export function comIntegracaoApi(
  dado: DadoExternoApiFalso,
  integracao: Partial<IntegracaoApiFalsa> = {},
): DadoExternoApiFalso {
  return { ...copiar(dado), ...semIntegracaoApi(false), ...integracao }
}

/**
 * Lista padrão como o **Admin** a recebe (mesma ordem de `dadosExternosApi`), com os campos da
 * integração:
 * - Faturamento líquido — ativo, integração gravada (URL_FATURAMENTO, saída e entrada);
 * - Cobertura de clientes — inativo, **integração pendente** (sem URL);
 * - Devoluções de venda e Prazo médio — em construção (sem integração, não pendentes);
 * - Chamados atendidos no prazo — ativo, **integração pendente** (sem URL);
 * - Volume de vendas — ativo, integração gravada (URL_VOLUME, saída em lista).
 */
export function dadosExternosAdminApi(): DadoExternoApiFalso[] {
  return [
    comIntegracaoApi(DADO_FATURAMENTO_API, {
      url: URL_FATURAMENTO,
      'parametros de saida': SAIDA_FATURAMENTO_API.map((item) => ({ ...item })),
      'parametros de entrada': { ...ENTRADA_FATURAMENTO_API },
      'variaveis usadas': ['dataFinal', 'dataInicial', 'filial'],
      'integracao alterada em': '2026-11-09 10:00:00',
      'integracao alterada por': 'Equipe TI',
    }),
    comIntegracaoApi(DADO_COBERTURA_API, semIntegracaoApi(true)),
    comIntegracaoApi(DADO_DEVOLUCOES_API),
    comIntegracaoApi(DADO_PRAZO_API),
    comIntegracaoApi(DADO_CHAMADOS_API, semIntegracaoApi(true)),
    comIntegracaoApi(DADO_VOLUME_API, {
      url: URL_VOLUME,
      'parametros de saida': SAIDA_VOLUME_API.map((item) => ({ ...item })),
      'parametros de entrada': { ...ENTRADA_VOLUME_API },
      'variaveis usadas': ['competencia', 'filial'],
      'integracao alterada em': '2026-11-08 17:30:00',
      'integracao alterada por': 'Equipe TI',
    }),
  ]
}

/** Item de `GET .../integracoes-pendentes`. */
export interface DadoPendenteApiFalso {
  id: number
  nome: string
  identificador: string | null
  situacao: DadoExternoApiFalso['situacao']
}

/** Corpo de `GET /api/ped/dados-externos-cadastro/integracoes-pendentes` calculado a partir da lista. */
export function integracoesPendentesApi(lista: DadoExternoApiFalso[]) {
  const dados: DadoPendenteApiFalso[] = lista
    .filter((dado) => dado['integracao pendente'] === true)
    .map((dado) => ({ id: dado.id, nome: dado.nome, identificador: dado.identificador, situacao: dado.situacao }))
  return { quantidade: dados.length, dados }
}

/** Rota falsa de `GET .../integracoes-pendentes`; `obterLista` é lida a cada requisição. */
export function rotaIntegracoesPendentes(obterLista: () => DadoExternoApiFalso[]): RotaFalsa {
  return () => respostaJson(integracoesPendentesApi(obterLista()))
}

/** Corpo enviado em `PUT .../concluir` e `PUT .../integracao` (os quatro campos são obrigatórios). */
export interface CorpoIntegracaoApiFalso {
  identificador: string
  url: string
  'parametros de saida': string
  'parametros de entrada': string
}

// ---------------------------------------------------------------------------
// Variáveis da integração (F5.14, F5.15)
// ---------------------------------------------------------------------------

/**
 * Variável no formato de `GET /api/ped/integracao/variaveis` (contrato de 09/11/2026):
 * `{ variavel: "%filial%", nome: "filial", tipo, descricao, exemplo: "100" }`. As descrições do
 * back-end vêm sem acento. Campos opcionais aqui para os testes de formato.
 */
export interface VariavelIntegracaoApiFalsa {
  variavel?: string
  nome?: string
  tipo: string
  descricao?: string | null
  exemplo?: string | null
}

/**
 * As 13 variáveis devolvidas pela API (formato real), na ordem do documento. Os exemplos seguem a
 * prévia do back-end: filial 100, empresa 1, empresas "1,6,7,8,9", período 10/2026, 3 meses
 * retroativos; `%hoje%` fixo em 09/11/2026. `%empresa%` e `%empresas%` entraram em 10/11/2026
 * (seção 3 de `RESPOSTA-FINAL-meta-via-api.md`).
 */
export function variaveisIntegracaoApi(): VariavelIntegracaoApiFalsa[] {
  return [
    { variavel: '%filial%', nome: 'filial', tipo: 'numero', descricao: 'Codigo da filial', exemplo: '100' },
    { variavel: '%empresa%', nome: 'empresa', tipo: 'numero', descricao: 'Codigo da empresa da filial consultada', exemplo: '1' },
    {
      variavel: '%empresas%',
      nome: 'empresas',
      tipo: 'texto',
      descricao: 'Empresas participantes, em ordem e separadas por virgula',
      exemplo: '1,6,7,8,9',
    },
    { variavel: '%colaborador%', nome: 'colaborador', tipo: 'texto', descricao: 'Matricula do colaborador', exemplo: '000123' },
    { variavel: '%zona%', nome: 'zona', tipo: 'texto', descricao: 'Codigo da zona de venda', exemplo: 'Z01' },
    { variavel: '%mes%', nome: 'mes', tipo: 'numero', descricao: 'Mes do periodo (1 a 12)', exemplo: '10' },
    { variavel: '%ano%', nome: 'ano', tipo: 'numero', descricao: 'Ano do periodo', exemplo: '2026' },
    { variavel: '%competencia%', nome: 'competencia', tipo: 'texto', descricao: 'Competencia MM/AAAA', exemplo: '10/2026' },
    { variavel: '%dataInicial%', nome: 'dataInicial', tipo: 'data', descricao: 'Primeiro dia do periodo', exemplo: '01/10/2026' },
    { variavel: '%dataFinal%', nome: 'dataFinal', tipo: 'data', descricao: 'Ultimo dia do periodo', exemplo: '31/10/2026' },
    { variavel: '%hoje%', nome: 'hoje', tipo: 'data', descricao: 'Data da execucao da consulta', exemplo: '09/11/2026' },
    { variavel: '%diaColeta%', nome: 'diaColeta', tipo: 'numero', descricao: 'Dia de coleta configurado no dado', exemplo: '1' },
    { variavel: '%mesesRetro%', nome: 'mesesRetro', tipo: 'numero', descricao: 'Meses de periodicidade retroativa do dado', exemplo: '3' },
  ]
}

/** As mesmas 13 variáveis já convertidas para o domínio (`VariavelIntegracao`, com o `exemplo`). */
export function variaveisIntegracao(): VariavelIntegracao[] {
  return variaveisIntegracaoApi().map((v) => ({
    nome: v.nome ?? '',
    descricao: v.descricao ?? '',
    tipo: v.tipo as VariavelIntegracao['tipo'],
    exemplo: v.exemplo ?? null,
  }))
}

/**
 * As 13 variáveis no domínio **sem exemplo** (`exemplo: null`): a prévia local usa os valores
 * calculados a partir do dado e de `hoje` (`valoresDeExemplo`).
 */
export function variaveisIntegracaoSemExemplo(): VariavelIntegracao[] {
  return variaveisIntegracao().map((v) => ({ ...v, exemplo: null }))
}
