import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TextoTruncado } from './TextoTruncado'

const URL_LONGA = 'https://erp.exemplo.com.br/api/v1/relatorios/faturamento-liquido?filial={filial}&inicio={dataInicial}&fim={dataFinal}'

/** Medidas simuladas no protótipo (o jsdom não faz layout: scrollWidth e clientWidth são 0). */
let medidas = { scrollWidth: 0, clientWidth: 0 }

function definirMedidas(scrollWidth: number, clientWidth: number) {
  medidas = { scrollWidth, clientWidth }
}

const descritorScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')
const descritorClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

/** ResizeObserver falso: guarda as instâncias para disparar o callback e conferir observe/disconnect. */
class ResizeObserverFalso {
  static instancias: ResizeObserverFalso[] = []
  readonly callback: ResizeObserverCallback
  readonly observe = vi.fn<(alvo: Element) => void>()
  readonly unobserve = vi.fn<(alvo: Element) => void>()
  readonly disconnect = vi.fn<() => void>()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverFalso.instancias.push(this)
  }

  disparar() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

/**
 * F1.19 — Texto truncado com esmaecer e reticências (src/components/TextoTruncado.tsx).
 * Interface: TextoTruncado({ texto: string, className?: string }) → <span class="texto-truncado ...">
 * com o texto completo no DOM e no title; data-cortado="true" só quando scrollWidth > clientWidth,
 * medido na montagem, na troca do texto e a cada callback do ResizeObserver (quando existe).
 */
