import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraFechamento } from '../../services/adaptadores'
import { fechamentosApi } from '../../test/fechamentosFalsos'
import type { Fechamento } from '../../types/dominio'
import { TabelaFechamentos } from './TabelaFechamentos'

const FECHAMENTOS: Fechamento[] = fechamentosApi().map(paraFechamento)
const porNome = (nome: string) => FECHAMENTOS.find((f) => f.nome === nome)!

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — `TabelaFechamentos`:
 * - progresso "{preenchidos} de {total} lançamento(s)" no singular ou no plural **pelo total**: "0 de 1
 *   lançamento", "1 de 1 lançamento", "0 de 2 lançamentos", "0 de 0 lançamentos";
 * - contagens com separador de milhar (`formatarInteiro`): "1.234 de 1.500 lançamentos", "1.500
 *   colaboradores vinculados", "1.500 colaboradores" (unidades).
 */
describe('F12.2 — TabelaFechamentos: plural pelo total e separador de milhar', () => {
  function renderizar(fechamentos: Fechamento[]) {
    render(<TabelaFechamentos fechamentos={fechamentos} onPrevisualizar={vi.fn()} onEncerrar={vi.fn()} />)
    return screen.getByRole('table', { name: 'Fechamentos por dashboard' })
  }

  function linha(tabela: HTMLElement, nome: string): HTMLElement {
    const tr = within(tabela).getByText(nome).closest('tr')
    if (!tr) throw new Error(`Linha de ${nome} não encontrada`)
    return tr
  }

  it.each([
    [0, 1, '0 de 1 lançamento'],
    [1, 1, '1 de 1 lançamento'],
    [0, 2, '0 de 2 lançamentos'],
    [0, 0, '0 de 0 lançamentos'],
  ])('progresso %d de %d: "%s"', (preenchidos, total, esperado) => {
    const tabela = renderizar([{ ...porNome('PED Gerentes'), progresso: { preenchidos, total } }])

    expect(within(linha(tabela, 'PED Gerentes')).getByText(esperado)).toBeInTheDocument()
  })

  it('progresso com milhar: "1.234 de 1.500 lançamentos"', () => {
    const tabela = renderizar([{ ...porNome('PED Gerentes'), progresso: { preenchidos: 1234, total: 1500 } }])

    expect(within(linha(tabela, 'PED Gerentes')).getByText('1.234 de 1.500 lançamentos')).toBeInTheDocument()
  })

  it('vínculo por colaboradores com 1.500 itens e 1.500 unidades: "1.500 colaboradores vinculados" e "1.500 colaboradores"', () => {
    const itens = Array.from({ length: 1500 }, (_, i) => String(i + 1))
    const tabela = renderizar([{ ...porNome('PED Vendedores'), itensVinculados: itens, unidadesDeImagem: 1500 }])

    const tr = linha(tabela, 'PED Vendedores')
    expect(within(tr).getByText('1.500 colaboradores vinculados')).toBeInTheDocument()
    expect(within(tr).getByText('1.500 colaboradores')).toBeInTheDocument()
  })
})
