/**
 * Apontamentos no formato devolvido por `GET /api/ped/apontamentos` (chaves com espaço), para os
 * testes da F4.
 *
 * A lista padrão cobre os casos da tela: um vinculado a dashboard (Roteiro), um desativado mas
 * usado em indicador ativo (Conciliação), um com dois indicadores (Treinamentos), um sem indicador
 * e ativo (Chamados, pode ser excluído) e um inativo sem indicador (Relatório, pode ser ativado).
 *
 * `rotaListarApontamentos` reproduz a filtragem da API (busca, situação e tipo) a partir da query
 * string, para os testes de filtros verificarem a tela sem reimplementar o filtro no front.
 */
import { normalizarBusca } from '../utils/formato'
import type { RotaFalsa } from './apiFalsa'
import { respostaJson } from './apiFalsa'

export interface ApontamentoApiFalso {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
  'id tipo': number
  tipo: string
  'tipo de valor': 'Porcentagem' | 'Numeral' | 'Booleano'
  indicadores: Array<{ id: number; nome: string }>
  'vinculado a dashboard': boolean
  'desativado mas usado em indicador ativo': boolean
  'cadastrado em': string | null
  'cadastrado por': string | null
  'situacao alterada em': string | null
  'situacao alterada por': string | null
}

export interface ContagemPorTipoApiFalsa {
  id: number
  nome: string
  quantidade: number
}

export interface RespostaApontamentosApiFalsa {
  apontamentos: ApontamentoApiFalso[]
  'contagem por tipo': ContagemPorTipoApiFalsa[]
}

/** Tipos do usuário (Admin/Validador) usados nos testes da F4, no formato de `GET /api/ped/acesso`. */
export const TIPOS_DO_USUARIO_API = [
  { id: 1, nome: 'Comercial' },
  { id: 2, nome: 'Financeiro' },
  { id: 3, nome: 'Recursos Humanos' },
  { id: 4, nome: 'Tecnologia da Informação' },
]

