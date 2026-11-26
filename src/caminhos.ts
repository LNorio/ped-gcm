/**
 * Caminhos (URLs) da aplicação (F2.3 — RF-02).
 *
 * Mantidos em módulo próprio, sem dependências, para que as páginas (login, sem acesso) possam
 * navegar por constante sem importar `rotas.tsx` — que, por sua vez, importa as páginas.
 * `rotas.tsx` reexporta `CAMINHOS`.
 */
import type { Aba } from './sessao/permissoes'

export const CAMINHOS = {
  login: '/login',
  semAcesso: '/sem-acesso',
  inicio: '/',
  tipos: '/tipos',
  apontamentos: '/apontamentos',
  dadosExternos: '/dados-externos',
  indicadores: '/indicadores',
  faixas: '/faixas',
  dashboards: '/dashboards',
  preenchimento: '/preenchimento',
  fechamentos: '/fechamentos',
} as const

/**
 * Página pública com a documentação para o back-end (F2.13). Fica fora de `CAMINHOS` (login, sem acesso
 * e abas, verificado pelos testes de F2.3) e do menu de abas.
 */
export const CAMINHO_BACKEND = '/backend'

/**
 * Página pública com o diário de implementação e a documentação do projeto (F2.14). Como o
 * `/backend`, fica fora de `CAMINHOS` e do menu de abas.
 */
export const CAMINHO_RESUMO = '/resumo'

/** Caminho de cada aba do menu. */
export const CAMINHO_DA_ABA: Readonly<Record<Aba, string>> = {
  inicio: CAMINHOS.inicio,
  tipos: CAMINHOS.tipos,
  apontamentos: CAMINHOS.apontamentos,
  'dados-externos': CAMINHOS.dadosExternos,
  indicadores: CAMINHOS.indicadores,
  faixas: CAMINHOS.faixas,
  dashboards: CAMINHOS.dashboards,
  preenchimento: CAMINHOS.preenchimento,
  fechamentos: CAMINHOS.fechamentos,
}
