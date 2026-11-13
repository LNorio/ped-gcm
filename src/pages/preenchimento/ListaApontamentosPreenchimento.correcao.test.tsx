import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APONTAMENTO_INADIMPLENCIA, APONTAMENTO_VISITAS, telaMesFechado, tiposPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { usuarioRapido } from '../../test/usuario'
import { ListaApontamentosPreenchimento, type ListaApontamentosPreenchimentoProps } from './ListaApontamentosPreenchimento'

/**
 * Ações de correção e histórico na linha do apontamento (F9.7 — RF-62, RF-68, RF-69):
 * - "Corrigir" só no mês editável e só em apontamento já lançado (com valor);
 * - "Histórico" em apontamento já lançado, em qualquer mês (consulta incluída);
 * - apontamento sem valor não tem nenhum dos dois.
 * Os botões chamam `onCorrigir(apontamento)` e `onVerHistorico(apontamento)`.
 */
describe('F9.7 — ListaApontamentosPreenchimento ("Corrigir" e "Histórico" por apontamento)', () => {
  function renderizar(props: Partial<ListaApontamentosPreenchimentoProps> = {}) {
    const completas: ListaApontamentosPreenchimentoProps = {
      tipos: tiposPreenchimento(),
      editavel: true,
      rascunhos: {},
      onAlterarRascunho: vi.fn(),
      erros: {},
      onCorrigir: vi.fn(),
      onVerHistorico: vi.fn(),
      ...props,
    }
    render(<ListaApontamentosPreenchimento {...completas} />)
    return completas
  }

  const linha = (nome: string) => screen.getByRole('article', { name: nome })

  it('mês editável: apontamentos já lançados oferecem "Corrigir" e "Histórico"', () => {
    renderizar()

    for (const nome of ['Visitas a clientes', 'Inadimplência']) {
      expect(within(linha(nome)).getByRole('button', { name: 'Corrigir' })).toBeInTheDocument()
      expect(within(linha(nome)).getByRole('button', { name: 'Histórico' })).toBeInTheDocument()
    }
  })

  it('apontamento sem valor não oferece "Corrigir" nem "Histórico"', () => {
    renderizar()

    expect(within(linha('Vitrine montada')).queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument()
    expect(within(linha('Vitrine montada')).queryByRole('button', { name: 'Histórico' })).not.toBeInTheDocument()
  })

  it('"Corrigir" chama onCorrigir com o apontamento da linha', async () => {
    const user = usuarioRapido()
    const props = renderizar()

    await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Corrigir' }))

    expect(props.onCorrigir).toHaveBeenCalledWith(APONTAMENTO_INADIMPLENCIA)
    expect(props.onVerHistorico).not.toHaveBeenCalled()
  })

  it('"Histórico" chama onVerHistorico com o apontamento da linha', async () => {
    const user = usuarioRapido()
    const props = renderizar()

    await user.click(within(linha('Visitas a clientes')).getByRole('button', { name: 'Histórico' }))

    expect(props.onVerHistorico).toHaveBeenCalledWith(APONTAMENTO_VISITAS)
    expect(props.onCorrigir).not.toHaveBeenCalled()
  })

  it('mês não editável (consulta): nenhum "Corrigir", mas "Histórico" continua nos já lançados', () => {
    renderizar({ tipos: telaMesFechado().tipos, editavel: false })

    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument()
    expect(within(linha('Visitas a clientes')).getByRole('button', { name: 'Histórico' })).toBeInTheDocument()
    expect(within(linha('Inadimplência')).getByRole('button', { name: 'Histórico' })).toBeInTheDocument()
    expect(within(linha('Vitrine montada')).queryByRole('button', { name: 'Histórico' })).not.toBeInTheDocument()
  })
})