/** Ativo, com indicador e vinculado a dashboard: não pode ser excluído (RN-11). */
export const APONTAMENTO_ROTEIRO_API: ApontamentoApiFalso = {
  id: 1,
  nome: 'Roteiro de visitas elaborado',
  descricao: 'Percentual de vendedores com roteiro semanal entregue.',
  ativo: true,
  'id tipo': 1,
  tipo: 'Comercial',
  'tipo de valor': 'Porcentagem',
  indicadores: [{ id: 1, nome: 'Cobertura de visitas' }],
  'vinculado a dashboard': true,
  'desativado mas usado em indicador ativo': false,
  'cadastrado em': '2026-10-02 09:15:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Inativo, mas usado em indicador ativo (filtro "Com problemas"); já teve a situação alterada. */
export const APONTAMENTO_CONCILIACAO_API: ApontamentoApiFalso = {
  id: 2,
  nome: 'Conciliação bancária concluída',
  descricao: 'Conciliação de todas as contas fechada até o dia 5.',
  ativo: false,
  'id tipo': 2,
  tipo: 'Financeiro',
  'tipo de valor': 'Booleano',
  indicadores: [{ id: 2, nome: 'Rotinas financeiras em dia' }],
  'vinculado a dashboard': false,
  'desativado mas usado em indicador ativo': true,
  'cadastrado em': '2026-09-15 14:30:00',
  'cadastrado por': 'João Lima',
  'situacao alterada em': '2026-10-20 11:05:00',
  'situacao alterada por': 'Ana Costa',
}

/** Ativo, sem descrição, com dois indicadores: exclusão bloqueada listando os dois (RN-12). */
export const APONTAMENTO_TREINAMENTOS_API: ApontamentoApiFalso = {
  id: 3,
  nome: 'Horas de treinamento realizadas',
  descricao: null,
  ativo: true,
  'id tipo': 3,
  tipo: 'Recursos Humanos',
  'tipo de valor': 'Numeral',
  indicadores: [
    { id: 3, nome: 'Capacitação' },
    { id: 4, nome: 'Desenvolvimento de equipe' },
  ],
  'vinculado a dashboard': false,
  'desativado mas usado em indicador ativo': false,
  'cadastrado em': '2026-10-10 08:00:00',
  'cadastrado por': 'Carla Nunes',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Ativo e sem indicador: pode ser excluído e desativado. */
export const APONTAMENTO_CHAMADOS_API: ApontamentoApiFalso = {
  id: 4,
  nome: 'Chamados resolvidos no prazo',
  descricao: 'Percentual de chamados encerrados dentro do SLA.',
  ativo: true,
  'id tipo': 4,
  tipo: 'Tecnologia da Informação',
  'tipo de valor': 'Porcentagem',
  indicadores: [],
  'vinculado a dashboard': false,
  'desativado mas usado em indicador ativo': false,
  'cadastrado em': '2026-10-25 16:45:00',
  'cadastrado por': 'Pedro Alves',
  'situacao alterada em': null,
  'situacao alterada por': null,
}

/** Inativo e sem indicador: pode ser ativado de novo e excluído. */
export const APONTAMENTO_RELATORIO_API: ApontamentoApiFalso = {
  id: 5,
  nome: 'Relatório mensal entregue',
  descricao: 'Relatório de vendas enviado à diretoria.',
  ativo: false,
  'id tipo': 1,
  tipo: 'Comercial',
  'tipo de valor': 'Booleano',
  indicadores: [],
  'vinculado a dashboard': false,
  'desativado mas usado em indicador ativo': false,
  'cadastrado em': '2026-08-01 10:00:00',
  'cadastrado por': 'Maria Souza',
  'situacao alterada em': '2026-10-28 10:00:00',
  'situacao alterada por': 'Maria Souza',
}

export const NOMES_APONTAMENTOS = [
  'Roteiro de visitas elaborado',
  'Conciliação bancária concluída',
  'Horas de treinamento realizadas',
  'Chamados resolvidos no prazo',
  'Relatório mensal entregue',
] as const

/** Lista padrão (5 apontamentos), na ordem acima. Devolve sempre cópias novas. */
export function apontamentosApi(): ApontamentoApiFalso[] {
  return [
    APONTAMENTO_ROTEIRO_API,
    APONTAMENTO_CONCILIACAO_API,
    APONTAMENTO_TREINAMENTOS_API,
    APONTAMENTO_CHAMADOS_API,
    APONTAMENTO_RELATORIO_API,
  ].map((apontamento) => ({ ...apontamento, indicadores: apontamento.indicadores.map((i) => ({ ...i })) }))
}

/** Contagem por tipo como a API devolve: um item por tipo com ocorrência, na ordem dos ids. */
export function contagemPorTipoApi(lista: ApontamentoApiFalso[]): ContagemPorTipoApiFalsa[] {
  const contagem = new Map<number, ContagemPorTipoApiFalsa>()
  for (const apontamento of lista) {
    const atual = contagem.get(apontamento['id tipo'])
    if (atual) atual.quantidade += 1
    else contagem.set(apontamento['id tipo'], { id: apontamento['id tipo'], nome: apontamento.tipo, quantidade: 1 })
  }
  return [...contagem.values()].sort((a, b) => a.id - b.id)
}

/** Corpo completo de `GET /api/ped/apontamentos` para a lista informada (sem filtro). */
export function respostaApontamentosApi(lista: ApontamentoApiFalso[] = apontamentosApi()): RespostaApontamentosApiFalsa {
  return { apontamentos: lista, 'contagem por tipo': contagemPorTipoApi(lista) }
}

function casaBusca(apontamento: ApontamentoApiFalso, termo: string): boolean {
  const termoNormalizado = normalizarBusca(termo)
  if (termoNormalizado === '') return true
  return [apontamento.nome, apontamento.tipo, apontamento.descricao ?? '', apontamento['tipo de valor']].some((campo) =>
    normalizarBusca(campo).includes(termoNormalizado),
  )
}

function casaSituacao(apontamento: ApontamentoApiFalso, situacao: string | null): boolean {
  switch (situacao) {
    case 'ativos':
      return apontamento.ativo
    case 'inativos':
      return !apontamento.ativo
    case 'problemas':
      return apontamento['desativado mas usado em indicador ativo']
    default:
      return true
  }
}

/**
 * Aplica à lista os filtros da query string como a API faz: `busca` (nome, tipo, descrição ou tipo
 * de valor, sem acento/maiúsculas), `situacao` e `tipo`. A contagem por tipo considera busca e
 * situação, mas não o filtro de tipo.
 */
export function filtrarApontamentosApi(lista: ApontamentoApiFalso[], url: URL): RespostaApontamentosApiFalsa {
  const busca = url.searchParams.get('busca') ?? ''
  const situacao = url.searchParams.get('situacao')
  const tipo = url.searchParams.get('tipo')

  const porBuscaESituacao = lista.filter((a) => casaBusca(a, busca) && casaSituacao(a, situacao))
  const apontamentos = tipo === null ? porBuscaESituacao : porBuscaESituacao.filter((a) => String(a['id tipo']) === tipo)
  return { apontamentos, 'contagem por tipo': contagemPorTipoApi(porBuscaESituacao) }
}

/**
 * Rota falsa de `GET /api/ped/apontamentos` com filtragem pela query. `obterLista` é chamada a cada
 * requisição, para a API falsa refletir alterações (cadastro, situação, exclusão) feitas pelos testes.
 */
export function rotaListarApontamentos(obterLista: () => ApontamentoApiFalso[]): RotaFalsa {
  return (_init, url) => respostaJson(filtrarApontamentosApi(obterLista(), url))
}
