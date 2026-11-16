import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APONTAMENTO_INADIMPLENCIA, APONTAMENTO_PEDIDOS, telaMesFechado, tiposPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { ApontamentoPreenchimento, TipoPreenchimento } from '../../types/dominio'
import { ListaApontamentosPreenchimento, type ListaApontamentosPreenchimentoProps } from './ListaApontamentosPreenchimento'

/**
 * Entrada dos valores na lista (F9.6 — RF-66, RF-67, RF-62). A lista é controlada pela página:
 * - no mês editável, cada apontamento **sem valor** mostra o `CampoValorApontamento` com o texto de
 *   `rascunhos[id]` e avisa as mudanças em `onAlterarRascunho(id, texto)`;
 * - apontamento **com valor** não tem campo (o valor é lançado uma única vez; mudar é "Corrigir" — F9.7);
 * - `erros[id]` (validação local ou da API) aparece como alerta na linha do apontamento;
 * - fora do mês aberto (`editavel: false`), nenhum campo de valor.
 * Subabas por tipo (alteração de 13/11/2026): os rascunhos de outra aba continuam no campo ao voltar a
 * ela; um erro novo só em apontamentos de outras abas (ou oculto pela busca, que é limpa) seleciona a
 * aba do primeiro apontamento com erro; `pedidoFoco` num apontamento de outra aba seleciona a aba dele
 * e leva o foco ao campo.
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
  const aba = (tipo: string) =>
    within(screen.getByRole('tablist', { name: 'Tipos de apontamento' })).getByRole('tab', { name: (nome) => nome.startsWith(tipo) })

  it('mês editável: o apontamento booleano sem valor mostra Sim/Não; os com valor não têm campo', async () => {
    const user = usuarioRapido()
    renderizar()

    expect(within(linha('Vitrine montada')).getByRole('group', { name: 'Valor de Vitrine montada' })).toBeInTheDocument()
    expect(within(linha('Visitas a clientes')).queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(aba('Financeiro'))
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

    it('ao receber erro de um apontamento escondido pela busca, a busca é limpa, as abas voltam e o erro aparece na linha', async () => {
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
      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')
      expect(aba('Financeiro')).toBeInTheDocument()
      expect(screen.getAllByRole('article')).toHaveLength(3)
    })
  })

  // Alteração de 13/11/2026 (subabas por tipo, como no protótipo): erro ou foco num apontamento de outra aba.
  describe('subabas: rascunhos, erros e foco em apontamentos de outra aba', () => {
    const RENEGOCIADOS: ApontamentoPreenchimento = { ...APONTAMENTO_PEDIDOS, id: 12, nome: 'Títulos renegociados' }
    const tiposComPendenteNoFinanceiro = (): TipoPreenchimento[] => [
      tiposPreenchimento()[0],
      { id: 2, nome: 'Financeiro', quantidade: 2, apontamentos: [APONTAMENTO_INADIMPLENCIA, RENEGOCIADOS] },
    ]
    const propsBase = (): ListaApontamentosPreenchimentoProps => ({
      tipos: tiposComPendenteNoFinanceiro(),
      editavel: true,
      rascunhos: {},
      onAlterarRascunho: vi.fn(),
      erros: {},
      onCorrigir: vi.fn(),
      onVerHistorico: vi.fn(),
    })
    const campoRenegociados = () => within(linha('Títulos renegociados')).getByRole('textbox', { name: 'Valor de Títulos renegociados' })

    it('o rascunho de outra aba aparece no campo ao voltar para ela', async () => {
      const user = usuarioRapido()
      render(<ListaApontamentosPreenchimento {...propsBase()} rascunhos={{ [RENEGOCIADOS.id]: '3' }} />)

      await user.click(aba('Financeiro'))
      expect(campoRenegociados()).toHaveValue('3')
      await user.click(aba('Comercial'))
      expect(screen.queryByRole('article', { name: 'Títulos renegociados' })).not.toBeInTheDocument()
      await user.click(aba('Financeiro'))

      expect(campoRenegociados()).toHaveValue('3')
    })

    it('erro novo só num apontamento de outra aba: a aba dele é selecionada e o erro aparece na linha', () => {
      const props = propsBase()
      const { rerender } = render(<ListaApontamentosPreenchimento {...props} />)
      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')

      rerender(<ListaApontamentosPreenchimento {...props} erros={{ [RENEGOCIADOS.id]: 'Apontamento desativado.' }} />)

      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'false')
      expect(within(linha('Títulos renegociados')).getByRole('alert')).toHaveTextContent('Apontamento desativado.')
    })

    it('erro num apontamento da aba atual: a aba selecionada continua a mesma', () => {
      const props = propsBase()
      const { rerender } = render(<ListaApontamentosPreenchimento {...props} />)

      rerender(<ListaApontamentosPreenchimento {...props} erros={{ 7: 'Apontamento desativado.' }} />)

      expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')
      expect(within(linha('Vitrine montada')).getByRole('alert')).toHaveTextContent('Apontamento desativado.')
    })

    it('pedido de foco num apontamento de outra aba: seleciona a aba e leva o foco ao campo dele', () => {
      const props = propsBase()
      const { rerender } = render(<ListaApontamentosPreenchimento {...props} rascunhos={{ [RENEGOCIADOS.id]: '-5' }} />)

      rerender(
        <ListaApontamentosPreenchimento
          {...props}
          rascunhos={{ [RENEGOCIADOS.id]: '-5' }}
          erros={{ [RENEGOCIADOS.id]: 'O valor não pode ser negativo.' }}
          pedidoFoco={{ id: RENEGOCIADOS.id }}
        />,
      )

      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
      expect(campoRenegociados()).toHaveFocus()
      expect(campoRenegociados()).toHaveValue('-5')
    })

    it('erro de um apontamento de outra aba, oculto pela busca: a busca é limpa e a aba dele é selecionada', async () => {
      const user = usuarioRapido()
      const props = propsBase()
      const { rerender } = render(<ListaApontamentosPreenchimento {...props} />)
      await user.type(screen.getByLabelText('Buscar apontamento ou indicador'), 'Vitrine')

      rerender(<ListaApontamentosPreenchimento {...props} erros={{ [RENEGOCIADOS.id]: 'Apontamento desativado.' }} />)

      expect(screen.getByLabelText('Buscar apontamento ou indicador')).toHaveValue('')
      expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
      expect(within(linha('Títulos renegociados')).getByRole('alert')).toHaveTextContent('Apontamento desativado.')
    })
  })
})
