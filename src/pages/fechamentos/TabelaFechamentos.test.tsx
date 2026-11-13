import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraFechamento } from '../../services/adaptadores'
import { FECHAMENTO_COMERCIAL_API, fechamentosApi } from '../../test/fechamentosFalsos'
import { escolherAcao, itensDoMenuAcoes, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import type { Fechamento } from '../../types/dominio'
import { TabelaFechamentos, type TabelaFechamentosProps } from './TabelaFechamentos'

/** PED Gerentes (mensal, aberto), PED Comercial (trimestral, aberto) e PED Vendedores (anual, encerrado). */
const FECHAMENTOS: Fechamento[] = fechamentosApi().map(paraFechamento)
const porNome = (nome: string) => FECHAMENTOS.find((f) => f.nome === nome)!

const LEGENDA = 'Fechamentos por dashboard'

describe('F10.2 — TabelaFechamentos: linhas da aba Fechamentos (RF-78, RN-16)', () => {
  function renderizar(props: Partial<TabelaFechamentosProps> = {}) {
    const callbacks = {
      onPrevisualizar: props.onPrevisualizar ?? vi.fn(),
      onEncerrar: props.onEncerrar ?? vi.fn(),
    }
    render(<TabelaFechamentos fechamentos={props.fechamentos ?? FECHAMENTOS} textoVazio={props.textoVazio} {...callbacks} />)
    return callbacks
  }

  const tabela = () => screen.getByRole('table', { name: LEGENDA })

  /** Linha (`<tr>`) do dashboard com o nome informado. */
  function linha(nome: string): HTMLElement {
    const celula = within(tabela()).getByText(nome)
    const tr = celula.closest('tr')
    if (!tr) throw new Error(`Linha de ${nome} não encontrada`)
    return tr
  }

  it(`tabela nomeada "${LEGENDA}" com as colunas Dashboard, Unidades, Periodicidade, Período atual, Progresso e Ações`, () => {
    renderizar()

    expect(within(tabela()).getAllByRole('columnheader').map((c) => c.textContent?.trim())).toEqual([
      'Dashboard',
      'Unidades',
      'Periodicidade',
      'Período atual',
      'Progresso',
      'Ações',
    ])
  })

  it('mantém a ordem recebida (uma linha por dashboard)', () => {
    renderizar()

    const nomes = within(tabela())
      .getAllByRole('row')
      .slice(1)
      .map((tr) => FECHAMENTOS.find((f) => within(tr).queryByText(f.nome) !== null)?.nome)
    expect(nomes).toEqual(['PED Gerentes', 'PED Comercial', 'PED Vendedores'])
  })

  describe('nome e vínculo', () => {
    it('vínculo por filiais: "Filiais: 100, 101, 102"', () => {
      renderizar()
      expect(within(linha('PED Comercial')).getByText('Filiais: 100, 101, 102')).toBeInTheDocument()
    })

    it('vínculo por cargos: "Cargos: Gerente de Loja"', () => {
      renderizar()
      expect(within(linha('PED Gerentes')).getByText('Cargos: Gerente de Loja')).toBeInTheDocument()
    })

    it('vínculo por colaboradores: "2 colaboradores vinculados" (1: "1 colaborador vinculado")', () => {
      const umColaborador: Fechamento = { ...porNome('PED Vendedores'), id: 99, nome: 'PED Solo', itensVinculados: ['12'] }
      renderizar({ fechamentos: [porNome('PED Vendedores'), umColaborador] })

      expect(within(linha('PED Vendedores')).getByText('2 colaboradores vinculados')).toBeInTheDocument()
      expect(within(linha('PED Solo')).getByText('1 colaborador vinculado')).toBeInTheDocument()
    })
  })

  describe('unidades e pendências', () => {
    it('dashboard por filiais conta filiais: "3 filiais" e "1 com pendências"', () => {
      renderizar()
      const tr = linha('PED Comercial')

      expect(within(tr).getByText('3 filiais')).toBeInTheDocument()
      expect(within(tr).getByText('1 com pendências')).toBeInTheDocument()
    })

    it('dashboard por cargos conta colaboradores: "2 colaboradores" e "2 com pendências"', () => {
      renderizar()
      const tr = linha('PED Gerentes')

      expect(within(tr).getByText('2 colaboradores')).toBeInTheDocument()
      expect(within(tr).getByText('2 com pendências')).toBeInTheDocument()
    })

    it('sem pendências mostra "Sem pendências"', () => {
      renderizar()
      const tr = linha('PED Vendedores')

      expect(within(tr).getByText('2 colaboradores')).toBeInTheDocument()
      expect(within(tr).getByText('Sem pendências')).toBeInTheDocument()
      expect(within(tr).queryByText(/com pendências/)).not.toBeInTheDocument()
    })

    it('singular: "1 filial"', () => {
      const umaFilial = paraFechamento({
        ...FECHAMENTO_COMERCIAL_API,
        id: 50,
        nome: 'PED Matriz',
        'itens vinculados': ['100'],
        'unidades de imagem': 1,
        'unidades encerradas': 0,
        'unidades com pendencias': 0,
      })
      renderizar({ fechamentos: [umaFilial] })

      expect(within(linha('PED Matriz')).getByText('1 filial')).toBeInTheDocument()
    })
  })

  describe('periodicidade, período atual e situação do período', () => {
    it('mostra o rótulo da periodicidade, o período atual e "Em aberto"', () => {
      renderizar()

      const gerentes = linha('PED Gerentes')
      expect(within(gerentes).getByText('Mensal')).toBeInTheDocument()
      expect(within(gerentes).getByText('11/2026')).toBeInTheDocument()
      expect(within(gerentes).getByText('Em aberto')).toBeInTheDocument()

      const comercial = linha('PED Comercial')
      expect(within(comercial).getByText('Trimestral')).toBeInTheDocument()
      expect(within(comercial).getByText('4º tri/2026')).toBeInTheDocument()
      expect(within(comercial).getByText('Em aberto')).toBeInTheDocument()
    })

    it('período encerrado mostra "Encerrado"', () => {
      renderizar()

      const vendedores = linha('PED Vendedores')
      expect(within(vendedores).getByText('Anual')).toBeInTheDocument()
      expect(within(vendedores).getByText('2026')).toBeInTheDocument()
      expect(within(vendedores).getByText('Encerrado')).toBeInTheDocument()
      expect(within(vendedores).queryByText('Em aberto')).not.toBeInTheDocument()
    })
  })

  describe('progresso de lançamentos', () => {
    it('texto "X de Y lançamentos"', () => {
      renderizar()

      expect(within(linha('PED Gerentes')).getByText('1 de 4 lançamentos')).toBeInTheDocument()
      expect(within(linha('PED Comercial')).getByText('5 de 6 lançamentos')).toBeInTheDocument()
      expect(within(linha('PED Vendedores')).getByText('0 de 0 lançamentos')).toBeInTheDocument()
    })

    it('barra de progresso acessível "Progresso de lançamentos de {nome}" com o percentual arredondado (0 a 100)', () => {
      renderizar()

      const gerentes = within(linha('PED Gerentes')).getByRole('progressbar', { name: 'Progresso de lançamentos de PED Gerentes' })
      expect(gerentes).toHaveAttribute('aria-valuenow', '25')
      expect(gerentes).toHaveAttribute('aria-valuemin', '0')
      expect(gerentes).toHaveAttribute('aria-valuemax', '100')

      const comercial = within(linha('PED Comercial')).getByRole('progressbar', { name: 'Progresso de lançamentos de PED Comercial' })
      expect(comercial).toHaveAttribute('aria-valuenow', '83')
    })
  })

  describe('etiquetas de indicadores com problema e falta de tabela de faixas', () => {
    it('um indicador com problema: etiqueta "1 indicador com problema"', () => {
      renderizar()
      expect(within(linha('PED Gerentes')).getByText('1 indicador com problema')).toBeInTheDocument()
    })

    it('vários: "2 indicadores com problema"', () => {
      const dois: Fechamento = { ...porNome('PED Gerentes'), indicadoresComProblema: ['Custo de frete por entrega', 'Ticket médio'] }
      renderizar({ fechamentos: [dois] })

      expect(within(linha('PED Gerentes')).getByText('2 indicadores com problema')).toBeInTheDocument()
    })

    it('uma filial sem faixas: "Sem tabela de faixas: filial 102"', () => {
      renderizar()

      expect(within(linha('PED Gerentes')).getByText('Sem tabela de faixas: filial 102')).toBeInTheDocument()
      expect(within(linha('PED Comercial')).getByText('Sem tabela de faixas: filial 102')).toBeInTheDocument()
    })

    it('várias filiais sem faixas: "Sem tabela de faixas: filiais 101, 102"', () => {
      const duas: Fechamento = { ...porNome('PED Comercial'), unidadesSemTabelaDeFaixas: ['101', '102'] }
      renderizar({ fechamentos: [duas] })

      expect(within(linha('PED Comercial')).getByText('Sem tabela de faixas: filiais 101, 102')).toBeInTheDocument()
    })

    it('sem problemas e com faixas: nenhuma das duas etiquetas', () => {
      renderizar()
      const comercial = linha('PED Comercial')
      const vendedores = linha('PED Vendedores')

      expect(within(comercial).queryByText(/com problema/)).not.toBeInTheDocument()
      expect(within(vendedores).queryByText(/com problema/)).not.toBeInTheDocument()
      expect(within(vendedores).queryByText(/Sem tabela de faixas/)).not.toBeInTheDocument()
    })
  })

  describe('menu de ações', () => {
    it('cada linha tem o gatilho "Ações do dashboard {nome}"', () => {
      renderizar()

      for (const fechamento of FECHAMENTOS) {
        expect(within(linha(fechamento.nome)).getByRole('button', { name: rotuloAcoesDashboard(fechamento.nome) })).toBeInTheDocument()
      }
    })

    it('período em aberto: "Pré-visualizar imagens" e "Encerrar período"', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Gerentes'))).toEqual(['Pré-visualizar imagens', 'Encerrar período'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesDashboard('PED Comercial'))).toEqual(['Pré-visualizar imagens', 'Encerrar período'])
    })

    it('"Pré-visualizar imagens" chama onPrevisualizar com o fechamento da linha', async () => {
      const user = usuarioRapido()
      const { onPrevisualizar, onEncerrar } = renderizar()

      await escolherAcao(user, rotuloAcoesDashboard('PED Comercial'), 'Pré-visualizar imagens')

      expect(onPrevisualizar).toHaveBeenCalledTimes(1)
      expect(onPrevisualizar).toHaveBeenCalledWith(porNome('PED Comercial'))
      expect(onEncerrar).not.toHaveBeenCalled()
    })

    it('"Encerrar período" chama onEncerrar com o fechamento da linha', async () => {
      const user = usuarioRapido()
      const { onPrevisualizar, onEncerrar } = renderizar()

      await escolherAcao(user, rotuloAcoesDashboard('PED Gerentes'), 'Encerrar período')

      expect(onEncerrar).toHaveBeenCalledTimes(1)
      expect(onEncerrar).toHaveBeenCalledWith(porNome('PED Gerentes'))
      expect(onPrevisualizar).not.toHaveBeenCalled()
    })
  })

  it('lista vazia mostra o textoVazio informado', () => {
    renderizar({ fechamentos: [], textoVazio: 'Nenhum dashboard ativo.' })

    expect(within(tabela()).getByText('Nenhum dashboard ativo.')).toBeInTheDocument()
  })
})
