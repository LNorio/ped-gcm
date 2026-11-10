import { describe, expect, it } from 'vitest'
import rotas from './rotas.tsx?raw'

/** Páginas das abas (e a 404), carregadas sob demanda: cada uma vira um chunk próprio na build. */
const PAGINAS_SOB_DEMANDA = [
  ['InicioPage', './pages/inicio/InicioPage'],
  ['TiposPage', './pages/tipos/TiposPage'],
  ['ApontamentosPage', './pages/apontamentos/ApontamentosPage'],
  ['DadosExternosPage', './pages/dados-externos/DadosExternosPage'],
  ['IndicadoresPage', './pages/indicadores/IndicadoresPage'],
  ['DashboardsPage', './pages/dashboards/DashboardsPage'],
  ['FaixasPage', './pages/faixas/FaixasPage'],
  ['PreenchimentoPage', './pages/preenchimento/PreenchimentoPage'],
  ['FechamentosPage', './pages/fechamentos/FechamentosPage'],
  ['NaoEncontradaPage', './pages/nao-encontrada/NaoEncontradaPage'],
] as const

/** Páginas de entrada e de fallback de erro: continuam no pacote principal (import estático). */
const PAGINAS_ESTATICAS = [
  ['LoginPage', './pages/login/LoginPage'],
  ['SemAcessoPage', './pages/sem-acesso/SemAcessoPage'],
  ['ErroPage', './pages/erro/ErroPage'],
] as const

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** `import ... from '<caminho>'` estático (não `import type`), com ou sem a extensão `.tsx`. */
const importEstatico = (caminho: string) =>
  new RegExp(`^\\s*import\\s+(?!type\\b)[^'";]*\\bfrom\\s*['"]${escapar(caminho)}(\\.tsx)?['"]`, 'm')

/** `import('<caminho>')` dinâmico, com ou sem a extensão `.tsx`. */
const importDinamico = (caminho: string) =>
  new RegExp(`\\bimport\\(\\s*['"]${escapar(caminho)}(\\.tsx)?['"]\\s*\\)`)

describe('F2.9 — Carregamento sob demanda das abas (estrutura de rotas.tsx)', () => {
  it.each(PAGINAS_SOB_DEMANDA)('%s não é importada estaticamente em rotas.tsx', (_pagina, caminho) => {
    expect(rotas).not.toMatch(importEstatico(caminho))
  })

  it.each(PAGINAS_SOB_DEMANDA)('%s é carregada com import() dinâmico', (_pagina, caminho) => {
    expect(rotas).toMatch(importDinamico(caminho))
  })

  it.each(PAGINAS_ESTATICAS)('%s continua importada estaticamente (entrada / fallback de erro)', (pagina, caminho) => {
    expect(rotas).toMatch(importEstatico(caminho))
    expect(rotas).toMatch(new RegExp(`\\b${pagina}\\b`))
    expect(rotas).not.toMatch(importDinamico(caminho))
  })

  it('usa React.lazy para as páginas sob demanda', () => {
    expect(rotas).toMatch(/\blazy\s*\(/)
  })
})
