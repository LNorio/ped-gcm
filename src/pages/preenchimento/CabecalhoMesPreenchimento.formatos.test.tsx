import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { telaPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { CabecalhoMesPreenchimento } from './CabecalhoMesPreenchimento'

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — progresso do cabeçalho do mês do
 * Preenchimento: "{X} de {Y} apontamento(s) preenchido(s)" no singular ou no plural **pelo total**
 * ("0 de 1 apontamento preenchido", "0 de 2 apontamentos preenchidos") e com separador de milhar
 * (`formatarInteiro`: "1.234 de 1.500 apontamentos preenchidos").
 */
describe('F12.2 — CabecalhoMesPreenchimento: plural pelo total e separador de milhar no progresso', () => {
  function renderizar(preenchidos: number, total: number) {
    render(<CabecalhoMesPreenchimento tela={telaPreenchimento({ progresso: { preenchidos, total } })} />)
    return screen.getByRole('region', { name: 'Resumo do mês' })
  }

  it.each([
    [0, 1, '0 de 1 apontamento preenchido'],
    [1, 1, '1 de 1 apontamento preenchido'],
    [0, 2, '0 de 2 apontamentos preenchidos'],
    [2, 3, '2 de 3 apontamentos preenchidos'],
  ])('progresso %d de %d: "%s"', (preenchidos, total, esperado) => {
    const resumo = renderizar(preenchidos, total)

    expect(within(resumo).getByText(esperado)).toBeInTheDocument()
  })

  it('progresso com milhar: "1.234 de 1.500 apontamentos preenchidos"', () => {
    const resumo = renderizar(1234, 1500)

    expect(within(resumo).getByText('1.234 de 1.500 apontamentos preenchidos')).toBeInTheDocument()
  })
})
