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
