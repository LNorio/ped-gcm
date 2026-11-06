/**
 * Tipos de apontamento no formato devolvido por `GET /api/ped/tipos-apontamento`
 * (chaves com espaço), para os testes da F3.
 *
 * Os 7 fixos seguem a ordem e os nomes da API (`docs/backend/API (24).md`); os personalizados
 * cobrem os dois casos da exclusão: sem apontamentos (pode excluir) e com apontamentos (bloqueado).
 *
 * A-02 (06/11/2026, `docs/backend/FRONT-PED-mudancas (1).md`, item 4): para Admin e Validador cada
 * tipo traz `grupos` e `usuarios` (`[{ id, nome }]`); para o Preenchedor os dois vêm `null`.
 * Também ficam aqui os grupos do ERP (`GET /api/ped/grupos`) e os colaboradores da lista de vínculo
 * (`GET /api/ped/vinculos?tipo=colaboradores`), usados como fonte dos usuários vinculados.
 */
import type { ColaboradorVinculo } from '../services/dashboardsService'
import type { GrupoErp } from '../services/tiposService'
import type { OrigemTipo, ReferenciaNomeada, TipoApontamento } from '../types/dominio'

export interface ReferenciaApiFalsa {
  id: number
  nome: string
}

export interface TipoApontamentoApiFalso {
  id: number
  nome: string
  origem: 'Fixo' | 'Personalizado'
  'quantidade usuarios': number
  'quantidade apontamentos': number
  /** Grupos do ERP vinculados (Admin e Validador); `null` para o Preenchedor. */
  grupos?: ReferenciaApiFalsa[] | null
  /** Usuários vinculados diretamente (Admin e Validador); `null` para o Preenchedor. */
  usuarios?: ReferenciaApiFalsa[] | null
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

// ---------------------------------------------------------------------------
// Grupos do ERP (GET /api/ped/grupos)
// ---------------------------------------------------------------------------

export interface GrupoApiFalso {
  id: number
  nome: string
  'quantidade usuarios': number
  tipos: ReferenciaApiFalsa[]
}

export const GRUPO_CAIXA_API: GrupoApiFalso = {
  id: 4,
  nome: 'DEF_OPERADOR DE CAIXA',
  'quantidade usuarios': 37,
  tipos: [{ id: 1, nome: 'Comercial' }, { id: 9, nome: 'Marketing' }],
}

export const GRUPO_GERENTE_API: GrupoApiFalso = {
  id: 7,
  nome: 'DEF_GERENTE DE LOJA',
  'quantidade usuarios': 12,
  tipos: [{ id: 1, nome: 'Comercial' }, { id: 2, nome: 'Financeiro' }],
}

export const GRUPO_FINANCEIRO_API: GrupoApiFalso = {
  id: 9,
  nome: 'DEF_ANALISTA FINANCEIRO',
  'quantidade usuarios': 1,
  tipos: [{ id: 5, nome: 'Fiscal' }, { id: 7, nome: 'Contabilidade' }],
}

export const GRUPO_LOGISTICA_API: GrupoApiFalso = {
  id: 11,
  nome: 'DEF_SUPERVISÃO LOGÍSTICA',
  'quantidade usuarios': 5,
  tipos: [{ id: 8, nome: 'Logística' }],
}

/** Lista padrão de grupos (4), na ordem da API. Devolve sempre cópias novas. */
export function gruposApi(): GrupoApiFalso[] {
  return [GRUPO_CAIXA_API, GRUPO_GERENTE_API, GRUPO_FINANCEIRO_API, GRUPO_LOGISTICA_API].map((grupo) => ({
    ...grupo,
    tipos: grupo.tipos.map((tipo) => ({ ...tipo })),
  }))
}

/** Grupo convertido para o domínio, como `listarGrupos` deve devolver. */
export function grupoDominio(grupo: GrupoApiFalso): GrupoErp {
  return {
    id: grupo.id,
    nome: grupo.nome,
    quantidadeUsuarios: grupo['quantidade usuarios'],
    tipos: grupo.tipos.map((tipo) => ({ ...tipo })),
  }
}

/** Lista padrão de grupos já convertida. */
export function gruposDominio(): GrupoErp[] {
  return gruposApi().map(grupoDominio)
}

const ref = (grupo: GrupoApiFalso): ReferenciaApiFalsa => ({ id: grupo.id, nome: grupo.nome })

// ---------------------------------------------------------------------------
// Colaboradores (GET /api/ped/vinculos?tipo=colaboradores) — fonte dos usuários vinculados
// ---------------------------------------------------------------------------

export interface ColaboradorApiFalso {
  'id colaborador': number
  nome: string
  cargo: string | null
  filial: string | null
}

export const COLABORADOR_FULANO_API: ColaboradorApiFalso = {
  'id colaborador': 12,
  nome: 'Fulano',
  cargo: 'Gerente de Loja',
  filial: '101',
}
export const COLABORADOR_BELTRANO_API: ColaboradorApiFalso = {
  'id colaborador': 20,
  nome: 'Beltrano',
  cargo: 'Analista de TI',
  filial: '100',
}
export const COLABORADOR_CICLANO_API: ColaboradorApiFalso = {
  'id colaborador': 21,
  nome: 'Ciclano',
  cargo: 'Vendedor',
  filial: '102',
}
export const COLABORADOR_MARIA_API: ColaboradorApiFalso = {
  'id colaborador': 30,
  nome: 'Maria Souza',
  cargo: 'Analista Financeiro',
  filial: '100',
}

/** Lista padrão de colaboradores (4). Devolve sempre cópias novas. */
export function colaboradoresApi(): ColaboradorApiFalso[] {
  return [COLABORADOR_FULANO_API, COLABORADOR_BELTRANO_API, COLABORADOR_CICLANO_API, COLABORADOR_MARIA_API].map(
    (colaborador) => ({ ...colaborador }),
  )
}

/** Colaborador convertido como `listarColaboradoresVinculo` (dashboardsService) devolve. */
export function colaboradorDominio(colaborador: ColaboradorApiFalso): ColaboradorVinculo {
  return {
    id: colaborador['id colaborador'],
    nome: colaborador.nome,
    cargo: colaborador.cargo,
    filial: colaborador.filial,
  }
}

/** Lista padrão de colaboradores já convertida. */
export function colaboradoresDominio(): ColaboradorVinculo[] {
  return colaboradoresApi().map(colaboradorDominio)
}

// ---------------------------------------------------------------------------
// Tipos de apontamento (GET /api/ped/tipos-apontamento) — visão de Admin e Validador
// ---------------------------------------------------------------------------

const FULANO: ReferenciaApiFalsa = { id: 12, nome: 'Fulano' }
const BELTRANO: ReferenciaApiFalsa = { id: 20, nome: 'Beltrano' }
const CICLANO: ReferenciaApiFalsa = { id: 21, nome: 'Ciclano' }

export const TIPOS_FIXOS_API: TipoApontamentoApiFalso[] = [
  {
    id: 1,
    nome: 'Comercial',
    origem: 'Fixo',
    'quantidade usuarios': 3,
    'quantidade apontamentos': 7,
    grupos: [ref(GRUPO_CAIXA_API), ref(GRUPO_GERENTE_API)],
    usuarios: [FULANO],
  },
  {
    id: 2,
    nome: 'Financeiro',
    origem: 'Fixo',
    'quantidade usuarios': 2,
    'quantidade apontamentos': 4,
    grupos: [ref(GRUPO_GERENTE_API)],
    usuarios: [],
  },
  {
    id: 3,
    nome: 'Recursos Humanos',
    origem: 'Fixo',
    'quantidade usuarios': 1,
    'quantidade apontamentos': 0,
    grupos: [],
    usuarios: [],
  },
  {
    id: 4,
    nome: 'Tecnologia da Informação',
    origem: 'Fixo',
    'quantidade usuarios': 2,
    'quantidade apontamentos': 2,
    grupos: [],
    usuarios: [BELTRANO, CICLANO],
  },
  {
    id: 5,
    nome: 'Fiscal',
    origem: 'Fixo',
    'quantidade usuarios': 1,
    'quantidade apontamentos': 1,
    grupos: [ref(GRUPO_FINANCEIRO_API)],
    usuarios: [],
  },
  {
    id: 6,
    nome: 'Processos',
    origem: 'Fixo',
    'quantidade usuarios': 0,
    'quantidade apontamentos': 0,
    grupos: [],
    usuarios: [],
  },
  {
    id: 7,
    nome: 'Contabilidade',
    origem: 'Fixo',
    'quantidade usuarios': 1,
    'quantidade apontamentos': 5,
    grupos: [ref(GRUPO_FINANCEIRO_API)],
    usuarios: [],
  },
]

/** Personalizado sem apontamentos: pode ser excluído. */
export const TIPO_LOGISTICA_API: TipoApontamentoApiFalso = {
  id: 8,
  nome: 'Logística',
  origem: 'Personalizado',
  'quantidade usuarios': 2,
  'quantidade apontamentos': 0,
  grupos: [ref(GRUPO_LOGISTICA_API)],
  usuarios: [FULANO],
}

/** Personalizado com apontamentos: exclusão bloqueada (RN-13). */
export const TIPO_MARKETING_API: TipoApontamentoApiFalso = {
  id: 9,
  nome: 'Marketing',
  origem: 'Personalizado',
  'quantidade usuarios': 1,
  'quantidade apontamentos': 3,
  grupos: [ref(GRUPO_CAIXA_API)],
  usuarios: [],
}

function copiarTipo(tipo: TipoApontamentoApiFalso): TipoApontamentoApiFalso {
  return {
    ...tipo,
    grupos: tipo.grupos ? tipo.grupos.map((item) => ({ ...item })) : tipo.grupos,
    usuarios: tipo.usuarios ? tipo.usuarios.map((item) => ({ ...item })) : tipo.usuarios,
  }
}

/** Lista padrão: 7 fixos + 2 personalizados (9 tipos). Devolve sempre cópias novas. */
export function tiposApi(): TipoApontamentoApiFalso[] {
  return [...TIPOS_FIXOS_API, TIPO_LOGISTICA_API, TIPO_MARKETING_API].map(copiarTipo)
}

/** Visão do Preenchedor: `grupos` e `usuarios` vêm `null`. */
export function tiposApiPreenchedor(): TipoApontamentoApiFalso[] {
  return tiposApi().map((tipo) => ({ ...tipo, grupos: null, usuarios: null }))
}

function referencias(lista: ReferenciaApiFalsa[] | null | undefined): ReferenciaNomeada[] | null {
  return lista ? lista.map((item) => ({ id: item.id, nome: item.nome })) : null
}

/**
 * Tipo convertido para o domínio, como `listarTipos` deve devolver (camelCase; `grupos`/`usuarios`
 * ausentes ou `null` viram `null`). Usado para montar as props dos componentes nos testes.
 */
export function tipoDominio(tipo: TipoApontamentoApiFalso): TipoApontamento {
  return {
    id: tipo.id,
    nome: tipo.nome,
    origem: tipo.origem satisfies OrigemTipo,
    quantidadeUsuarios: tipo['quantidade usuarios'],
    quantidadeApontamentos: tipo['quantidade apontamentos'],
    grupos: referencias(tipo.grupos),
    usuarios: referencias(tipo.usuarios),
  }
}

/** Lista padrão já convertida para o domínio. */
export function tiposDominio(): TipoApontamento[] {
  return tiposApi().map(tipoDominio)
}

/** Rótulo do gatilho do menu de ações de um tipo (F3.2). */
export const rotuloAcoesTipo = (nome: string) => `Ações do tipo ${nome}`

// ---------------------------------------------------------------------------
// Resposta real da API (06/11/2026) — usuários vinculados com a chave "id colaborador"
// ---------------------------------------------------------------------------

/** Usuário vinculado como a API real devolve em `usuarios` (chave `"id colaborador"`, não `id`). */
export interface UsuarioVinculadoApiReal {
  'id colaborador': number
  nome: string
}

/** Tipo de apontamento exatamente no formato da resposta real de `GET /api/ped/tipos-apontamento`. */
export interface TipoApontamentoApiReal {
  id: number
  nome: string
  origem: 'Fixo' | 'Personalizado'
  'quantidade usuarios': number
  usuarios: UsuarioVinculadoApiReal[]
  grupos: ReferenciaApiFalsa[]
  'quantidade apontamentos': number
}

/** Colaborador 985 ("Preenchedor"), vinculado diretamente aos 7 tipos fixos na resposta real. */
export const COLABORADOR_PREENCHEDOR_API: ColaboradorApiFalso = {
  'id colaborador': 985,
  nome: 'Preenchedor',
  cargo: 'Analista',
  filial: '100',
}

/**
 * Resposta real de `GET /api/ped/tipos-apontamento` enviada pelo usuário em 06/11/2026: os 7 tipos
 * fixos, cada um com `usuarios: [{ "id colaborador": 985, nome: "Preenchedor" }]` e `grupos: []`.
 * O documento do back-end mostrava `usuarios` como `[{ id, nome }]`; a API real usa `"id colaborador"`.
 * Só "Tecnologia da Informação" tem 1 apontamento.
 */
export const RESPOSTA_REAL_TIPOS_API: readonly TipoApontamentoApiReal[] = NOMES_TIPOS_FIXOS.map((nome, indice) => ({
  id: indice + 1,
  nome,
  origem: 'Fixo' as const,
  'quantidade usuarios': 1,
  usuarios: [{ 'id colaborador': 985, nome: 'Preenchedor' }],
  grupos: [],
  'quantidade apontamentos': nome === 'Tecnologia da Informação' ? 1 : 0,
}))

/** Cópia nova da resposta real (para rotas com estado ou mutação nos testes). */
export function respostaRealTiposApi(): TipoApontamentoApiReal[] {
  return RESPOSTA_REAL_TIPOS_API.map((tipo) => ({
    ...tipo,
    usuarios: tipo.usuarios.map((usuario) => ({ ...usuario })),
    grupos: tipo.grupos.map((grupo) => ({ ...grupo })),
  }))
}
