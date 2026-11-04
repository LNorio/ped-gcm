import { render, screen, within } from '@testing-library/react'
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
  { id: 3, nome: 'Roteiro elaborado', tipo: 'Comercial', ativo: true },
]

const todasExpansiveis = (linha: Apontamento) => <p>Histórico de {linha.nome}</p>
const soAtivas = (linha: Apontamento) => (linha.ativo ? <p>Histórico de {linha.nome}</p> : null)

function linhaDe(nome: string): HTMLElement {
  const linha = screen.getByRole('cell', { name: nome }).closest('tr')
  if (!linha) throw new Error(`Linha "${nome}" não encontrada`)
  return linha
}

describe('F1.7 — Tabela: expansão controlada pelo pai (prop "expandidas")', () => {
  it('não mostra a coluna nem o botão de expandir', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set<number>()}
      />,
    )

    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Nome', 'Tipo', 'Situação'])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    for (const nome of ['Visitas realizadas', 'Fechamento contábil', 'Roteiro elaborado']) {
      expect(within(linhaDe(nome)).getAllByRole('cell')).toHaveLength(3)
    }
  })

  it('com o conjunto vazio, nenhuma linha fica aberta', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set<number>()}
      />,
    )

    expect(screen.queryByText(/^Histórico de/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(1 + dados.length)
  })

  it('abre só as linhas cujas chaves estão no conjunto', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set([1, 3])}
      />,
    )

    expect(screen.getByText('Histórico de Visitas realizadas')).toBeInTheDocument()
    expect(screen.getByText('Histórico de Roteiro elaborado')).toBeInTheDocument()
    expect(screen.queryByText('Histórico de Fechamento contábil')).not.toBeInTheDocument()
  })

  it('aceita chaves de texto', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => `ap-${linha.id}`}
        expandir={todasExpansiveis}
        expandidas={new Set(['ap-2'])}
      />,
    )

    expect(screen.getByText('Histórico de Fechamento contábil')).toBeInTheDocument()
    expect(screen.queryByText('Histórico de Visitas realizadas')).not.toBeInTheDocument()
  })

  it('o conteúdo expandido fica na linha logo abaixo da sua, ocupando todas as colunas, com um id próprio', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set([1, 3])}
      />,
    )

    const detalhesVisitas = linhaDe('Visitas realizadas').nextElementSibling as HTMLElement
    expect(detalhesVisitas).toHaveTextContent('Histórico de Visitas realizadas')
    expect(detalhesVisitas.querySelectorAll('td')).toHaveLength(1)
    expect(detalhesVisitas.querySelector('td')).toHaveAttribute('colspan', '3')

    const detalhesRoteiro = linhaDe('Roteiro elaborado').nextElementSibling as HTMLElement
    expect(detalhesRoteiro).toHaveTextContent('Histórico de Roteiro elaborado')

    expect(detalhesVisitas.id).toBeTruthy()
    expect(detalhesRoteiro.id).toBeTruthy()
    expect(detalhesVisitas.id).not.toBe(detalhesRoteiro.id)
    expect(document.getElementById(detalhesVisitas.id)).toBe(detalhesVisitas)
  })

  it('linha cujo "expandir" devolve null não abre, mesmo com a chave no conjunto', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={soAtivas}
        expandidas={new Set([1, 2])}
      />,
    )

    expect(screen.getByText('Histórico de Visitas realizadas')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(1 + dados.length + 1)
    const depoisDaInativa = linhaDe('Fechamento contábil').nextElementSibling as HTMLElement
    expect(within(depoisDaInativa).getByRole('cell', { name: 'Roteiro elaborado' })).toBeInTheDocument()
  })

  it('segue o conjunto recebido a cada renderização: abre e recolhe conforme o pai muda a prop', () => {
    const { rerender } = render(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set<number>()}
      />,
    )
    expect(screen.queryByText(/^Histórico de/)).not.toBeInTheDocument()

    rerender(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set([2])}
      />,
    )
    expect(screen.getByText('Histórico de Fechamento contábil')).toBeInTheDocument()

    rerender(
      <Tabela
        colunas={colunas}
        dados={dados}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set([1])}
      />,
    )
    expect(screen.getByText('Histórico de Visitas realizadas')).toBeInTheDocument()
    expect(screen.queryByText('Histórico de Fechamento contábil')).not.toBeInTheDocument()
  })

  it('lista vazia: o estado vazio ocupa só as colunas informadas (sem a coluna de detalhes)', () => {
    render(
      <Tabela
        colunas={colunas}
        dados={[]}
        obterChave={(linha) => linha.id}
        expandir={todasExpansiveis}
        expandidas={new Set<number>()}
      />,
    )

    expect(screen.getByRole('cell', { name: 'Nenhum registro encontrado.' })).toHaveAttribute('colspan', '3')
  })
})
