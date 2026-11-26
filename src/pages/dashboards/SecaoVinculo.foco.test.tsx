import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CARGOS_VINCULO, COLABORADORES_VINCULO, FILIAIS_VINCULO } from '../../test/dashboardsFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { VinculoFormulario } from './regrasDashboard'
import { SecaoVinculo } from './SecaoVinculo'

/**
 * F12.1 (RNF-05, item A4 da revisão de acessibilidade de 24/11/2026) — foco ao escolher e remover itens do
 * vínculo do dashboard (`SecaoVinculo` e o seletor com busca usado por ela).
 *
 * Antes, a opção escolhida (ou o "Remover {nome}") era desmontada e o foco caía no `<body>`. Regra:
 * - escolher o tipo de vínculo (a lista fecha) → foco no botão "Tipo de vínculo do dashboard";
 * - escolher um item com o painel aberto e com busca (cargos, colaboradores) → foco na busca;
 * - escolher uma filial (painel aberto, sem busca) → foco no gatilho "Selecionar filial";
 * - "Selecionar todas as filiais (N)" (o painel fecha) → foco no gatilho "Selecionar filial";
 * - remover → foco no "Remover" do próximo item; sem próximo, no do anterior; sem itens, no gatilho;
 * - o foco nunca fica no `<body>`.
 */
describe('F12.1 — SecaoVinculo: foco ao escolher e remover (A4)', () => {
  function Controlado({ inicial }: { inicial: VinculoFormulario }) {
    const [valor, setValor] = useState(inicial)
    return (
      <SecaoVinculo
        valor={valor}
        onChange={setValor}
        filiais={FILIAIS_VINCULO}
        cargos={CARGOS_VINCULO}
        colaboradores={COLABORADORES_VINCULO}
      />
    )
  }

  function renderizar(inicial: VinculoFormulario = { tipo: 'cargos', itens: [] }) {
    render(<Controlado inicial={inicial} />)
  }

  const botaoTipo = () => screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' })
  const listaTipos = () => screen.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })
  const opcao = (lista: HTMLElement, rotulo: string) => within(lista).getByRole('option', { name: (nome) => nome.startsWith(rotulo) })
  const remover = (nome: string) => screen.getByRole('button', { name: `Remover ${nome}` })

  async function abrir(user: Usuario, botao: string, lista: string) {
    const gatilho = screen.getByRole('button', { name: botao })
    if (gatilho.getAttribute('aria-expanded') !== 'true') await user.click(gatilho)
    return screen.getByRole('listbox', { name: lista })
  }

  describe('tipo de vínculo', () => {
    it.each(['Filiais', 'Colaboradores específicos', 'Cargos de colaboradores'])(
      'escolher "%s" fecha a lista e devolve o foco ao botão "Tipo de vínculo do dashboard"',
      async (rotulo) => {
        const user = usuarioRapido()
        renderizar()
        await user.click(botaoTipo())

        await user.click(opcao(listaTipos(), rotulo))

        expect(screen.queryByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).not.toBeInTheDocument()
        expect(botaoTipo()).toHaveFocus()
      },
    )

    it('escolher o tipo pelo teclado (Enter na opção) também devolve o foco ao botão', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(botaoTipo())

      opcao(listaTipos(), 'Filiais').focus()
      await user.keyboard('{Enter}')

      expect(botaoTipo()).toHaveTextContent('Filiais')
      expect(botaoTipo()).toHaveFocus()
    })
  })

  describe('escolher itens', () => {
    it('cargos: escolher um cargo mantém o painel aberto e leva o foco à busca "Buscar cargo"', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'cargos', itens: [] })

      await user.click(opcao(await abrir(user, 'Selecionar cargo de colaboradores', 'Cargos vinculados'), 'Vendedor'))

      expect(screen.getByRole('listbox', { name: 'Cargos vinculados' })).toBeInTheDocument()
      expect(screen.getByRole('searchbox', { name: 'Buscar cargo' })).toHaveFocus()
    })

    it('colaboradores: escolher um colaborador leva o foco à busca "Buscar colaborador"', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'colaboradores', itens: [] })

      await user.click(opcao(await abrir(user, 'Selecionar colaborador', 'Colaboradores vinculados'), 'Ana Souza'))

      expect(screen.getByRole('searchbox', { name: 'Buscar colaborador' })).toHaveFocus()
    })

    it('filiais (sem busca): escolher uma filial leva o foco ao gatilho "Selecionar filial"', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'filiais', itens: [] })

      await user.click(opcao(await abrir(user, 'Selecionar filial', 'Filiais vinculadas'), '101 - CAMPO GRANDE'))

      expect(screen.getByRole('button', { name: 'Selecionar filial' })).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })

    it('"Selecionar todas as filiais (N)" fecha o painel e leva o foco ao gatilho "Selecionar filial"', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'filiais', itens: [] })

      await user.click(opcao(await abrir(user, 'Selecionar filial', 'Filiais vinculadas'), 'Selecionar todas as filiais'))

      expect(screen.queryByRole('listbox', { name: 'Filiais vinculadas' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Selecionar filial' })).toHaveFocus()
    })
  })

  describe('remover itens', () => {
    it('remover o primeiro leva o foco ao "Remover" do próximo', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'cargos', itens: ['Gerente de Loja', 'Vendedor', 'Supervisor Comercial'] })

      await user.click(remover('Gerente de Loja'))

      expect(remover('Vendedor')).toHaveFocus()
    })

    it('remover o último (sem próximo) leva o foco ao "Remover" do anterior', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'filiais', itens: ['100', '102'] })

      await user.click(remover('102 - DOURADOS'))

      expect(remover('100 - MATRIZ')).toHaveFocus()
    })

    it('remover o único item leva o foco ao gatilho do dropdown', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'cargos', itens: ['Vendedor'] })

      await user.click(remover('Vendedor'))

      expect(screen.getByText('Nenhum cargo selecionado.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Selecionar cargo de colaboradores' })).toHaveFocus()
      expect(document.activeElement).not.toBe(document.body)
    })
  })
})
