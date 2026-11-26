import { render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usuarioRapido } from '../../test/usuario'
import { ResumoPage } from './ResumoPage'

/**
 * F2.14 — Página pública /resumo com o diário de implementação e a documentação do projeto
 * (unitário da página).
 *
 * O conteúdo é controlado pelo teste: `DOCUMENTOS_RESUMO` (de `./documentosResumo`) é substituído por
 * textos fixos, no mesmo formato dos arquivos reais (`docs/diario-implementacao.md` e
 * `docs/documentacao.md`), que mudam todos os dias.
 *
 * Contrato:
 * - `<h1>` "Resumo do projeto"; título do documento "Resumo · PED".
 * - Abas (WAI-ARIA): `tablist` "Documentos do projeto" com os `tab` "Diário de implementação" e
 *   "Documentação"; a selecionada tem `aria-selected="true"`, `tabindex="0"` e `aria-controls` = id do
 *   painel; a outra, `aria-selected="false"` e `tabindex="-1"`. Setas ←/→ (circulares), Home e End
 *   selecionam a aba e levam o foco a ela. Só o painel ativo fica visível, com `role="tabpanel"`
 *   nomeado pela aba.
 * - URL: `?aba=diario` | `?aba=documentacao`; sem `?aba` ou com valor inválido, abre o diário.
 * - Markdown por react-markdown + remark-gfm, sem executar HTML cru.
 * - Links: `#...` (âncora interna) continuam `<a href="#...">` sem `target`, e existe no painel um único
 *   elemento com aquele `id`; clicar neles não muda a rota nem a aba. http/https abrem em nova aba com
 *   `rel="noopener noreferrer"`. Qualquer outro destino (arquivo relativo do projeto, `.md`,
 *   `javascript:`) aparece só como texto, sem link.
 */
const { DOCUMENTOS } = vi.hoisted(() => {
  const diario = [
    '# Diário de Implementação — PED',
    '',
    '## 24/11/2026',
    '',
    '**Resumo:** Texto de abertura do diário com `codigoDoDiario` no meio.',
    '',
    '### Implementações',
    '',
    '- primeiro item do diário',
    '- segundo item do diário',
    '',
    '| Coluna | Valor |',
    '| --- | --- |',
    '| Requisitos implementados | 113 |',
    '',
    '```text',
    'npx vitest run --maxWorkers=2',
    '```',
    '',
  ].join('\n')

  const documentacao = [
    '# Documentação — PED',
    '',
    '## Índice',
    '',
    '| Data | Tags | Resumo |',
    '| --- | --- | --- |',
    '| [24/11/2026](#2026-11-24) | #fechamentos #testes | Resumo do dia vinte e quatro |',
    '| [19/11/2026](#2026-11-19) | #indicadores | Resumo do dia dezenove |',
    '',
    '---',
    '',
    '<a id="2026-11-24"></a>',
    '## 24/11/2026',
    '',
    '**Tags:** #fechamentos #testes',
    '',
    '### Visão geral',
    'Texto do dia vinte e quatro na documentação.',
    '',
    'Veja o [plano de implementação](plano-implementacao.md), o [arquivo de rotas](../src/rotas.tsx), o [link perigoso](javascript:window.__resumoExecutado=true) e o [site do Vite](https://vite.dev/guide/).',
    '',
    '<script>window.__resumoExecutado = true</script>',
    '',
    '<img src="x" onerror="window.__resumoExecutado = true">',
    '',
    '<a id="malicioso" href="javascript:window.__resumoExecutado=true" onmouseover="window.__resumoExecutado = true">passe aqui</a>',
    '',
    'Parágrafo depois do HTML cru.',
    '',
    '---',
    '',
    '<a id="2026-11-19"></a>',
    '## 19/11/2026',
    '',
    'Texto do dia dezenove na documentação.',
    '',
  ].join('\n')

  return { DOCUMENTOS: { diario, documentacao } }
})

