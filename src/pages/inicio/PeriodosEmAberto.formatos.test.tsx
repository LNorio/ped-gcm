import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { PeriodoEmAbertoInicio } from '../../types/dominio'
import { PeriodosEmAberto } from './PeriodosEmAberto'

const COMERCIAL: PeriodoEmAbertoInicio = {
  id: 1,
  nome: 'PED Comercial',
  periodicidade: 'trimestral',
  periodoAtual: '4º tri/2026',
  periodoEncerrado: false,
  filiaisAbertas: 3,
  progresso: { preenchidos: 5, total: 9 },
}

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — progresso da lista "Períodos em aberto" do
 * Início: singular ou plural **pelo total** ("0 de 1 lançamento", "0 de 2 lançamentos") e separador de
 * milhar (`formatarInteiro`: "1.234 de 1.500 lançamentos").
 */
describe('F12.2 — PeriodosEmAberto: plural pelo total e separador de milhar no progresso', () => {
  function renderizar(progresso: PeriodoEmAbertoInicio['progresso']) {
    render(
      <MemoryRouter>
        <PeriodosEmAberto periodos={[{ ...COMERCIAL, progresso }]} />
      </MemoryRouter>,
    )
    return screen.getByRole('region', { name: 'Períodos em aberto' })
  }

  it.each([
    [0, 1, '0 de 1 lançamento'],
    [1, 1, '1 de 1 lançamento'],
    [0, 2, '0 de 2 lançamentos'],
    [5, 9, '5 de 9 lançamentos'],
  ])('progresso %d de %d: "%s"', (preenchidos, total, esperado) => {
    const regiao = renderizar({ preenchidos, total })

    expect(within(regiao).getByText(esperado)).toBeInTheDocument()
  })

  it('progresso com milhar: "1.234 de 1.500 lançamentos"', () => {
    const regiao = renderizar({ preenchidos: 1234, total: 1500 })

    expect(within(regiao).getByText('1.234 de 1.500 lançamentos')).toBeInTheDocument()
  })
})
