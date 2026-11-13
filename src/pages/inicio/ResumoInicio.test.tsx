import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ItemResumoInicio } from '../../types/dominio'
import { formatarNumero } from '../../utils/formato'
import { ResumoInicio } from './ResumoInicio'

const RESUMO_ADMIN: ItemResumoInicio[] = [
  { chave: 'apontamentos ativos', rotulo: 'Apontamentos ativos', valor: 12 },
  { chave: 'dados externos ativos', rotulo: 'Dados externos ativos', valor: 5 },
  { chave: 'total de indicadores', rotulo: 'Total de indicadores', valor: 8 },
  { chave: 'dados externos em construcao', rotulo: 'Dados externos em construção (TI)', valor: 2 },
  { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 1234 },
]

const lista = () => screen.getByRole('list', { name: 'Indicadores-resumo' })
const itens = () => within(lista()).getAllByRole('listitem')

/** Confere, item a item e na ordem, o rótulo e o valor exibidos. */
function esperarItens(esperados: Array<[string, string]>) {
  const encontrados = itens()
  expect(encontrados).toHaveLength(esperados.length)
  esperados.forEach(([rotulo, valor], indice) => {
    expect(within(encontrados[indice]).getByText(rotulo)).toBeInTheDocument()
    expect(within(encontrados[indice]).getByText(valor)).toBeInTheDocument()
  })
}

/**
 * F11.3 — Indicadores-resumo do Início (`src/pages/inicio/ResumoInicio.tsx`; RF-08).
 *
 * Props: `{ itens: ItemResumoInicio[] }`. Lista (`<ul aria-label="Indicadores-resumo">`) com um item por
 * indicador, na ordem recebida (a API monta a lista conforme o perfil), cada um com o `rotulo` da API e o
 * `valor` em pt-BR sem casas decimais (ponto de milhar: 1.234). Lista vazia: nada é exibido.
 */
describe('F11.3 — ResumoInicio (indicadores-resumo por perfil)', () => {
  it('Admin: os 5 indicadores na ordem da API, com rótulo e valor', () => {
    render(<ResumoInicio itens={RESUMO_ADMIN} />)

    esperarItens([
      ['Apontamentos ativos', '12'],
      ['Dados externos ativos', '5'],
      ['Total de indicadores', '8'],
      ['Dados externos em construção (TI)', '2'],
      ['Lançamentos pendentes no período', formatarNumero(1234, 0)],
    ])
  })

  it('valores com milhar no padrão pt-BR (1.234) e zero exibido como 0', () => {
    render(
      <ResumoInicio
        itens={[
          { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 1234 },
          { chave: 'meus dados externos em construcao', rotulo: 'Meus dados externos em construção (TI)', valor: 0 },
        ]}
      />,
    )

    expect(formatarNumero(1234, 0)).toBe('1.234')
    esperarItens([
      ['Lançamentos pendentes no período', '1.234'],
      ['Meus dados externos em construção (TI)', '0'],
    ])
  })

  it('Preenchedor: mostra exatamente os itens recebidos (sem "Dashboards ativos")', () => {
    render(
      <ResumoInicio
        itens={[
          { chave: 'apontamentos dos meus tipos', rotulo: 'Apontamentos dos meus tipos', valor: 3 },
          { chave: 'dashboards com meus apontamentos', rotulo: 'Dashboards com meus apontamentos', valor: 1 },
          { chave: 'meus dados externos em construcao', rotulo: 'Meus dados externos em construção (TI)', valor: 0 },
          { chave: 'lancamentos pendentes', rotulo: 'Lançamentos pendentes no período', valor: 1 },
        ]}
      />,
    )

    esperarItens([
      ['Apontamentos dos meus tipos', '3'],
      ['Dashboards com meus apontamentos', '1'],
      ['Meus dados externos em construção (TI)', '0'],
      ['Lançamentos pendentes no período', '1'],
    ])
    expect(screen.queryByText('Dashboards ativos')).not.toBeInTheDocument()
  })

  it('sem itens: não exibe a lista', () => {
    render(<ResumoInicio itens={[]} />)

    expect(screen.queryByRole('list', { name: 'Indicadores-resumo' })).not.toBeInTheDocument()
  })
})
