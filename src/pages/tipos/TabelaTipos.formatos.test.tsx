import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TIPO_LOGISTICA_API, tipoDominio } from '../../test/tiposFalsos'
import type { TipoApontamento } from '../../types/dominio'
import { TabelaTipos } from './TabelaTipos'

/** Índice da coluna "Apontamentos" (Nome, Origem, Grupos vinculados, Apontamentos, Ações). */
const COLUNA_APONTAMENTOS = 3

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — a coluna "Apontamentos" de `TabelaTipos`
 * mostra a contagem com separador de milhar (`formatarInteiro`): 1500 vira "1.500".
 */
describe('F12.2 — TabelaTipos: contagem de apontamentos com separador de milhar', () => {
  function renderizar(tipos: TipoApontamento[]) {
    render(<TabelaTipos tipos={tipos} podeEditar podeExcluir onEditar={vi.fn()} onExcluir={vi.fn()} />)
    const linha = screen.getByRole('cell', { name: 'Logística' }).closest('tr')
    if (!linha) throw new Error('Linha de Logística não encontrada')
    return within(linha).getAllByRole('cell')[COLUNA_APONTAMENTOS]
  }

  it.each([
    [0, '0'],
    [3, '3'],
    [999, '999'],
    [1000, '1.000'],
    [1500, '1.500'],
    [1234567, '1.234.567'],
  ])('%d apontamentos aparece como "%s"', (quantidade, esperado) => {
    const celula = renderizar([{ ...tipoDominio(TIPO_LOGISTICA_API), quantidadeApontamentos: quantidade }])

    expect(celula).toHaveTextContent(new RegExp(`^${esperado.replace(/\./g, '\\.')}$`))
  })
})
