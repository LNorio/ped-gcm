import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { tabelasFaixasApi } from '../../test/faixasFalsos'
import { abrirMenuAcoes, escolherAcao, itensDoMenuAcoes, rotuloAcoesTabelaFaixas } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import { formatarMoeda, formatarPercentual } from '../../utils/formato'
import { ListaTabelasFaixas, type ListaTabelasFaixasProps } from './ListaTabelasFaixas'

const TABELAS = tabelasFaixasApi().map(paraTabelaFaixas)
const [COMERCIAL_101, , GERENTES_100] = TABELAS

const COLUNAS = ['Dashboard', 'Filial', 'Versão vigente', 'Faixas', 'Ações']
const COLUNAS_FAIXAS = ['De (R$)', 'Até (R$)', 'Alíquota (%)']
const MENU_COMPLETO = ['Ver faixas', 'Alterar faixas', 'Histórico de versões', 'Excluir tabela']

function renderizar(props: Partial<ListaTabelasFaixasProps> = {}) {
  const callbacks = {
    onAlterar: vi.fn(),
    onVerHistorico: vi.fn(),
    onExcluir: vi.fn(),
  }
  render(
    <ListaTabelasFaixas
      tabelas={TABELAS}
      podeAlterar
      podeVerHistorico
      podeExcluir
      textoVazio="Nenhuma tabela de faixas cadastrada."
      {...callbacks}
      {...props}
    />,
  )
  return callbacks
}

const tabela = () => screen.getByRole('table', { name: 'Tabelas de faixas' })
const linha = (nome: string) => within(tabela()).getByRole('button', { name: rotuloAcoesTabelaFaixas(nome) }).closest('tr')!

