import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import {
  NOME_COMERCIAL_100_INATIVA,
  NOME_GERAL_GERENTES_INATIVA,
  NOME_GERAL_SUPERVISORES,
  tabelasFaixasComSituacaoApi,
} from '../../test/faixasFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import { ListaTabelasFaixas, type ListaTabelasFaixasProps } from './ListaTabelasFaixas'

const TABELAS = tabelasFaixasComSituacaoApi().map(paraTabelaFaixas)
const COMERCIAL_101 = TABELAS.find((t) => t.id === 1)!
const GERAL_SUPERVISORES = TABELAS.find((t) => t.id === 5)!
const INATIVA_100 = TABELAS.find((t) => t.id === 6)!
const GERAL_GERENTES_INATIVA = TABELAS.find((t) => t.id === 7)!
const EXCLUIDO_101 = TABELAS.find((t) => t.id === 4)!
const NOME_EXCLUIDO_101 = 'PED Antigo · Filial 101'

const MENU_ATIVA = ['Ver faixas', 'Alterar faixas', 'Histórico de versões', 'Inativar tabela', 'Excluir tabela']
const MENU_INATIVA = ['Ver faixas', 'Histórico de versões', 'Reativar tabela', 'Excluir tabela']

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

const tabela = () => screen.getByRole('table', { name: 'Tabelas de faixas' })
const linha = (nome: string) => within(tabela()).getByRole('button', { name: rotuloAcoesTabelaFaixas(nome) }).closest('tr')!

/**
 * Proposta "faixa geral e situação" (12/11/2026): faixa geral (todas as filiais) e situação
 * ativa/inativa na lista. Props novas: `podeAlterarSituacao` e `onAlterarSituacao` (e `onVerMotivo`,
 * da F8.8). A faixa geral tem as mesmas ações das faixas por filial, para Admin e Validador
 * (decisão do negócio de 12/11/2026).
 *
 * Contrato final (F8.12*): a faixa de dashboard já excluído não muda de situação (a API responde
 * `400`); o menu dela não oferece "Inativar tabela" nem "Reativar tabela", só a exclusão.
 */
describe('F8.7 — ListaTabelasFaixas: faixa geral, etiqueta "Inativa" e ações Inativar/Reativar', () => {
  describe('exibição', () => {
    it('a faixa geral aparece como "{dashboard} · Geral", com "Todas as filiais (geral)" na coluna Filial', () => {
      renderizar()

      const geral = linha(NOME_GERAL_SUPERVISORES)
      expect(within(geral).getByText('PED Supervisores')).toBeInTheDocument()
      expect(within(geral).getByText('Todas as filiais (geral)')).toBeInTheDocument()
      expect(within(geral).getByText('v1')).toBeInTheDocument()
      expect(within(geral).getByText('1 faixa')).toBeInTheDocument()
      expect(within(linha('PED Comercial · Filial 101')).getByText('101 - CAMPO GRANDE')).toBeInTheDocument()
    })

    it('a tabela inativa (por filial ou geral) leva a etiqueta "Inativa"; as ativas não', () => {
      renderizar()

      expect(within(linha(NOME_COMERCIAL_100_INATIVA)).getByText('Inativa')).toBeInTheDocument()
      expect(within(linha(NOME_GERAL_GERENTES_INATIVA)).getByText('Inativa')).toBeInTheDocument()
      expect(within(linha('PED Comercial · Filial 101')).queryByText('Inativa')).not.toBeInTheDocument()
      expect(within(linha(NOME_GERAL_SUPERVISORES)).queryByText('Inativa')).not.toBeInTheDocument()
    })

    it('"Ver faixas" da faixa geral abre "Faixas vigentes de {dashboard} · Geral"', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_GERAL_SUPERVISORES), 'Ver faixas')

      expect(screen.getByRole('table', { name: `Faixas vigentes de ${NOME_GERAL_SUPERVISORES}` })).toBeInTheDocument()
    })
  })

  describe('menu de ações', () => {
    it('tabela ativa (por filial ou geral): Ver faixas, Alterar faixas, Histórico de versões, Inativar tabela e Excluir tabela', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'))).toEqual(MENU_ATIVA)
      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_GERAL_SUPERVISORES))).toEqual(MENU_ATIVA)
    })

    it('tabela inativa: "Alterar faixas" indisponível e "Reativar tabela" no lugar de "Inativar tabela"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_COMERCIAL_100_INATIVA))).toEqual(MENU_INATIVA)
      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_GERAL_GERENTES_INATIVA))).toEqual(MENU_INATIVA)
    })

    it('sem podeAlterarSituacao: sem "Inativar tabela" nem "Reativar tabela"', async () => {
      const user = usuarioRapido()
      renderizar({ podeAlterarSituacao: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'))).toEqual([
        'Ver faixas',
        'Alterar faixas',
        'Histórico de versões',
        'Excluir tabela',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_COMERCIAL_100_INATIVA))).toEqual([
        'Ver faixas',
        'Histórico de versões',
        'Excluir tabela',
      ])
    })

    it.each([
      ['Inativar tabela', 'PED Comercial · Filial 101', COMERCIAL_101],
      ['Inativar tabela', NOME_GERAL_SUPERVISORES, GERAL_SUPERVISORES],
      ['Reativar tabela', NOME_COMERCIAL_100_INATIVA, INATIVA_100],
      ['Reativar tabela', NOME_GERAL_GERENTES_INATIVA, GERAL_GERENTES_INATIVA],
    ] as const)('"%s" em "%s" chama onAlterarSituacao com a tabela da linha', async (item, nome, esperada) => {
      const user = usuarioRapido()
      const callbacks = renderizar()

      await escolherAcao(user, rotuloAcoesTabelaFaixas(nome), item)

      expect(callbacks.onAlterarSituacao).toHaveBeenCalledTimes(1)
      expect(callbacks.onAlterarSituacao).toHaveBeenCalledWith(esperada)
      expect(callbacks.onExcluir).not.toHaveBeenCalled()
    })

    it('tabela de dashboard excluído (contrato final: a situação não muda): sem "Inativar tabela"; "Excluir tabela" continua', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_EXCLUIDO_101))).toEqual([
        'Ver faixas',
        'Alterar faixas',
        'Histórico de versões',
        'Excluir tabela',
      ])
    })

    it('tabela inativa de dashboard excluído: sem "Reativar tabela"; "Excluir tabela" continua', async () => {
      const user = usuarioRapido()
      renderizar({ tabelas: [{ ...EXCLUIDO_101, situacao: 'inativa' }] })

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas(NOME_EXCLUIDO_101))).toEqual([
        'Ver faixas',
        'Histórico de versões',
        'Excluir tabela',
      ])
    })

    it('"Excluir tabela" da tabela de dashboard excluído chama onExcluir; onAlterarSituacao nunca é chamado', async () => {
      const user = usuarioRapido()
      const callbacks = renderizar()

      await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_EXCLUIDO_101), 'Excluir tabela')

      expect(callbacks.onExcluir).toHaveBeenCalledWith(EXCLUIDO_101)
      expect(callbacks.onAlterarSituacao).not.toHaveBeenCalled()
    })

    it('"Excluir tabela" da tabela inativa chama onExcluir com a tabela da linha', async () => {
      const user = usuarioRapido()
      const callbacks = renderizar()

      await escolherAcao(user, rotuloAcoesTabelaFaixas(NOME_COMERCIAL_100_INATIVA), 'Excluir tabela')

      expect(callbacks.onExcluir).toHaveBeenCalledWith(INATIVA_100)
    })
  })
})
