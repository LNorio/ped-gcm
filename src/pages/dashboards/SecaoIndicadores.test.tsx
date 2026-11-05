import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import { dadosExternosParaDashboardApi, indicadoresParaDashboardApi } from '../../test/dashboardsFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { TipoVinculo } from '../../types/dominio'
import { SecaoIndicadores, type PontosIndicador, type SecaoIndicadoresProps } from './SecaoIndicadores'

const INDICADORES = indicadoresParaDashboardApi().map(paraIndicador)
const DADOS_EXTERNOS = dadosExternosParaDashboardApi().map(paraDadoExterno)

describe('F7.6 — SecaoIndicadores: indicadores com pontos base, total e indisponíveis (RF-51, RF-52, RF-53, RN-15, protótipo dashModal)', () => {
  interface Opcoes {
    inicial?: PontosIndicador[]
    tipoVinculo?: TipoVinculo | ''
    pontuacaoMaxima?: number | null
    extras?: Partial<SecaoIndicadoresProps>
  }

  /** Mantém o valor em estado, como o formulário faz, e registra cada mudança. */
  function Controlado({ inicial = [], tipoVinculo = 'cargos', pontuacaoMaxima = 100, extras = {}, onChange }: Opcoes & { onChange: (v: PontosIndicador[]) => void }) {
    const [valor, setValor] = useState(inicial)
    return (
      <SecaoIndicadores
        indicadores={INDICADORES}
        dadosExternos={DADOS_EXTERNOS}
        tipoVinculo={tipoVinculo}
        pontuacaoMaxima={pontuacaoMaxima}
        valor={valor}
        onChange={(novo) => {
          onChange(novo)
          setValor(novo)
        }}
        {...extras}
      />
    )
  }

  function renderizar(opcoes: Opcoes = {}) {
    const onChange = vi.fn<(valor: PontosIndicador[]) => void>()
    render(<Controlado {...opcoes} onChange={onChange} />)
    return { onChange }
  }

  const grupo = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const botao = () => within(grupo()).getByRole('button', { name: 'Selecionar indicador' })
  const lista = () => within(grupo()).getByRole('listbox', { name: 'Indicadores' })
  const opcao = (rotulo: string) => within(lista()).getByRole('option', { name: (nome) => nome.startsWith(rotulo) })
  const pontos = (nome: string) => screen.getByRole('textbox', { name: `Pontos base de ${nome} neste dashboard` })
  const escolhidos = () =>
    within(within(grupo()).getByRole('list', { name: 'Indicadores escolhidos' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '')

  async function abrir(user: Usuario) {
    if (botao().getAttribute('aria-expanded') !== 'true') await user.click(botao())
  }

  async function escolher(user: Usuario, nome: string) {
    await abrir(user)
    await user.click(opcao(nome))
  }

  it('começa sem indicadores ("Nenhum indicador selecionado.") e com o dropdown fechado', () => {
    renderizar()

    expect(within(grupo()).getByText('Nenhum indicador selecionado.')).toBeInTheDocument()
    expect(botao()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('o dropdown tem "Buscar indicador" ("Buscar indicador...") e lista primeiro os disponíveis e depois os indisponíveis, desabilitados, com o motivo; inativos não aparecem (RF-52)', async () => {
    const user = usuarioRapido()
    renderizar()

    await abrir(user)

    expect(within(grupo()).getByLabelText('Buscar indicador')).toHaveAttribute('placeholder', 'Buscar indicador...')
    const nomes = within(lista())
      .getAllByRole('option')
      .map((item) => INDICADORES.find((indicador) => (item.textContent ?? '').startsWith(indicador.nome))?.nome)
    expect(nomes).toEqual([
      'Cobertura de visitas',
      'Faturamento líquido mensal',
      'Vendas por zona',
      'Rotinas financeiras em dia',
      'Devoluções de venda',
      'Custo de frete por entrega',
      'Cobertura da carteira',
    ])
    expect(within(lista()).queryByRole('option', { name: (nome) => nome.startsWith('Capacitação') })).not.toBeInTheDocument()
    expect(opcao('Cobertura de visitas')).toBeEnabled()
    for (const [nome, motivo] of [
      ['Rotinas financeiras em dia', 'Componente desativado'],
      ['Devoluções de venda', 'Meta a definir'],
    ]) {
      expect(opcao(nome)).toBeDisabled()
      expect(opcao(nome)).toHaveAttribute('aria-disabled', 'true')
      expect(opcao(nome)).toHaveTextContent(`Indisponível: ${motivo}`)
    }
  })

  it('a opção disponível mostra a meta e onde o indicador já é usado ("{pts} pts em {dashboard}" ou "ainda não usado")', async () => {
    const user = usuarioRapido()
    renderizar()

    await abrir(user)

    expect(opcao('Cobertura de visitas')).toHaveTextContent('Meta 85,00 · 40 pts em PED Comercial')
    expect(opcao('Faturamento líquido mensal')).toHaveTextContent('Meta 1.500.000,50 · 60 pts em PED Comercial · 30 pts em PED Gerentes')
    expect(opcao('Vendas por zona')).toHaveTextContent('Meta 500.000,00 · ainda não usado')
  })

  it('em dashboard por filiais, indicador com dado externo por Zona de venda fica indisponível com o motivo (RF-53)', async () => {
    const user = usuarioRapido()
    renderizar({ tipoVinculo: 'filiais' })

    await abrir(user)

    expect(opcao('Vendas por zona')).toBeDisabled()
    expect(opcao('Vendas por zona')).toHaveTextContent('Indisponível: Dado externo por Zona de venda não é aceito em dashboard por filiais')
    expect(opcao('Faturamento líquido mensal')).toBeEnabled()
  })

  it('clicar em indisponível não o escolhe', async () => {
    const user = usuarioRapido()
    const { onChange } = renderizar()

    await abrir(user)
    await user.click(opcao('Devoluções de venda'))

    expect(onChange).not.toHaveBeenCalled()
    expect(within(grupo()).getByText('Nenhum indicador selecionado.')).toBeInTheDocument()
  })

  it('a busca filtra pelo nome, sem acento nem maiúsculas; sem resultado mostra "Nenhum indicador encontrado para a busca."', async () => {
    const user = usuarioRapido()
    renderizar()
    await abrir(user)

    await user.type(within(grupo()).getByLabelText('Buscar indicador'), 'COBERTURA')
    expect(within(lista()).getAllByRole('option')).toHaveLength(2)

    await user.clear(within(grupo()).getByLabelText('Buscar indicador'))
    await user.type(within(grupo()).getByLabelText('Buscar indicador'), 'devolucoes')
    expect(within(lista()).getAllByRole('option')).toHaveLength(1)

    await user.clear(within(grupo()).getByLabelText('Buscar indicador'))
    await user.type(within(grupo()).getByLabelText('Buscar indicador'), 'xyz')
    expect(within(grupo()).getByText('Nenhum indicador encontrado para a busca.')).toBeInTheDocument()
  })

  it('escolher indicadores os coloca em "Indicadores escolhidos", com o campo de pontos base de cada um, e os tira das opções', async () => {
    const user = usuarioRapido()
    const { onChange } = renderizar()

    await escolher(user, 'Faturamento líquido mensal')
    await escolher(user, 'Cobertura de visitas')

    expect(onChange).toHaveBeenLastCalledWith([
      { idIndicador: 3, pontos: '' },
      { idIndicador: 1, pontos: '' },
    ])
    expect(escolhidos()).toEqual([expect.stringMatching(/^Faturamento líquido mensal/), expect.stringMatching(/^Cobertura de visitas/)])
    expect(pontos('Faturamento líquido mensal')).toHaveValue('')
    expect(pontos('Faturamento líquido mensal')).toHaveAttribute('inputmode', 'decimal')
    expect(pontos('Faturamento líquido mensal')).toHaveAttribute('placeholder', '0')
    expect(pontos('Cobertura de visitas')).toHaveAttribute('aria-required', 'true')
    await abrir(user)
    expect(within(lista()).queryByRole('option', { name: (nome) => nome.startsWith('Cobertura de visitas') })).not.toBeInTheDocument()
  })

  it('com indicadores escolhidos há a linha de cabeçalho "Indicador" / "Pts base neste dashboard" (fora da lista) e cada item mostra a meta e a composição', async () => {
    const user = usuarioRapido()
    renderizar()

    expect(within(grupo()).queryByText('Pts base neste dashboard')).not.toBeInTheDocument()
    await escolher(user, 'Cobertura de visitas')
    await escolher(user, 'Faturamento líquido mensal')

    expect(within(grupo()).getByText('Indicador')).toBeInTheDocument()
    expect(within(grupo()).getByText('Pts base neste dashboard')).toBeInTheDocument()
    expect(escolhidos()).toHaveLength(2)
    expect(escolhidos()[0]).toContain('Meta 85,00 · 2 apontamentos')
    expect(escolhidos()[1]).toContain('Meta 1.500.000,50 · dado externo')
  })

  it('digitar os pontos base atualiza o valor e o total: "{n} indicadores · {soma} de {máximo} pts" e quanto falta', async () => {
    const user = usuarioRapido()
    const { onChange } = renderizar({ pontuacaoMaxima: 100 })

    await escolher(user, 'Faturamento líquido mensal')
    expect(within(grupo()).getByText('1 indicador · 0 de 100 pts')).toBeInTheDocument()
    expect(within(grupo()).getByText('Faltam 100 pts para 100')).toBeInTheDocument()

    await user.type(pontos('Faturamento líquido mensal'), '60')
    await escolher(user, 'Cobertura de visitas')
    await user.type(pontos('Cobertura de visitas'), '30,5')

    expect(onChange).toHaveBeenLastCalledWith([
      { idIndicador: 3, pontos: '60' },
      { idIndicador: 1, pontos: '30,5' },
    ])
    expect(within(grupo()).getByText('2 indicadores · 90,50 de 100 pts')).toBeInTheDocument()
    expect(within(grupo()).getByText('Faltam 9,50 pts para 100')).toBeInTheDocument()
  })

  it('total igual ao máximo mostra "Total correto"; acima, quanto excede', () => {
    const { unmount } = render(
      <SecaoIndicadores
        indicadores={INDICADORES}
        dadosExternos={DADOS_EXTERNOS}
        tipoVinculo="cargos"
        pontuacaoMaxima={100}
        valor={[
          { idIndicador: 1, pontos: '40' },
          { idIndicador: 3, pontos: '60' },
        ]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('2 indicadores · 100 de 100 pts')).toBeInTheDocument()
    expect(screen.getByText('Total correto: 100 pts')).toBeInTheDocument()
    unmount()

    render(
      <SecaoIndicadores
        indicadores={INDICADORES}
        dadosExternos={DADOS_EXTERNOS}
        tipoVinculo="cargos"
        pontuacaoMaxima={100}
        valor={[
          { idIndicador: 1, pontos: '50' },
          { idIndicador: 3, pontos: '60' },
        ]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Excedeu 10 pts — o total deve ser 100')).toBeInTheDocument()
  })

  it('sem pontuação máxima válida, pede "Informe a pontuação base máxima"', () => {
    renderizar({ pontuacaoMaxima: null })

    expect(within(grupo()).getByText('Informe a pontuação base máxima')).toBeInTheDocument()
  })

  it('"Remover {nome}" tira o indicador e os pontos dele', async () => {
    const user = usuarioRapido()
    const { onChange } = renderizar({
      inicial: [
        { idIndicador: 1, pontos: '40' },
        { idIndicador: 3, pontos: '60' },
      ],
    })

    await user.click(within(grupo()).getByRole('button', { name: 'Remover Cobertura de visitas' }))

    expect(onChange).toHaveBeenLastCalledWith([{ idIndicador: 3, pontos: '60' }])
    expect(escolhidos()).toEqual([expect.stringMatching(/^Faturamento líquido mensal/)])
    expect(within(grupo()).getByText('1 indicador · 60 de 100 pts')).toBeInTheDocument()
  })

  it('edição: indicador já vinculado que ficou com problema continua escolhido, com a etiqueta "⚠ {motivo}" (só novos são barrados)', () => {
    renderizar({
      inicial: [
        { idIndicador: 3, pontos: '30' },
        { idIndicador: 6, pontos: '20' },
      ],
      pontuacaoMaxima: 50,
      extras: { idsJaVinculados: [3, 6] },
    })

    const itemCusto = within(within(grupo()).getByRole('list', { name: 'Indicadores escolhidos' }))
      .getAllByRole('listitem')
      .find((item) => (item.textContent ?? '').startsWith('Custo de frete por entrega'))!
    expect(within(itemCusto).getByText('⚠ Componente desativado')).toBeInTheDocument()
    expect(pontos('Custo de frete por entrega')).toHaveValue('20')
    expect(within(grupo()).getByText('Total correto: 50 pts')).toBeInTheDocument()
  })

  it('edição: indicador inativo já vinculado continua na lista, com "⚠ Indicador inativo", mas não volta ao dropdown se removido', async () => {
    const user = usuarioRapido()
    renderizar({
      inicial: [
        { idIndicador: 2, pontos: '50,5' },
        { idIndicador: 5, pontos: '40' },
      ],
      pontuacaoMaxima: 90.5,
      extras: { idsJaVinculados: [2, 5] },
    })

    const itemCapacitacao = within(within(grupo()).getByRole('list', { name: 'Indicadores escolhidos' }))
      .getAllByRole('listitem')
      .find((item) => (item.textContent ?? '').startsWith('Capacitação'))!
    expect(within(itemCapacitacao).getByText('⚠ Indicador inativo')).toBeInTheDocument()

    await user.click(within(grupo()).getByRole('button', { name: 'Remover Capacitação' }))
    await abrir(user)
    expect(within(lista()).queryByRole('option', { name: (nome) => nome.startsWith('Capacitação') })).not.toBeInTheDocument()
  })

  it('mostra o erro geral e os erros de pontos recebidos do formulário', () => {
    renderizar({
      inicial: [{ idIndicador: 1, pontos: '' }],
      extras: {
        erro: 'Vincule ao menos um indicador.',
        errosPontos: { 1: 'Informe os pontos base do indicador “Cobertura de visitas” neste dashboard.' },
      },
    })

    expect(within(grupo()).getByText('Vincule ao menos um indicador.')).toBeInTheDocument()
    expect(pontos('Cobertura de visitas')).toHaveAccessibleDescription(
      expect.stringContaining('Informe os pontos base do indicador “Cobertura de visitas” neste dashboard.'),
    )
  })
})
