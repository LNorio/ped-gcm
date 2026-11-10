import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno, paraIndicador } from '../../services/adaptadores'
import { dadosExternosParaDashboardApi } from '../../test/dashboardsFalsos'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_ERRO_API,
} from '../../test/indicadoresFalsos'
import { type Usuario, usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { SecaoIndicadores, type PontosIndicador } from './SecaoIndicadores'

/**
 * F7.6 — Indicadores com meta via API no dropdown "Selecionar indicador" do formulário de dashboard
 * (contrato final: RESPOSTA-FINAL-meta-via-api.md, seção 2.6 — 10/11/2026).
 * - Fonte `integracao` sem situação `ok`: indisponível (desabilitado) com "Indisponível: {motivo}"
 *   ("Integração da meta pendente", "Aguardando a primeira consulta da meta", "Erro na consulta da meta").
 * - Fonte `dado_externo` e fonte `integracao` com `ok`: disponíveis.
 * - O subtexto da meta dos indicadores com meta via API é "Meta via API" (no lugar de "Meta a definir").
 */
const INDICADORES: Indicador[] = [
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_META_API_PENDENTE_API,
  INDICADOR_META_API_CONFIGURADO_API,
  INDICADOR_META_DADO_EXTERNO_API,
  INDICADOR_META_AGUARDANDO_API,
  INDICADOR_META_ERRO_API,
].map(paraIndicador)
const DADOS_EXTERNOS = dadosExternosParaDashboardApi().map(paraDadoExterno)

describe('F7.6 — SecaoIndicadores: indicadores com meta via API', () => {
  function renderizar(valor: PontosIndicador[] = []) {
    const onChange = vi.fn<(valor: PontosIndicador[]) => void>()
    render(
      <SecaoIndicadores
        indicadores={INDICADORES}
        dadosExternos={DADOS_EXTERNOS}
        tipoVinculo="filiais"
        pontuacaoMaxima={100}
        valor={valor}
        onChange={onChange}
      />,
    )
    return { onChange }
  }

  const grupo = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const lista = () => within(grupo()).getByRole('listbox', { name: 'Indicadores' })
  const opcao = (rotulo: string) => within(lista()).getByRole('option', { name: (nome) => nome.startsWith(rotulo) })

  async function abrir(user: Usuario) {
    await user.click(within(grupo()).getByRole('button', { name: 'Selecionar indicador' }))
  }

  it.each([
    ['Faturamento com meta da TI', 'Integração da meta pendente'],
    ['Novos clientes com meta da TI', 'Aguardando a primeira consulta da meta'],
    ['Cobertura com meta da TI', 'Erro na consulta da meta'],
  ])('fonte integracao sem meta disponível: %s fica desabilitado com "Indisponível: %s"', async (nome, motivo) => {
    const user = usuarioRapido()
    renderizar()

    await abrir(user)

    expect(opcao(nome)).toBeDisabled()
    expect(opcao(nome)).toHaveAttribute('aria-disabled', 'true')
    expect(opcao(nome)).toHaveTextContent(`Indisponível: ${motivo}`)
  })

  it('fonte dado_externo e fonte integracao com situação ok ficam disponíveis, com o subtexto "Meta via API"', async () => {
    const user = usuarioRapido()
    renderizar()

    await abrir(user)

    for (const nome of ['Faturamento com meta do ERP', 'Margem com meta da TI']) {
      expect(opcao(nome)).toBeEnabled()
      expect(opcao(nome)).toHaveTextContent('Meta via API · ainda não usado')
      expect(opcao(nome)).not.toHaveTextContent('Meta a definir')
    }
  })

  it('escolher o indicador da fonte dado_externo o adiciona aos escolhidos', async () => {
    const user = usuarioRapido()
    const { onChange } = renderizar()

    await abrir(user)
    await user.click(opcao('Faturamento com meta do ERP'))

    expect(onChange).toHaveBeenCalledWith([{ idIndicador: 12, pontos: '' }])
  })

  it('indicador escolhido com meta via API mostra "Meta via API · dado externo" / "Meta via API · 1 apontamento"', () => {
    renderizar([
      { idIndicador: 12, pontos: '' },
      { idIndicador: 11, pontos: '' },
    ])

    const itens = within(within(grupo()).getByRole('list', { name: 'Indicadores escolhidos' })).getAllByRole('listitem')
    expect(itens[0]).toHaveTextContent('Meta via API · dado externo')
    expect(itens[1]).toHaveTextContent('Meta via API · 1 apontamento')
  })
})
