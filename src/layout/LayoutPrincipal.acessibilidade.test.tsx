import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirToken, limparToken } from '../services/sessao'
import { respostaJson, simularApi } from '../test/apiFalsa'
import { CHAVE_ROTA_ALERTAS_MENU, alertasMenuAdminApi } from '../test/alertasMenuFalsos'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { usuarioRapido } from '../test/usuario'
import { LayoutPrincipal } from './LayoutPrincipal'

/**
 * F12.1 (RNF-05, revisão de acessibilidade de 24/11/2026) — `LayoutPrincipal`:
 *
 * M4 — link "Pular para o conteúdo": primeiro elemento focável da página (antes do cabeçalho), com
 * `href="#conteudo"`; o `<main>` tem `id="conteudo"` e `tabIndex={-1}`; ativar o link (clique ou Enter)
 * leva o foco ao `<main>`.
 *
 * M5 — título do documento por rota: "{Aba} · PED" (ex.: "Início · PED", "Tipos · PED", "Dados Externos ·
 * PED"), pelo rótulo da aba (`ROTULOS_ABA`); depois de navegar pelas abas, o foco vai para o `<h1>` da
 * página nova. (Login e 404, com títulos próprios, estão em `src/rotas.titulo.integration.test.tsx`.)
 *
 * M6 — dica do marcador "Com alertas": além (ou no lugar) do `title`, a dica é a descrição acessível do
 * marcador por `aria-describedby`, apontando para um texto visualmente oculto **fora do link** da aba (o
 * texto do link continua só o rótulo, como em `LayoutPrincipal.alertasMenu.test.tsx`). Sem dica, o
 * marcador não tem `aria-describedby`. O nome `img` "Com alertas" não muda.
 */

