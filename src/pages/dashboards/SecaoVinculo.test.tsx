import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CARGOS_VINCULO, COLABORADORES_VINCULO, FILIAIS_VINCULO } from '../../test/dashboardsFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { VinculoFormulario } from './regrasDashboard'
import { SecaoVinculo } from './SecaoVinculo'

const FILIAL_SEM_COLABORADOR = 'identificada como “Filial (sem colaborador vinculado)”.'
const OPCAO_TODAS = 'Selecionar todas as filiais'

describe('F7.5 — SecaoVinculo: filiais, cargos ou colaboradores e resumo de imagens (RF-50, INT-02, protótipo dashModal)', () => {
  /** Mantém o valor em estado, como o formulário faz, e registra cada mudança. */
  function Controlado({ inicial, onChange }: { inicial: VinculoFormulario; onChange: (valor: VinculoFormulario) => void }) {
    const [valor, setValor] = useState(inicial)
    return (
      <SecaoVinculo
        valor={valor}
        onChange={(novo) => {
          onChange(novo)
          setValor(novo)
        }}
        filiais={FILIAIS_VINCULO}
        cargos={CARGOS_VINCULO}
        colaboradores={COLABORADORES_VINCULO}
      />
    )
  }

  function renderizar(inicial: VinculoFormulario = { tipo: 'cargos', itens: [] }) {
    const onChange = vi.fn<(valor: VinculoFormulario) => void>()
    render(<Controlado inicial={inicial} onChange={onChange} />)
    return { onChange }
  }

  const botaoTipo = () => screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' })
  const listaTipos = () => screen.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })
  const opcao = (lista: HTMLElement, rotulo: string) => within(lista).getByRole('option', { name: (nome) => nome.startsWith(rotulo) })
  const listaAtual = (nome: string) => screen.getByRole('listbox', { name: nome })
  /** Cada texto deve começar pelo nome correspondente (o restante é o subtexto do item). */
  const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const comecamCom = (nomes: string[]) => nomes.map((nome) => expect.stringMatching(new RegExp(`^${escaparRegex(nome)}`)))
  /** Opções de itens do painel (sem a opção "Selecionar todas as filiais (N)"). */
  const textosOpcoes = (lista: HTMLElement) =>
    within(lista)
      .queryAllByRole('option')
      .map((item) => item.textContent ?? '')
      .filter((texto) => !texto.startsWith(OPCAO_TODAS))
  const textosEscolhidos = (nome: string) =>
    within(screen.getByRole('list', { name: nome }))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '')

  /** Abre o painel do dropdown se estiver fechado (ele permanece aberto após cada escolha). */
  async function abrirPainel(user: Usuario, botao: string) {
    const gatilho = screen.getByRole('button', { name: botao })
    if (gatilho.getAttribute('aria-expanded') !== 'true') await user.click(gatilho)
  }

  async function abrir(user: Usuario, botao: string, lista: string) {
    await abrirPainel(user, botao)
    return listaAtual(lista)
  }

  async function escolherTipo(user: Usuario, rotulo: string) {
    if (botaoTipo().getAttribute('aria-expanded') !== 'true') await user.click(botaoTipo())
    await user.click(opcao(listaTipos(), rotulo))
  }

  describe('tipo de vínculo ("Vincular dashboard a")', () => {
    it('é um dropdown "Vincular dashboard a" que mostra o tipo atual e abre as três opções com os subtextos do protótipo', async () => {
      const user = usuarioRapido()
      renderizar()

      expect(screen.getByText('Vincular dashboard a')).toBeInTheDocument()
      expect(botaoTipo()).toHaveTextContent('Cargos de colaboradores')
      expect(botaoTipo()).toHaveAttribute('aria-expanded', 'false')
      expect(botaoTipo()).toHaveAttribute('aria-haspopup', 'listbox')
      expect(screen.queryByRole('combobox', { name: 'Tipo de vínculo' })).not.toBeInTheDocument()

      await user.click(botaoTipo())

      expect(botaoTipo()).toHaveAttribute('aria-expanded', 'true')
      expect(within(listaTipos()).getAllByRole('option')).toHaveLength(3)
      expect(opcao(listaTipos(), 'Filiais')).toHaveTextContent('Gera imagens só para as filiais escolhidas')
      expect(opcao(listaTipos(), 'Cargos de colaboradores')).toHaveTextContent('Gera imagens para todas as filiais')
      expect(opcao(listaTipos(), 'Colaboradores específicos')).toHaveTextContent('Gera imagens para as filiais dos colaboradores escolhidos')
      expect(opcao(listaTipos(), 'Cargos de colaboradores')).toHaveAttribute('aria-selected', 'true')
      expect(opcao(listaTipos(), 'Filiais')).toHaveAttribute('aria-selected', 'false')
    })

    it('escolher o tipo fecha o dropdown, chama onChange com o tipo e sem itens e mostra o campo de itens correspondente', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar()

      await escolherTipo(user, 'Filiais')
      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'filiais', itens: [] })
      expect(screen.queryByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).not.toBeInTheDocument()
      expect(botaoTipo()).toHaveTextContent('Filiais')
      expect(screen.getByText('Filiais vinculadas')).toBeInTheDocument()
      expect(screen.getByText('Nenhuma filial selecionada.')).toBeInTheDocument()

      await escolherTipo(user, 'Colaboradores específicos')
      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'colaboradores', itens: [] })
      expect(screen.getByText('Colaboradores vinculados')).toBeInTheDocument()
      expect(screen.getByText('Nenhum colaborador selecionado.')).toBeInTheDocument()

      await escolherTipo(user, 'Cargos de colaboradores')
      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'cargos', itens: [] })
      expect(screen.getByText('Cargos vinculados')).toBeInTheDocument()
      expect(screen.getByText('Nenhum cargo selecionado.')).toBeInTheDocument()
    })

    it('trocar o tipo limpa os itens escolhidos', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'filiais', itens: ['100', '101'] })

      await escolherTipo(user, 'Cargos de colaboradores')

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'cargos', itens: [] })
      expect(screen.queryByRole('list', { name: 'Filiais escolhidas' })).not.toBeInTheDocument()
    })

    it('escolher o mesmo tipo mantém os itens escolhidos', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'filiais', itens: ['100', '101'] })

      await escolherTipo(user, 'Filiais')

      expect(onChange).not.toHaveBeenCalledWith({ tipo: 'filiais', itens: [] })
      expect(textosEscolhidos('Filiais escolhidas')).toEqual(comecamCom(['100 - MATRIZ', '101 - CAMPO GRANDE']))
    })
  })

  describe('filiais', () => {
    it('"Selecionar filial" abre a lista "Filiais vinculadas", sem busca, com "{código} - {nome}" e a quantidade de colaboradores', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'filiais', itens: [] })

      const lista = await abrir(user, 'Selecionar filial', 'Filiais vinculadas')

      expect(screen.getByRole('button', { name: 'Selecionar filial' })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/^Buscar/)).not.toBeInTheDocument()
      expect(textosOpcoes(lista)).toEqual(comecamCom(['100 - MATRIZ', '101 - CAMPO GRANDE', '102 - DOURADOS', '103 - TRÊS LAGOAS']))
      expect(opcao(lista, '100 - MATRIZ')).toHaveTextContent('2 colaboradores')
      expect(opcao(lista, '103 - TRÊS LAGOAS')).toHaveTextContent('Sem colaborador vinculado')
    })

    it('o painel começa com a opção "Selecionar todas as filiais (N)", com "Adiciona todas as filiais de uma vez"', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'filiais', itens: ['102'] })

      const lista = await abrir(user, 'Selecionar filial', 'Filiais vinculadas')

      const primeira = within(lista).getAllByRole('option')[0]
      expect(primeira).toHaveTextContent('Selecionar todas as filiais (4)')
      expect(primeira).toHaveTextContent('Adiciona todas as filiais de uma vez')
    })

    it('escolher filiais as acrescenta à lista "Filiais escolhidas", na ordem da escolha, e as tira das opções; o painel continua aberto', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'filiais', itens: [] })

      await user.click(opcao(await abrir(user, 'Selecionar filial', 'Filiais vinculadas'), '102 - DOURADOS'))
      expect(screen.getByRole('button', { name: 'Selecionar filial' })).toHaveAttribute('aria-expanded', 'true')
      await user.click(opcao(listaAtual('Filiais vinculadas'), '100 - MATRIZ'))

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'filiais', itens: ['102', '100'] })
      expect(textosEscolhidos('Filiais escolhidas')).toEqual(comecamCom(['102 - DOURADOS', '100 - MATRIZ']))
      expect(textosOpcoes(listaAtual('Filiais vinculadas'))).toEqual(comecamCom(['101 - CAMPO GRANDE', '103 - TRÊS LAGOAS']))
    })

    it('"Selecionar todas as filiais (N)" no painel escolhe todas, na ordem da lista, e fecha o painel', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'filiais', itens: ['102'] })

      await user.click(opcao(await abrir(user, 'Selecionar filial', 'Filiais vinculadas'), OPCAO_TODAS))

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'filiais', itens: ['100', '101', '102', '103'] })
      expect(screen.queryByRole('listbox', { name: 'Filiais vinculadas' })).not.toBeInTheDocument()
      expect(textosEscolhidos('Filiais escolhidas')).toEqual(comecamCom(['100 - MATRIZ', '101 - CAMPO GRANDE', '102 - DOURADOS', '103 - TRÊS LAGOAS']))
    })

    it('o botão "Selecionar todas" escolhe todas as filiais e some, com a opção do painel, quando não resta nenhuma', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'filiais', itens: ['102'] })

      await user.click(screen.getByRole('button', { name: 'Selecionar todas' }))

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'filiais', itens: ['100', '101', '102', '103'] })
      expect(screen.queryByRole('button', { name: 'Selecionar todas' })).not.toBeInTheDocument()
      const lista = await abrir(user, 'Selecionar filial', 'Filiais vinculadas')
      expect(within(lista).queryAllByRole('option')).toHaveLength(0)
      expect(screen.getByText('Todas as filiais já foram adicionadas.')).toBeInTheDocument()
    })

    it('"Limpar seleção" só aparece com mais de um item e tira todos os escolhidos', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'filiais', itens: ['100'] })

      expect(screen.queryByRole('button', { name: 'Limpar seleção' })).not.toBeInTheDocument()
      await user.click(opcao(await abrir(user, 'Selecionar filial', 'Filiais vinculadas'), '101 - CAMPO GRANDE'))

      await user.click(screen.getByRole('button', { name: 'Limpar seleção' }))

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'filiais', itens: [] })
      expect(screen.getByText('Nenhuma filial selecionada.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Limpar seleção' })).not.toBeInTheDocument()
    })

    it('"Remover {filial}" tira a filial escolhida', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'filiais', itens: ['100', '101'] })

      await user.click(within(screen.getByRole('list', { name: 'Filiais escolhidas' })).getByRole('button', { name: 'Remover 100 - MATRIZ' }))

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'filiais', itens: ['101'] })
      expect(textosEscolhidos('Filiais escolhidas')).toEqual(comecamCom(['101 - CAMPO GRANDE']))
    })

    it('resumo: "No encerramento serão geradas N imagens (uma por colaborador) nas filiais …", com a filial sem colaborador explicada (RF-50)', () => {
      renderizar({ tipo: 'filiais', itens: ['103', '101'] })

      expect(screen.getByText('No encerramento serão geradas 3 imagens (uma por colaborador) nas filiais 101, 103.')).toBeInTheDocument()
      expect(screen.getByText(`A filial 103 não tem colaborador vinculado e gera uma única imagem, ${FILIAL_SEM_COLABORADOR}`)).toBeInTheDocument()
    })

    it('resumo no singular para uma imagem em uma filial', () => {
      renderizar({ tipo: 'filiais', itens: ['103'] })

      expect(screen.getByText('No encerramento será gerada 1 imagem (uma por colaborador) na filial 103.')).toBeInTheDocument()
    })

    it('resumo com várias filiais sem colaborador fica no plural', () => {
      const filiais = [...FILIAIS_VINCULO, { codigo: '104', nome: 'CORUMBÁ' }]
      render(
        <SecaoVinculo
          valor={{ tipo: 'filiais', itens: ['103', '104'] }}
          onChange={vi.fn()}
          filiais={filiais}
          cargos={CARGOS_VINCULO}
          colaboradores={COLABORADORES_VINCULO}
        />,
      )

      expect(screen.getByText('No encerramento serão geradas 2 imagens (uma por colaborador) nas filiais 103, 104.')).toBeInTheDocument()
      expect(
        screen.getByText(`As filiais 103, 104 não têm colaborador vinculado e cada uma gera uma única imagem, ${FILIAL_SEM_COLABORADOR}`),
      ).toBeInTheDocument()
    })

    it('sem itens escolhidos não há resumo', () => {
      renderizar({ tipo: 'filiais', itens: [] })

      expect(screen.queryByText(/No encerramento/)).not.toBeInTheDocument()
    })
  })

  describe('cargos', () => {
    it('"Selecionar cargo de colaboradores" abre a busca "Buscar cargo" ("Buscar cargo...") e a lista "Cargos vinculados"; não há "Selecionar todas"', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'cargos', itens: [] })

      const lista = await abrir(user, 'Selecionar cargo de colaboradores', 'Cargos vinculados')

      expect(screen.getByLabelText('Buscar cargo')).toHaveAttribute('placeholder', 'Buscar cargo...')
      expect(textosOpcoes(lista)).toEqual(comecamCom(['Gerente de Loja', 'Supervisor Comercial', 'Vendedor']))
      expect(opcao(lista, 'Vendedor')).toHaveTextContent('3 colaboradores')
      expect(opcao(lista, 'Supervisor Comercial')).toHaveTextContent('1 colaborador')
      expect(screen.queryByRole('button', { name: 'Selecionar todas' })).not.toBeInTheDocument()
      expect(within(lista).queryByRole('option', { name: (nome) => nome.startsWith(OPCAO_TODAS) })).not.toBeInTheDocument()
    })

    it('a busca filtra sem acento nem maiúsculas; sem resultado mostra "Nenhum resultado para a busca."', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'cargos', itens: [] })
      await abrirPainel(user, 'Selecionar cargo de colaboradores')

      await user.type(screen.getByLabelText('Buscar cargo'), 'GERENTE')
      expect(textosOpcoes(listaAtual('Cargos vinculados'))).toEqual(comecamCom(['Gerente de Loja']))

      await user.clear(screen.getByLabelText('Buscar cargo'))
      await user.type(screen.getByLabelText('Buscar cargo'), 'xyz')
      expect(screen.getByText('Nenhum resultado para a busca.')).toBeInTheDocument()
    })

    it('escolher cargos e ver o resumo: uma imagem por colaborador, só nas filiais com o cargo', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'cargos', itens: [] })

      await abrirPainel(user, 'Selecionar cargo de colaboradores')
      await user.type(screen.getByLabelText('Buscar cargo'), 'vend')
      expect(textosOpcoes(listaAtual('Cargos vinculados'))).toEqual(comecamCom(['Vendedor']))
      await user.click(opcao(listaAtual('Cargos vinculados'), 'Vendedor'))

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'cargos', itens: ['Vendedor'] })
      expect(textosEscolhidos('Cargos escolhidos')).toEqual(comecamCom(['Vendedor']))
      expect(screen.getByText('No encerramento serão geradas 3 imagens (uma por colaborador) nas filiais 101, 102.')).toBeInTheDocument()
    })

    it('todos os cargos escolhidos: "Todos os cargos já foram adicionados."', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'cargos', itens: ['Gerente de Loja', 'Supervisor Comercial', 'Vendedor'] })

      await abrirPainel(user, 'Selecionar cargo de colaboradores')

      expect(screen.getByText('Todos os cargos já foram adicionados.')).toBeInTheDocument()
    })

    it('cargo sem colaboradores: "Nenhuma imagem será gerada: não há colaboradores nos itens escolhidos."', () => {
      render(
        <SecaoVinculo
          valor={{ tipo: 'cargos', itens: ['Motorista'] }}
          onChange={vi.fn()}
          filiais={FILIAIS_VINCULO}
          cargos={[...CARGOS_VINCULO, { cargo: 'Motorista', colaboradores: 0 }]}
          colaboradores={COLABORADORES_VINCULO}
        />,
      )

      expect(screen.getByText('Nenhuma imagem será gerada: não há colaboradores nos itens escolhidos.')).toBeInTheDocument()
    })
  })

  describe('colaboradores específicos', () => {
    it('"Selecionar colaborador" abre a busca "Buscar colaborador" ("Buscar por nome, cargo ou filial...") e a lista "Colaboradores vinculados"', async () => {
      const user = usuarioRapido()
      renderizar({ tipo: 'colaboradores', itens: [] })

      const lista = await abrir(user, 'Selecionar colaborador', 'Colaboradores vinculados')

      expect(screen.getByLabelText('Buscar colaborador')).toHaveAttribute('placeholder', 'Buscar por nome, cargo ou filial...')
      expect(textosOpcoes(lista)).toEqual(comecamCom(['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha', 'Elisa Prado', 'Fábio Nunes']))
      expect(opcao(lista, 'Ana Souza')).toHaveTextContent('Gerente de Loja · Filial 100')
    })

    it.each([
      ['nome, sem acento', 'fabio', ['Fábio Nunes']],
      ['cargo', 'gerente', ['Ana Souza', 'Diego Rocha']],
      ['filial', '101', ['Bruno Lima', 'Carla Dias']],
    ])('a busca alcança %s', async (_caso, termo, esperado) => {
      const user = usuarioRapido()
      renderizar({ tipo: 'colaboradores', itens: [] })
      await abrirPainel(user, 'Selecionar colaborador')

      await user.type(screen.getByLabelText('Buscar colaborador'), termo)

      expect(textosOpcoes(listaAtual('Colaboradores vinculados'))).toEqual(comecamCom(esperado))
    })

    it('escolher colaboradores registra os ids em texto e o resumo mostra uma imagem por colaborador', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ tipo: 'colaboradores', itens: [] })

      await user.click(opcao(await abrir(user, 'Selecionar colaborador', 'Colaboradores vinculados'), 'Ana Souza'))

      expect(onChange).toHaveBeenLastCalledWith({ tipo: 'colaboradores', itens: ['11'] })
      expect(textosEscolhidos('Colaboradores escolhidos')).toEqual(comecamCom(['Ana Souza']))
      expect(screen.getByText('No encerramento será gerada 1 imagem (uma por colaborador) na filial 100.')).toBeInTheDocument()
    })
  })

  it('mostra o erro dos itens recebido do formulário', () => {
    render(
      <SecaoVinculo
        valor={{ tipo: 'filiais', itens: [] }}
        onChange={vi.fn()}
        filiais={FILIAIS_VINCULO}
        cargos={CARGOS_VINCULO}
        colaboradores={COLABORADORES_VINCULO}
        erroItens="Selecione ao menos uma filial."
      />,
    )

    expect(screen.getByText('Selecione ao menos uma filial.')).toBeInTheDocument()
  })
})
