import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento, paraDadoExterno } from '../../services/adaptadores'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_ROTEIRO_API,
  APONTAMENTO_TREINAMENTOS_API,
} from '../../test/apontamentosFalsos'
import { DADO_CHAMADOS_API, DADO_FATURAMENTO_API, DADO_VOLUME_API } from '../../test/dadosExternosFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Apontamento, DadoExterno, NovoIndicador } from '../../types/dominio'
import { FormularioIndicador } from './FormularioIndicador'

const APONTAMENTOS: Apontamento[] = [APONTAMENTO_ROTEIRO_API, APONTAMENTO_TREINAMENTOS_API, APONTAMENTO_CHAMADOS_API].map(paraApontamento)
const DADOS_EXTERNOS: DadoExterno[] = [DADO_FATURAMENTO_API, DADO_CHAMADOS_API, DADO_VOLUME_API].map(paraDadoExterno)

/**
 * F12.1 (RNF-05, item A4 da revisão de acessibilidade de 24/11/2026) — foco ao escolher e remover itens
 * da composição do indicador (`SeletorComponentes` e "Remover {nome}" em `FormularioIndicador.tsx`).
 *
 * Antes, o elemento focado (a opção escolhida ou o botão "Remover") era desmontado e o foco caía no
 * `<body>`. Regra:
 * - escolher um apontamento (o painel continua aberto) → foco na busca "Buscar apontamento";
 * - escolher o dado externo (o painel fecha e o gatilho "Selecionar dado externo" some, porque só cabe
 *   um) → foco no "Remover {nome}" do dado escolhido;
 * - remover → foco no "Remover" do próximo item; sem próximo, no do anterior; sem itens, no gatilho do
 *   dropdown ("Selecionar apontamento" ou "Selecionar dado externo");
 * - o foco nunca fica no `<body>`.
 */
describe('F12.1 — FormularioIndicador: foco ao escolher e remover componentes (A4)', () => {
  function renderizar() {
    render(
      <FormularioIndicador
        apontamentos={APONTAMENTOS}
        dadosExternos={DADOS_EXTERNOS}
        carregandoComponentes={false}
        erroComponentes={null}
        salvando={false}
        erro={null}
        onSalvar={vi.fn<(dados: NovoIndicador) => void>()}
        onCancelar={vi.fn()}
      />,
    )
  }

  const grupoApontamentos = () => screen.getByRole('group', { name: 'Apontamentos' })
  const grupoDadoExterno = () => screen.getByRole('group', { name: 'Dado externo' })
  const botaoApontamento = () => within(grupoApontamentos()).getByRole('button', { name: 'Selecionar apontamento' })
  const botaoDadoExterno = () => within(grupoDadoExterno()).getByRole('button', { name: 'Selecionar dado externo' })
  const listaApontamentos = () => within(grupoApontamentos()).getByRole('listbox', { name: 'Apontamentos' })
  const listaDadosExternos = () => within(grupoDadoExterno()).getByRole('listbox', { name: 'Dados externos' })
  const buscaApontamento = () => within(grupoApontamentos()).getByRole('searchbox', { name: 'Buscar apontamento' })
  const opcao = (lista: HTMLElement, rotulo: string) =>
    within(lista).getByRole('option', { name: (nomeOpcao) => nomeOpcao.startsWith(rotulo) })
  const remover = (nome: string) => screen.getByRole('button', { name: `Remover ${nome}` })

  async function escolherApontamento(user: Usuario, rotulo: string) {
    if (within(grupoApontamentos()).queryByRole('listbox') === null) await user.click(botaoApontamento())
    await user.click(opcao(listaApontamentos(), rotulo))
  }

  async function escolherDadoExterno(user: Usuario, rotulo: string) {
    await user.click(botaoDadoExterno())
    await user.click(opcao(listaDadosExternos(), rotulo))
  }

  describe('escolher', () => {
    it('escolher um apontamento pelo clique leva o foco à busca "Buscar apontamento" (o painel continua aberto)', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherApontamento(user, 'Roteiro de visitas elaborado')

      expect(listaApontamentos()).toBeInTheDocument()
      expect(buscaApontamento()).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })

    it('escolher um apontamento pelo teclado (Enter na opção) também leva o foco à busca', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(botaoApontamento())

      opcao(listaApontamentos(), 'Horas de treinamento realizadas').focus()
      await user.keyboard('{Enter}')

      expect(within(grupoApontamentos()).getByRole('list', { name: 'Apontamentos escolhidos' })).toHaveTextContent(
        'Horas de treinamento realizadas',
      )
      expect(buscaApontamento()).toHaveFocus()
    })

    it('escolher o dado externo leva o foco ao "Remover {nome}" do dado escolhido (o gatilho deixa de existir)', async () => {
      const user = usuarioRapido()
      renderizar()

      await escolherDadoExterno(user, 'Faturamento líquido')

      expect(within(grupoDadoExterno()).queryByRole('button', { name: 'Selecionar dado externo' })).not.toBeInTheDocument()
      expect(remover('Faturamento líquido')).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })
  })

  describe('remover apontamentos', () => {
    it('remover o primeiro de três leva o foco ao "Remover" do próximo', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolherApontamento(user, 'Horas de treinamento realizadas')
      await escolherApontamento(user, 'Chamados resolvidos no prazo')

      await user.click(remover('Roteiro de visitas elaborado'))

      expect(remover('Horas de treinamento realizadas')).toHaveFocus()
    })

    it('remover o do meio leva o foco ao "Remover" do seguinte', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolherApontamento(user, 'Horas de treinamento realizadas')
      await escolherApontamento(user, 'Chamados resolvidos no prazo')

      await user.click(remover('Horas de treinamento realizadas'))

      expect(remover('Chamados resolvidos no prazo')).toHaveFocus()
    })

    it('remover o último da lista (sem próximo) leva o foco ao "Remover" do anterior', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolherApontamento(user, 'Chamados resolvidos no prazo')

      await user.click(remover('Chamados resolvidos no prazo'))

      expect(remover('Roteiro de visitas elaborado')).toHaveFocus()
    })

    it('remover o único apontamento leva o foco ao gatilho "Selecionar apontamento"', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')

      await user.click(remover('Roteiro de visitas elaborado'))

      expect(within(grupoApontamentos()).getByText('Nenhum apontamento selecionado.')).toBeInTheDocument()
      expect(botaoApontamento()).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })

    it('remover pelo teclado (Enter no "Remover") também move o foco ao próximo', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherApontamento(user, 'Roteiro de visitas elaborado')
      await escolherApontamento(user, 'Chamados resolvidos no prazo')

      remover('Roteiro de visitas elaborado').focus()
      await user.keyboard('{Enter}')

      expect(screen.queryByRole('button', { name: 'Remover Roteiro de visitas elaborado' })).not.toBeInTheDocument()
      expect(remover('Chamados resolvidos no prazo')).toHaveFocus()
    })
  })

  describe('remover o dado externo', () => {
    it('remover o dado externo leva o foco ao gatilho "Selecionar dado externo", que volta a aparecer', async () => {
      const user = usuarioRapido()
      renderizar()
      await escolherDadoExterno(user, 'Faturamento líquido')

      await user.click(remover('Faturamento líquido'))

      expect(botaoDadoExterno()).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })
  })
})