function renderizar(caminho = '/') {
  const acesso = acessoFalso({ perfil: 'admin', todasAsFiliais: true, filiais: FILIAIS })
  return render(
    <ProvedorSessaoFalso sessao={{ estado: 'autenticado', acesso }}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route element={<LayoutPrincipal />}>
            <Route path="/" element={<h1 tabIndex={-1}>Início</h1>} />
            <Route path="/tipos" element={<h1 tabIndex={-1}>Tipos</h1>} />
            <Route path="/apontamentos" element={<h1 tabIndex={-1}>Apontamentos</h1>} />
            <Route path="/dados-externos" element={<h1 tabIndex={-1}>Dados Externos</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ProvedorSessaoFalso>,
  )
}

const abas = () => screen.getByRole('navigation', { name: 'Abas' })
const linkAba = (nome: RegExp) => within(abas()).getByRole('link', { name: nome })

describe('F12.1 — LayoutPrincipal: pular para o conteúdo, título por rota e dica do alerta (M4, M5, M6)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaJson({ abas: {} }) })
    document.title = 'PED - Sistema de Cadastro'
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  describe('M4 — "Pular para o conteúdo"', () => {
    const pular = () => screen.getByRole('link', { name: 'Pular para o conteúdo' })

    it('é o primeiro elemento focável da página: o primeiro Tab chega a ele', async () => {
      const user = usuarioRapido()
      renderizar('/tipos')

      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      await user.tab()

      expect(pular()).toHaveFocus()
    })

    it('aponta para o <main id="conteudo" tabIndex={-1}> e fica fora da navegação "Abas" e do cabeçalho', () => {
      renderizar('/tipos')

      expect(pular()).toHaveAttribute('href', '#conteudo')
      const principal = screen.getByRole('main')
      expect(principal).toHaveAttribute('id', 'conteudo')
      expect(principal).toHaveAttribute('tabindex', '-1')
      expect(abas().contains(pular())).toBe(false)
      expect(screen.getByRole('banner').contains(pular())).toBe(false)
    })

    it('ativar pelo clique leva o foco ao <main>', async () => {
      const user = usuarioRapido()
      renderizar('/tipos')

      await user.click(pular())

      expect(screen.getByRole('main')).toHaveFocus()
    })

    it('ativar pelo teclado (Tab e Enter) leva o foco ao <main>', async () => {
      const user = usuarioRapido()
      renderizar('/tipos')

      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      await user.tab()
      await user.keyboard('{Enter}')

      expect(screen.getByRole('main')).toHaveFocus()
    })
  })

  describe('M5 — título do documento e foco no <h1> ao navegar', () => {
    it.each([
      ['/', 'Início · PED'],
      ['/tipos', 'Tipos · PED'],
      ['/apontamentos', 'Apontamentos · PED'],
      ['/dados-externos', 'Dados Externos · PED'],
    ])('em %s o título é "%s"', async (caminho, titulo) => {
      renderizar(caminho)

      await waitFor(() => expect(document.title).toBe(titulo))
    })

    it('navegar pela aba "Apontamentos" troca o título e leva o foco ao <h1> "Apontamentos"', async () => {
      const user = usuarioRapido()
      renderizar('/tipos')
      await waitFor(() => expect(document.title).toBe('Tipos · PED'))

      await user.click(linkAba(/^Apontamentos/))

      await waitFor(() => expect(document.title).toBe('Apontamentos · PED'))
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Apontamentos' })).toHaveFocus())
    })

    it('navegar pelo teclado (Enter na aba) também leva o foco ao <h1> da página nova', async () => {
      const user = usuarioRapido()
      renderizar('/')

      linkAba(/^Dados Externos/).focus()
      await user.keyboard('{Enter}')

      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dados Externos' })).toHaveFocus())
      expect(document.title).toBe('Dados Externos · PED')
    })
  })

  describe('M6 — dica do marcador "Com alertas" como descrição acessível', () => {
    const marcador = (nome: RegExp) => within(linkAba(nome)).queryByRole('img', { name: 'Com alertas' })
    const DICA_INDICADORES =
      '2 indicadores aguardando definição de meta · 3 indicadores com filial sem meta · 1 indicador com integração da meta pendente'

    it('o marcador aponta, por aria-describedby, para um texto com a dica, fora do link da aba', async () => {
      simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaJson(alertasMenuAdminApi()) })
      renderizar('/')
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())

      const sinal = marcador(/^Indicadores/)!
      const ids = sinal.getAttribute('aria-describedby')
      expect(ids).toBeTruthy()
      const descricao = document.getElementById(ids!.split(' ')[0])
      expect(descricao).not.toBeNull()
      expect(descricao).toHaveTextContent(DICA_INDICADORES)
      expect(linkAba(/^Indicadores/).contains(descricao)).toBe(false)
      expect(linkAba(/^Indicadores/).textContent).toBe('Indicadores')
      expect(sinal).toHaveAccessibleDescription(DICA_INDICADORES)
      expect(sinal).toHaveAccessibleName('Com alertas')
    })

    it('cada aba acesa tem a própria descrição (Dados Externos)', async () => {
      simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaJson(alertasMenuAdminApi()) })
      renderizar('/')
      await waitFor(() => expect(marcador(/^Dados Externos/)).not.toBeNull())

      const sinal = marcador(/^Dados Externos/)!
      const descricao = document.getElementById(sinal.getAttribute('aria-describedby') ?? '')
      expect(descricao).toHaveTextContent('4 dados externos sem integração configurada')
    })

    it('o texto da dica fica visualmente oculto (classe "visualmente-oculto" do tema)', async () => {
      simularApi(fetchFalso, { [CHAVE_ROTA_ALERTAS_MENU]: () => respostaJson(alertasMenuAdminApi()) })
      renderizar('/')
      await waitFor(() => expect(marcador(/^Indicadores/)).not.toBeNull())

      const descricao = document.getElementById(marcador(/^Indicadores/)!.getAttribute('aria-describedby') ?? '')
      expect(descricao).not.toBeNull()
      expect(descricao).toHaveClass('visualmente-oculto')
    })

    it('aba sem dica (sem alertas) não tem marcador nem descrição pendurada', async () => {
      renderizar('/')
      await waitFor(() => expect(fetchFalso).toHaveBeenCalled())

      expect(screen.queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument()
      expect(linkAba(/^Indicadores/)).not.toHaveAttribute('aria-describedby')
    })
  })
})
