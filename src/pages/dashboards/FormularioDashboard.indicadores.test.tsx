import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import {
  CARGOS_VINCULO,
  COLABORADORES_VINCULO,
  FILIAIS_VINCULO,
  dadosExternosParaDashboardApi,
  indicadoresParaDashboardApi,
} from '../../test/dashboardsFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { FormularioDashboard, type ListasFormularioDashboard } from './FormularioDashboard'

const LISTAS: ListasFormularioDashboard = {
  indicadores: indicadoresParaDashboardApi().map(paraIndicador),
  dadosExternos: dadosExternosParaDashboardApi().map(paraDadoExterno),
  filiais: FILIAIS_VINCULO,
  cargos: CARGOS_VINCULO,
  colaboradores: COLABORADORES_VINCULO,
}

const SOMA_DIFERENTE = 'A soma dos pontos base dos indicadores deve ser exatamente igual à pontuação base máxima (100 pts). Total atual: 90 pts.'
const ERRO_PONTOS_COBERTURA = 'Informe os pontos base do indicador “Cobertura de visitas” neste dashboard.'

describe('F7.6 — FormularioDashboard: indicadores com pontos base no formulário (RF-51, RF-52, RF-53, RN-15, protótipo dashModal)', () => {
  function renderizar() {
    const onPrevia = vi.fn().mockResolvedValue({ titulo: 'T', descricao: 'D' })
    const onSalvar = vi.fn()
    render(
      <FormularioDashboard
        listas={LISTAS}
        carregandoListas={false}
        erroListas={null}
        onPrevia={onPrevia}
        salvando={false}
        erro={null}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onPrevia, onSalvar }
  }

  const grupo = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const enviar = () => screen.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' })
  const pontos = (nome: string) => screen.getByRole('textbox', { name: `Pontos base de ${nome} neste dashboard` })

  async function escolherIndicador(user: Usuario, nome: string) {
    const botao = within(grupo()).getByRole('button', { name: 'Selecionar indicador' })
    if (botao.getAttribute('aria-expanded') !== 'true') await user.click(botao)
    await user.click(within(within(grupo()).getByRole('listbox', { name: 'Indicadores' })).getByRole('option', { name: (n) => n.startsWith(nome) }))
  }

  async function escolherTipo(user: Usuario, rotulo: string) {
    await user.click(screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' }))
    await user.click(
      within(screen.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).getByRole('option', { name: (n) => n.startsWith(rotulo) }),
    )
  }

  it('a pontuação base máxima digitada alimenta o total de "Indicadores vinculados"', async () => {
    const user = usuarioRapido()
    renderizar()

    expect(within(grupo()).getByText('Informe a pontuação base máxima')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Pontuação base máxima' }), '100')
    await escolherIndicador(user, 'Cobertura de visitas')
    await user.type(pontos('Cobertura de visitas'), '40')

    expect(within(grupo()).getByText('1 indicador · 40 de 100 pts')).toBeInTheDocument()
    expect(within(grupo()).getByText('Faltam 60 pts para 100')).toBeInTheDocument()
  })

  it('sem indicadores, enviar mostra "Vincule ao menos um indicador." e não salva', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()

    await user.click(enviar())

    expect(within(grupo()).getByText('Vincule ao menos um indicador.')).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it.each(['', '0', '-5', 'abc'])(
    'pontos base "%s" mostram "Informe os pontos base do indicador “{nome}” neste dashboard." no campo do indicador (RF-51)',
    async (valor) => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()

      await escolherIndicador(user, 'Cobertura de visitas')
      if (valor !== '') await user.type(pontos('Cobertura de visitas'), valor)
      await user.click(enviar())

      expect(pontos('Cobertura de visitas')).toHaveAccessibleDescription(expect.stringContaining(ERRO_PONTOS_COBERTURA))
      expect(onSalvar).not.toHaveBeenCalled()
    },
  )

  it('soma diferente da pontuação máxima mostra o total exigido e o total atual (RN-15)', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()

    await user.type(screen.getByRole('textbox', { name: 'Pontuação base máxima' }), '100')
    await escolherIndicador(user, 'Cobertura de visitas')
    await user.type(pontos('Cobertura de visitas'), '40')
    await escolherIndicador(user, 'Faturamento líquido mensal')
    await user.type(pontos('Faturamento líquido mensal'), '50')
    await user.click(enviar())

    expect(screen.getByText(SOMA_DIFERENTE)).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('indicador com dado externo por Zona de venda escolhido antes e vínculo trocado para filiais: erro do RF-53 ao enviar', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()

    await escolherIndicador(user, 'Vendas por zona')
    await escolherTipo(user, 'Filiais')
    await user.click(enviar())

    expect(
      screen.getByText('O indicador “Vendas por zona” usa dado externo por Zona de venda e não pode entrar em dashboard por filiais.'),
    ).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('trocar o tipo de vínculo mantém os indicadores escolhidos e os pontos digitados', async () => {
    const user = usuarioRapido()
    renderizar()

    await escolherIndicador(user, 'Cobertura de visitas')
    await user.type(pontos('Cobertura de visitas'), '40')
    await escolherTipo(user, 'Colaboradores específicos')

    expect(pontos('Cobertura de visitas')).toHaveValue('40')
  })
})
