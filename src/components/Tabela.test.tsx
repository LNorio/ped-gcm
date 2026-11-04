import { render, screen, within } from '@testing-library/react'
import { usuarioRapido } from '../test/usuario'
import { describe, expect, it } from 'vitest'
import { Tabela, type ColunaTabela } from './Tabela'

interface Apontamento {
  id: number
  nome: string
  tipo: string
  ativo: boolean
}

const colunas: ColunaTabela<Apontamento>[] = [
  { chave: 'nome', titulo: 'Nome' },
  { chave: 'tipo', titulo: 'Tipo' },
  { chave: 'situacao', titulo: 'Situação', render: (linha) => (linha.ativo ? 'Ativo' : 'Inativo') },
]

const dados: Apontamento[] = [
  { id: 1, nome: 'Visitas realizadas', tipo: 'Comercial', ativo: true },
  { id: 2, nome: 'Fechamento contábil', tipo: 'Contabilidade', ativo: false },
]

describe('F1.7 — Tabela', () => {
  it('renderiza os cabeçalhos das colunas', () => {
    render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} />)

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent)
    expect(cabecalhos).toEqual(['Nome', 'Tipo', 'Situação'])
  })

  it('renderiza uma linha por item, com o valor da chave e o render personalizado', () => {
    render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} />)

    const linhas = screen.getAllByRole('row').slice(1) // sem o cabeçalho
    expect(linhas).toHaveLength(2)
    expect(within(linhas[0]).getByRole('cell', { name: 'Visitas realizadas' })).toBeInTheDocument()
    expect(within(linhas[0]).getByRole('cell', { name: 'Comercial' })).toBeInTheDocument()
    expect(within(linhas[0]).getByRole('cell', { name: 'Ativo' })).toBeInTheDocument()
    expect(within(linhas[1]).getByRole('cell', { name: 'Inativo' })).toBeInTheDocument()
  })

  it('nomeia a tabela pela legenda', () => {
    render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} legenda="Apontamentos" />)

    expect(screen.getByRole('table', { name: 'Apontamentos' })).toBeInTheDocument()
  })

  it('exibe o estado vazio padrão quando não há dados', () => {
    render(<Tabela colunas={colunas} dados={[]} obterChave={(linha) => linha.id} />)

    expect(screen.getByText('Nenhum registro encontrado.')).toBeInTheDocument()
  })

  it('exibe o texto de estado vazio informado', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={[]}
        obterChave={(linha) => linha.id}
        textoVazio="Nenhum apontamento encontrado para a busca."
      />,
    )

    expect(screen.getByText('Nenhum apontamento encontrado para a busca.')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum registro encontrado.')).not.toBeInTheDocument()
  })

  it('não exibe o estado vazio quando há dados', () => {
    render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} />)

    expect(screen.queryByText('Nenhum registro encontrado.')).not.toBeInTheDocument()
  })

  it('fica dentro de um quadro com rolagem horizontal (RNF-04)', () => {
    render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} />)

    expect(screen.getByRole('table').closest('.tabela-rolagem')).not.toBeNull()
  })

  describe('linhas expansíveis', () => {
    const expandir = (linha: Apontamento) => (linha.ativo ? <p>Histórico de {linha.nome}</p> : null)

    it('sem "expandir", não há botões de expandir', () => {
      render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} />)

      expect(screen.queryByRole('button', { name: /detalhes/i })).not.toBeInTheDocument()
    })

    it('mostra um botão "Expandir detalhes" recolhido em cada linha com conteúdo expansível', () => {
      render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} expandir={expandir} />)

      const botoes = screen.getAllByRole('button', { name: 'Expandir detalhes' })
      expect(botoes).toHaveLength(1) // só a linha ativa devolve conteúdo
      expect(botoes[0]).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Histórico de Visitas realizadas')).not.toBeInTheDocument()
    })

    it('ao clicar, exibe o conteúdo expandido e troca o botão para "Recolher detalhes"', async () => {
      const user = usuarioRapido()
      render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} expandir={expandir} />)

      await user.click(screen.getByRole('button', { name: 'Expandir detalhes' }))

      expect(screen.getByText('Histórico de Visitas realizadas')).toBeInTheDocument()
      const botao = screen.getByRole('button', { name: 'Recolher detalhes' })
      expect(botao).toHaveAttribute('aria-expanded', 'true')

      await user.click(botao)

      expect(screen.queryByText('Histórico de Visitas realizadas')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expandir detalhes' })).toHaveAttribute('aria-expanded', 'false')
    })

    it('linha cujo "expandir" devolve null não tem botão de expandir, mesmo com a coluna de detalhes presente', () => {
      render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} expandir={expandir} />)

      const linhas = screen.getAllByRole('row').slice(1)
      const linhaInativa = linhas.find((linha) => within(linha).queryByText('Fechamento contábil') !== null)
      expect(linhaInativa).toBeDefined()
      expect(within(linhaInativa as HTMLElement).queryByRole('button')).not.toBeInTheDocument()

      const linhaAtiva = linhas.find((linha) => within(linha).queryByText('Visitas realizadas') !== null)
      expect(within(linhaAtiva as HTMLElement).getByRole('button', { name: 'Expandir detalhes' })).toBeInTheDocument()
    })

    it('permite duas linhas expandidas ao mesmo tempo', async () => {
      const user = usuarioRapido()
      const todasExpansiveis = (linha: Apontamento) => <p>Histórico de {linha.nome}</p>
      render(
        <Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} expandir={todasExpansiveis} />,
      )

      const [primeiro, segundo] = screen.getAllByRole('button', { name: 'Expandir detalhes' })
      await user.click(primeiro)
      await user.click(segundo)

      expect(screen.getByText('Histórico de Visitas realizadas')).toBeInTheDocument()
      expect(screen.getByText('Histórico de Fechamento contábil')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Recolher detalhes' })).toHaveLength(2)
      expect(screen.queryByRole('button', { name: 'Expandir detalhes' })).not.toBeInTheDocument()
    })

    it('recolher uma linha não afeta a outra que continua expandida', async () => {
      const user = usuarioRapido()
      const todasExpansiveis = (linha: Apontamento) => <p>Histórico de {linha.nome}</p>
      render(
        <Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} expandir={todasExpansiveis} />,
      )
      const [primeiro, segundo] = screen.getAllByRole('button', { name: 'Expandir detalhes' })
      await user.click(primeiro)
      await user.click(segundo)

      const [recolherPrimeiro] = screen.getAllByRole('button', { name: 'Recolher detalhes' })
      await user.click(recolherPrimeiro)

      expect(screen.queryByText('Histórico de Visitas realizadas')).not.toBeInTheDocument()
      expect(screen.getByText('Histórico de Fechamento contábil')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Recolher detalhes' })).toHaveLength(1)
      expect(screen.getAllByRole('button', { name: 'Expandir detalhes' })).toHaveLength(1)
    })

    it('o botão aberto aponta via aria-controls para a linha de detalhes existente no documento', async () => {
      const user = usuarioRapido()
      render(<Tabela colunas={colunas} dados={dados} obterChave={(linha) => linha.id} expandir={expandir} />)

      await user.click(screen.getByRole('button', { name: 'Expandir detalhes' }))

      const botao = screen.getByRole('button', { name: 'Recolher detalhes' })
      const idControlado = botao.getAttribute('aria-controls')
      expect(idControlado).toBeTruthy()
      const detalhes = document.getElementById(idControlado as string)
      expect(detalhes).not.toBeNull()
      expect(detalhes).toHaveTextContent('Histórico de Visitas realizadas')
    })

    it('aceita rótulos personalizados para expandir e recolher', async () => {
      const user = usuarioRapido()
      render(
        <Tabela
          colunas={colunas}
          dados={dados}
          obterChave={(linha) => linha.id}
          expandir={expandir}
          rotuloExpandir="Ver histórico"
          rotuloRecolher="Ocultar histórico"
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Ver histórico' }))

      expect(screen.getByRole('button', { name: 'Ocultar histórico' })).toBeInTheDocument()
    })
  })
})
