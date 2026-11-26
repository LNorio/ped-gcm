import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef, useState, type ReactNode, type RefObject } from 'react'
import { describe, expect, it } from 'vitest'
import { usuarioRapido } from '../test/usuario'
import { Dialogo } from './Dialogo'

/**
 * F12.1 (RNF-05, revisão de acessibilidade de 24/11/2026) — foco do `Dialogo`.
 *
 * M2 — `iframe` (PDF embutido em `DialogoImagem` e na prévia): o `iframe` entra no ciclo do Tab do
 * diálogo (`SELETOR_FOCAVEIS`); Shift+Tab no primeiro focável vai para o `iframe` quando ele é o último,
 * e Tab no `iframe` (último) volta ao primeiro. No navegador, as teclas dentro do `iframe` vão para o
 * documento dele e não chegam ao `document` da página; por isso, enquanto o diálogo do topo estiver
 * aberto, o foco que chegar a um elemento **fora** do painel (como ao sair do `iframe` pelo Tab) volta
 * para dentro do diálogo.
 *
 * M3 — fechar quando o elemento que abriu o diálogo não existe mais (ex.: a linha excluída pelo
 * `MenuAcoes`): o foco vai para um destino estável e nunca fica no `<body>`:
 * 1. `focoAoFechar` (prop opcional, `RefObject<HTMLElement | null>`), se informada e ainda na página;
 * 2. senão, o `<h1>` da página (ou o `<main>` que o contém);
 * 3. sem `<h1>`, o `<main>`.
 * Se o elemento que abriu ainda existe, o foco volta para ele, como antes (F1.8).
 */
describe('F12.1 — Dialogo: foco com iframe e ao fechar sem o gatilho (M2, M3)', () => {
  describe('M2 — iframe no ciclo do Tab', () => {
    function renderizarComIframe(conteudo?: ReactNode) {
      render(
        <>
          <Dialogo aberto titulo="Imagem" onFechar={() => {}}>
            {conteudo ?? (
              <>
                <button type="button">Exportar</button>
                <iframe title="PDF da imagem" src="about:blank" />
              </>
            )}
          </Dialogo>
          <button type="button">Fora do diálogo</button>
        </>,
      )
      const dialogo = screen.getByRole('dialog', { name: 'Imagem' })
      return {
        dialogo,
        fechar: within(dialogo).getByRole('button', { name: 'Fechar' }),
        iframe: within(dialogo).getByTitle('PDF da imagem'),
      }
    }

    it('Shift+Tab no primeiro focável ("Fechar") vai para o iframe, último elemento do diálogo', async () => {
      const user = usuarioRapido()
      const { fechar, iframe } = renderizarComIframe()
      fechar.focus()

      await user.tab({ shift: true })

      expect(iframe).toHaveFocus()
    })

    it('Tab com o foco no iframe (último) volta ao primeiro focável ("Fechar")', () => {
      const { fechar, iframe } = renderizarComIframe()
      iframe.focus()
      expect(iframe).toHaveFocus()

      const evento = fireEvent.keyDown(iframe, { key: 'Tab' })

      expect(evento).toBe(false) // preventDefault: o diálogo controla o destino
      expect(fechar).toHaveFocus()
    })

    it('o foco que sai do iframe para um elemento fora do diálogo volta para dentro do diálogo', () => {
      const { dialogo, iframe } = renderizarComIframe()
      iframe.focus()

      act(() => {
        screen.getByRole('button', { name: 'Fora do diálogo' }).focus()
      })

      expect(dialogo.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).not.toBe(document.body)
    })

    it('com o iframe no meio, o foco que sai dele para fora do diálogo também volta para dentro', () => {
      const { dialogo, iframe } = renderizarComIframe(
        <>
          <iframe title="PDF da imagem" src="about:blank" />
          <a href="blob:teste/1">Abrir PDF em nova aba</a>
        </>,
      )
      iframe.focus()

      act(() => {
        screen.getByRole('button', { name: 'Fora do diálogo' }).focus()
      })

      expect(dialogo.contains(document.activeElement)).toBe(true)
    })

    it('sem diálogo aberto, o foco fora não é puxado de volta', () => {
      render(
        <>
          <Dialogo aberto={false} titulo="Imagem" onFechar={() => {}}>
            <iframe title="PDF da imagem" src="about:blank" />
          </Dialogo>
          <button type="button">Fora do diálogo</button>
        </>,
      )
      const fora = screen.getByRole('button', { name: 'Fora do diálogo' })

      act(() => {
        fora.focus()
      })

      expect(fora).toHaveFocus()
    })
  })

  describe('M3 — fechar quando o elemento que abriu não existe mais', () => {
    /**
     * Tela com o gatilho de uma "linha" que abre o diálogo; "Excluir" fecha o diálogo e remove a linha
     * (com o gatilho) na mesma atualização, como uma exclusão pelo menu de ações.
     */
    function Tela({
      comTitulo = true,
      comFocoAoFechar = false,
    }: {
      comTitulo?: boolean
      comFocoAoFechar?: boolean
    }) {
      const [aberto, setAberto] = useState(false)
      const [linha, setLinha] = useState(true)
      const destino = useRef<HTMLButtonElement>(null)
      const focoAoFechar: RefObject<HTMLElement | null> | undefined = comFocoAoFechar ? destino : undefined
      return (
        <main id="conteudo" tabIndex={-1}>
          {comTitulo ? <h1>Tipos</h1> : null}
          <button ref={destino} type="button">
            Novo tipo
          </button>
          {linha ? (
            <button type="button" onClick={() => setAberto(true)}>
              Ações da linha
            </button>
          ) : null}
          <Dialogo
            aberto={aberto}
            titulo="Excluir tipo"
            onFechar={() => setAberto(false)}
            focoAoFechar={focoAoFechar}
          >
            <button
              type="button"
              onClick={() => {
                setLinha(false)
                setAberto(false)
              }}
            >
              Excluir
            </button>
            <button type="button" onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </Dialogo>
        </main>
      )
    }

    it('com focoAoFechar, o foco vai para o elemento indicado', async () => {
      const user = usuarioRapido()
      render(<Tela comFocoAoFechar />)
      await user.click(screen.getByRole('button', { name: 'Ações da linha' }))

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ações da linha' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Novo tipo' })).toHaveFocus()
    })

    it('sem focoAoFechar, o foco vai para o <h1> da página (ou o <main> que o contém), nunca para o <body>', async () => {
      const user = usuarioRapido()
      render(<Tela />)
      await user.click(screen.getByRole('button', { name: 'Ações da linha' }))

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(document.activeElement).not.toBe(document.body)
      expect([screen.getByRole('heading', { level: 1, name: 'Tipos' }), screen.getByRole('main')]).toContain(document.activeElement)
    })

    it('sem <h1>, o foco vai para o <main>', async () => {
      const user = usuarioRapido()
      render(<Tela comTitulo={false} />)
      await user.click(screen.getByRole('button', { name: 'Ações da linha' }))

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))

      expect(screen.getByRole('main')).toHaveFocus()
    })

    it('com o gatilho ainda na página (Cancelar), o foco volta para ele, como antes', async () => {
      const user = usuarioRapido()
      render(<Tela comFocoAoFechar />)
      await user.click(screen.getByRole('button', { name: 'Ações da linha' }))

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(screen.getByRole('button', { name: 'Ações da linha' })).toHaveFocus()
    })
  })
})
