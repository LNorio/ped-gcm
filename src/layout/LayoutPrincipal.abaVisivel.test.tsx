import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../services/sessao'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { CHAVE_ROTA_ALERTAS_MENU } from '../test/alertasMenuFalsos'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { usuarioRapido } from '../test/usuario'
import { LayoutPrincipal } from './LayoutPrincipal'

/**
 * F12.2 (RNF-04, revisão de responsividade de 24/11/2026) — aba ativa visível na barra de abas
 * (`BarraAbas` em `LayoutPrincipal.tsx`). Em telas estreitas a barra rola na horizontal e a aba ativa
 * podia ficar fora da área visível. Na troca de rota, o link da aba ativa chama
 * `scrollIntoView({ inline: 'nearest', block: 'nearest' })`.
 *
 * O jsdom não implementa `scrollIntoView`: o teste define `Element.prototype.scrollIntoView` com um
 * registro de quem o chamou (`this`) e com quais opções.
 */
describe('F12.2 — LayoutPrincipal: a aba ativa é rolada para a área visível na troca de rota', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>
  const original = Element.prototype.scrollIntoView
  let chamadas: { elemento: Element; opcoes: unknown }[] = []

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaJson({ abas: {} }) })
    chamadas = []
    Element.prototype.scrollIntoView = function scrollIntoViewFalso(this: Element, opcoes?: boolean | ScrollIntoViewOptions) {
      chamadas.push({ elemento: this, opcoes })
    }
  })

  afterEach(() => {
    Element.prototype.scrollIntoView = original
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  function renderizar(caminho = '/') {
    const acesso = acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
    return render(
      <ProvedorSessaoFalso sessao={{ estado: 'autenticado', acesso }}>
        <MemoryRouter initialEntries={[caminho]}>
          <Routes>
            <Route element={<LayoutPrincipal />}>
              <Route path="/" element={<h1>Início</h1>} />
              <Route path="/tipos" element={<h1>Tipos</h1>} />
              <Route path="/fechamentos" element={<h1>Fechamentos</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ProvedorSessaoFalso>,
    )
  }

  const link = (nome: RegExp) => within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: nome })

  it('ao navegar para "Fechamentos" (última aba), o link dela chama scrollIntoView({ inline: "nearest", block: "nearest" })', async () => {
    const user = usuarioRapido()
    renderizar('/')

    await user.click(link(/^Fechamentos/))

    await waitFor(() => expect(chamadas.some((c) => c.elemento === link(/^Fechamentos/))).toBe(true))
    const ultima = chamadas[chamadas.length - 1]
    expect(ultima.elemento).toBe(link(/^Fechamentos/))
    expect(ultima.opcoes).toEqual(expect.objectContaining({ inline: 'nearest', block: 'nearest' }))
  })

  it('a cada troca de rota, a rolagem é feita na aba que ficou ativa (Tipos e depois Início)', async () => {
    const user = usuarioRapido()
    renderizar('/fechamentos')

    await user.click(link(/^Tipos/))
    await waitFor(() => expect(chamadas[chamadas.length - 1]?.elemento).toBe(link(/^Tipos/)))

    await user.click(link(/^Início/))
    await waitFor(() => expect(chamadas[chamadas.length - 1]?.elemento).toBe(link(/^Início/)))
    expect(link(/^Início/)).toHaveAttribute('aria-current', 'page')
  })

  it('depois da troca de rota, a rolagem não é feita em nenhuma aba inativa', async () => {
    const user = usuarioRapido()
    renderizar('/')
    const antes = chamadas.length

    await user.click(link(/^Tipos/))
    await waitFor(() => expect(chamadas.length).toBeGreaterThan(antes))

    const abasInativas = [/^Início/, /^Fechamentos/, /^Apontamentos/].map(link)
    for (const chamada of chamadas.slice(antes)) expect(abasInativas).not.toContain(chamada.elemento)
  })
})
