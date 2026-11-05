/**
 * Dados externos no formato devolvido por `GET /api/ped/dados-externos-cadastro` (chaves com
 * espaço), para os testes da F5.
 *
 * A lista padrão cobre os casos da tela:
 * - Faturamento líquido — ativo, coleta no dia 15, sem indicador (pode ser desativado e excluído);
 * - Cobertura de clientes — inativo, usado em indicador (filtro "Com problemas"), já teve a situação alterada;
 * - Devoluções de venda — em construção (TI) com tarefa nº 1044, sem identificador;
 * - Prazo médio de recebimento — em construção (TI) sem tarefa (sem número), sem `coleta descricao`;
 * - Chamados atendidos no prazo — "Outro sistema" com comentário, ativo, sentido "último valor";
 * - Volume de vendas — ativo, compõe dois indicadores (exclusão bloqueada).
 *
 * `indicadores` é a lista de NOMES em texto, como a API devolve na listagem (ex.: `["teste externo"]`).
 * `RESPOSTA_REAL_LISTAGEM_API` é a resposta real colada pelo usuário em 05/11/2026 (bug da aba).
 * `DADO_TAREFA_SEM_NUMERO_API` é um dado em construção com a tarefa registrada e ainda sem número no
 * Bitrix24 (`"tarefa bitrix": { "id": null, ... }`), como a API devolve antes da integração.
 *
 * `rotaListarDadosExternos` reproduz a filtragem da API (busca e situação) a partir da query string.
 *
 * Formatos assumidos (não documentados em `docs/backend/API (24).md`; ver dúvidas da F5):
 * - listagem: `{ "dados externos": [...] }` (o serviço também aceita a lista pura);
 * - identificadores: lista de `{ identificador, quantidade }`;
 * - POST: `{ "dado externo": {...}, "tarefa": {...} | null }`;
 * - concluir: `{ "dado externo": {...}, "indicador criado": { id, nome } | null }`.
 */
import { normalizarBusca } from '../utils/formato'
import type { RotaFalsa } from './apiFalsa'
import { respostaJson } from './apiFalsa'

export interface TarefaBitrixApiFalsa {
  /** `null` enquanto a tarefa só está registrada localmente (`aguardando_envio`), antes do Bitrix24. */
  id: number | null
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
}

export interface IdentificadorApiFalso {
  identificador: string
  quantidade: number
}

/** Tarefa devolvida pela API ao pedir a construção (POST de Validador/Preenchedor). */
export interface TarefaCriadaApiFalsa {
  id?: number | null
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
}

/** Em construção (TI) com a tarefa nº 1044; identificador a definir pela TI. */
export const DADO_DEVOLUCOES_API: DadoExternoApiFalso = {
  id: 3,
  nome: 'Devoluções de venda',
  'id tipo': 1,
  tipo: 'Comercial',
  situacao: 'em_construcao',
  'situacao descricao': 'Em construção (TI)',
  'tarefa bitrix': { id: 1044, status: 'aguardando_envio', titulo: '[PED] Construir dado externo: Devoluções de venda' },
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

export const NOMES_DADOS_EXTERNOS = [
  'Faturamento líquido',
  'Cobertura de clientes',
  'Devoluções de venda',
  'Prazo médio de recebimento',
  'Chamados atendidos no prazo',
  'Volume de vendas',
] as const

function copiar(dado: DadoExternoApiFalso): DadoExternoApiFalso {
  return {
    ...dado,
    'tarefa bitrix': dado['tarefa bitrix'] ? { ...dado['tarefa bitrix'] } : null,
    indicadores: [...dado.indicadores],
  }
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
