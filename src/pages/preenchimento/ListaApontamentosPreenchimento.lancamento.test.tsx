import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APONTAMENTO_INADIMPLENCIA, APONTAMENTO_PEDIDOS, telaMesFechado, tiposPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { TipoPreenchimento } from '../../types/dominio'
import { ListaApontamentosPreenchimento, type ListaApontamentosPreenchimentoProps } from './ListaApontamentosPreenchimento'

/**
 * Entrada dos valores na lista (F9.6 — RF-66, RF-67, RF-62). A lista é controlada pela página:
 * - no mês editável, cada apontamento **sem valor** mostra o `CampoValorApontamento` com o texto de
 *   `rascunhos[id]` e avisa as mudanças em `onAlterarRascunho(id, texto)`;
 * - apontamento **com valor** não tem campo (o valor é lançado uma única vez; mudar é "Corrigir" — F9.7);
 * - `erros[id]` (validação local ou da API) aparece como alerta na linha do apontamento;
 * - fora do mês aberto (`editavel: false`), nenhum campo de valor.
 */
describe('F9.6 — ListaApontamentosPreenchimento (campos de valor e erros por apontamento)', () => {
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

  it('mês editável: o apontamento booleano sem valor mostra Sim/Não; os com valor não têm campo', () => {
    renderizar()

    expect(within(linha('Vitrine montada')).getByRole('group', { name: 'Valor de Vitrine montada' })).toBeInTheDocument()
    expect(within(linha('Visitas a clientes')).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(linha('Inadimplência')).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('apontamento Numeral sem valor mostra a caixa "Valor de {nome}" com o rascunho', () => {
    const tipos: TipoPreenchimento[] = [{ id: 1, nome: 'Comercial', quantidade: 1, apontamentos: [APONTAMENTO_PEDIDOS] }]
    renderizar({ tipos, rascunhos: { [APONTAMENTO_PEDIDOS.id]: '42,5' } })

    expect(within(linha('Pedidos digitados')).getByRole('textbox', { name: 'Valor de Pedidos digitados' })).toHaveValue('42,5')
  })

  it('Porcentagem sem valor mostra a caixa com "%"', () => {
    const tipos: TipoPreenchimento[] = [
      { id: 2, nome: 'Financeiro', quantidade: 1, apontamentos: [{ ...APONTAMENTO_INADIMPLENCIA, situacao: 'pendente', valor: null }] },
    ]
    renderizar({ tipos })

    expect(within(linha('Inadimplência')).getByRole('textbox', { name: 'Valor de Inadimplência' })).toBeInTheDocument()
    expect(within(linha('Inadimplência')).getByText('%')).toBeInTheDocument()
  })

  it('digitar no campo chama onAlterarRascunho(id, texto)', async () => {
    const user = usuarioRapido()
    const tipos: TipoPreenchimento[] = [{ id: 1, nome: 'Comercial', quantidade: 1, apontamentos: [APONTAMENTO_PEDIDOS] }]
    const props = renderizar({ tipos })

    await user.type(within(linha('Pedidos digitados')).getByRole('textbox', { name: 'Valor de Pedidos digitados' }), '7')

    expect(props.onAlterarRascunho).toHaveBeenCalledWith(APONTAMENTO_PEDIDOS.id, '7')
  })

  it('clicar em "Sim" chama onAlterarRascunho(id, "sim"); o rascunho "sim" deixa "Sim" pressionado', async () => {
    const user = usuarioRapido()
    const props = renderizar()

    await user.click(within(linha('Vitrine montada')).getByRole('button', { name: 'Sim' }))
    expect(props.onAlterarRascunho).toHaveBeenCalledWith(7, 'sim')
  })

  it('o rascunho "nao" deixa "Não" pressionado', () => {
    renderizar({ rascunhos: { 7: 'nao' } })

    expect(within(linha('Vitrine montada')).getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('erros[id] aparece como alerta na linha daquele apontamento, e só nela', () => {
    const tipos: TipoPreenchimento[] = [
      { id: 1, nome: 'Comercial', quantidade: 3, apontamentos: [...tiposPreenchimento()[0].apontamentos, APONTAMENTO_PEDIDOS] },
    ]
    renderizar({ tipos, erros: { [APONTAMENTO_PEDIDOS.id]: 'O valor não pode ser negativo.' } })

    expect(within(linha('Pedidos digitados')).getByRole('alert')).toHaveTextContent('O valor não pode ser negativo.')
    expect(within(linha('Vitrine montada')).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('mês não editável (consulta): nenhum campo de valor nem botão Sim/Não', () => {
    renderizar({ tipos: telaMesFechado().tipos, editavel: false })

    expect(screen.queryByRole('textbox', { name: /^Valor de/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /^Valor de/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sim' })).not.toBeInTheDocument()
  })

  it('mês não editável: o apontamento sem valor mostra "—" no lugar do valor', () => {
    renderizar({ tipos: telaMesFechado().tipos, editavel: false })

    expect(within(linha('Vitrine montada')).getByText('—')).toBeInTheDocument()
  })

  // Revisão da F9 em 13/11/2026: o erro de um apontamento escondido pela busca precisa ficar visível.
  describe('erro num apontamento oculto pela busca', () => {
    const tiposComPedidos = (): TipoPreenchimento[] => [
      { id: 1, nome: 'Comercial', quantidade: 3, apontamentos: [...tiposPreenchimento()[0].apontamentos, APONTAMENTO_PEDIDOS] },
      tiposPreenchimento()[1],
    ]
    const campoBusca = () => screen.getByLabelText('Buscar apontamento ou indicador')

    it('ao receber erro de um apontamento escondido pela busca, a busca é limpa e o erro aparece na linha', async () => {
      const user = usuarioRapido()
      const props: ListaApontamentosPreenchimentoProps = {
        tipos: tiposComPedidos(),
        editavel: true,
        rascunhos: { [APONTAMENTO_PEDIDOS.id]: '-5' },
        onAlterarRascunho: vi.fn(),
        erros: {},
        onCorrigir: vi.fn(),
        onVerHistorico: vi.fn(),
      }
      const { rerender } = render(<ListaApontamentosPreenchimento {...props} />)
      await user.type(campoBusca(), 'Vitrine')
      expect(screen.queryByRole('article', { name: 'Pedidos digitados' })).not.toBeInTheDocument()

      rerender(<ListaApontamentosPreenchimento {...props} erros={{ [APONTAMENTO_PEDIDOS.id]: 'O valor não pode ser negativo.' }} />)

      expect(campoBusca()).toHaveValue('')
      expect(within(linha('Pedidos digitados')).getByRole('alert')).toHaveTextContent('O valor não pode ser negativo.')
      expect(screen.getByRole('region', { name: 'Financeiro' })).toBeInTheDocument()
      expect(screen.getAllByRole('article')).toHaveLength(4)
    })
  })
})
