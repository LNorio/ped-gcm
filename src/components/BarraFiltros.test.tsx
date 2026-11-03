import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BarraFiltros } from './BarraFiltros'

const situacoes = [
  { valor: 'todas', rotulo: 'Todas', contagem: 10 },
  { valor: 'ativos', rotulo: 'Ativos', contagem: 7 },
  { valor: 'inativos', rotulo: 'Inativos', contagem: 3 },
  { valor: 'problemas', rotulo: 'Com problemas', contagem: 0 },
]

const tipos = [
  { valor: '1', rotulo: 'Comercial', contagem: 4 },
  { valor: '2', rotulo: 'Financeiro', contagem: 6 },
]

describe('F1.10 — BarraFiltros', () => {
  describe('busca', () => {
    it('exibe um campo de busca rotulado "Buscar" por padrão', () => {
      render(<BarraFiltros busca="" onBuscaChange={() => {}} />)

      expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeInTheDocument()
    })

    it('aceita rótulo e placeholder personalizados', () => {
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          rotuloBusca="Buscar apontamento"
          placeholderBusca="Nome, tipo, descrição ou tipo de valor"
        />,
      )

      expect(screen.getByRole('searchbox', { name: 'Buscar apontamento' })).toHaveAttribute(
        'placeholder',
        'Nome, tipo, descrição ou tipo de valor',
      )
    })

    it('exibe o valor atual da busca', () => {
      render(<BarraFiltros busca="cobertura" onBuscaChange={() => {}} />)

      expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('cobertura')
    })

    it('ao digitar, chama onBuscaChange com o texto digitado e a versão normalizada (sem acento e minúscula)', async () => {
      const user = userEvent.setup()
      const onBuscaChange = vi.fn()
      render(<BarraFiltros busca="" onBuscaChange={onBuscaChange} />)

      await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'Ç')

      expect(onBuscaChange).toHaveBeenLastCalledWith('Ç', 'c')
    })

    it('normaliza acentos e maiúsculas no segundo argumento', async () => {
      const user = userEvent.setup()
      const onBuscaChange = vi.fn()
      render(<BarraFiltros busca="Faturamento Líquid" onBuscaChange={onBuscaChange} />)

      await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'o')

      expect(onBuscaChange).toHaveBeenLastCalledWith('Faturamento Líquido', 'faturamento liquido')
    })
  })

  describe('situação (seletor com papel de lista)', () => {
    it('exibe as situações em um listbox rotulado "Situação", com uma opção por item e a contagem', () => {
      render(
        <BarraFiltros busca="" onBuscaChange={() => {}} situacoes={situacoes} situacao="todas" onSituacaoChange={() => {}} />,
      )

      const lista = screen.getByRole('listbox', { name: 'Situação' })
      const opcoes = within(lista).getAllByRole('option')
      expect(opcoes).toHaveLength(4)
      expect(within(lista).getByRole('option', { name: /Ativos/ })).toHaveTextContent('7')
      expect(within(lista).getByRole('option', { name: /Com problemas/ })).toHaveTextContent('0')
    })

    it('marca a situação selecionada com aria-selected', () => {
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          situacoes={situacoes}
          situacao="ativos"
          onSituacaoChange={() => {}}
        />,
      )

      const lista = screen.getByRole('listbox', { name: 'Situação' })
      expect(within(lista).getByRole('option', { name: /Ativos/ })).toHaveAttribute('aria-selected', 'true')
      expect(within(lista).getByRole('option', { name: /Todas/ })).toHaveAttribute('aria-selected', 'false')
      expect(within(lista).getByRole('option', { name: /Inativos/ })).toHaveAttribute('aria-selected', 'false')
    })

    it('ao clicar em uma situação, chama onSituacaoChange com o valor', async () => {
      const user = userEvent.setup()
      const onSituacaoChange = vi.fn()
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          situacoes={situacoes}
          situacao="todas"
          onSituacaoChange={onSituacaoChange}
        />,
      )

      await user.click(screen.getByRole('option', { name: /Inativos/ }))

      expect(onSituacaoChange).toHaveBeenCalledWith('inativos')
    })

    it('aceita rótulo personalizado para o seletor de situação', () => {
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          situacoes={situacoes}
          situacao="todas"
          onSituacaoChange={() => {}}
          rotuloSituacoes="Situação do período"
        />,
      )

      expect(screen.getByRole('listbox', { name: 'Situação do período' })).toBeInTheDocument()
    })

    it('não exibe o seletor de situação quando não há situações', () => {
      render(<BarraFiltros busca="" onBuscaChange={() => {}} />)

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    describe('navegação por teclado no listbox', () => {
      function renderizarComSituacao(situacao: string, onSituacaoChange = vi.fn()) {
        render(
          <BarraFiltros
            busca=""
            onBuscaChange={() => {}}
            situacoes={situacoes}
            situacao={situacao}
            onSituacaoChange={onSituacaoChange}
          />,
        )
        return { onSituacaoChange, opcao: (nome: RegExp) => screen.getByRole('option', { name: nome }) }
      }

      it('somente a opção selecionada entra na ordem de tabulação (tabIndex 0); as demais ficam em -1', () => {
        const { opcao } = renderizarComSituacao('ativos')

        expect(opcao(/Ativos/)).toHaveAttribute('tabindex', '0')
        expect(opcao(/Todas/)).toHaveAttribute('tabindex', '-1')
        expect(opcao(/Inativos/)).toHaveAttribute('tabindex', '-1')
        expect(opcao(/Com problemas/)).toHaveAttribute('tabindex', '-1')
      })

      it('ArrowRight avança para a próxima situação e move o foco', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('todas')

        opcao(/Todas/).focus()
        await user.keyboard('{ArrowRight}')

        expect(onSituacaoChange).toHaveBeenCalledTimes(1)
        expect(onSituacaoChange).toHaveBeenCalledWith('ativos')
        expect(opcao(/Ativos/)).toHaveFocus()
      })

      it('ArrowDown avança para a próxima situação', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('ativos')

        opcao(/Ativos/).focus()
        await user.keyboard('{ArrowDown}')

        expect(onSituacaoChange).toHaveBeenCalledWith('inativos')
        expect(opcao(/Inativos/)).toHaveFocus()
      })

      it('ArrowRight na última situação volta para a primeira (ciclo)', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('problemas')

        opcao(/Com problemas/).focus()
        await user.keyboard('{ArrowRight}')

        expect(onSituacaoChange).toHaveBeenCalledWith('todas')
        expect(opcao(/Todas/)).toHaveFocus()
      })

      it('ArrowLeft volta para a situação anterior e move o foco', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('inativos')

        opcao(/Inativos/).focus()
        await user.keyboard('{ArrowLeft}')

        expect(onSituacaoChange).toHaveBeenCalledWith('ativos')
        expect(opcao(/Ativos/)).toHaveFocus()
      })

      it('ArrowUp volta para a situação anterior', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('ativos')

        opcao(/Ativos/).focus()
        await user.keyboard('{ArrowUp}')

        expect(onSituacaoChange).toHaveBeenCalledWith('todas')
        expect(opcao(/Todas/)).toHaveFocus()
      })

      it('ArrowLeft na primeira situação vai para a última (ciclo)', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('todas')

        opcao(/Todas/).focus()
        await user.keyboard('{ArrowLeft}')

        expect(onSituacaoChange).toHaveBeenCalledWith('problemas')
        expect(opcao(/Com problemas/)).toHaveFocus()
      })

      it('Home vai para a primeira situação e End para a última', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('ativos')

        opcao(/Ativos/).focus()
        await user.keyboard('{End}')
        expect(onSituacaoChange).toHaveBeenLastCalledWith('problemas')
        expect(opcao(/Com problemas/)).toHaveFocus()

        await user.keyboard('{Home}')
        expect(onSituacaoChange).toHaveBeenLastCalledWith('todas')
        expect(opcao(/Todas/)).toHaveFocus()
      })

      it('Enter seleciona a situação em foco', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('todas')

        opcao(/Inativos/).focus()
        await user.keyboard('{Enter}')

        expect(onSituacaoChange).toHaveBeenCalledTimes(1)
        expect(onSituacaoChange).toHaveBeenCalledWith('inativos')
      })

      it('Espaço seleciona a situação em foco', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('todas')

        opcao(/Com problemas/).focus()
        await user.keyboard(' ')

        expect(onSituacaoChange).toHaveBeenCalledTimes(1)
        expect(onSituacaoChange).toHaveBeenCalledWith('problemas')
      })

      it('outras teclas não alteram a situação', async () => {
        const user = userEvent.setup()
        const { onSituacaoChange, opcao } = renderizarComSituacao('todas')

        opcao(/Todas/).focus()
        await user.keyboard('{Tab}')
        await user.keyboard('a')

        expect(onSituacaoChange).not.toHaveBeenCalled()
      })

      it('com situação de valor inexistente, ainda há exatamente uma opção tabulável (a primeira)', () => {
        const { opcao } = renderizarComSituacao('valor-que-nao-existe')

        const lista = screen.getByRole('listbox', { name: 'Situação' })
        const tabulaveis = within(lista)
          .getAllByRole('option')
          .filter((item) => item.getAttribute('tabindex') === '0')
        expect(tabulaveis).toHaveLength(1)
        expect(tabulaveis[0]).toBe(opcao(/Todas/))
        expect(within(lista).queryByRole('option', { selected: true })).not.toBeInTheDocument()
      })

      it('sem situação informada, a primeira opção é a tabulável', () => {
        render(<BarraFiltros busca="" onBuscaChange={() => {}} situacoes={situacoes} onSituacaoChange={() => {}} />)

        const lista = screen.getByRole('listbox', { name: 'Situação' })
        const tabulaveis = within(lista)
          .getAllByRole('option')
          .filter((item) => item.getAttribute('tabindex') === '0')
        expect(tabulaveis).toHaveLength(1)
        expect(tabulaveis[0]).toHaveTextContent('Todas')
      })
    })
  })

  describe('botões com contagem (ex.: por tipo)', () => {
    it('exibe os botões em um grupo rotulado "Tipo" por padrão, com a contagem', () => {
      render(
        <BarraFiltros busca="" onBuscaChange={() => {}} botoes={tipos} botaoAtivo={null} onBotaoChange={() => {}} />,
      )

      const grupo = screen.getByRole('group', { name: 'Tipo' })
      expect(within(grupo).getByRole('button', { name: /Comercial/ })).toHaveTextContent('4')
      expect(within(grupo).getByRole('button', { name: /Financeiro/ })).toHaveTextContent('6')
    })

    it('marca o botão ativo com aria-pressed', () => {
      render(
        <BarraFiltros busca="" onBuscaChange={() => {}} botoes={tipos} botaoAtivo="2" onBotaoChange={() => {}} />,
      )

      expect(screen.getByRole('button', { name: /Financeiro/ })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /Comercial/ })).toHaveAttribute('aria-pressed', 'false')
    })

    it('ao clicar em um botão inativo, chama onBotaoChange com o valor', async () => {
      const user = userEvent.setup()
      const onBotaoChange = vi.fn()
      render(
        <BarraFiltros busca="" onBuscaChange={() => {}} botoes={tipos} botaoAtivo={null} onBotaoChange={onBotaoChange} />,
      )

      await user.click(screen.getByRole('button', { name: /Comercial/ }))

      expect(onBotaoChange).toHaveBeenCalledWith('1')
    })

    it('ao clicar no botão já ativo, chama onBotaoChange com null (desmarca)', async () => {
      const user = userEvent.setup()
      const onBotaoChange = vi.fn()
      render(
        <BarraFiltros busca="" onBuscaChange={() => {}} botoes={tipos} botaoAtivo="1" onBotaoChange={onBotaoChange} />,
      )

      await user.click(screen.getByRole('button', { name: /Comercial/ }))

      expect(onBotaoChange).toHaveBeenCalledWith(null)
    })

    it('aceita rótulo personalizado para o grupo de botões', () => {
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          botoes={tipos}
          botaoAtivo={null}
          onBotaoChange={() => {}}
          rotuloBotoes="Periodicidade"
        />,
      )

      expect(screen.getByRole('group', { name: 'Periodicidade' })).toBeInTheDocument()
    })
  })

  describe('limpar filtros', () => {
    it('não exibe "Limpar filtros" quando nenhum filtro está ativo', () => {
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          situacoes={situacoes}
          situacao="todas"
          onSituacaoChange={() => {}}
          botoes={tipos}
          botaoAtivo={null}
          onBotaoChange={() => {}}
          onLimpar={() => {}}
        />,
      )

      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })

    it('exibe "Limpar filtros" quando há busca digitada', () => {
      render(<BarraFiltros busca="cob" onBuscaChange={() => {}} onLimpar={() => {}} />)

      expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    })

    it('exibe "Limpar filtros" quando a situação não é a primeira (padrão)', () => {
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          situacoes={situacoes}
          situacao="ativos"
          onSituacaoChange={() => {}}
          onLimpar={() => {}}
        />,
      )

      expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    })

    it('exibe "Limpar filtros" quando há um botão ativo', () => {
      render(
        <BarraFiltros
          busca=""
          onBuscaChange={() => {}}
          botoes={tipos}
          botaoAtivo="1"
          onBotaoChange={() => {}}
          onLimpar={() => {}}
        />,
      )

      expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
    })

    it('ao clicar em "Limpar filtros", chama onLimpar', async () => {
      const user = userEvent.setup()
      const onLimpar = vi.fn()
      render(<BarraFiltros busca="cob" onBuscaChange={() => {}} onLimpar={onLimpar} />)

      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

      expect(onLimpar).toHaveBeenCalledTimes(1)
    })

    it('não exibe "Limpar filtros" quando onLimpar não é informado, mesmo com filtros ativos', () => {
      render(<BarraFiltros busca="cob" onBuscaChange={() => {}} />)

      expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
    })
  })
})