describe('F8.2 — ListaTabelasFaixas (tabelas de faixas da filial — RF-41, RNF-03)', () => {
  it('tabela "Tabelas de faixas" com as colunas Dashboard, Filial, Versão vigente, Faixas e Ações, uma linha por tabela', () => {
    renderizar()

    expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS)
    for (const nome of ['PED Comercial · Filial 101', 'PED Comercial · Filial 102', 'PED Gerentes · Filial 100', 'PED Antigo · Filial 101']) {
      expect(linha(nome)).toBeInTheDocument()
    }
  })

  it('mostra dashboard, descrição, filial (código - nome), versão vigente, data e autor da versão e a quantidade de faixas', () => {
    renderizar()

    const comercial = linha('PED Comercial · Filial 101')
    expect(within(comercial).getByText('PED Comercial')).toBeInTheDocument()
    expect(within(comercial).getByText('Resultado operacional')).toBeInTheDocument()
    expect(within(comercial).getByText('101 - CAMPO GRANDE')).toBeInTheDocument()
    expect(within(comercial).getByText('v2')).toBeInTheDocument()
    expect(within(comercial).getByText('20/10/2026 15:30 por Ana Costa')).toBeInTheDocument()
    expect(within(comercial).getByText('3 faixas')).toBeInTheDocument()

    const gerentes = linha('PED Gerentes · Filial 100')
    expect(within(gerentes).getByText('100 - MATRIZ')).toBeInTheDocument()
    expect(within(gerentes).getByText('v1')).toBeInTheDocument()
    expect(within(gerentes).getByText('01/08/2026 10:00 por Maria Souza')).toBeInTheDocument()
    expect(within(gerentes).getByText('1 faixa')).toBeInTheDocument()
  })

  it('tabela de dashboard excluído mostra a etiqueta "Dashboard excluído"; as demais não', () => {
    renderizar()

    expect(within(linha('PED Antigo · Filial 101')).getByText('Dashboard excluído')).toBeInTheDocument()
    expect(within(linha('PED Comercial · Filial 101')).queryByText('Dashboard excluído')).not.toBeInTheDocument()
  })

  it('sem data e sem autor da versão, não mostra o texto "por"', () => {
    renderizar({ tabelas: [{ ...GERENTES_100, dataDaVersao: null, autorDaVersao: null }] })

    const gerentes = linha('PED Gerentes · Filial 100')
    expect(within(gerentes).getByText('v1')).toBeInTheDocument()
    expect(within(gerentes).queryByText(/ por /)).not.toBeInTheDocument()
  })

  it('lista vazia mostra o texto de vazio informado', () => {
    renderizar({ tabelas: [], textoVazio: 'Nenhuma tabela de faixas para a filial 102.' })

    expect(screen.getByText('Nenhuma tabela de faixas para a filial 102.')).toBeInTheDocument()
  })

  describe('menu de ações por tabela ("Ações da tabela de faixas {nome}")', () => {
    it('com todas as permissões: Ver faixas, Alterar faixas, Histórico de versões e Excluir tabela (em todas as tabelas, inclusive de dashboard existente)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'))).toEqual(MENU_COMPLETO)
      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Antigo · Filial 101'))).toEqual(MENU_COMPLETO)
    })

    it('sem permissões de ação: só "Ver faixas"', async () => {
      const user = usuarioRapido()
      renderizar({ podeAlterar: false, podeVerHistorico: false, podeExcluir: false })

      expect(await itensDoMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'))).toEqual(['Ver faixas'])
    })

    it('"Excluir tabela" tem o destaque de perigo; "Alterar faixas" não', async () => {
      const user = usuarioRapido()
      renderizar()

      const menu = await abrirMenuAcoes(user, rotuloAcoesTabelaFaixas('PED Antigo · Filial 101'))
      expect(within(menu).getByRole('menuitem', { name: 'Excluir tabela' })).toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Alterar faixas' })).not.toHaveClass('menu-acoes__item--perigo')
    })

    it.each([
      ['Alterar faixas', 'onAlterar'],
      ['Histórico de versões', 'onVerHistorico'],
      ['Excluir tabela', 'onExcluir'],
    ] as const)('"%s" chama %s com a tabela da linha', async (item, callback) => {
      const user = usuarioRapido()
      const callbacks = renderizar()

      await escolherAcao(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'), item)

      expect(callbacks[callback]).toHaveBeenCalledTimes(1)
      expect(callbacks[callback]).toHaveBeenCalledWith(COMERCIAL_101)
    })
  })

  describe('"Ver faixas" — linhas De/Até (R$) e Alíquota (%) da versão vigente', () => {
    it('abre abaixo da linha a tabela "Faixas vigentes de {nome}" com valores em reais e percentuais pt-BR', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(screen.queryByRole('table', { name: 'Faixas vigentes de PED Comercial · Filial 101' })).not.toBeInTheDocument()
      await escolherAcao(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'), 'Ver faixas')

      const faixas = screen.getByRole('table', { name: 'Faixas vigentes de PED Comercial · Filial 101' })
      expect(within(faixas).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(COLUNAS_FAIXAS)
      const linhas = within(faixas).getAllByRole('row').slice(1)
      expect(linhas.map((l) => within(l).getAllByRole('cell').map((c) => c.textContent))).toEqual([
        [formatarMoeda(0), formatarMoeda(1000), formatarPercentual(0)],
        [formatarMoeda(1000.01), formatarMoeda(2000), formatarPercentual(1.5)],
        [formatarMoeda(2000.01), formatarMoeda(5000), formatarPercentual(3)],
      ])
    })

    it('o item passa a "Ocultar faixas" e, escolhido, fecha as faixas', async () => {
      const user = usuarioRapido()
      renderizar()
      const rotulo = rotuloAcoesTabelaFaixas('PED Gerentes · Filial 100')

      await escolherAcao(user, rotulo, 'Ver faixas')
      expect(screen.getByRole('table', { name: 'Faixas vigentes de PED Gerentes · Filial 100' })).toBeInTheDocument()
      expect(await itensDoMenuAcoes(user, rotulo)).toEqual(['Ocultar faixas', 'Alterar faixas', 'Histórico de versões', 'Excluir tabela'])

      await escolherAcao(user, rotulo, 'Ocultar faixas')
      expect(screen.queryByRole('table', { name: 'Faixas vigentes de PED Gerentes · Filial 100' })).not.toBeInTheDocument()
    })

    it('várias tabelas podem ficar abertas ao mesmo tempo', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherAcao(user, rotuloAcoesTabelaFaixas('PED Comercial · Filial 101'), 'Ver faixas')
      await escolherAcao(user, rotuloAcoesTabelaFaixas('PED Antigo · Filial 101'), 'Ver faixas')

      expect(screen.getByRole('table', { name: 'Faixas vigentes de PED Comercial · Filial 101' })).toBeInTheDocument()
      expect(screen.getByRole('table', { name: 'Faixas vigentes de PED Antigo · Filial 101' })).toBeInTheDocument()
    })

    it('mostra as faixas recebidas na nova lista (ex.: após "Alterar faixas")', async () => {
      const user = usuarioRapido()
      const props = { podeAlterar: true, podeVerHistorico: true, podeExcluir: true, textoVazio: '', onAlterar: vi.fn(), onVerHistorico: vi.fn(), onExcluir: vi.fn() }
      const { rerender } = render(<ListaTabelasFaixas tabelas={[GERENTES_100]} {...props} />)

      await escolherAcao(user, rotuloAcoesTabelaFaixas('PED Gerentes · Filial 100'), 'Ver faixas')
      rerender(
        <ListaTabelasFaixas
          tabelas={[{ ...GERENTES_100, versaoVigente: 2, quantidadeDeFaixas: 2, faixas: [{ de: 0, ate: 3000, aliquota: 0.5 }, { de: 3000.01, ate: 6000, aliquota: 1 }] }]}
          {...props}
        />,
      )

      const faixas = screen.getByRole('table', { name: 'Faixas vigentes de PED Gerentes · Filial 100' })
      expect(within(faixas).getAllByRole('row').slice(1)).toHaveLength(2)
      expect(within(faixas).getByText(formatarMoeda(6000).replace(/\s/g, ' '))).toBeInTheDocument()
    })
  })
})
