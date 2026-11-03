import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { normalizarBusca } from '../utils/formato'
import { BarraFiltros } from './BarraFiltros'
import { Tabela, type ColunaTabela } from './Tabela'

interface Apontamento {
  id: number
  nome: string
  tipo: string
  idTipo: string
  descricao: string
  ativo: boolean
}

const apontamentos: Apontamento[] = [
  { id: 1, nome: 'Visitas realizadas', tipo: 'Comercial', idTipo: '1', descricao: 'Visitas a clientes', ativo: true },
  { id: 2, nome: 'Percentual de cobertura', tipo: 'Comercial', idTipo: '1', descricao: 'Clientes com venda', ativo: true },
  { id: 3, nome: 'Fechamento contábil', tipo: 'Contabilidade', idTipo: '7', descricao: 'Balancete do mês', ativo: false },
  { id: 4, nome: 'Ação de retenção', tipo: 'Recursos Humanos', idTipo: '3', descricao: 'Colaboradores retidos', ativo: true },
]

const colunas: ColunaTabela<Apontamento>[] = [
  { chave: 'nome', titulo: 'Nome' },
  { chave: 'tipo', titulo: 'Tipo' },
  { chave: 'situacao', titulo: 'Situação', render: (linha) => (linha.ativo ? 'Ativo' : 'Inativo') },
]

// Tela de exemplo que compõe BarraFiltros + Tabela + normalizarBusca, como as abas farão.
function TelaApontamentos() {
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('todas')
  const [tipo, setTipo] = useState<string | null>(null)

  const porBuscaESituacao = useMemo(() => {
    const termo = normalizarBusca(busca)
    return apontamentos.filter((item) => {
      const casaBusca =
        termo === '' ||
        [item.nome, item.tipo, item.descricao].some((campo) => normalizarBusca(campo).includes(termo))
      const casaSituacao =
        situacao === 'todas' || (situacao === 'ativos' ? item.ativo : !item.ativo)
      return casaBusca && casaSituacao
    })
  }, [busca, situacao])

  const visiveis = porBuscaESituacao.filter((item) => tipo === null || item.idTipo === tipo)

  const contagem = (filtro: (item: Apontamento) => boolean) =>
    apontamentos.filter((item) => {
      const termo = normalizarBusca(busca)
      const casaBusca =
        termo === '' ||
        [item.nome, item.tipo, item.descricao].some((campo) => normalizarBusca(campo).includes(termo))
      return casaBusca && filtro(item)
    }).length

  const situacoes = [
    { valor: 'todas', rotulo: 'Todas', contagem: contagem(() => true) },
    { valor: 'ativos', rotulo: 'Ativos', contagem: contagem((item) => item.ativo) },
    { valor: 'inativos', rotulo: 'Inativos', contagem: contagem((item) => !item.ativo) },
  ]

  const tipos = [
    { valor: '1', rotulo: 'Comercial' },
    { valor: '3', rotulo: 'Recursos Humanos' },
    { valor: '7', rotulo: 'Contabilidade' },
  ].map((t) => ({ ...t, contagem: porBuscaESituacao.filter((item) => item.idTipo === t.valor).length }))

  return (
    <>
      <BarraFiltros
        busca={busca}
        onBuscaChange={(valor) => setBusca(valor)}
        rotuloBusca="Buscar apontamento"
        situacoes={situacoes}
        situacao={situacao}
        onSituacaoChange={setSituacao}
        botoes={tipos}
        botaoAtivo={tipo}
        onBotaoChange={setTipo}
        onLimpar={() => {
          setBusca('')
          setSituacao('todas')
          setTipo(null)
        }}
      />
      <Tabela
        colunas={colunas}
        dados={visiveis}
        obterChave={(linha) => linha.id}
        legenda="Apontamentos"
        textoVazio="Nenhum apontamento encontrado para a busca."
      />
    </>
  )
}

function nomesVisiveis() {
  const tabela = screen.getByRole('table', { name: 'Apontamentos' })
  return within(tabela)
    .getAllByRole('row')
    .slice(1)
    .map((linha) => within(linha).getAllByRole('cell')[0].textContent)
}

