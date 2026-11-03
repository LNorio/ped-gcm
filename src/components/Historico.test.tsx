import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Historico, type ItemHistorico } from './Historico'

const itens: ItemHistorico[] = [
  {
    id: 2,
    data: '2026-10-29 14:05:00',
    acao: 'Correção',
    usuario: 'Maria Souza',
    de: '5',
    para: '6',
    motivo: 'digitação errada',
  },
  {
    id: 1,
    data: '2026-10-20 09:58:19',
    acao: 'Lançamento',
    usuario: 'João Lima',
    de: null,
    para: '5',
    motivo: null,
  },
]

describe('F1.11 — Histórico somente leitura (RNF-01)', () => {
  it('exibe os registros como lista, na ordem recebida', () => {
    render(<Historico itens={itens} />)

    const lista = screen.getByRole('list')
    const registros = within(lista).getAllByRole('listitem')
    expect(registros).toHaveLength(2)
    expect(registros[0]).toHaveTextContent('Correção')
    expect(registros[1]).toHaveTextContent('Lançamento')
  })

  it('nomeia a lista pela legenda informada', () => {
    render(<Historico itens={itens} legenda="Histórico do apontamento" />)

    expect(screen.getByRole('list', { name: 'Histórico do apontamento' })).toBeInTheDocument()
  })

  it('mostra data e hora em pt-BR (dd/mm/aaaa hh:mm), ação e usuário', () => {
    render(<Historico itens={itens} />)

    const [correcao, lancamento] = screen.getAllByRole('listitem')
    expect(correcao).toHaveTextContent('29/10/2026 14:05')
    expect(correcao).toHaveTextContent('Correção')
    expect(correcao).toHaveTextContent('Maria Souza')
    expect(lancamento).toHaveTextContent('20/10/2026 09:58')
    expect(lancamento).toHaveTextContent('João Lima')
  })

  it('mostra a mudança como "de → para"', () => {
    render(<Historico itens={itens} />)

    const [correcao] = screen.getAllByRole('listitem')
    expect(correcao).toHaveTextContent('5 → 6')
  })

  it('usa "—" no lugar do valor anterior ausente', () => {
    render(<Historico itens={itens} />)

    const [, lancamento] = screen.getAllByRole('listitem')
    expect(lancamento).toHaveTextContent('— → 5')
  })

  it('usa "—" no lugar do novo valor ausente quando só há valor anterior', () => {
    render(
      <Historico
        itens={[
          { id: 1, data: '2026-10-29 14:00:00', acao: 'Exclusão de valor', usuario: 'Fulano', de: '5', para: null },
        ]}
      />,
    )

    const [registro] = screen.getAllByRole('listitem')
    expect(registro).toHaveTextContent('5 → —')
  })

  it('não mostra a seta de mudança quando o registro não tem valor anterior nem novo valor', () => {
    render(
      <Historico
        itens={[{ id: 1, data: '2026-10-29 14:00:00', acao: 'Abertura do período', usuario: 'Fulano' }]}
      />,
    )

    const [registro] = screen.getAllByRole('listitem')
    expect(registro).toHaveTextContent('Abertura do período')
    expect(registro).not.toHaveTextContent('→')
    expect(registro).not.toHaveTextContent('—')
  })

  it('mostra o motivo quando existe e não inventa um quando não há', () => {
    render(<Historico itens={itens} />)

    const [correcao, lancamento] = screen.getAllByRole('listitem')
    expect(correcao).toHaveTextContent('digitação errada')
    expect(lancamento).not.toHaveTextContent('digitação errada')
    expect(lancamento).not.toHaveTextContent(/motivo/i)
  })

  it('não oferece nenhuma ação de editar ou excluir registros', () => {
    render(<Historico itens={itens} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('exibe o estado vazio padrão quando não há registros', () => {
    render(<Historico itens={[]} />)

    expect(screen.getByText('Nenhuma alteração registrada.')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('aceita texto de estado vazio personalizado', () => {
    render(<Historico itens={[]} textoVazio="Nenhum lançamento registrado ainda." />)

    expect(screen.getByText('Nenhum lançamento registrado ainda.')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma alteração registrada.')).not.toBeInTheDocument()
  })

  it('aceita campos adicionais (ex.: filial e competência da alteração de meta) como detalhes', () => {
    render(
      <Historico
        itens={[
          {
            id: 1,
            data: '2026-10-29 14:00:00',
            acao: 'Ajuste de meta',
            usuario: 'Fulano',
            de: '1.500,50',
            para: '2.000,25',
            motivo: 'sazonalidade',
            detalhes: ['Filial 101', '10/2026'],
          },
        ]}
      />,
    )

    const [registro] = screen.getAllByRole('listitem')
    expect(registro).toHaveTextContent('Filial 101')
    expect(registro).toHaveTextContent('10/2026')
    expect(registro).toHaveTextContent('1.500,50 → 2.000,25')
  })
})
