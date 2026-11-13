import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { UltimaAlteracaoInicio } from '../../types/dominio'
import { formatarNumero } from '../../utils/formato'
import { UltimasAlteracoes } from './UltimasAlteracoes'

function alteracao(parcial: Partial<UltimaAlteracaoInicio> = {}): UltimaAlteracaoInicio {
  return {
    acao: 'correcao',
    apontamento: 'Cobertura de clientes',
    competencia: '2026-10-01',
    filial: '101',
    valorAnterior: 5,
    valorNovo: 6.5,
    data: '2026-11-12 14:30:00',
    usuario: 'Ana Costa',
    ...parcial,
  }
}

const regiao = () => screen.getByRole('region', { name: 'Últimas alterações em apontamentos' })
const itens = () => within(regiao()).getAllByRole('listitem')

/**
 * F11.5 — "Últimas alterações em apontamentos" do Início (`src/pages/inicio/UltimasAlteracoes.tsx`; RF-11).
 *
 * Props: `{ alteracoes: UltimaAlteracaoInicio[] }`. Card (região) com o título "Últimas alterações em
 * apontamentos" e uma lista com as alterações na ordem recebida (mais recente primeiro), **no máximo 6**.
 * Cada item mostra:
 * - a ação por extenso ("Lançamento" ou "Correção", numa etiqueta);
 * - o nome do apontamento;
 * - "Competência {MM/AAAA} · Filial {código} · {anterior} → {novo}" — sem valor anterior (`null`, como no
 *   lançamento), só o novo: "Competência 10/2026 · Filial 100 · 451.590,62"; números em pt-BR com 2 casas
 *   (RN-10) e booleanos como "Sim"/"Não";
 * - "{dd/mm/aaaa hh:mm} · {usuário}".
 * Sem alterações: "Nenhum lançamento registrado ainda.".
 */
describe('F11.5 — UltimasAlteracoes (últimas alterações em apontamentos)', () => {
  it('região com o título e um item por alteração, na ordem recebida', () => {
    render(
      <UltimasAlteracoes
        alteracoes={[alteracao(), alteracao({ acao: 'lancamento', apontamento: 'Faturamento líquido', valorAnterior: null })]}
      />,
    )

    expect(within(regiao()).getByRole('heading', { name: 'Últimas alterações em apontamentos' })).toBeInTheDocument()
    const [primeira, segunda] = itens()
    expect(itens()).toHaveLength(2)
    expect(within(primeira).getByText('Cobertura de clientes')).toBeInTheDocument()
    expect(within(segunda).getByText('Faturamento líquido')).toBeInTheDocument()
  })

  it('correção numérica: ação, apontamento, competência, filial, anterior → novo, data e usuário', () => {
    render(<UltimasAlteracoes alteracoes={[alteracao()]} />)

    const [item] = itens()
    expect(within(item).getByText('Correção')).toBeInTheDocument()
    expect(within(item).getByText('Cobertura de clientes')).toBeInTheDocument()
    expect(within(item).getByText(`Competência 10/2026 · Filial 101 · ${formatarNumero(5)} → ${formatarNumero(6.5)}`)).toBeInTheDocument()
    expect(within(item).getByText('12/11/2026 14:30 · Ana Costa')).toBeInTheDocument()
  })

  it('valores em pt-BR com 2 casas (vírgula decimal e ponto de milhar)', () => {
    render(<UltimasAlteracoes alteracoes={[alteracao({ valorAnterior: 1000, valorNovo: 451590.62 })]} />)

    expect(formatarNumero(451590.62)).toBe('451.590,62')
    expect(within(itens()[0]).getByText('Competência 10/2026 · Filial 101 · 1.000,00 → 451.590,62')).toBeInTheDocument()
  })

  it('lançamento sem valor anterior: "Lançamento" e só o valor novo', () => {
    render(
      <UltimasAlteracoes
        alteracoes={[
          alteracao({
            acao: 'lancamento',
            apontamento: 'Faturamento líquido',
            filial: '100',
            valorAnterior: null,
            valorNovo: 451590.62,
            data: '2026-11-12 10:05:00',
            usuario: 'Bruno Lima',
          }),
        ]}
      />,
    )

    const [item] = itens()
    expect(within(item).getByText('Lançamento')).toBeInTheDocument()
    expect(within(item).getByText('Competência 10/2026 · Filial 100 · 451.590,62')).toBeInTheDocument()
    expect(within(item).queryByText(/→/)).not.toBeInTheDocument()
    expect(within(item).getByText('12/11/2026 10:05 · Bruno Lima')).toBeInTheDocument()
  })

  it('valores booleanos como "Não → Sim"', () => {
    render(
      <UltimasAlteracoes
        alteracoes={[alteracao({ apontamento: 'Loja auditada', filial: '102', valorAnterior: false, valorNovo: true })]}
      />,
    )

    expect(within(itens()[0]).getByText('Competência 10/2026 · Filial 102 · Não → Sim')).toBeInTheDocument()
  })

  it('mostra no máximo as 6 primeiras (mais recentes) alterações recebidas', () => {
    const sete = Array.from({ length: 7 }, (_, indice) => alteracao({ apontamento: `Apontamento ${indice + 1}` }))

    render(<UltimasAlteracoes alteracoes={sete} />)

    expect(itens()).toHaveLength(6)
    expect(within(itens()[5]).getByText('Apontamento 6')).toBeInTheDocument()
    expect(screen.queryByText('Apontamento 7')).not.toBeInTheDocument()
  })

  it('sem alterações: "Nenhum lançamento registrado ainda."', () => {
    render(<UltimasAlteracoes alteracoes={[]} />)

    expect(within(regiao()).getByText('Nenhum lançamento registrado ainda.')).toBeInTheDocument()
    expect(within(regiao()).queryAllByRole('listitem')).toHaveLength(0)
  })
})
