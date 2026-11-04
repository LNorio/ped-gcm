/**
 * Permissões por perfil (F2.6 — RF-04, RF-16).
 *
 * Implementa a matriz de acesso da **seção 2 do documento de requisitos**
 * (`docs/PED — Cadastro e Preenchimento Documento de Requisitos.md`), com a decisão registrada na
 * revisão 2.1: **Validador com acesso total a Tipos, Faixas e Fechamentos** (mesmas abas do Admin).
 *
 * | Aba            | Admin | Validador | Preenchedor |
 * | -------------- | :---: | :-------: | :---------: |
 * | Início         |   x   |     x     |      x      |
 * | Tipos          |   x   |     x     |             |
 * | Apontamentos   |   x   |     x     |      x      |
 * | Dados Externos |   x   |     x     |      x      |
 * | Indicadores    |   x   |     x     |             |
 * | Faixas         |   x   |     x     |             |
 * | Dashboards     |   x   |     x     |             |
 * | Preenchimento  |   x   |     x     |      x      |
 * | Fechamentos    |   x   |     x     |             |
 *
 * Este módulo é o único ponto que conhece a matriz; componentes e rotas devem consultar
 * `abasVisiveis`/`podeAcessar` (ou o hook `usePermissoes`) em vez de comparar perfis diretamente.
 */
import type { Perfil } from '../types/dominio'

export type Aba =
  | 'inicio'
  | 'tipos'
  | 'apontamentos'
  | 'dados-externos'
  | 'indicadores'
  | 'faixas'
  | 'dashboards'
  | 'preenchimento'
  | 'fechamentos'

/** Todas as abas, na ordem em que aparecem no menu (ordem do protótipo). */
export const ABAS: readonly Aba[] = [
  'inicio',
  'tipos',
  'apontamentos',
  'dados-externos',
  'indicadores',
  'faixas',
  'dashboards',
  'preenchimento',
  'fechamentos',
]

/** Rótulos exibidos ao usuário (pt-BR). */
export const ROTULOS_ABA: Readonly<Record<Aba, string>> = {
  inicio: 'Início',
  tipos: 'Tipos',
  apontamentos: 'Apontamentos',
  'dados-externos': 'Dados Externos',
  indicadores: 'Indicadores',
  faixas: 'Faixas',
  dashboards: 'Dashboards',
  preenchimento: 'Preenchimento',
  fechamentos: 'Fechamentos',
}

/** Matriz de acesso: abas permitidas por perfil, na ordem de `ABAS`. */
const ABAS_POR_PERFIL: Readonly<Record<Perfil, readonly Aba[]>> = {
  admin: ABAS,
  validador: ABAS,
  preenchedor: ['inicio', 'apontamentos', 'dados-externos', 'preenchimento'],
}

/**
 * Abas visíveis para o perfil informado, na ordem do menu.
 * Devolve sempre um novo array; `null` (sem acesso) não vê aba alguma.
 */
export function abasVisiveis(perfil: Perfil | null): Aba[] {
  if (perfil === null) return []
  return [...ABAS_POR_PERFIL[perfil]]
}

/** Indica se o perfil pode acessar a aba. `null` nunca pode. */
export function podeAcessar(perfil: Perfil | null, aba: Aba): boolean {
  if (perfil === null) return false
  return ABAS_POR_PERFIL[perfil].includes(aba)
}

/**
 * Ações sensíveis controladas por perfil (F1.13 — seção 2 do documento de requisitos).
 *
 * | Ação                          | Admin | Validador | Preenchedor |
 * | ----------------------------- | :---: | :-------: | :---------: |
 * | excluir-tipo                  |   x   |     x     |             |
 * | alterar-situacao-apontamento  |   x   |     x     |             |
 * | excluir-apontamento           |   x   |           |             |
 * | cadastrar-dado-externo-ativo  |   x   |           |             |
 * | concluir-dado-externo         |   x   |           |             |
 * | alterar-situacao-dado-externo |   x   |     x     |             |
 * | excluir-dado-externo          |   x   |           |             |
 */
export type AcaoPermissao =
  | 'excluir-tipo'
  | 'alterar-situacao-apontamento'
  | 'excluir-apontamento'
  | 'cadastrar-dado-externo-ativo'
  | 'concluir-dado-externo'
  | 'alterar-situacao-dado-externo'
  | 'excluir-dado-externo'

/** Matriz de ações: perfis autorizados por ação. Único ponto que conhece essa regra. */
const PERFIS_POR_ACAO: Readonly<Record<AcaoPermissao, readonly Perfil[]>> = {
  'excluir-tipo': ['admin', 'validador'],
  'alterar-situacao-apontamento': ['admin', 'validador'],
  'excluir-apontamento': ['admin'],
  'cadastrar-dado-externo-ativo': ['admin'],
  'concluir-dado-externo': ['admin'],
  'alterar-situacao-dado-externo': ['admin', 'validador'],
  'excluir-dado-externo': ['admin'],
}

/** Indica se o perfil pode executar a ação. `null` nunca pode. */
export function podeExecutar(perfil: Perfil | null, acao: AcaoPermissao): boolean {
  if (perfil === null) return false
  return PERFIS_POR_ACAO[acao].includes(perfil)
}
