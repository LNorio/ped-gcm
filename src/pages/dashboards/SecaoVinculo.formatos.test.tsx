import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ColaboradorVinculo } from '../../services/dashboardsService'
import { FILIAIS_VINCULO } from '../../test/dashboardsFalsos'
import { SecaoVinculo } from './SecaoVinculo'

/** 1.500 vendedores na filial 100, para o resumo do encerramento. */
const VENDEDORES: ColaboradorVinculo[] = Array.from({ length: 1500 }, (_, i) => ({
  id: 1000 + i,
  nome: `Vendedor ${i + 1}`,
  cargo: 'Vendedor',
  filial: '100',
}))

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — o resumo das imagens do vínculo
 * (`SecaoVinculo`) mostra a quantidade com separador de milhar (`formatarInteiro`):
 * "No encerramento serão geradas 1.500 imagens (uma por colaborador) na filial 100.".
 */
describe('F12.2 — SecaoVinculo: resumo de imagens com separador de milhar', () => {
  it('cargo com 1.500 colaboradores: "serão geradas 1.500 imagens"', () => {
    render(
      <SecaoVinculo
        valor={{ tipo: 'cargos', itens: ['Vendedor'] }}
        onChange={vi.fn()}
        filiais={FILIAIS_VINCULO}
        cargos={[{ cargo: 'Vendedor', colaboradores: 1500 }]}
        colaboradores={VENDEDORES}
      />,
    )

    expect(
      screen.getByText('No encerramento serão geradas 1.500 imagens (uma por colaborador) na filial 100.'),
    ).toBeInTheDocument()
  })
})