describe('F1.10 — Barra de filtros + tabela (integração)', () => {
  it('mostra todos os registros sem filtros, com as contagens por situação e por tipo', () => {
    render(<TelaApontamentos />)

    expect(nomesVisiveis()).toEqual([
      'Visitas realizadas',
      'Percentual de cobertura',
      'Fechamento contábil',
      'Ação de retenção',
    ])
    const lista = screen.getByRole('listbox', { name: 'Situação' })
    expect(within(lista).getByRole('option', { name: /Todas/ })).toHaveTextContent('4')
    expect(within(lista).getByRole('option', { name: /Ativos/ })).toHaveTextContent('3')
    expect(within(lista).getByRole('option', { name: /Inativos/ })).toHaveTextContent('1')
    const grupo = screen.getByRole('group', { name: 'Tipo' })
    expect(within(grupo).getByRole('button', { name: /Comercial/ })).toHaveTextContent('2')
    expect(within(grupo).getByRole('button', { name: /Contabilidade/ })).toHaveTextContent('1')
  })

  it('a busca ignora acentos e maiúsculas (RNF-09) e procura em vários campos', async () => {
    const user = userEvent.setup()
    render(<TelaApontamentos />)

    await user.type(screen.getByRole('searchbox', { name: 'Buscar apontamento' }), 'COBERTÚRA')
    expect(nomesVisiveis()).toEqual(['Percentual de cobertura'])

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar apontamento' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar apontamento' }), 'acao')
    expect(nomesVisiveis()).toEqual(['Ação de retenção'])

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar apontamento' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar apontamento' }), 'balancete')
    expect(nomesVisiveis()).toEqual(['Fechamento contábil'])
  })

  it('a busca sem resultado mostra o estado vazio da tabela', async () => {
    const user = userEvent.setup()
    render(<TelaApontamentos />)

    await user.type(screen.getByRole('searchbox', { name: 'Buscar apontamento' }), 'inexistente')

    expect(screen.getByText('Nenhum apontamento encontrado para a busca.')).toBeInTheDocument()
    expect(within(screen.getByRole('listbox', { name: 'Situação' })).getByRole('option', { name: /Todas/ })).toHaveTextContent(
      '0',
    )
  })

  it('o chip de situação filtra a lista e marca a opção selecionada', async () => {
    const user = userEvent.setup()
    render(<TelaApontamentos />)

    await user.click(screen.getByRole('option', { name: /Inativos/ }))

    expect(nomesVisiveis()).toEqual(['Fechamento contábil'])
    expect(screen.getByRole('option', { name: /Inativos/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: /Todas/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('o botão de tipo filtra a lista e clicar de novo desmarca', async () => {
    const user = userEvent.setup()
    render(<TelaApontamentos />)

    await user.click(screen.getByRole('button', { name: /Comercial/ }))
    expect(nomesVisiveis()).toEqual(['Visitas realizadas', 'Percentual de cobertura'])
    expect(screen.getByRole('button', { name: /Comercial/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Comercial/ }))
    expect(nomesVisiveis()).toHaveLength(4)
    expect(screen.getByRole('button', { name: /Comercial/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('busca, situação e tipo combinam, e as contagens dos tipos refletem a busca e a situação', async () => {
    const user = userEvent.setup()
    render(<TelaApontamentos />)

    await user.type(screen.getByRole('searchbox', { name: 'Buscar apontamento' }), 'clientes')
    await user.click(screen.getByRole('option', { name: /Ativos/ }))

    const grupo = screen.getByRole('group', { name: 'Tipo' })
    expect(within(grupo).getByRole('button', { name: /Comercial/ })).toHaveTextContent('2')
    expect(within(grupo).getByRole('button', { name: /Contabilidade/ })).toHaveTextContent('0')

    await user.click(within(grupo).getByRole('button', { name: /Comercial/ }))
    expect(nomesVisiveis()).toEqual(['Visitas realizadas', 'Percentual de cobertura'])
  })

  it('"Limpar filtros" aparece com filtros ativos e restaura a lista completa', async () => {
    const user = userEvent.setup()
    render(<TelaApontamentos />)
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar apontamento' }), 'visitas')
    await user.click(screen.getByRole('option', { name: /Ativos/ }))
    await user.click(screen.getByRole('button', { name: /Comercial/ }))
    expect(nomesVisiveis()).toEqual(['Visitas realizadas'])

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(nomesVisiveis()).toHaveLength(4)
    expect(screen.getByRole('searchbox', { name: 'Buscar apontamento' })).toHaveValue('')
    expect(screen.getByRole('option', { name: /Todas/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /Comercial/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
  })
})
