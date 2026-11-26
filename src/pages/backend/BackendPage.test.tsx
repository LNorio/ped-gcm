import { render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usuarioRapido } from '../../test/usuario'
import { BackendPage } from './BackendPage'
import type { DocumentoBackend } from './documentosBackend'

/**
 * F2.13 — Página pública /backend com a documentação trocada com o back-end (unitário da página).
 *
 * Os documentos são controlados pelo teste: `DOCUMENTOS_BACKEND` é substituído por uma lista fixa (os
 * documentos reais mudam com o tempo e têm o próprio teste em `documentosBackend.test.ts`).
 */
const { DOCUMENTOS } = vi.hoisted(() => {
  const documentos: DocumentoBackend[] = [
    {
      id: 'PENDENCIAS-backend-2026-11-25',
      arquivo: 'PENDENCIAS-backend-2026-11-25.md',
      titulo: 'O que ainda falta do back-end',
      data: '2026-11-25',
      conteudo: [
        '# O que ainda falta do back-end',
        '',
        'Texto de abertura com `codigoInline` no meio.',
        '',
        '## Rotas pendentes',
        '',
        '| Rota | Situação |',
        '| --- | --- |',
        '| GET /api/ped/inicio | Aguardando |',
        '',
        '- primeiro item da lista',
        '- segundo item da lista',
        '',
        '```json',
        '{ "chave": "valor" }',
        '```',
        '',
        'Veja a [contraproposta dos alertas](CONTRAPROPOSTA-alertas-menu.md) e o [Swagger do back-end](https://exemplo.com/swagger).',
        '',
      ].join('\n'),
    },
    {
      id: 'PENDENCIAS-backend-2026-11-24',
      arquivo: 'PENDENCIAS-backend-2026-11-24.md',
      titulo: 'Pendências de 24/11',
      data: '2026-11-24',
      conteudo: [
        '# Pendências de 24/11',
        '',
        'Parágrafo antes do HTML cru.',
        '',
        '<script>window.__backendExecutado = true</script>',
        '',
        '<img src="x" onerror="window.__backendExecutado = true">',
        '',
        'Parágrafo depois do HTML cru.',
        '',
      ].join('\n'),
    },
    {
      id: 'CONTRAPROPOSTA-alertas-menu',
      arquivo: 'CONTRAPROPOSTA-alertas-menu.md',
      titulo: 'Contraproposta: alertas do menu',
      data: null,
      conteudo: '# Contraproposta: alertas do menu\n\nConteúdo da contraproposta dos alertas.\n',
    },
  ]
  return { DOCUMENTOS: documentos }
})

vi.mock('./documentosBackend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./documentosBackend')>()),
  DOCUMENTOS_BACKEND: DOCUMENTOS,
}))

declare global {
  interface Window {
    __backendExecutado?: boolean
  }
}

function renderizarPagina(caminho = '/backend') {
  const roteador = createMemoryRouter([{ path: '/backend', element: <BackendPage /> }], { initialEntries: [caminho] })
  const resultado = render(<RouterProvider router={roteador} />)
  return { ...resultado, roteador }
}

const docDaUrl = (roteador: ReturnType<typeof createMemoryRouter>) =>
  new URLSearchParams(roteador.state.location.search).get('doc')

const listaDeDocumentos = () => screen.getByRole('navigation', { name: 'Documentos' })
const conteudo = () => screen.getByRole('article')

