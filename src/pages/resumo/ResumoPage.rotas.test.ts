import { describe, expect, it } from 'vitest'
import { CAMINHOS, CAMINHO_BACKEND, CAMINHO_RESUMO } from '../../caminhos'
import rotas from '../../rotas.tsx?raw'

/**
 * F2.14 — /resumo na estrutura de rotas: caminho próprio (fora de `CAMINHOS`, como o `/backend`) e
 * página carregada sob demanda (`import()` dinâmico + `lazy`), para o react-markdown e o texto dos
 * documentos ficarem fora do pacote principal.
 */
const CAMINHO_DA_PAGINA = './pages/resumo/ResumoPage'

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

describe('F2.14 — Rota /resumo (estrutura)', () => {
  it('CAMINHO_RESUMO é "/resumo" e não faz parte de CAMINHOS (login, sem acesso e abas)', () => {
    expect(CAMINHO_RESUMO).toBe('/resumo')
    expect(Object.values(CAMINHOS)).not.toContain(CAMINHO_RESUMO)
    expect(CAMINHO_RESUMO).not.toBe(CAMINHO_BACKEND)
  })

  it('ResumoPage não é importada estaticamente em rotas.tsx', () => {
    expect(rotas).not.toMatch(
      new RegExp(`^\\s*import\\s+(?!type\\b)[^'";]*\\bfrom\\s*['"]${escapar(CAMINHO_DA_PAGINA)}(\\.tsx)?['"]`, 'm'),
    )
  })

  it('ResumoPage é carregada com import() dinâmico', () => {
    expect(rotas).toMatch(new RegExp(`\\bimport\\(\\s*['"]${escapar(CAMINHO_DA_PAGINA)}(\\.tsx)?['"]\\s*\\)`))
  })
})
