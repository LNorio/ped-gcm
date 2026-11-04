import { render, screen, within } from '@testing-library/react'
import { type Usuario, usuarioRapido } from '../../test/usuario'
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
import { abrirMenuAcoes, escolherAcao, itensDoMenuAcoes, rotuloAcoesApontamento } from '../../test/menuAcoes'
import type { Apontamento } from '../../types/dominio'
import { TabelaApontamentos, type TabelaApontamentosProps } from './TabelaApontamentos'

const APONTAMENTOS: Apontamento[] = apontamentosApi().map(paraApontamento)
const ROTEIRO = paraApontamento(APONTAMENTO_ROTEIRO_API)
const CONCILIACAO = paraApontamento(APONTAMENTO_CONCILIACAO_API)
const TREINAMENTOS = paraApontamento(APONTAMENTO_TREINAMENTOS_API)
const CHAMADOS = paraApontamento(APONTAMENTO_CHAMADOS_API)
const RELATORIO = paraApontamento(APONTAMENTO_RELATORIO_API)

const COLUNAS = ['Nome', 'Tipo', 'Tipo de valor', 'Situação', 'Indicadores', 'Cadastro', 'Ações']
const COL_ACOES = 6

/** Apontamentos com `situacaoAlteradaEm` preenchido (as únicas linhas com detalhes). */
const COM_DETALHES = ['Conciliação bancária concluída', 'Relatório mensal entregue']
const SEM_DETALHES = ['Roteiro de visitas elaborado', 'Horas de treinamento realizadas', 'Chamados resolvidos no prazo']

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

  /** Linha de detalhes logo abaixo da linha do apontamento, ou `null` se estiver recolhida. */
  function detalhesDe(nome: string): HTMLElement | null {
    const proxima = linhaDoApontamento(nome).nextElementSibling as HTMLElement | null
    return proxima && proxima.classList.contains('tabela__detalhes') ? proxima : null
  }

  async function verDetalhes(user: Usuario, nome: string): Promise<HTMLElement> {
    await escolherAcao(user, rotuloAcoesApontamento(nome), 'Ver detalhes')
    const detalhes = detalhesDe(nome)
    if (!detalhes) throw new Error(`Detalhes de "${nome}" não foram abertos`)
    return detalhes
  }

  describe('estrutura', () => {
    it('renderiza a tabela com legenda "Apontamentos" e só as colunas Nome, Tipo, Tipo de valor, Situação, Indicadores, Cadastro e Ações', () => {
      renderizar()

      const cabecalhos = within(tabela()).getAllByRole('columnheader').map((coluna) => coluna.textContent)
      expect(cabecalhos).toEqual(COLUNAS)
      expect(within(linhaDoApontamento('Conciliação bancária concluída')).getAllByRole('cell')).toHaveLength(COLUNAS.length)
    })

    it('lista os apontamentos recebidos na ordem informada, com o nome na primeira coluna e os detalhes recolhidos', () => {
      renderizar()

      expect(linhasDeDados()).toHaveLength(5)
      for (const [indice, nome] of NOMES_APONTAMENTOS.entries()) {
        expect(within(within(linhasDeDados()[indice]).getAllByRole('cell')[0]).getByText(nome)).toBeInTheDocument()
        expect(detalhesDe(nome)).toBeNull()
      }
    })

    it('não há coluna nem botão "Expandir detalhes" da tabela (a expansão fica no menu de ações)', () => {
      renderizar()

      expect(screen.queryByRole('button', { name: /^(Expandir|Recolher) detalhes$/ })).not.toBeInTheDocument()
      expect(within(tabela()).queryByRole('columnheader', { name: 'Detalhes' })).not.toBeInTheDocument()
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

    it('a coluna Ações tem o menu "Ações do apontamento {nome}" (aria-haspopup="menu") em todas as linhas', () => {
      renderizar()

      for (const nome of NOMES_APONTAMENTOS) {
        const gatilho = within(celula(nome, COL_ACOES)).getByRole('button', { name: rotuloAcoesApontamento(nome) })
        expect(gatilho).toHaveAttribute('aria-haspopup', 'menu')
      }
    })

    it('a coluna Ações não tem mais os botões "Desativar/Ativar/Excluir apontamento {nome}"', () => {
      renderizar()

      expect(screen.queryByRole('button', { name: /^(Desativar|Ativar|Excluir) apontamento / })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^(Desativar|Ativar|Excluir)$/ })).not.toBeInTheDocument()
    })
  })

  describe('detalhes da linha com a alteração de situação ("Ver detalhes" no menu de ações — RNF-01)', () => {
    it('"Ver detalhes" mostra "Situação alterada em {data} por {usuário}" só naquela linha', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(screen.queryByText(/Situação alterada em/)).not.toBeInTheDocument()
      const detalhes = await verDetalhes(user, 'Conciliação bancária concluída')

      expect(within(detalhes).getByText('Situação alterada em 20/10/2026 11:05 por Ana Costa')).toBeInTheDocument()
      expect(detalhesDe('Relatório mensal entregue')).toBeNull()
      expect(screen.queryByText(/^Situação alterada em 28\/10\/2026/)).not.toBeInTheDocument()
    })

    it('cada linha expande o próprio registro', async () => {
      const user = usuarioRapido()
      renderizar()

      const detalhes = await verDetalhes(user, 'Relatório mensal entregue')

      expect(within(detalhes).getByText('Situação alterada em 28/10/2026 10:00 por Maria Souza')).toBeInTheDocument()
      expect(screen.queryByText(/por Ana Costa/)).not.toBeInTheDocument()
    })

    it('aberto, o item vira "Ocultar detalhes"; escolhê-lo recolhe a linha e o item volta a "Ver detalhes"', async () => {
      const user = usuarioRapido()
      renderizar()
      await verDetalhes(user, 'Conciliação bancária concluída')

      const menu = await abrirMenuAcoes(user, rotuloAcoesApontamento('Conciliação bancária concluída'))
      expect(within(menu).queryByRole('menuitem', { name: 'Ver detalhes' })).not.toBeInTheDocument()
      await user.click(within(menu).getByRole('menuitem', { name: 'Ocultar detalhes' }))

      expect(detalhesDe('Conciliação bancária concluída')).toBeNull()
      expect(screen.queryByText(/Situação alterada em/)).not.toBeInTheDocument()
      expect((await itensDoMenuAcoes(user, rotuloAcoesApontamento('Conciliação bancária concluída')))[0]).toBe('Ver detalhes')
    })

    it('o rótulo "Ocultar detalhes" vale só para a linha aberta', async () => {
      const user = usuarioRapido()
      renderizar()
      await verDetalhes(user, 'Conciliação bancária concluída')

      expect((await itensDoMenuAcoes(user, rotuloAcoesApontamento('Relatório mensal entregue')))[0]).toBe('Ver detalhes')
      expect((await itensDoMenuAcoes(user, rotuloAcoesApontamento('Conciliação bancária concluída')))[0]).toBe('Ocultar detalhes')
    })

    it('duas linhas podem ficar abertas; recolher uma não afeta a outra', async () => {
      const user = usuarioRapido()
      renderizar()
      await verDetalhes(user, 'Conciliação bancária concluída')
      await verDetalhes(user, 'Relatório mensal entregue')

      expect(detalhesDe('Conciliação bancária concluída')).not.toBeNull()
      expect(detalhesDe('Relatório mensal entregue')).not.toBeNull()

      await escolherAcao(user, rotuloAcoesApontamento('Conciliação bancária concluída'), 'Ocultar detalhes')

      expect(detalhesDe('Conciliação bancária concluída')).toBeNull()
      expect(detalhesDe('Relatório mensal entregue')).not.toBeNull()
    })

    it('linha sem situação alterada não tem "Ver detalhes" no menu', async () => {
      const user = usuarioRapido()
      renderizar()

      for (const nome of SEM_DETALHES) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))
        expect(itens).not.toContain('Ver detalhes')
        expect(itens).not.toContain('Ocultar detalhes')
      }
    })

    it('"Ver detalhes" não chama nenhum callback', async () => {
      const user = usuarioRapido()
      const { onAlterarSituacao, onExcluir } = renderizar()

      await verDetalhes(user, 'Conciliação bancária concluída')

      expect(onAlterarSituacao).not.toHaveBeenCalled()
      expect(onExcluir).not.toHaveBeenCalled()
    })
  })

  describe('itens do menu de ações por permissão e por existência de detalhes', () => {
    it('com todas as permissões: Ver detalhes (se houver), Desativar/Ativar e Excluir, nesta ordem', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Roteiro de visitas elaborado'))).toEqual(['Desativar', 'Excluir'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'))).toEqual(['Desativar', 'Excluir'])
      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Conciliação bancária concluída'))).toEqual([
        'Ver detalhes',
        'Ativar',
        'Excluir',
      ])
      expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento('Relatório mensal entregue'))).toEqual([
        'Ver detalhes',
        'Ativar',
        'Excluir',
      ])
    })

    it('"Excluir" é o item de perigo; os demais não', async () => {
      const user = usuarioRapido()
      renderizar()

      const menu = await abrirMenuAcoes(user, rotuloAcoesApontamento('Conciliação bancária concluída'))

      expect(within(menu).getByRole('menuitem', { name: 'Excluir' })).toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Ativar' })).not.toHaveClass('menu-acoes__item--perigo')
      expect(within(menu).getByRole('menuitem', { name: 'Ver detalhes' })).not.toHaveClass('menu-acoes__item--perigo')
    })

    it('só com podeAlterarSituacao: "Desativar" nos ativos e "Ativar" nos inativos, sem "Excluir"', async () => {
      const user = usuarioRapido()
      renderizar({ podeExcluir: false })

      for (const nome of SEM_DETALHES) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))).toEqual(['Desativar'])
      }
      for (const nome of COM_DETALHES) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))).toEqual(['Ver detalhes', 'Ativar'])
      }
    })

    it('só com podeExcluir: "Excluir" em todas as linhas, sem Desativar/Ativar', async () => {
      const user = usuarioRapido()
      renderizar({ podeAlterarSituacao: false })

      for (const nome of SEM_DETALHES) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))).toEqual(['Excluir'])
      }
      for (const nome of COM_DETALHES) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))).toEqual(['Ver detalhes', 'Excluir'])
      }
    })

    it('sem nenhuma permissão: linhas com detalhes têm só "Ver detalhes"', async () => {
      const user = usuarioRapido()
      renderizar({ podeAlterarSituacao: false, podeExcluir: false })

      for (const nome of COM_DETALHES) {
        expect(await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome), celula(nome, COL_ACOES))).toEqual(['Ver detalhes'])
      }
    })

    it('sem nenhuma permissão e sem detalhes, a célula Ações fica vazia (sem menu)', () => {
      renderizar({ podeAlterarSituacao: false, podeExcluir: false })

      for (const nome of SEM_DETALHES) {
        const acoes = celula(nome, COL_ACOES)
        expect(within(acoes).queryByRole('button')).not.toBeInTheDocument()
        expect(acoes).toHaveTextContent(/^$/)
      }
      expect(screen.getAllByRole('button', { name: /^Ações do apontamento / })).toHaveLength(COM_DETALHES.length)
    })

    it('nunca oferece uma ação "Editar" (RF-20)', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
      for (const nome of NOMES_APONTAMENTOS) {
        const itens = await itensDoMenuAcoes(user, rotuloAcoesApontamento(nome))
        expect(itens.some((item) => /editar/i.test(item))).toBe(false)
      }
    })
  })

  describe('callbacks', () => {
    it('"Desativar" chama onAlterarSituacao com o apontamento da linha e fecha o menu', async () => {
      const user = usuarioRapido()
      const { onAlterarSituacao, onExcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Desativar')

      expect(onAlterarSituacao).toHaveBeenCalledTimes(1)
      expect(onAlterarSituacao).toHaveBeenCalledWith(CHAMADOS)
      expect(onExcluir).not.toHaveBeenCalled()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('"Ativar" chama onAlterarSituacao com o apontamento inativo da linha', async () => {
      const user = usuarioRapido()
      const { onAlterarSituacao } = renderizar()

      await escolherAcao(user, rotuloAcoesApontamento('Relatório mensal entregue'), 'Ativar')

      expect(onAlterarSituacao).toHaveBeenCalledWith(RELATORIO)
      expect(onAlterarSituacao.mock.calls[0][0]).toBe(APONTAMENTOS[4])
    })

    it('"Excluir" chama onExcluir com o apontamento da linha (inclusive os que têm indicadores)', async () => {
      const user = usuarioRapido()
      const { onAlterarSituacao, onExcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesApontamento('Horas de treinamento realizadas'), 'Excluir')

      expect(onExcluir).toHaveBeenCalledTimes(1)
      expect(onExcluir).toHaveBeenCalledWith(TREINAMENTOS)
      expect(onAlterarSituacao).not.toHaveBeenCalled()
    })

    it('"Excluir" aparece também no vinculado a dashboard e no desativado-mas-usado (o bloqueio é decidido no diálogo)', async () => {
      const user = usuarioRapido()
      const { onExcluir } = renderizar()

      await escolherAcao(user, rotuloAcoesApontamento('Roteiro de visitas elaborado'), 'Excluir')
      await escolherAcao(user, rotuloAcoesApontamento('Conciliação bancária concluída'), 'Excluir')

      expect(onExcluir.mock.calls.map(([apontamento]) => apontamento)).toEqual([ROTEIRO, CONCILIACAO])
    })

    it('depois de escolher uma ação, o foco volta ao gatilho do menu da linha', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherAcao(user, rotuloAcoesApontamento('Chamados resolvidos no prazo'), 'Excluir')

      expect(screen.getByRole('button', { name: rotuloAcoesApontamento('Chamados resolvidos no prazo') })).toHaveFocus()
    })
  })
})
