import { describe, expect, it } from 'vitest'

/**
 * F1.18 (refatoração sugerida pela revisão de qualidade de 06/11/2026) — o SeletorBusca, usado nos
 * dashboards e na aba Tipos, sai de src/pages/dashboards/ para src/components/. Hoje a aba Tipos
 * importa '../dashboards/SeletorBusca', que por sua vez carrega FormularioDashboard.css: a tela de
 * Tipos depende do código e do CSS de outra tela. Critério do plano: nenhuma importação de CSS de
 * src/pages/dashboards/ fora dessa pasta.
 *
 * Teste estático: lê o texto dos arquivos de src/ (sem executá-los) e resolve os caminhos importados.
 */
const ARQUIVOS = import.meta.glob<string>(['/src/**/*.{ts,tsx,css}'], { query: '?raw', import: 'default', eager: true })

const PASTA_DASHBOARDS = '/src/pages/dashboards/'

/**
 * Fora da pasta, só o registro das rotas (carga sob demanda da tela) e o auxiliar de testes que pré-carrega
 * as telas podem importar a página de dashboards; nenhum deles pode importar outro módulo ou CSS da pasta.
 */
const IMPORTACOES_PERMITIDAS: Record<string, string[]> = {
  '/src/rotas.tsx': ['/src/pages/dashboards/DashboardsPage'],
  '/src/test/renderizarApp.tsx': ['/src/pages/dashboards/DashboardsPage'],
}

/** Especificadores importados: `from '...'`, `import '...'`, `import('...')` e `@import '...'` (CSS). */
function especificadores(fonte: string): string[] {
  const padroes = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g,
  ]
  return padroes.flatMap((padrao) => [...fonte.matchAll(padrao)].map((m) => m[1]))
}

/** Resolve um especificador relativo a partir do arquivo (`/src/a/b.tsx` + `../c` → `/src/c`). */
function resolver(arquivo: string, especificador: string): string | null {
  if (!especificador.startsWith('.')) return especificador.startsWith('/src/') ? especificador : null
  const partes = arquivo.split('/').slice(0, -1)
  for (const parte of especificador.split('/')) {
    if (parte === '.' || parte === '') continue
    if (parte === '..') partes.pop()
    else partes.push(parte)
  }
  return partes.join('/').replace(/\?.*$/, '')
}

/** Importações, por arquivo fora de src/pages/dashboards/, que apontam para dentro dessa pasta. */
function importacoesDeDashboardsForaDaPasta(): Array<{ arquivo: string; destino: string }> {
  return Object.entries(ARQUIVOS)
    .filter(([arquivo]) => !arquivo.startsWith(PASTA_DASHBOARDS))
    .flatMap(([arquivo, fonte]) =>
      especificadores(fonte)
        .map((especificador) => resolver(arquivo, especificador))
        .filter((destino): destino is string => destino !== null && destino.startsWith(PASTA_DASHBOARDS))
        .map((destino) => ({ arquivo, destino })),
    )
}

describe('F3.4 — Isolamento de src/pages/dashboards/: o SeletorBusca fica em src/components/ (F1.18)', () => {
  it('a leitura dos arquivos funciona (sanidade: encontra a importação de DashboardsPage em src/rotas.tsx)', () => {
    expect(Object.keys(ARQUIVOS).length).toBeGreaterThan(100)
    expect(importacoesDeDashboardsForaDaPasta()).toContainEqual({ arquivo: '/src/rotas.tsx', destino: '/src/pages/dashboards/DashboardsPage' })
  })

  it('nenhum arquivo fora de src/pages/dashboards/ importa CSS dessa pasta', () => {
    const css = importacoesDeDashboardsForaDaPasta().filter(({ destino }) => destino.endsWith('.css'))

    expect(css).toEqual([])
  })

  it('nenhum arquivo fora de src/pages/dashboards/ importa módulos dessa pasta (só as rotas e o auxiliar de testes carregam a DashboardsPage)', () => {
    const indevidas = importacoesDeDashboardsForaDaPasta().filter(
      ({ arquivo, destino }) => !(IMPORTACOES_PERMITIDAS[arquivo] ?? []).includes(destino),
    )

    expect(indevidas).toEqual([])
  })

  it('o SeletorBusca existe em src/components/ e não existe mais em src/pages/dashboards/', () => {
    expect(Object.keys(ARQUIVOS)).toContain('/src/components/SeletorBusca.tsx')
    expect(Object.keys(ARQUIVOS)).not.toContain('/src/pages/dashboards/SeletorBusca.tsx')
  })

  it('src/components/SeletorBusca.tsx não importa nada de src/pages/ (componente reutilizável não depende de telas)', () => {
    const fonte = ARQUIVOS['/src/components/SeletorBusca.tsx'] ?? ''
    const destinos = especificadores(fonte).map((especificador) => resolver('/src/components/SeletorBusca.tsx', especificador))

    expect(fonte).not.toBe('')
    expect(destinos.filter((destino) => destino?.startsWith('/src/pages/'))).toEqual([])
  })
})
