import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { UltimaAlteracaoInicio } from '../../types/dominio'
import { formatarNumero, formatarPercentual } from '../../utils/formato'
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
    tipoValor: null,
    ...parcial,
  }
}

const regiao = () => screen.getByRole('region', { name: 'Últimas alterações em apontamentos' })
const itens = () => within(regiao()).getAllByRole('listitem')

/**
 * F11.5 (F12.12* do plano, RNF-04) — valores das últimas alterações formatados pelo `tipoValor`
 * (`"tipo de valor"` de `GET /api/ped/inicio`, Swagger de 25/11/2026), no padrão do Preenchimento
 * (`formatarValorLancamento`):
 * - `porcentagem`: `formatarPercentual` — "5,00% → 6,50%"; só o novo no lançamento: "12,50%";
 * - `numeral`: `formatarNumero` com 2 casas — "1.234,50 → 1.300,00";
 * - `booleano`: "Sim"/"Não" — "Não → Sim";
 * - `tipoValor` `null` (resposta sem o campo): o formato atual (número com 2 casas, sem "%"; booleano
 *   Sim/Não).
 * O restante do texto não muda: "Competência {MM/AAAA} · Filial {código} · {anterior} → {novo}".
 */
describe('F11.5 — UltimasAlteracoes: valores formatados pelo tipo de valor', () => {
  it('porcentagem: anterior e novo com "%" (formatarPercentual)', () => {
    render(<UltimasAlteracoes alteracoes={[alteracao({ tipoValor: 'porcentagem' })]} />)

    expect(formatarPercentual(5)).toBe('5,00%')
    expect(within(itens()[0]).getByText('Competência 10/2026 · Filial 101 · 5,00% → 6,50%')).toBeInTheDocument()
  })

  it('porcentagem no lançamento sem valor anterior: só o novo, com "%"', () => {
    render(
      <UltimasAlteracoes
        alteracoes={[alteracao({ acao: 'lancamento', tipoValor: 'porcentagem', valorAnterior: null, valorNovo: 12.5 })]}
      />,
    )

    const [item] = itens()
    expect(within(item).getByText('Competência 10/2026 · Filial 101 · 12,50%')).toBeInTheDocument()
    expect(within(item).queryByText(/→/)).not.toBeInTheDocument()
  })

  it('numeral: número em pt-BR com 2 casas, sem "%"', () => {
    render(<UltimasAlteracoes alteracoes={[alteracao({ tipoValor: 'numeral', valorAnterior: 1234.5, valorNovo: 1300 })]} />)

    expect(within(itens()[0]).getByText('Competência 10/2026 · Filial 101 · 1.234,50 → 1.300,00')).toBeInTheDocument()
    expect(within(itens()[0]).queryByText(/%/)).not.toBeInTheDocument()
  })

  it('booleano: "Não → Sim"', () => {
    render(
      <UltimasAlteracoes
        alteracoes={[alteracao({ tipoValor: 'booleano', apontamento: 'Loja auditada', filial: '102', valorAnterior: false, valorNovo: true })]}
      />,
    )

    expect(within(itens()[0]).getByText('Competência 10/2026 · Filial 102 · Não → Sim')).toBeInTheDocument()
  })

  it('sem tipo de valor (null): mantém o formato atual, número com 2 casas e sem "%"', () => {
    render(<UltimasAlteracoes alteracoes={[alteracao({ tipoValor: null })]} />)

    expect(
      within(itens()[0]).getByText(`Competência 10/2026 · Filial 101 · ${formatarNumero(5)} → ${formatarNumero(6.5)}`),
    ).toBeInTheDocument()
    expect(within(itens()[0]).queryByText(/%/)).not.toBeInTheDocument()
  })

  it('cada alteração usa o próprio tipo: porcentagem e numeral na mesma lista', () => {
    render(
      <UltimasAlteracoes
        alteracoes={[
          alteracao({ tipoValor: 'porcentagem' }),
          alteracao({ apontamento: 'Faturamento líquido', filial: '100', tipoValor: 'numeral', valorAnterior: 1000, valorNovo: 451590.62 }),
        ]}
      />,
    )

    const [porcentagem, numeral] = itens()
    expect(within(porcentagem).getByText('Competência 10/2026 · Filial 101 · 5,00% → 6,50%')).toBeInTheDocument()
    expect(within(numeral).getByText('Competência 10/2026 · Filial 100 · 1.000,00 → 451.590,62')).toBeInTheDocument()
  })
})
