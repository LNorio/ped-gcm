import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import { dadosExternosParaDashboardApi, indicadoresParaDashboardApi } from '../../test/dashboardsFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { SecaoIndicadores, type PontosIndicador, type SecaoIndicadoresProps } from './SecaoIndicadores'

const INDICADORES = indicadoresParaDashboardApi().map(paraIndicador)
const DADOS_EXTERNOS = dadosExternosParaDashboardApi().map(paraDadoExterno)

const AVISO =
  'Como o dashboard não é mensal, o sistema vai usar o resultado mensal de cada mês do período e fazer o cálculo escolhido em cada indicador.'
const ERRO_CALCULO = 'Selecione o cálculo no período.'

/**
 * Interface (F7.15): `SecaoIndicadores` recebe `mostrarCalculoNoPeriodo?: boolean` (padrão `false`; o
 * formulário passa `true` quando a periodicidade não é mensal) e `errosCalculo?: Record<number, string>`
 * (erro do cálculo de cada indicador, pelo id). `PontosIndicador` ganha `calculoNoPeriodo?: SentidoCalculo | ''`
 * (ausente ou `''` = ainda não escolhido).
 */
describe('F7.15 — SecaoIndicadores: "Cálculo no período" de cada indicador em dashboard não mensal', () => {
  interface Opcoes {
    inicial?: PontosIndicador[]
    extras?: Partial<SecaoIndicadoresProps>
  }

  function Controlado({ inicial = [], extras = {}, onChange }: Opcoes & { onChange: (v: PontosIndicador[]) => void }) {
    const [valor, setValor] = useState(inicial)
    return (
      <SecaoIndicadores
        indicadores={INDICADORES}
        dadosExternos={DADOS_EXTERNOS}
        tipoVinculo="cargos"
        pontuacaoMaxima={100}
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
    const utils = render(<Controlado {...opcoes} onChange={onChange} />)
    return { ...utils, onChange }
  }

  const grupo = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const calculo = (nome: string) => within(grupo()).getByRole('combobox', { name: `Cálculo no período de ${nome}` })
  const consultarCalculo = (nome: string) => within(grupo()).queryByRole('combobox', { name: `Cálculo no período de ${nome}` })
  const textos = (select: HTMLElement) => within(select).getAllByRole('option').map((opcao) => opcao.textContent)
  const itemDe = (nome: string) =>
    within(within(grupo()).getByRole('list', { name: 'Indicadores escolhidos' }))
      .getAllByRole('listitem')
      .find((li) => (li.textContent ?? '').startsWith(nome))!

  async function escolher(user: Usuario, nome: string) {
    const botao = within(grupo()).getByRole('button', { name: 'Selecionar indicador' })
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao)
    await user.click(
      within(within(grupo()).getByRole('listbox', { name: 'Indicadores' })).getByRole('option', { name: (n) => n.startsWith(nome) }),
    )
  }

  const DOIS: PontosIndicador[] = [
    { idIndicador: 1, pontos: '40' },
    { idIndicador: 3, pontos: '60' },
  ]

  describe('com mostrarCalculoNoPeriodo', () => {
    it('cada indicador escolhido tem o select "Cálculo no período de {nome}", dentro da própria linha', () => {
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      expect(within(itemDe('Cobertura de visitas')).getByRole('combobox', { name: 'Cálculo no período de Cobertura de visitas' })).toBeInTheDocument()
      expect(
        within(itemDe('Faturamento líquido mensal')).getByRole('combobox', { name: 'Cálculo no período de Faturamento líquido mensal' }),
      ).toBeInTheDocument()
    })

    it('o cabeçalho da lista ganha a coluna "Cálculo no período"', () => {
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      expect(within(grupo()).getByText('Cálculo no período')).toBeInTheDocument()
    })

    it('opções "Somar", "Fazer a média" e "Usar só o último valor" (ROTULOS_SENTIDO_CALCULO), depois de "Selecione"; começa vazio, sem valor padrão', () => {
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      for (const nome of ['Cobertura de visitas', 'Faturamento líquido mensal']) {
        expect(textos(calculo(nome))).toEqual(['Selecione', 'Somar', 'Fazer a média', 'Usar só o último valor'])
        expect(calculo(nome)).toHaveValue('')
      }
    })

    it('os valores das opções são os de SENTIDOS_CALCULO (soma, media, ultimo)', () => {
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      const valores = within(calculo('Cobertura de visitas'))
        .getAllByRole('option')
        .map((opcao) => (opcao as HTMLOptionElement).value)
      expect(valores).toEqual(['', 'soma', 'media', 'ultimo'])
    })

    it('o select é obrigatório (aria-required)', () => {
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      expect(calculo('Cobertura de visitas')).toHaveAttribute('aria-required', 'true')
    })

    it('escolher o cálculo chama onChange com calculoNoPeriodo só no indicador alterado, mantendo os pontos', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      await user.selectOptions(calculo('Faturamento líquido mensal'), 'Usar só o último valor')

      expect(onChange).toHaveBeenLastCalledWith([
        { idIndicador: 1, pontos: '40' },
        { idIndicador: 3, pontos: '60', calculoNoPeriodo: 'ultimo' },
      ])
      expect(calculo('Faturamento líquido mensal')).toHaveValue('ultimo')
      expect(calculo('Cobertura de visitas')).toHaveValue('')
    })

    it.each<[string, string]>([
      ['Somar', 'soma'],
      ['Fazer a média', 'media'],
      ['Usar só o último valor', 'ultimo'],
    ])('"%s" grava calculoNoPeriodo "%s"', async (rotulo, valor) => {
      const user = usuarioRapido()
      const { onChange } = renderizar({ inicial: [{ idIndicador: 1, pontos: '100' }], extras: { mostrarCalculoNoPeriodo: true } })

      await user.selectOptions(calculo('Cobertura de visitas'), rotulo)

      expect(onChange).toHaveBeenLastCalledWith([{ idIndicador: 1, pontos: '100', calculoNoPeriodo: valor }])
    })

    it('mostra o valor recebido em `valor` (ex.: edição)', () => {
      renderizar({
        inicial: [
          { idIndicador: 1, pontos: '40', calculoNoPeriodo: 'media' },
          { idIndicador: 3, pontos: '60', calculoNoPeriodo: 'soma' },
        ],
        extras: { mostrarCalculoNoPeriodo: true },
      })

      expect(calculo('Cobertura de visitas')).toHaveValue('media')
      expect(calculo('Faturamento líquido mensal')).toHaveValue('soma')
    })

    it('digitar os pontos não apaga o cálculo escolhido', async () => {
      const user = usuarioRapido()
      const { onChange } = renderizar({
        inicial: [{ idIndicador: 1, pontos: '', calculoNoPeriodo: 'soma' }],
        extras: { mostrarCalculoNoPeriodo: true },
      })

      await user.type(screen.getByRole('textbox', { name: 'Pontos base de Cobertura de visitas neste dashboard' }), '9')

      expect(onChange).toHaveBeenLastCalledWith([{ idIndicador: 1, pontos: '9', calculoNoPeriodo: 'soma' }])
      expect(calculo('Cobertura de visitas')).toHaveValue('soma')
    })

    it('indicador escolhido depois também ganha o select, vazio', async () => {
      const user = usuarioRapido()
      renderizar({ inicial: [{ idIndicador: 1, pontos: '40', calculoNoPeriodo: 'soma' }], extras: { mostrarCalculoNoPeriodo: true } })

      await escolher(user, 'Vendas por zona')

      expect(calculo('Vendas por zona')).toHaveValue('')
      expect(calculo('Cobertura de visitas')).toHaveValue('soma')
    })

    it('remover um indicador remove o select dele', async () => {
      const user = usuarioRapido()
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      await user.click(within(grupo()).getByRole('button', { name: 'Remover Cobertura de visitas' }))

      expect(consultarCalculo('Cobertura de visitas')).not.toBeInTheDocument()
      expect(calculo('Faturamento líquido mensal')).toBeInTheDocument()
    })

    it(`aviso informativo (role note) na seção: "${AVISO}"`, () => {
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true } })

      const aviso = within(grupo()).getByText(AVISO)
      expect(aviso.closest('[role="note"]')).not.toBeNull()
    })

    it('o aviso aparece mesmo sem indicador escolhido', () => {
      renderizar({ extras: { mostrarCalculoNoPeriodo: true } })

      expect(within(grupo()).getByText(AVISO)).toBeInTheDocument()
      expect(within(grupo()).getByText('Nenhum indicador selecionado.')).toBeInTheDocument()
    })

    it('errosCalculo: o erro aparece no campo do indicador (aria-invalid e descrição acessível), só nele', () => {
      renderizar({ inicial: DOIS, extras: { mostrarCalculoNoPeriodo: true, errosCalculo: { 3: ERRO_CALCULO } } })

      expect(calculo('Faturamento líquido mensal')).toHaveAttribute('aria-invalid', 'true')
      expect(calculo('Faturamento líquido mensal')).toHaveAccessibleDescription(expect.stringContaining(ERRO_CALCULO))
      expect(within(itemDe('Faturamento líquido mensal')).getByText(ERRO_CALCULO)).toBeInTheDocument()
      expect(calculo('Cobertura de visitas')).not.toHaveAttribute('aria-invalid')
      expect(within(itemDe('Cobertura de visitas')).queryByText(ERRO_CALCULO)).not.toBeInTheDocument()
    })
  })

  describe('sem mostrarCalculoNoPeriodo (dashboard mensal)', () => {
    it('padrão: sem select de cálculo, sem a coluna e sem o aviso', () => {
      renderizar({ inicial: DOIS })

      expect(consultarCalculo('Cobertura de visitas')).not.toBeInTheDocument()
      expect(consultarCalculo('Faturamento líquido mensal')).not.toBeInTheDocument()
      expect(within(grupo()).queryByText('Cálculo no período')).not.toBeInTheDocument()
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
    })

    it('mostrarCalculoNoPeriodo false: nada do cálculo, mesmo com valor e erro informados', () => {
      renderizar({
        inicial: [{ idIndicador: 1, pontos: '100', calculoNoPeriodo: 'soma' }],
        extras: { mostrarCalculoNoPeriodo: false, errosCalculo: { 1: ERRO_CALCULO } },
      })

      expect(consultarCalculo('Cobertura de visitas')).not.toBeInTheDocument()
      expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
      expect(screen.queryByText(ERRO_CALCULO)).not.toBeInTheDocument()
    })

    it('passar a mostrar (troca da periodicidade) exibe o select com o valor guardado', () => {
      const inicial: PontosIndicador[] = [{ idIndicador: 1, pontos: '100', calculoNoPeriodo: 'media' }]
      const { rerender } = render(
        <SecaoIndicadores indicadores={INDICADORES} dadosExternos={DADOS_EXTERNOS} tipoVinculo="cargos" pontuacaoMaxima={100} valor={inicial} onChange={vi.fn()} />,
      )
      expect(consultarCalculo('Cobertura de visitas')).not.toBeInTheDocument()

      rerender(
        <SecaoIndicadores
          indicadores={INDICADORES}
          dadosExternos={DADOS_EXTERNOS}
          tipoVinculo="cargos"
          pontuacaoMaxima={100}
          valor={inicial}
          onChange={vi.fn()}
          mostrarCalculoNoPeriodo
        />,
      )

      expect(calculo('Cobertura de visitas')).toHaveValue('media')
      expect(screen.getByText(AVISO)).toBeInTheDocument()
    })
  })
})