vi.mock('./documentosResumo', () => ({ DOCUMENTOS_RESUMO: DOCUMENTOS }))

declare global {
  interface Window {
    __resumoExecutado?: boolean
  }
}

const ABA_DIARIO = 'Diário de implementação'
const ABA_DOCUMENTACAO = 'Documentação'

function renderizarPagina(caminho = '/resumo') {
  const roteador = createMemoryRouter([{ path: '/resumo', element: <ResumoPage /> }], { initialEntries: [caminho] })
  const resultado = render(<RouterProvider router={roteador} />)
  return { ...resultado, roteador }
}

const abaDaUrl = (roteador: ReturnType<typeof createMemoryRouter>) =>
  new URLSearchParams(roteador.state.location.search).get('aba')

const listaDeAbas = () => screen.getByRole('tablist', { name: 'Documentos do projeto' })
const aba = (nome: string) => within(listaDeAbas()).getByRole('tab', { name: nome })
const painel = () => screen.getByRole('tabpanel')

/** O texto não está no painel visível: ou não foi renderizado, ou está num painel oculto. */
function expectForaDoPainelVisivel(texto: string | RegExp) {
  expect(within(painel()).queryByText(texto)).not.toBeInTheDocument()
  const encontrado = screen.queryByText(texto)
  if (encontrado) expect(encontrado).not.toBeVisible()
}