describe('F2.13 — Página de documentação para o back-end (BackendPage)', () => {
  beforeEach(() => {
    document.title = 'PED - Sistema de Cadastro'
    delete window.__backendExecutado
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o <h1> "Documentação para o back-end" e o título do documento "Back-end · PED"', async () => {
    renderizarPagina()

    expect(screen.getByRole('heading', { level: 1, name: 'Documentação para o back-end' })).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe('Back-end · PED'))
  })

  it('não chama a API', () => {
    const fetchFalso = vi.spyOn(globalThis, 'fetch')
    renderizarPagina()

    expect(fetchFalso).not.toHaveBeenCalled()
  })

  describe('lista de documentos', () => {
    it('tem um link por documento, com o título, na ordem da lista', () => {
      renderizarPagina()

      const links = within(listaDeDocumentos()).getAllByRole('link')
      expect(links.map((link) => link.textContent?.trim())).toEqual([
        'O que ainda falta do back-end',
        'Pendências de 24/11',
        'Contraproposta: alertas do menu',
      ])
    })

    it('cada link aponta para /backend?doc=<arquivo sem .md>', () => {
      renderizarPagina()

      const nav = listaDeDocumentos()
      expect(within(nav).getByRole('link', { name: 'O que ainda falta do back-end' })).toHaveAttribute(
        'href',
        '/backend?doc=PENDENCIAS-backend-2026-11-25',
      )
      expect(within(nav).getByRole('link', { name: 'Pendências de 24/11' })).toHaveAttribute(
        'href',
        '/backend?doc=PENDENCIAS-backend-2026-11-24',
      )
      expect(within(nav).getByRole('link', { name: 'Contraproposta: alertas do menu' })).toHaveAttribute(
        'href',
        '/backend?doc=CONTRAPROPOSTA-alertas-menu',
      )
    })
  })

  describe('documento padrão', () => {
    it('sem ?doc, abre o primeiro documento da lista (o mais recente)', () => {
      renderizarPagina('/backend')

      expect(within(conteudo()).getByText(/Texto de abertura com/)).toBeInTheDocument()
      expect(screen.queryByText('Conteúdo da contraproposta dos alertas.')).not.toBeInTheDocument()
      expect(within(listaDeDocumentos()).getByRole('link', { name: 'O que ainda falta do back-end' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })

    it('só o documento aberto fica marcado com aria-current="page"', () => {
      renderizarPagina('/backend')

      const nav = listaDeDocumentos()
      expect(within(nav).getByRole('link', { name: 'Pendências de 24/11' })).not.toHaveAttribute('aria-current')
      expect(within(nav).getByRole('link', { name: 'Contraproposta: alertas do menu' })).not.toHaveAttribute('aria-current')
    })

    it('com ?doc válido, abre esse documento', () => {
      renderizarPagina('/backend?doc=CONTRAPROPOSTA-alertas-menu')

      expect(within(conteudo()).getByText('Conteúdo da contraproposta dos alertas.')).toBeInTheDocument()
      expect(screen.queryByText(/Texto de abertura com/)).not.toBeInTheDocument()
      expect(within(listaDeDocumentos()).getByRole('link', { name: 'Contraproposta: alertas do menu' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })

  it('clicar em um documento da lista troca o conteúdo e leva a escolha para a URL (?doc)', async () => {
    const user = usuarioRapido()
    const { roteador } = renderizarPagina('/backend')

    await user.click(within(listaDeDocumentos()).getByRole('link', { name: 'Contraproposta: alertas do menu' }))

    expect(await within(conteudo()).findByText('Conteúdo da contraproposta dos alertas.')).toBeInTheDocument()
    expect(screen.queryByText(/Texto de abertura com/)).not.toBeInTheDocument()
    expect(roteador.state.location.pathname).toBe('/backend')
    expect(docDaUrl(roteador)).toBe('CONTRAPROPOSTA-alertas-menu')
    expect(within(listaDeDocumentos()).getByRole('link', { name: 'Contraproposta: alertas do menu' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  describe('?doc inexistente', () => {
    it('mostra "Documento não encontrado." e a lista continua visível', () => {
      renderizarPagina('/backend?doc=NAO-EXISTE')

      expect(screen.getByText('Documento não encontrado.')).toBeInTheDocument()
      expect(within(listaDeDocumentos()).getAllByRole('link')).toHaveLength(3)
      expect(screen.getByRole('heading', { level: 1, name: 'Documentação para o back-end' })).toBeInTheDocument()
    })

    it('não mostra outro documento no lugar nem marca nenhum como aberto', () => {
      renderizarPagina('/backend?doc=NAO-EXISTE')

      expect(screen.queryByText(/Texto de abertura com/)).not.toBeInTheDocument()
      for (const link of within(listaDeDocumentos()).getAllByRole('link')) expect(link).not.toHaveAttribute('aria-current')
    })

    it('escolher um documento da lista sai do aviso', async () => {
      const user = usuarioRapido()
      renderizarPagina('/backend?doc=NAO-EXISTE')

      await user.click(within(listaDeDocumentos()).getByRole('link', { name: 'Pendências de 24/11' }))

      expect(await within(conteudo()).findByText('Parágrafo antes do HTML cru.')).toBeInTheDocument()
      expect(screen.queryByText('Documento não encontrado.')).not.toBeInTheDocument()
    })
  })

  describe('renderização do Markdown', () => {
    it('cabeçalhos viram títulos', () => {
      renderizarPagina()

      expect(within(conteudo()).getByRole('heading', { name: 'O que ainda falta do back-end' })).toBeInTheDocument()
      expect(within(conteudo()).getByRole('heading', { level: 2, name: 'Rotas pendentes' })).toBeInTheDocument()
    })

    it('tabela GFM vira <table> com cabeçalhos e células', () => {
      renderizarPagina()

      const tabela = within(conteudo()).getByRole('table')
      expect(within(tabela).getByRole('columnheader', { name: 'Rota' })).toBeInTheDocument()
      expect(within(tabela).getByRole('columnheader', { name: 'Situação' })).toBeInTheDocument()
      expect(within(tabela).getByRole('cell', { name: 'GET /api/ped/inicio' })).toBeInTheDocument()
      expect(within(tabela).getByRole('cell', { name: 'Aguardando' })).toBeInTheDocument()
    })

    it('lista vira <ul> com itens', () => {
      renderizarPagina()

      const lista = within(conteudo()).getByRole('list')
      expect(within(lista).getAllByRole('listitem').map((item) => item.textContent?.trim())).toEqual([
        'primeiro item da lista',
        'segundo item da lista',
      ])
    })

    it('código inline e bloco de código viram <code> (o bloco dentro de <pre>)', () => {
      renderizarPagina()

      const artigo = conteudo()
      const codigos = Array.from(artigo.querySelectorAll('code')).map((codigo) => codigo.textContent?.trim())
      expect(codigos).toContain('codigoInline')
      const bloco = artigo.querySelector('pre code')
      expect(bloco).not.toBeNull()
      expect(bloco?.textContent).toContain('{ "chave": "valor" }')
    })

    it('não mostra a sintaxe do Markdown como texto', () => {
      renderizarPagina()

      const texto = conteudo().textContent ?? ''
      expect(texto).not.toContain('## Rotas pendentes')
      expect(texto).not.toContain('| --- |')
      expect(texto).not.toContain('](CONTRAPROPOSTA-alertas-menu.md)')
    })
  })

  describe('links dentro do documento', () => {
    it('link relativo para outro documento (.md) leva a /backend?doc=<nome sem .md>', () => {
      renderizarPagina()

      const link = within(conteudo()).getByRole('link', { name: 'contraproposta dos alertas' })
      expect(link).toHaveAttribute('href', '/backend?doc=CONTRAPROPOSTA-alertas-menu')
      expect(link).not.toHaveAttribute('target')
    })

    it('clicar no link relativo abre o outro documento na própria página e atualiza a URL', async () => {
      const user = usuarioRapido()
      const { roteador } = renderizarPagina()

      await user.click(within(conteudo()).getByRole('link', { name: 'contraproposta dos alertas' }))

      expect(await within(conteudo()).findByText('Conteúdo da contraproposta dos alertas.')).toBeInTheDocument()
      expect(roteador.state.location.pathname).toBe('/backend')
      expect(docDaUrl(roteador)).toBe('CONTRAPROPOSTA-alertas-menu')
    })

    it('link externo abre em nova aba com rel="noopener noreferrer"', () => {
      renderizarPagina()

      const link = within(conteudo()).getByRole('link', { name: 'Swagger do back-end' })
      expect(link).toHaveAttribute('href', 'https://exemplo.com/swagger')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
    })
  })

  describe('HTML cru no Markdown', () => {
    it('<script> e <img onerror> não viram elementos nem são executados', () => {
      const { container } = renderizarPagina('/backend?doc=PENDENCIAS-backend-2026-11-24')

      const artigo = conteudo()
      expect(within(artigo).getByText('Parágrafo antes do HTML cru.')).toBeInTheDocument()
      expect(within(artigo).getByText('Parágrafo depois do HTML cru.')).toBeInTheDocument()
      expect(container.querySelector('script')).toBeNull()
      expect(artigo.querySelector('img')).toBeNull()
      expect(container.querySelector('[onerror]')).toBeNull()
      expect(window.__backendExecutado).toBeUndefined()
    })
  })
})
