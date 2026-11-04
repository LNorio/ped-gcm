import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento } from '../../services/adaptadores'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_CONCILIACAO_API,
  APONTAMENTO_RELATORIO_API,
  APONTAMENTO_ROTEIRO_API,
  APONTAMENTO_TREINAMENTOS_API,
  NOMES_APONTAMENTOS,
  apontamentosApi,
} from '../../test/apontamentosFalsos'
import type { Apontamento } from '../../types/dominio'
import { TabelaApontamentos, type TabelaApontamentosProps } from './TabelaApontamentos'

const APONTAMENTOS: Apontamento[] = apontamentosApi().map(paraApontamento)
const ROTEIRO = paraApontamento(APONTAMENTO_ROTEIRO_API)
const CONCILIACAO = paraApontamento(APONTAMENTO_CONCILIACAO_API)
const TREINAMENTOS = paraApontamento(APONTAMENTO_TREINAMENTOS_API)
const CHAMADOS = paraApontamento(APONTAMENTO_CHAMADOS_API)
const RELATORIO = paraApontamento(APONTAMENTO_RELATORIO_API)

const COLUNAS = ['Nome', 'Tipo', 'Tipo de valor', 'Situação', 'Indicadores', 'Cadastro', 'Ações']

describe('F4.2 — TabelaApontamentos (tabela da listagem de apontamentos)', () => {
  function renderizar(props: Partial<TabelaApontamentosProps> = {}) {
    const onAlterarSituacao = props.onAlterarSituacao ?? vi.fn<(apontamento: Apontamento) => void>()
    const onExcluir = props.onExcluir ?? vi.fn<(apontamento: Apontamento) => void>()
    render(
      <TabelaApontamentos
        apontamentos={props.apontamentos ?? APONTAMENTOS}
        podeAlterarSituacao={props.podeAlterarSituacao ?? true}
        podeExcluir={props.podeExcluir ?? true}
        onAlterarSituacao={onAlterarSituacao}
        onExcluir={onExcluir}
        textoVazio={props.textoVazio}
      />,
    )
    return { onAlterarSituacao, onExcluir }
  }

  function tabela() {
    return screen.getByRole('table', { name: 'Apontamentos' })
  }

  /** Linhas de dados (sem o cabeçalho e sem linhas de detalhes). */
  function linhasDeDados() {
    return within(tabela())
      .getAllByRole('row')
      .slice(1)
      .filter((linha) => !linha.classList.contains('tabela__detalhes'))
  }

  function linhaDoApontamento(nome: string): HTMLElement {
    const linha = screen.getByText(nome).closest('tr')
    if (!linha) throw new Error(`Linha do apontamento "${nome}" não encontrada`)
    return linha
  }

  function celula(nome: string, indice: number): HTMLElement {
    return within(linhaDoApontamento(nome)).getAllByRole('cell')[indice]
  }

  describe('estrutura', () => {
    it('renderiza a tabela com legenda "Apontamentos" e as colunas Nome, Tipo, Tipo de valor, Situação, Indicadores, Cadastro e Ações', () => {
      renderizar()

      const cabecalhos = within(tabela()).getAllByRole('columnheader').map((coluna) => coluna.textContent)
      expect(cabecalhos.slice(0, COLUNAS.length)).toEqual(COLUNAS)
    })

    it('lista os apontamentos recebidos na ordem informada, com o nome na primeira coluna', () => {
      renderizar()

      expect(linhasDeDados()).toHaveLength(5)
      for (const [indice, nome] of NOMES_APONTAMENTOS.entries()) {
        expect(within(within(linhasDeDados()[indice]).getAllByRole('cell')[0]).getByText(nome)).toBeInTheDocument()
      }
    })

    it('lista vazia exibe o textoVazio informado e nenhum botão', () => {
      renderizar({ apontamentos: [], textoVazio: 'Nenhum apontamento cadastrado.' })

      expect(within(tabela()).getByText('Nenhum apontamento cadastrado.')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('textoVazio é usado só quando a lista está vazia', () => {
      renderizar({ apontamentos: [CHAMADOS], textoVazio: 'Nenhum apontamento encontrado para os filtros.' })

      expect(screen.queryByText('Nenhum apontamento encontrado para os filtros.')).not.toBeInTheDocument()
      expect(screen.getByText('Chamados resolvidos no prazo')).toBeInTheDocument()
    })
  })

  describe('coluna Nome', () => {
    it('mostra a descrição abaixo do nome, na mesma célula', () => {
      renderizar()

      const nome = celula('Roteiro de visitas elaborado', 0)
      expect(within(nome).getByText('Roteiro de visitas elaborado')).toBeInTheDocument()
      expect(within(nome).getByText('Percentual de vendedores com roteiro semanal entregue.')).toBeInTheDocument()
    })

    it('apontamento sem descrição mostra só o nome (sem "null" nem texto inventado)', () => {
      renderizar()

      const nome = celula('Horas de treinamento realizadas', 0)
      expect(nome).not.toHaveTextContent('null')
      expect(nome).not.toHaveTextContent('undefined')
      expect(within(nome).queryByText(/Sem descrição/i)).not.toBeInTheDocument()
    })

    it('mostra a etiqueta dourada "Vinculado a dashboard" só no apontamento vinculado', () => {
      renderizar()

      const etiqueta = within(celula('Roteiro de visitas elaborado', 0)).getByText('Vinculado a dashboard')
      expect(etiqueta).toHaveClass('etiqueta', 'etiqueta--dourado')
      expect(screen.getAllByText('Vinculado a dashboard')).toHaveLength(1)
      expect(within(linhaDoApontamento('Chamados resolvidos no prazo')).queryByText('Vinculado a dashboard')).not.toBeInTheDocument()
    })

    it('mostra a etiqueta de alerta "Desativado, mas usado em indicador ativo" só no apontamento com o problema', () => {
      renderizar()

      const etiqueta = within(celula('Conciliação bancária concluída', 0)).getByText('Desativado, mas usado em indicador ativo')
      expect(etiqueta).toHaveClass('etiqueta', 'etiqueta--alerta')
      expect(screen.getAllByText('Desativado, mas usado em indicador ativo')).toHaveLength(1)
      expect(
        within(linhaDoApontamento('Relatório mensal entregue')).queryByText('Desativado, mas usado em indicador ativo'),
      ).not.toBeInTheDocument()
    })
  })

  describe('demais colunas', () => {
    it('Tipo mostra o nome do tipo de apontamento', () => {
      renderizar()

      expect(celula('Roteiro de visitas elaborado', 1)).toHaveTextContent('Comercial')
      expect(celula('Chamados resolvidos no prazo', 1)).toHaveTextContent('Tecnologia da Informação')
    })

    it('Tipo de valor mostra o rótulo em pt-BR (Porcentagem, Numeral, Booleano)', () => {
      renderizar()

      expect(celula('Roteiro de visitas elaborado', 2)).toHaveTextContent(/^Porcentagem$/)
      expect(celula('Horas de treinamento realizadas', 2)).toHaveTextContent(/^Numeral$/)
      expect(celula('Conciliação bancária concluída', 2)).toHaveTextContent(/^Booleano$/)
    })

    it('Situação mostra a etiqueta "Ativo" em tom de sucesso e "Inativo" em tom neutro', () => {
      renderizar()

      const ativo = within(celula('Roteiro de visitas elaborado', 3)).getByText('Ativo')
      expect(ativo).toHaveClass('etiqueta', 'etiqueta--sucesso')
      const inativo = within(celula('Conciliação bancária concluída', 3)).getByText('Inativo')
      expect(inativo).toHaveClass('etiqueta', 'etiqueta--neutro')
    })

    it('Indicadores lista os nomes separados por vírgula, ou "—" quando não há', () => {
      renderizar()

      expect(celula('Horas de treinamento realizadas', 4)).toHaveTextContent('Capacitação, Desenvolvimento de equipe')
      expect(celula('Roteiro de visitas elaborado', 4)).toHaveTextContent(/^Cobertura de visitas$/)
      expect(celula('Chamados resolvidos no prazo', 4)).toHaveTextContent(/^—$/)
    })

    it('Cadastro mostra a data/hora em pt-BR e o autor ("por {nome}")', () => {
      renderizar()

      const cadastro = celula('Roteiro de visitas elaborado', 5)
      expect(cadastro).toHaveTextContent('02/10/2026 09:15')
      expect(cadastro).toHaveTextContent('por Maria Souza')

      expect(celula('Conciliação bancária concluída', 5)).toHaveTextContent('15/09/2026 14:30')
      expect(celula('Conciliação bancária concluída', 5)).toHaveTextContent('por João Lima')
    })
  })

  describe('linha expansível com a alteração de situação (RNF-01)', () => {
    it('apontamento com situação alterada tem o botão "Expandir detalhes"; sem alteração não tem', () => {
      renderizar()

      expect(within(linhaDoApontamento('Conciliação bancária concluída')).getByRole('button', { name: 'Expandir detalhes' })).toBeInTheDocument()
      expect(within(linhaDoApontamento('Relatório mensal entregue')).getByRole('button', { name: 'Expandir detalhes' })).toBeInTheDocument()
      expect(within(linhaDoApontamento('Roteiro de visitas elaborado')).queryByRole('button', { name: 'Expandir detalhes' })).not.toBeInTheDocument()
      expect(within(linhaDoApontamento('Chamados resolvidos no prazo')).queryByRole('button', { name: 'Expandir detalhes' })).not.toBeInTheDocument()
    })

    it('expandir mostra "Situação alterada em {data} por {usuário}" e recolher esconde', async () => {
      const user = userEvent.setup()
      renderizar()

      expect(screen.queryByText(/Situação alterada em/)).not.toBeInTheDocument()
      await user.click(within(linhaDoApontamento('Conciliação bancária concluída')).getByRole('button', { name: 'Expandir detalhes' }))

      expect(screen.getByText('Situação alterada em 20/10/2026 11:05 por Ana Costa')).toBeInTheDocument()

      await user.click(within(linhaDoApontamento('Conciliação bancária concluída')).getByRole('button', { name: 'Recolher detalhes' }))
      expect(screen.queryByText(/Situação alterada em/)).not.toBeInTheDocument()
    })

    it('cada linha expande o próprio registro', async () => {
      const user = userEvent.setup()
      renderizar()

      await user.click(within(linhaDoApontamento('Relatório mensal entregue')).getByRole('button', { name: 'Expandir detalhes' }))

      expect(screen.getByText('Situação alterada em 28/10/2026 10:00 por Maria Souza')).toBeInTheDocument()
      expect(screen.queryByText(/por Ana Costa/)).not.toBeInTheDocument()
    })
  })

  describe('coluna Ações por permissão', () => {
    it('com podeAlterarSituacao, mostra "Desativar" nos ativos e "Ativar" nos inativos, com aria-label nomeando o apontamento', () => {
      renderizar({ podeExcluir: false })

      const desativar = within(celula('Roteiro de visitas elaborado', 6)).getByRole('button', { name: 'Desativar apontamento Roteiro de visitas elaborado' })
      expect(desativar).toHaveTextContent('Desativar')
      const ativar = within(celula('Conciliação bancária concluída', 6)).getByRole('button', { name: 'Ativar apontamento Conciliação bancária concluída' })
      expect(ativar).toHaveTextContent('Ativar')

      expect(screen.getAllByRole('button', { name: /^Desativar apontamento / })).toHaveLength(3)
      expect(screen.getAllByRole('button', { name: /^Ativar apontamento / })).toHaveLength(2)
    })

    it('com podeExcluir, mostra "Excluir" em todas as linhas com aria-label "Excluir apontamento {nome}"', () => {
      renderizar({ podeAlterarSituacao: false })

      const botoes = screen.getAllByRole('button', { name: /^Excluir apontamento / })
      expect(botoes.map((botao) => botao.getAttribute('aria-label'))).toEqual(
        NOMES_APONTAMENTOS.map((nome) => `Excluir apontamento ${nome}`),
      )
      expect(botoes[0]).toHaveTextContent('Excluir')
      expect(botoes[0]).toHaveClass('botao--perigo')
    })

    it('sem podeAlterarSituacao não há botões Desativar/Ativar', () => {
      renderizar({ podeAlterarSituacao: false })

      expect(screen.queryByRole('button', { name: /^Desativar apontamento / })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Ativar apontamento / })).not.toBeInTheDocument()
    })

    it('sem podeExcluir não há botões Excluir', () => {
      renderizar({ podeExcluir: false })

      expect(screen.queryByRole('button', { name: /^Excluir apontamento / })).not.toBeInTheDocument()
    })

    it('sem nenhuma permissão, a célula Ações não tem botão algum (as linhas expansíveis continuam)', () => {
      renderizar({ podeAlterarSituacao: false, podeExcluir: false })

      for (const nome of NOMES_APONTAMENTOS) {
        expect(within(celula(nome, 6)).queryByRole('button')).not.toBeInTheDocument()
      }
      expect(within(linhaDoApontamento('Conciliação bancária concluída')).getByRole('button', { name: 'Expandir detalhes' })).toBeInTheDocument()
    })

    it('nunca oferece uma ação "Editar" (RF-20)', () => {
      renderizar()

      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    })
  })

  describe('callbacks', () => {
    it('clicar em Desativar chama onAlterarSituacao com o apontamento da linha', async () => {
      const user = userEvent.setup()
      const { onAlterarSituacao, onExcluir } = renderizar()

      await user.click(screen.getByRole('button', { name: 'Desativar apontamento Chamados resolvidos no prazo' }))

      expect(onAlterarSituacao).toHaveBeenCalledTimes(1)
      expect(onAlterarSituacao).toHaveBeenCalledWith(CHAMADOS)
      expect(onExcluir).not.toHaveBeenCalled()
    })

    it('clicar em Ativar chama onAlterarSituacao com o apontamento inativo da linha', async () => {
      const user = userEvent.setup()
      const { onAlterarSituacao } = renderizar()

      await user.click(screen.getByRole('button', { name: 'Ativar apontamento Relatório mensal entregue' }))

      expect(onAlterarSituacao).toHaveBeenCalledWith(RELATORIO)
      expect(onAlterarSituacao.mock.calls[0][0]).toBe(APONTAMENTOS[4])
    })

    it('clicar em Excluir chama onExcluir com o apontamento da linha (inclusive os que têm indicadores)', async () => {
      const user = userEvent.setup()
      const { onAlterarSituacao, onExcluir } = renderizar()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Horas de treinamento realizadas' }))

      expect(onExcluir).toHaveBeenCalledTimes(1)
      expect(onExcluir).toHaveBeenCalledWith(TREINAMENTOS)
      expect(onAlterarSituacao).not.toHaveBeenCalled()
    })

    it('o botão Excluir aparece também no vinculado a dashboard e no desativado-mas-usado (o bloqueio é decidido no diálogo)', async () => {
      const user = userEvent.setup()
      const { onExcluir } = renderizar()

      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Roteiro de visitas elaborado' }))
      await user.click(screen.getByRole('button', { name: 'Excluir apontamento Conciliação bancária concluída' }))

      expect(onExcluir.mock.calls.map(([apontamento]) => apontamento)).toEqual([ROTEIRO, CONCILIACAO])
    })
  })
})