describe('F2.14 — Página de resumo do projeto (ResumoPage)', () => {
  let scrollOriginal: typeof Element.prototype.scrollIntoView | undefined

  beforeEach(() => {
    document.title = 'PED - Sistema de Cadastro'
    delete window.__resumoExecutado
    // O jsdom não implementa scrollIntoView; a página pode usá-lo para ir à âncora.
    scrollOriginal = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    Element.prototype.scrollIntoView = scrollOriginal as typeof Element.prototype.scrollIntoView
    vi.restoreAllMocks()
  })

  it('mostra o <h1> "Resumo do projeto" e o título do documento "Resumo · PED"', async () => {
    renderizarPagina()

    expect(screen.getByRole('heading', { level: 1, name: 'Resumo do projeto' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Resumo · PED'))
  })

  it('não chama a API (nem ao trocar de aba)', async () => {
    const fetchFalso = vi.spyOn(globalThis, 'fetch')
    const user = usuarioRapido()
    renderizarPagina()

    await user.click(aba(ABA_DOCUMENTACAO))

    expect(fetchFalso).not.toHaveBeenCalled()
  })

  describe('abas', () => {
    it('tem a lista "Documentos do projeto" com as abas "Diário de implementação" e "Documentação", nessa ordem', () => {
      renderizarPagina()

      const abas = within(listaDeAbas()).getAllByRole('tab')
      expect(abas.map((item) => item.textContent?.trim())).toEqual([ABA_DIARIO, ABA_DOCUMENTACAO])
    })

    it('sem ?aba, abre o diário: aba selecionada e painel nomeado por ela', () => {
      renderizarPagina('/resumo')

      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByRole('tabpanel', { name: ABA_DIARIO })).toBeInTheDocument()
      expect(within(painel()).getByText(/Texto de abertura do diário/)).toBeInTheDocument()
      expectForaDoPainelVisivel('Texto do dia vinte e quatro na documentação.')
    })

    it('só um painel fica visível, e a aba selecionada aponta para ele (aria-controls)', () => {
      renderizarPagina('/resumo')

      const paineis = screen.getAllByRole('tabpanel')
      expect(paineis).toHaveLength(1)
      const idDoPainel = paineis[0].getAttribute('id')
      expect(idDoPainel).toBeTruthy()
      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-controls', idDoPainel)
    })

    it('?aba=documentacao abre a documentação', () => {
      renderizarPagina('/resumo?aba=documentacao')

      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')
      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByRole('tabpanel', { name: ABA_DOCUMENTACAO })).toBeInTheDocument()
      expect(within(painel()).getByText('Texto do dia vinte e quatro na documentação.')).toBeInTheDocument()
      expectForaDoPainelVisivel(/Texto de abertura do diário/)
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-controls', painel().getAttribute('id'))
    })

    it('?aba=diario abre o diário', () => {
      renderizarPagina('/resumo?aba=diario')

      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tabpanel', { name: ABA_DIARIO })).toBeInTheDocument()
    })

    it.each(['invalida', 'DOCUMENTACAO', ''])('?aba=%j (inválido) abre o diário', (valor) => {
      renderizarPagina(`/resumo?aba=${valor}`)

      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'false')
      expect(within(screen.getByRole('tabpanel', { name: ABA_DIARIO })).getByText(/Texto de abertura do diário/)).toBeInTheDocument()
    })

    it('clicar em "Documentação" troca o painel e leva a escolha para a URL (?aba=documentacao)', async () => {
      const user = usuarioRapido()
      const { roteador } = renderizarPagina('/resumo')

      await user.click(aba(ABA_DOCUMENTACAO))

      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')
      expect(within(screen.getByRole('tabpanel', { name: ABA_DOCUMENTACAO })).getByText('Texto do dia vinte e quatro na documentação.')).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/resumo')
      expect(abaDaUrl(roteador)).toBe('documentacao')
    })

    it('clicar em "Diário de implementação" volta ao diário e leva ?aba=diario para a URL', async () => {
      const user = usuarioRapido()
      const { roteador } = renderizarPagina('/resumo?aba=documentacao')

      await user.click(aba(ABA_DIARIO))

      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
      expect(within(screen.getByRole('tabpanel', { name: ABA_DIARIO })).getByText(/Texto de abertura do diário/)).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/resumo')
      expect(abaDaUrl(roteador)).toBe('diario')
    })
  })

  describe('teclado (padrão de abas do WAI-ARIA)', () => {
    it('só a aba selecionada fica na ordem do Tab (tabindex 0; a outra, -1)', async () => {
      const user = usuarioRapido()
      renderizarPagina()

      expect(aba(ABA_DIARIO)).toHaveAttribute('tabindex', '0')
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('tabindex', '-1')

      await user.click(aba(ABA_DOCUMENTACAO))

      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('tabindex', '0')
      expect(aba(ABA_DIARIO)).toHaveAttribute('tabindex', '-1')
    })

    it('seta para a direita seleciona a próxima aba, leva o foco a ela e atualiza a URL', async () => {
      const user = usuarioRapido()
      const { roteador } = renderizarPagina()
      await user.click(aba(ABA_DIARIO))

      await user.keyboard('{ArrowRight}')

      expect(aba(ABA_DOCUMENTACAO)).toHaveFocus()
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tabpanel', { name: ABA_DOCUMENTACAO })).toBeInTheDocument()
      expect(abaDaUrl(roteador)).toBe('documentacao')
    })

    it('seta para a direita na última aba volta à primeira', async () => {
      const user = usuarioRapido()
      renderizarPagina('/resumo?aba=documentacao')
      await user.click(aba(ABA_DOCUMENTACAO))

      await user.keyboard('{ArrowRight}')

      expect(aba(ABA_DIARIO)).toHaveFocus()
      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
    })

    it('seta para a esquerda na primeira aba vai à última; de novo, volta à primeira', async () => {
      const user = usuarioRapido()
      const { roteador } = renderizarPagina()
      await user.click(aba(ABA_DIARIO))

      await user.keyboard('{ArrowLeft}')
      expect(aba(ABA_DOCUMENTACAO)).toHaveFocus()
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')
      expect(abaDaUrl(roteador)).toBe('documentacao')

      await user.keyboard('{ArrowLeft}')
      expect(aba(ABA_DIARIO)).toHaveFocus()
      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
      expect(abaDaUrl(roteador)).toBe('diario')
    })

    it('End vai à última aba e Home volta à primeira', async () => {
      const user = usuarioRapido()
      renderizarPagina()
      await user.click(aba(ABA_DIARIO))

      await user.keyboard('{End}')
      expect(aba(ABA_DOCUMENTACAO)).toHaveFocus()
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')

      await user.keyboard('{Home}')
      expect(aba(ABA_DIARIO)).toHaveFocus()
      expect(aba(ABA_DIARIO)).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('renderização do Markdown', () => {
    it('cabeçalhos viram títulos', () => {
      renderizarPagina()

      expect(within(painel()).getByRole('heading', { name: 'Diário de Implementação — PED' })).toBeInTheDocument()
      expect(within(painel()).getByRole('heading', { name: '24/11/2026' })).toBeInTheDocument()
      expect(within(painel()).getByRole('heading', { name: 'Implementações' })).toBeInTheDocument()
    })

    it('tabela GFM vira <table> com cabeçalhos e células', () => {
      renderizarPagina()

      const tabela = within(painel()).getByRole('table')
      expect(within(tabela).getByRole('columnheader', { name: 'Coluna' })).toBeInTheDocument()
      expect(within(tabela).getByRole('columnheader', { name: 'Valor' })).toBeInTheDocument()
      expect(within(tabela).getByRole('cell', { name: 'Requisitos implementados' })).toBeInTheDocument()
      expect(within(tabela).getByRole('cell', { name: '113' })).toBeInTheDocument()
    })

    it('lista vira <ul> com itens', () => {
      renderizarPagina()

      const lista = within(painel()).getByRole('list')
      expect(within(lista).getAllByRole('listitem').map((item) => item.textContent?.trim())).toEqual([
        'primeiro item do diário',
        'segundo item do diário',
      ])
    })

    it('código inline e bloco de código viram <code> (o bloco dentro de <pre>)', () => {
      renderizarPagina()

      const area = painel()
      const codigos = Array.from(area.querySelectorAll('code')).map((codigo) => codigo.textContent?.trim())
      expect(codigos).toContain('codigoDoDiario')
      const bloco = area.querySelector('pre code')
      expect(bloco).not.toBeNull()
      expect(bloco?.textContent).toContain('npx vitest run --maxWorkers=2')
    })

    it('a tabela do índice da documentação também vira <table>', () => {
      renderizarPagina('/resumo?aba=documentacao')

      const tabela = within(painel()).getByRole('table')
      expect(within(tabela).getByRole('columnheader', { name: 'Data' })).toBeInTheDocument()
      expect(within(tabela).getByRole('cell', { name: 'Resumo do dia vinte e quatro' })).toBeInTheDocument()
    })

    it('não mostra a sintaxe do Markdown como texto', () => {
      renderizarPagina('/resumo?aba=documentacao')

      const texto = painel().textContent ?? ''
      expect(texto).not.toContain('## 24/11/2026')
      expect(texto).not.toContain('| --- |')
      expect(texto).not.toContain('](#2026-11-24)')
      expect(texto).not.toContain('<a id=')
    })
  })

  describe('âncoras internas do índice', () => {
    it('o link do índice continua um link para "#<data>", sem target', () => {
      renderizarPagina('/resumo?aba=documentacao')

      const link = within(painel()).getByRole('link', { name: '24/11/2026' })
      expect(link).toHaveAttribute('href', '#2026-11-24')
      expect(link).not.toHaveAttribute('target')
      expect(within(painel()).getByRole('link', { name: '19/11/2026' })).toHaveAttribute('href', '#2026-11-19')
    })

    it.each(['2026-11-24', '2026-11-19'])('existe no painel um único elemento com id "%s" (destino do link)', (id) => {
      renderizarPagina('/resumo?aba=documentacao')

      expect(painel().querySelectorAll(`[id="${id}"]`)).toHaveLength(1)
      expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1)
    })

    it('o destino fica junto da seção do dia: antes do texto dela e depois do índice', () => {
      renderizarPagina('/resumo?aba=documentacao')

      const area = painel()
      const destino = area.querySelector('[id="2026-11-24"]')
      expect(destino).not.toBeNull()
      const indice = within(area).getByRole('table')
      const textoDoDia = within(area).getByText('Texto do dia vinte e quatro na documentação.')
      const textoDoOutroDia = within(area).getByText('Texto do dia dezenove na documentação.')
      const outroDestino = area.querySelector('[id="2026-11-19"]')

      // DOCUMENT_POSITION_FOLLOWING (4): o argumento vem depois do nó.
      expect(indice.compareDocumentPosition(destino!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(destino!.compareDocumentPosition(textoDoDia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(textoDoDia.compareDocumentPosition(outroDestino!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(outroDestino!.compareDocumentPosition(textoDoOutroDia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('clicar num link do índice não sai da página nem troca de aba', async () => {
      const user = usuarioRapido()
      const { roteador } = renderizarPagina('/resumo?aba=documentacao')

      await user.click(within(painel()).getByRole('link', { name: '19/11/2026' }))

      expect(roteador.state.location.pathname).toBe('/resumo')
      expect(abaDaUrl(roteador)).toBe('documentacao')
      expect(aba(ABA_DOCUMENTACAO)).toHaveAttribute('aria-selected', 'true')
      expect(within(screen.getByRole('tabpanel', { name: ABA_DOCUMENTACAO })).getByText('Texto do dia dezenove na documentação.')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Resumo do projeto' })).toBeInTheDocument()
    })
  })

  describe('outros links', () => {
    it('link externo (https) abre em nova aba com rel="noopener noreferrer"', () => {
      renderizarPagina('/resumo?aba=documentacao')

      const link = within(painel()).getByRole('link', { name: 'site do Vite' })
      expect(link).toHaveAttribute('href', 'https://vite.dev/guide/')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
    })

    it.each(['plano de implementação', 'arquivo de rotas', 'link perigoso'])(
      'link para arquivo do projeto ou destino não seguro ("%s") aparece só como texto, sem link',
      (texto) => {
        renderizarPagina('/resumo?aba=documentacao')

        expect(within(painel()).queryByRole('link', { name: texto })).not.toBeInTheDocument()
        expect(painel().textContent).toContain(texto)
      },
    )

    it('nenhum link do painel leva a um arquivo relativo, a outro .md ou a javascript:', () => {
      const { container } = renderizarPagina('/resumo?aba=documentacao')

      for (const link of Array.from(container.querySelectorAll('a[href]'))) {
        const href = link.getAttribute('href') ?? ''
        expect(href.startsWith('#') || /^https?:\/\//i.test(href)).toBe(true)
      }
    })
  })

  describe('HTML cru no Markdown', () => {
    it('<script>, <img onerror> e <a> com eventos não viram elementos nem são executados', () => {
      const { container } = renderizarPagina('/resumo?aba=documentacao')

      const area = painel()
      expect(within(area).getByText('Texto do dia vinte e quatro na documentação.')).toBeInTheDocument()
      expect(within(area).getByText('Parágrafo depois do HTML cru.')).toBeInTheDocument()
      expect(container.querySelector('script')).toBeNull()
      expect(area.querySelector('img')).toBeNull()
      expect(container.querySelector('[onerror]')).toBeNull()
      expect(container.querySelector('[onmouseover]')).toBeNull()
      expect(container.querySelector('a[href^="javascript"]')).toBeNull()
      expect(window.__resumoExecutado).toBeUndefined()
    })

    it('o HTML cru não aparece como texto', () => {
      renderizarPagina('/resumo?aba=documentacao')

      const texto = painel().textContent ?? ''
      expect(texto).not.toContain('<script>')
      expect(texto).not.toContain('onerror')
      expect(texto).not.toContain('window.__resumoExecutado')
    })
  })
})
