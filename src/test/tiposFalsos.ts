/**
 * Tipos de apontamento no formato devolvido por `GET /api/ped/tipos-apontamento`
 * (chaves com espaço), para os testes da F3.
 *
 * Os 7 fixos seguem a ordem e os nomes da API (`docs/backend/API (24).md`); os personalizados
 * cobrem os dois casos da exclusão: sem apontamentos (pode excluir) e com apontamentos (bloqueado).
 */

export interface TipoApontamentoApiFalso {
  id: number
  nome: string
  origem: 'Fixo' | 'Personalizado'
  'quantidade usuarios': number
  'quantidade apontamentos': number
  /** Devolvido só para o Admin; o front ignora nesta fase. */
  usuarios?: Array<{ id: number; nome: string }>
}

export const NOMES_TIPOS_FIXOS = [
  'Comercial',
  'Financeiro',
  'Recursos Humanos',
  'Tecnologia da Informação',
  'Fiscal',
  'Processos',
  'Contabilidade',
] as const

export const TIPOS_FIXOS_API: TipoApontamentoApiFalso[] = [
  { id: 1, nome: 'Comercial', origem: 'Fixo', 'quantidade usuarios': 3, 'quantidade apontamentos': 7 },
  { id: 2, nome: 'Financeiro', origem: 'Fixo', 'quantidade usuarios': 2, 'quantidade apontamentos': 4 },
  { id: 3, nome: 'Recursos Humanos', origem: 'Fixo', 'quantidade usuarios': 1, 'quantidade apontamentos': 0 },
  { id: 4, nome: 'Tecnologia da Informação', origem: 'Fixo', 'quantidade usuarios': 2, 'quantidade apontamentos': 2 },
  { id: 5, nome: 'Fiscal', origem: 'Fixo', 'quantidade usuarios': 1, 'quantidade apontamentos': 1 },
  { id: 6, nome: 'Processos', origem: 'Fixo', 'quantidade usuarios': 0, 'quantidade apontamentos': 0 },
  { id: 7, nome: 'Contabilidade', origem: 'Fixo', 'quantidade usuarios': 1, 'quantidade apontamentos': 5 },
]

/** Personalizado sem apontamentos: pode ser excluído. */
export const TIPO_LOGISTICA_API: TipoApontamentoApiFalso = {
  id: 8,
  nome: 'Logística',
  origem: 'Personalizado',
  'quantidade usuarios': 2,
  'quantidade apontamentos': 0,
}

/** Personalizado com apontamentos: exclusão bloqueada (RN-13). */
export const TIPO_MARKETING_API: TipoApontamentoApiFalso = {
  id: 9,
  nome: 'Marketing',
  origem: 'Personalizado',
  'quantidade usuarios': 1,
  'quantidade apontamentos': 3,
}

/** Lista padrão: 7 fixos + 2 personalizados (9 tipos). Devolve sempre cópias novas. */
export function tiposApi(): TipoApontamentoApiFalso[] {
  return [...TIPOS_FIXOS_API, TIPO_LOGISTICA_API, TIPO_MARKETING_API].map((tipo) => ({ ...tipo }))
}
