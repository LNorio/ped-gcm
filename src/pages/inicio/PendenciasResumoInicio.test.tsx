import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PendenciasResumoInicio } from './PendenciasResumoInicio'

const lista = () => screen.getByRole('list', { name: 'Pendências do cadastro' })
const itens = () => within(lista()).getAllByRole('listitem')

/**
 * F11.6 — Cards de pendências na faixa de resumo do Início (`src/pages/inicio/PendenciasResumoInicio.tsx`).
 *
 * Props: `{ indicadoresComMetaPendente: number | null; dashboardsEmConstrucao: number | null }`. Lista
 * própria (`<ul aria-label="Pendências do cadastro">`), exibida na faixa de resumo ao lado da lista
 * "Indicadores-resumo" da API (que não muda), com dois itens, nesta ordem:
 * 1. rótulo "Indicadores com meta pendente" e a quantidade;
 * 2. rótulo "Dashboards em construção" e a quantidade.
 * Quantidade em pt-BR sem casas decimais (1.234); zero aparece como "0". `null` (carregando ou falha da
 * consulta): o card continua com o rótulo, mas sem número.
 */
describe('F11.6 — PendenciasResumoInicio (cards de indicadores com meta pendente e dashboards em construção)', () => {
  it('dois cards, na ordem, com o rótulo e a quantidade', () => {
    render(<PendenciasResumoInicio indicadoresComMetaPendente={3} dashboardsEmConstrucao={4} />)

    const [indicadores, dashboards] = itens()
    expect(itens()).toHaveLength(2)
    expect(within(indicadores).getByText('Indicadores com meta pendente')).toBeInTheDocument()
    expect(within(indicadores).getByText('3')).toBeInTheDocument()
    expect(within(dashboards).getByText('Dashboards em construção')).toBeInTheDocument()
    expect(within(dashboards).getByText('4')).toBeInTheDocument()
  })

  it('quantidades em pt-BR (1.234) e zero como 0', () => {
    render(<PendenciasResumoInicio indicadoresComMetaPendente={1234} dashboardsEmConstrucao={0} />)

    const [indicadores, dashboards] = itens()
    expect(within(indicadores).getByText('1.234')).toBeInTheDocument()
    expect(within(dashboards).getByText('0')).toBeInTheDocument()
  })

  it('quantidade null: o card mantém o rótulo, mas fica sem número', () => {
    render(<PendenciasResumoInicio indicadoresComMetaPendente={null} dashboardsEmConstrucao={2} />)

    const [indicadores, dashboards] = itens()
    expect(within(indicadores).getByText('Indicadores com meta pendente')).toBeInTheDocument()
    expect(indicadores).not.toHaveTextContent(/\d/)
    expect(within(dashboards).getByText('2')).toBeInTheDocument()
  })

  it('as duas quantidades null: os dois cards sem número', () => {
    render(<PendenciasResumoInicio indicadoresComMetaPendente={null} dashboardsEmConstrucao={null} />)

    const [indicadores, dashboards] = itens()
    expect(indicadores).not.toHaveTextContent(/\d/)
    expect(dashboards).not.toHaveTextContent(/\d/)
    expect(within(dashboards).getByText('Dashboards em construção')).toBeInTheDocument()
  })
})
