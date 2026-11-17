import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usuarioRapido } from '../test/usuario'
import { MenuAcoes, type ItemMenuAcoes } from './MenuAcoes'

const ROTULO = 'Ações do dado externo Faturamento'

function criarItens() {
  const verDetalhes = vi.fn<() => void>()
  const desativar = vi.fn<() => void>()
  const excluir = vi.fn<() => void>()
  const itens: ItemMenuAcoes[] = [
    { rotulo: 'Ver detalhes', onSelecionar: verDetalhes },
    { rotulo: 'Desativar', onSelecionar: desativar },
    { rotulo: 'Excluir', onSelecionar: excluir, perigo: true },
  ]
  return { itens, verDetalhes, desativar, excluir }
}

describe('F1.16 — MenuAcoes (menu de ações por linha)', () => {
  const gatilho = (rotulo = ROTULO) => screen.getByRole('button', { name: rotulo })
  const item = (nome: string) => screen.getByRole('menuitem', { name: nome })

  describe('gatilho', () => {
    it('com "itens" vazio não renderiza nada', () => {
      const { container } = render(<MenuAcoes rotulo={ROTULO} itens={[]} />)

      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('é um botão nomeado pelo "rotulo", com aria-haspopup="menu" e aria-expanded="false", e o menu fechado', () => {
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)

      expect(gatilho()).toHaveAttribute('aria-haspopup', 'menu')
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    })

    it('mostra o ícone de três pontos como svg decorativo (aria-hidden), sem texto visível', () => {
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)

      const icone = gatilho().querySelector('svg')
      expect(icone).not.toBeNull()
      expect(icone).toHaveAttribute('aria-hidden', 'true')
      expect(gatilho().textContent?.trim()).toBe('')
    })
  })

  describe('abrir', () => {
    it('o clique abre o menu flutuante com os itens na ordem recebida e aria-expanded="true"', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)

      await user.click(gatilho())

      const menu = screen.getByRole('menu')
      expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent?.trim())).toEqual([
        'Ver detalhes',
        'Desativar',
        'Excluir',
      ])
      expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
    })

    it('ao abrir, o foco vai para o primeiro item', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)

      await user.click(gatilho())

      expect(item('Ver detalhes')).toHaveFocus()
    })

    it('abre também pelo teclado (Enter no gatilho focado), com o foco no primeiro item', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)

      gatilho().focus()
      await user.keyboard('{Enter}')

      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(item('Ver detalhes')).toHaveFocus()
    })

    it('item com "perigo" recebe a classe de destaque menu-acoes__item--perigo; os demais não', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)

      await user.click(gatilho())

      expect(item('Excluir')).toHaveClass('menu-acoes__item--perigo')
      expect(item('Ver detalhes')).not.toHaveClass('menu-acoes__item--perigo')
      expect(item('Desativar')).not.toHaveClass('menu-acoes__item--perigo')
    })
  })

  describe('navegação pelo teclado', () => {
    it('seta para baixo avança e, no último item, volta ao primeiro', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)
      await user.click(gatilho())

      await user.keyboard('{ArrowDown}')
      expect(item('Desativar')).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(item('Excluir')).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(item('Ver detalhes')).toHaveFocus()
    })

    it('seta para cima recua e, no primeiro item, vai para o último', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)
      await user.click(gatilho())

      await user.keyboard('{ArrowUp}')
      expect(item('Excluir')).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(item('Desativar')).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(item('Ver detalhes')).toHaveFocus()
    })

    it('End vai para o último item e Home para o primeiro', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)
      await user.click(gatilho())

      await user.keyboard('{End}')
      expect(item('Excluir')).toHaveFocus()
      await user.keyboard('{Home}')
      expect(item('Ver detalhes')).toHaveFocus()
    })

    it('com um único item, as setas mantêm o foco nele', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={[{ rotulo: 'Ver detalhes', onSelecionar: vi.fn() }]} />)
      await user.click(gatilho())

      await user.keyboard('{ArrowDown}')
      expect(item('Ver detalhes')).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(item('Ver detalhes')).toHaveFocus()
    })
  })

  describe('fechar', () => {
    it('Esc fecha o menu e devolve o foco ao gatilho, sem selecionar nada', async () => {
      const user = usuarioRapido()
      const { itens, verDetalhes, desativar, excluir } = criarItens()
      render(<MenuAcoes rotulo={ROTULO} itens={itens} />)
      await user.click(gatilho())

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
      expect(gatilho()).toHaveFocus()
      expect(verDetalhes).not.toHaveBeenCalled()
      expect(desativar).not.toHaveBeenCalled()
      expect(excluir).not.toHaveBeenCalled()
    })

    it('clicar fora fecha o menu, sem selecionar nada', async () => {
      const user = usuarioRapido()
      const { itens, verDetalhes, desativar, excluir } = criarItens()
      render(
        <div>
          <p>Fora do menu</p>
          <MenuAcoes rotulo={ROTULO} itens={itens} />
        </div>,
      )
      await user.click(gatilho())

      await user.click(screen.getByText('Fora do menu'))

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
      expect(verDetalhes).not.toHaveBeenCalled()
      expect(desativar).not.toHaveBeenCalled()
      expect(excluir).not.toHaveBeenCalled()
    })

    it('Tab fecha o menu, sem selecionar nada', async () => {
      const user = usuarioRapido()
      const { itens, verDetalhes, desativar, excluir } = criarItens()
      render(<MenuAcoes rotulo={ROTULO} itens={itens} />)
      await user.click(gatilho())

      await user.tab()

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
      expect(verDetalhes).not.toHaveBeenCalled()
      expect(desativar).not.toHaveBeenCalled()
      expect(excluir).not.toHaveBeenCalled()
    })

    it('depois de fechado, pode ser aberto de novo, com o foco outra vez no primeiro item', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} />)
      await user.click(gatilho())
      await user.keyboard('{End}')
      await user.keyboard('{Escape}')

      await user.click(gatilho())

      expect(screen.getAllByRole('menu')).toHaveLength(1)
      expect(item('Ver detalhes')).toHaveFocus()
    })
  })

  describe('selecionar', () => {
    it('clicar num item chama só o onSelecionar dele, uma vez, fecha o menu e devolve o foco ao gatilho', async () => {
      const user = usuarioRapido()
      const { itens, verDetalhes, desativar, excluir } = criarItens()
      render(<MenuAcoes rotulo={ROTULO} itens={itens} />)
      await user.click(gatilho())

      await user.click(item('Desativar'))

      expect(desativar).toHaveBeenCalledTimes(1)
      expect(verDetalhes).not.toHaveBeenCalled()
      expect(excluir).not.toHaveBeenCalled()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
      expect(gatilho()).toHaveFocus()
    })

    it('Enter no item focado seleciona o item, fecha o menu e devolve o foco ao gatilho', async () => {
      const user = usuarioRapido()
      const { itens, verDetalhes, desativar, excluir } = criarItens()
      render(<MenuAcoes rotulo={ROTULO} itens={itens} />)
      await user.click(gatilho())

      await user.keyboard('{End}')
      await user.keyboard('{Enter}')

      expect(excluir).toHaveBeenCalledTimes(1)
      expect(verDetalhes).not.toHaveBeenCalled()
      expect(desativar).not.toHaveBeenCalled()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(gatilho()).toHaveFocus()
    })
  })

  describe('rótulo visível (rotuloVisivel)', () => {
    it('com "rotuloVisivel", o gatilho mostra o texto e é nomeado por ele quando "rotulo" é o mesmo texto', () => {
      render(<MenuAcoes rotulo="Exportar" rotuloVisivel="Exportar" itens={criarItens().itens} />)

      const botao = screen.getByRole('button', { name: 'Exportar' })
      expect(botao).toHaveTextContent('Exportar')
      expect(botao).toHaveAttribute('aria-haspopup', 'menu')
      expect(botao).toHaveAttribute('aria-expanded', 'false')
    })

    it('o texto visível aparece uma única vez e fica dentro do próprio gatilho', () => {
      render(<MenuAcoes rotulo="Exportar" rotuloVisivel="Exportar" itens={criarItens().itens} />)

      const textos = screen.getAllByText('Exportar')
      expect(textos).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Exportar' })).toContainElement(textos[0])
    })

    it('clicar no texto visível abre o menu, com o foco no primeiro item', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo="Exportar" rotuloVisivel="Exportar" itens={criarItens().itens} />)

      await user.click(screen.getByText('Exportar'))

      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Exportar' })).toHaveAttribute('aria-expanded', 'true')
      expect(item('Ver detalhes')).toHaveFocus()
    })

    it('com "rotulo" diferente do texto visível, o nome acessível continua sendo o "rotulo"', () => {
      render(<MenuAcoes rotulo="Exportar imagens" rotuloVisivel="Exportar" itens={criarItens().itens} />)

      const botao = screen.getByRole('button', { name: 'Exportar imagens' })
      expect(botao).toHaveTextContent('Exportar')
      expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
    })

    it('com "rotuloVisivel", selecionar um item chama o onSelecionar e devolve o foco ao gatilho', async () => {
      const user = usuarioRapido()
      const { itens, desativar } = criarItens()
      render(<MenuAcoes rotulo="Exportar" rotuloVisivel="Exportar" itens={itens} />)

      await user.click(screen.getByText('Exportar'))
      await user.click(item('Desativar'))

      expect(desativar).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Exportar' })).toHaveFocus()
    })
  })

  describe('desabilitado', () => {
    it('com "desabilitado", o gatilho fica disabled', () => {
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} desabilitado />)

      expect(gatilho()).toBeDisabled()
    })

    it('com "desabilitado={false}", o gatilho fica habilitado e abre normalmente', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} desabilitado={false} />)

      expect(gatilho()).toBeEnabled()
      await user.click(gatilho())
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('desabilitado, o clique não abre o menu', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} desabilitado />)

      await user.click(gatilho())

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
    })

    it('desabilitado com "rotuloVisivel", clicar no texto não abre o menu', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo="Exportar" rotuloVisivel="Exportar" itens={criarItens().itens} desabilitado />)

      expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled()
      await user.click(screen.getByText('Exportar'))

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('desabilitado, o teclado (Enter e espaço no gatilho) não abre o menu', async () => {
      const user = usuarioRapido()
      render(<MenuAcoes rotulo={ROTULO} itens={criarItens().itens} desabilitado />)

      gatilho().focus()
      await user.keyboard('{Enter}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()

      gatilho().focus()
      await user.keyboard(' ')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('se "desabilitado" passa a true com o menu aberto, o menu fecha sem selecionar nada', async () => {
      const user = usuarioRapido()
      const { itens, verDetalhes, desativar, excluir } = criarItens()
      const { rerender } = render(<MenuAcoes rotulo={ROTULO} itens={itens} />)
      await user.click(gatilho())
      expect(screen.getByRole('menu')).toBeInTheDocument()

      rerender(<MenuAcoes rotulo={ROTULO} itens={itens} desabilitado />)

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
      expect(gatilho()).toBeDisabled()
      expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
      expect(verDetalhes).not.toHaveBeenCalled()
      expect(desativar).not.toHaveBeenCalled()
      expect(excluir).not.toHaveBeenCalled()
    })

    it('ao voltar a habilitado, o menu abre de novo, com o foco no primeiro item', async () => {
      const user = usuarioRapido()
      const { itens } = criarItens()
      const { rerender } = render(<MenuAcoes rotulo={ROTULO} itens={itens} desabilitado />)

      rerender(<MenuAcoes rotulo={ROTULO} itens={itens} desabilitado={false} />)
      expect(gatilho()).toBeEnabled()
      await user.click(gatilho())

      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(item('Ver detalhes')).toHaveFocus()
    })
  })

  describe('várias instâncias', () => {
    it('cada instância tem o seu menu; abrir o de outra linha fecha o primeiro (um menu aberto por vez)', async () => {
      const user = usuarioRapido()
      const primeiro = criarItens()
      const segundo = criarItens()
      render(
        <div>
          <MenuAcoes rotulo="Ações do dado externo Faturamento" itens={primeiro.itens} />
          <MenuAcoes rotulo="Ações do dado externo Cobertura" itens={segundo.itens} />
        </div>,
      )

      await user.click(gatilho('Ações do dado externo Faturamento'))
      expect(screen.getAllByRole('menu')).toHaveLength(1)

      await user.click(gatilho('Ações do dado externo Cobertura'))

      expect(screen.getAllByRole('menu')).toHaveLength(1)
      expect(gatilho('Ações do dado externo Faturamento')).toHaveAttribute('aria-expanded', 'false')
      expect(gatilho('Ações do dado externo Cobertura')).toHaveAttribute('aria-expanded', 'true')

      await user.click(item('Desativar'))
      expect(segundo.desativar).toHaveBeenCalledTimes(1)
      expect(primeiro.desativar).not.toHaveBeenCalled()
    })
  })
})
