import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { NOME_COMERCIAL_100_INATIVA, NOME_GERAL_SUPERVISORES, tabelasFaixasComSituacaoApi } from '../../test/faixasFalsos'
import { rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import { ListaTabelasFaixas, type ListaTabelasFaixasProps } from './ListaTabelasFaixas'

const TABELAS = tabelasFaixasComSituacaoApi().map(paraTabelaFaixas)
const COMERCIAL_101 = TABELAS.find((t) => t.id === 1)!
const INATIVA_100 = TABELAS.find((t) => t.id === 6)!

function renderizar(props: Partial<ListaTabelasFaixasProps> = {}) {
  const callbacks = {
    onAlterar: vi.fn(),
    onVerHistorico: vi.fn(),
    onExcluir: vi.fn(),
    onAlterarSituacao: vi.fn(),
    onVerMotivo: vi.fn(),
  }
  render(
    <ListaTabelasFaixas
      tabelas={TABELAS}
      podeAlterar
      podeVerHistorico
      podeExcluir
      podeAlterarSituacao
      textoVazio="Nenhuma tabela de faixas cadastrada."
      {...callbacks}
      {...props}
    />,
  )
  return callbacks
}

const linha = (nome: string) =>
  within(screen.getByRole('table', { name: 'Tabelas de faixas' }))
    .getByRole('button', { name: rotuloAcoesTabelaFaixas(nome) })
    .closest('tr')!

/**
 * Pedido do usuário (12/11/2026): "ter um botão que mostra o motivo da alteração da versão das
 * faixas". Botão "Ver motivo" visível em cada linha (fora do menu de ações), com a mesma permissão do
 * histórico (`podeVerHistorico`, pois usa `GET .../historico`); chama `onVerMotivo` com a tabela.
 */
describe('F8.8 — ListaTabelasFaixas: botão "Ver motivo" em cada linha', () => {
  it('cada linha (ativa, inativa e faixa geral) tem o botão "Ver motivo"', () => {
    renderizar()

    for (const nome of ['PED Comercial · Filial 101', NOME_GERAL_SUPERVISORES, NOME_COMERCIAL_100_INATIVA]) {
      expect(within(linha(nome)).getByRole('button', { name: 'Ver motivo' })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('button', { name: 'Ver motivo' })).toHaveLength(TABELAS.length)
  })

  it('"Ver motivo" chama onVerMotivo com a tabela da linha', async () => {
    const user = usuarioRapido()
    const callbacks = renderizar()

    await user.click(within(linha('PED Comercial · Filial 101')).getByRole('button', { name: 'Ver motivo' }))
    await user.click(within(linha(NOME_COMERCIAL_100_INATIVA)).getByRole('button', { name: 'Ver motivo' }))

    expect(callbacks.onVerMotivo).toHaveBeenNthCalledWith(1, COMERCIAL_101)
    expect(callbacks.onVerMotivo).toHaveBeenNthCalledWith(2, INATIVA_100)
    expect(callbacks.onVerHistorico).not.toHaveBeenCalled()
  })

  it('"Ver motivo" não é item do menu de ações', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.click(screen.getByRole('button', { name: rotuloAcoesTabelaFaixas('PED Comercial · Filial 101') }))

    expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: 'Ver motivo' })).not.toBeInTheDocument()
  })

  it('sem podeVerHistorico, não há "Ver motivo"', () => {
    renderizar({ podeVerHistorico: false })

    expect(screen.queryByRole('button', { name: 'Ver motivo' })).not.toBeInTheDocument()
  })
})