describe('F1.19 — Texto truncado com esmaecer e reticências', () => {
  beforeEach(() => {
    definirMedidas(0, 0)
    ResizeObserverFalso.instancias = []
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => medidas.scrollWidth })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => medidas.clientWidth })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // No jsdom as medidas ficam em Element.prototype; sem descritor próprio, basta remover a sombra.
    if (descritorScroll) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', descritorScroll)
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth')
    if (descritorClient) Object.defineProperty(HTMLElement.prototype, 'clientWidth', descritorClient)
    else Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  })

  describe('renderização', () => {
    it('mostra o texto completo no DOM e no title', () => {
      render(<TextoTruncado texto={URL_LONGA} />)

      const elemento = screen.getByText(URL_LONGA)
      expect(elemento).toHaveTextContent(URL_LONGA)
      expect(elemento).toHaveAttribute('title', URL_LONGA)
    })

    it('tem a classe texto-truncado e repassa a className recebida', () => {
      render(<TextoTruncado texto="abc" className="minha-classe outra" />)

      const elemento = screen.getByText('abc')
      expect(elemento).toHaveClass('texto-truncado')
      expect(elemento).toHaveClass('minha-classe')
      expect(elemento).toHaveClass('outra')
    })

    it('sem className, só a classe texto-truncado', () => {
      render(<TextoTruncado texto="abc" />)

      expect(screen.getByText('abc').getAttribute('class')).toBe('texto-truncado')
    })
  })

  describe('detecção do corte', () => {
    it('texto que cabe (scrollWidth igual a clientWidth) não marca data-cortado', () => {
      definirMedidas(200, 200)
      render(<TextoTruncado texto="curto" />)

      expect(screen.getByText('curto')).not.toHaveAttribute('data-cortado')
    })

    it('texto menor que o espaço não marca data-cortado', () => {
      definirMedidas(80, 200)
      render(<TextoTruncado texto="curto" />)

      expect(screen.getByText('curto')).not.toHaveAttribute('data-cortado')
    })

    it('texto que passa do espaço (scrollWidth > clientWidth) marca data-cortado="true" já na montagem', () => {
      definirMedidas(201, 200)
      render(<TextoTruncado texto={URL_LONGA} />)

      expect(screen.getByText(URL_LONGA)).toHaveAttribute('data-cortado', 'true')
    })

    it('cortado, o texto completo continua no DOM e no title', () => {
      definirMedidas(900, 200)
      render(<TextoTruncado texto={URL_LONGA} />)

      const elemento = screen.getByText(URL_LONGA)
      expect(elemento).toHaveTextContent(URL_LONGA)
      expect(elemento).toHaveAttribute('title', URL_LONGA)
    })

    it('trocar o texto remede: de cortado para que cabe remove data-cortado e atualiza o title', () => {
      definirMedidas(900, 200)
      const { rerender } = render(<TextoTruncado texto={URL_LONGA} />)
      expect(screen.getByText(URL_LONGA)).toHaveAttribute('data-cortado', 'true')

      definirMedidas(100, 200)
      rerender(<TextoTruncado texto="https://curta" />)

      const elemento = screen.getByText('https://curta')
      expect(elemento).not.toHaveAttribute('data-cortado')
      expect(elemento).toHaveAttribute('title', 'https://curta')
    })

    it('trocar o texto remede: de que cabe para cortado marca data-cortado', () => {
      definirMedidas(100, 200)
      const { rerender } = render(<TextoTruncado texto="https://curta" />)
      expect(screen.getByText('https://curta')).not.toHaveAttribute('data-cortado')

      definirMedidas(900, 200)
      rerender(<TextoTruncado texto={URL_LONGA} />)

      expect(screen.getByText(URL_LONGA)).toHaveAttribute('data-cortado', 'true')
    })
  })

  describe('com ResizeObserver', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', ResizeObserverFalso)
    })

    it('observa o próprio elemento', () => {
      render(<TextoTruncado texto={URL_LONGA} />)

      expect(ResizeObserverFalso.instancias).toHaveLength(1)
      expect(ResizeObserverFalso.instancias[0].observe).toHaveBeenCalledWith(screen.getByText(URL_LONGA))
    })

    it('o callback do observer remede: a coluna estreita marca o corte e alargar remove', () => {
      definirMedidas(300, 400)
      render(<TextoTruncado texto={URL_LONGA} />)
      const elemento = screen.getByText(URL_LONGA)
      expect(elemento).not.toHaveAttribute('data-cortado')

      definirMedidas(300, 150)
      act(() => ResizeObserverFalso.instancias[0].disparar())
      expect(elemento).toHaveAttribute('data-cortado', 'true')

      definirMedidas(300, 500)
      act(() => ResizeObserverFalso.instancias[0].disparar())
      expect(elemento).not.toHaveAttribute('data-cortado')
    })

    it('desconecta o observer ao desmontar', () => {
      const { unmount } = render(<TextoTruncado texto={URL_LONGA} />)
      const observador = ResizeObserverFalso.instancias[0]
      expect(observador.disconnect).not.toHaveBeenCalled()

      unmount()

      expect(observador.disconnect).toHaveBeenCalledTimes(1)
    })

    it('ao trocar o texto, desconecta o observer anterior e observa de novo', () => {
      const { rerender } = render(<TextoTruncado texto={URL_LONGA} />)
      const primeiro = ResizeObserverFalso.instancias[0]

      rerender(<TextoTruncado texto="https://curta" />)

      expect(primeiro.disconnect).toHaveBeenCalledTimes(1)
      const ultimo = ResizeObserverFalso.instancias.at(-1)!
      expect(ultimo).not.toBe(primeiro)
      expect(ultimo.observe).toHaveBeenCalledWith(screen.getByText('https://curta'))
      expect(ultimo.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('sem ResizeObserver', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', undefined)
    })

    it('mede uma vez na montagem sem erro e marca o corte', () => {
      definirMedidas(900, 200)

      expect(() => render(<TextoTruncado texto={URL_LONGA} />)).not.toThrow()
      expect(screen.getByText(URL_LONGA)).toHaveAttribute('data-cortado', 'true')
    })

    it('troca de texto e desmontagem não quebram', () => {
      definirMedidas(100, 200)
      const { rerender, unmount } = render(<TextoTruncado texto="https://curta" />)
      expect(screen.getByText('https://curta')).not.toHaveAttribute('data-cortado')

      definirMedidas(900, 200)
      rerender(<TextoTruncado texto={URL_LONGA} />)
      expect(screen.getByText(URL_LONGA)).toHaveAttribute('data-cortado', 'true')

      expect(() => unmount()).not.toThrow()
    })
  })
})
