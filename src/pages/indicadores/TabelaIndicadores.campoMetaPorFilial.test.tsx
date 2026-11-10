import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import { INDICADOR_COBERTURA_VISITAS_API, INDICADOR_TICKET_MEDIO_API } from '../../test/indicadoresFalsos'
import type { Indicador } from '../../types/dominio'
import { TabelaIndicadores } from './TabelaIndicadores'

/**
 * F6.10 — Coluna Meta com o campo `"meta por filial"` da API (26) (`Indicador.metaPorFilial`):
 * na visão "Todas as filiais", `metaPorFilial: true` mostra "Por filial" (mesmo sem a lista de metas);
 * `metaPorFilial: false` mostra a meta única, como antes. A visão de uma filial não muda (F6.10).
 */
const COL_META = 3

describe('F6.10 — TabelaIndicadores: coluna Meta pelo campo "meta por filial"', () => {
  function renderizar(indicadores: Indicador[]) {
    render(
      <TabelaIndicadores
        indicadores={indicadores}
        filialSelecionada="todas"
        podeDefinirMeta
        podeVerHistorico
        podeAlterarSituacao
        podeExcluir
        onDefinirMeta={vi.fn()}
        onVerHistorico={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
      />,
    )
  }

  function celulaMeta(nome: string): HTMLElement {
    const linha = within(screen.getByRole('table', { name: 'Indicadores' })).getByText(nome).closest('tr')!
    return within(linha).getAllByRole('cell')[COL_META]
  }

  it('metaPorFilial true: "Por filial", mesmo com a lista de metas vazia', () => {
    renderizar([{ ...paraIndicador(INDICADOR_TICKET_MEDIO_API), metaPorFilial: true, meta: null, metasPorFilial: [], filiaisSemMeta: [] }])

    expect(celulaMeta('Ticket médio por filial')).toHaveTextContent(/^Por filial$/)
  })

  it('metaPorFilial false: a meta única formatada', () => {
    renderizar([{ ...paraIndicador(INDICADOR_COBERTURA_VISITAS_API), metaPorFilial: false }])

    expect(celulaMeta('Cobertura de visitas')).toHaveTextContent(/^85,00$/)
  })
})
