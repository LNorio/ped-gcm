import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../../test/usuario'
import { describe, expect, it, vi } from 'vitest'
import { paraTipoApontamento } from '../../services/adaptadores'
import { NOMES_TIPOS_FIXOS, TIPO_LOGISTICA_API, TIPO_MARKETING_API, tiposApi } from '../../test/tiposFalsos'
import type { TipoApontamento } from '../../types/dominio'
import { TabelaTipos } from './TabelaTipos'

const TIPOS: TipoApontamento[] = tiposApi().map(paraTipoApontamento)
const LOGISTICA = paraTipoApontamento(TIPO_LOGISTICA_API)
const MARKETING = paraTipoApontamento(TIPO_MARKETING_API)

describe('F3.2 — TabelaTipos (tabela da listagem de tipos)', () => {
  function renderizar(tipos: TipoApontamento[] = TIPOS, onExcluir = vi.fn<(tipo: TipoApontamento) => void>()) {
    render(<TabelaTipos tipos={tipos} onExcluir={onExcluir} />)
    return onExcluir
  }

  function tabela() {
    return screen.getByRole('table', { name: 'Tipos de apontamento' })
  }

  function linhasDeDados() {
    return within(tabela()).getAllByRole('row').slice(1)
  }

  function linhaDoTipo(nome: string): HTMLElement {
    const linha = screen.getByRole('cell', { name: nome }).closest('tr')
    if (!linha) throw new Error(`Linha do tipo "${nome}" não encontrada`)
    return linha
  }

  function celulaAcoes(nome: string): HTMLElement {
    return within(linhaDoTipo(nome)).getAllByRole('cell')[3]
  }

  it('renderiza a tabela "Tipos de apontamento" com as colunas Nome, Origem, Apontamentos e Ações', () => {
    renderizar()

    expect(within(tabela()).getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual([
      'Nome',
      'Origem',
      'Apontamentos',
      'Ações',
    ])
  })

  it('lista os tipos recebidos na ordem informada', () => {
    renderizar()

    expect(linhasDeDados()).toHaveLength(9)
    expect(linhasDeDados().map((linha) => within(linha).getAllByRole('cell')[0].textContent)).toEqual([
      ...NOMES_TIPOS_FIXOS,
      'Logística',
      'Marketing',
    ])
  })

  it('não exibe coluna de grupos vinculados', () => {
    renderizar()

    expect(within(tabela()).queryByRole('columnheader', { name: /grupos/i })).not.toBeInTheDocument()
  })

  it('mostra a origem como etiqueta: Fixo em tom neutro e Personalizado em tom de informação', () => {
    renderizar()

    expect(within(linhaDoTipo('Comercial')).getByText('Fixo')).toHaveClass('etiqueta', 'etiqueta--neutro')
    expect(within(linhaDoTipo('Logística')).getByText('Personalizado')).toHaveClass('etiqueta', 'etiqueta--info')
  })

  it('mostra a quantidade de apontamentos de cada tipo, inclusive zero', () => {
    renderizar()

    expect(within(linhaDoTipo('Comercial')).getAllByRole('cell')[2]).toHaveTextContent(/^7$/)
    expect(within(linhaDoTipo('Recursos Humanos')).getAllByRole('cell')[2]).toHaveTextContent(/^0$/)
    expect(within(linhaDoTipo('Marketing')).getAllByRole('cell')[2]).toHaveTextContent(/^3$/)
  })

  it('oferece o botão "Excluir tipo {nome}" apenas nos personalizados', () => {
    renderizar()

    expect(screen.getAllByRole('button', { name: /^Excluir tipo / }).map((botao) => botao.getAttribute('aria-label'))).toEqual([
      'Excluir tipo Logística',
      'Excluir tipo Marketing',
    ])
    expect(within(celulaAcoes('Logística')).getByRole('button', { name: 'Excluir tipo Logística' })).toHaveTextContent(
      'Excluir',
    )
    for (const nome of NOMES_TIPOS_FIXOS) {
      expect(within(linhaDoTipo(nome)).queryByRole('button')).not.toBeInTheDocument()
    }
  })

  it('o botão Excluir usa a variante de perigo em tamanho pequeno', () => {
    renderizar()

    const botao = screen.getByRole('button', { name: 'Excluir tipo Logística' })
    expect(botao).toHaveClass('botao--perigo')
    expect(botao).toHaveClass('botao--pequeno')
  })

  it('na célula Ações dos fixos, mostra "—" escondido de leitores de tela e o texto "Sem ações" só para leitores de tela', () => {
    renderizar()

    for (const nome of NOMES_TIPOS_FIXOS) {
      const celula = celulaAcoes(nome)
      const travessao = within(celula).getByText('—')
      expect(travessao).toHaveAttribute('aria-hidden', 'true')
      const semAcoes = within(celula).getByText('Sem ações')
      expect(semAcoes).toHaveClass('visualmente-oculto')
      expect(semAcoes).not.toHaveAttribute('aria-hidden')
    }
  })

  it('a célula Ações dos personalizados não tem o texto "Sem ações" nem o travessão', () => {
    renderizar()

    expect(within(celulaAcoes('Logística')).queryByText('Sem ações')).not.toBeInTheDocument()
    expect(within(celulaAcoes('Logística')).queryByText('—')).not.toBeInTheDocument()
  })

  it('clicar em Excluir chama onExcluir com o tipo da linha clicada', async () => {
    const user = usuarioRapido()
    const onExcluir = renderizar()

    await user.click(screen.getByRole('button', { name: 'Excluir tipo Logística' }))

    expect(onExcluir).toHaveBeenCalledTimes(1)
    expect(onExcluir).toHaveBeenCalledWith(LOGISTICA)
  })

  it('cada botão passa o próprio tipo (não o primeiro personalizado)', async () => {
    const user = usuarioRapido()
    const onExcluir = renderizar()

    await user.click(screen.getByRole('button', { name: 'Excluir tipo Marketing' }))

    expect(onExcluir).toHaveBeenCalledTimes(1)
    expect(onExcluir).toHaveBeenCalledWith(MARKETING)
    expect(onExcluir.mock.calls[0][0]).toBe(TIPOS[8])
  })

  it('lista vazia exibe o textoVazio informado e nenhum botão', () => {
    render(<TabelaTipos tipos={[]} onExcluir={vi.fn()} textoVazio="Nenhum tipo cadastrado." />)

    expect(within(tabela()).getByText('Nenhum tipo cadastrado.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('textoVazio é usado só quando a lista está vazia', () => {
    render(<TabelaTipos tipos={[LOGISTICA]} onExcluir={vi.fn()} textoVazio="Nenhum tipo encontrado para os filtros." />)

    expect(screen.queryByText('Nenhum tipo encontrado para os filtros.')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Logística' })).toBeInTheDocument()
  })

  it('aceita só os personalizados (lista filtrada) e mantém um botão por linha', () => {
    renderizar([LOGISTICA, MARKETING])

    expect(linhasDeDados()).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Excluir tipo / })).toHaveLength(2)
    expect(screen.queryByText('Sem ações')).not.toBeInTheDocument()
  })
})
