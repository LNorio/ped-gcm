import { render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import { dadosExternosParaDashboardApi, indicadoresParaDashboardApi } from '../../test/dashboardsFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import { SecaoIndicadores, type PontosIndicador } from './SecaoIndicadores'

const INDICADORES = indicadoresParaDashboardApi().map(paraIndicador)
const DADOS_EXTERNOS = dadosExternosParaDashboardApi().map(paraDadoExterno)

/**
 * F12.1 (RNF-05, item A4 da revisão de acessibilidade de 24/11/2026) — foco ao escolher e remover
 * indicadores do dashboard (`SecaoIndicadores`).
 *
 * Regra: escolher um indicador (o painel continua aberto) → foco na busca "Buscar indicador"; remover →
 * foco no "Remover" do próximo; sem próximo, no do anterior; sem itens, no gatilho "Selecionar
 * indicador". O foco nunca fica no `<body>`.
 */
describe('F12.1 — SecaoIndicadores: foco ao escolher e remover (A4)', () => {
  function Controlado({ inicial }: { inicial: PontosIndicador[] }) {
    const [valor, setValor] = useState(inicial)
    return (
      <SecaoIndicadores
        indicadores={INDICADORES}
        dadosExternos={DADOS_EXTERNOS}
        tipoVinculo="cargos"
        pontuacaoMaxima={100}
        valor={valor}
        onChange={setValor}
      />
    )
  }

  function renderizar(inicial: PontosIndicador[] = []) {
    render(<Controlado inicial={inicial} />)
  }

  const grupo = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const botao = () => within(grupo()).getByRole('button', { name: 'Selecionar indicador' })
  const lista = () => within(grupo()).getByRole('listbox', { name: 'Indicadores' })
  const opcao = (rotulo: string) => within(lista()).getByRole('option', { name: (nome) => nome.startsWith(rotulo) })
  const remover = (nome: string) => within(grupo()).getByRole('button', { name: `Remover ${nome}` })

  async function escolher(user: Usuario, nome: string) {
    if (botao().getAttribute('aria-expanded') !== 'true') await user.click(botao())
    await user.click(opcao(nome))
  }

  it('escolher um indicador mantém o painel aberto e leva o foco à busca "Buscar indicador"', async () => {
    const user = usuarioRapido()
    renderizar()

    await escolher(user, 'Cobertura de visitas')

    expect(lista()).toBeInTheDocument()
    expect(within(grupo()).getByRole('searchbox', { name: 'Buscar indicador' })).toHaveFocus()
  })

  it('remover o primeiro leva o foco ao "Remover" do próximo', async () => {
    const user = usuarioRapido()
    renderizar([
      { idIndicador: 1, pontos: '40' },
      { idIndicador: 3, pontos: '60' },
    ])

    await user.click(remover('Cobertura de visitas'))

    expect(remover('Faturamento líquido mensal')).toHaveFocus()
  })

  it('remover o último (sem próximo) leva o foco ao "Remover" do anterior', async () => {
    const user = usuarioRapido()
    renderizar([
      { idIndicador: 1, pontos: '40' },
      { idIndicador: 3, pontos: '60' },
    ])

    await user.click(remover('Faturamento líquido mensal'))

    expect(remover('Cobertura de visitas')).toHaveFocus()
  })

  it('remover o único indicador leva o foco ao gatilho "Selecionar indicador"', async () => {
    const user = usuarioRapido()
    renderizar([{ idIndicador: 1, pontos: '40' }])

    await user.click(remover('Cobertura de visitas'))

    expect(within(grupo()).getByText('Nenhum indicador selecionado.')).toBeInTheDocument()
    expect(botao()).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })
})
