import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraDadoExterno } from '../../services/adaptadores'
import { DADO_CHAMADOS_API, DADO_COBERTURA_API, DADO_FATURAMENTO_API } from '../../test/dadosExternosFalsos'
import type { DadoExterno } from '../../types/dominio'
import { TabelaDadosExternos } from './TabelaDadosExternos'

function comIntegracao(dado: DadoExterno, integracaoPendente: boolean): DadoExterno {
  return {
    ...dado,
    url: null,
    parametrosSaida: null,
    parametrosEntrada: null,
    variaveisUsadas: [],
    integracaoPendente,
    integracaoAlteradaEm: null,
    integracaoAlteradaPor: null,
  }
}

const FATURAMENTO = comIntegracao(paraDadoExterno(DADO_FATURAMENTO_API), false)
const COBERTURA = comIntegracao(paraDadoExterno(DADO_COBERTURA_API), true)
const CHAMADOS = comIntegracao(paraDadoExterno(DADO_CHAMADOS_API), true)

const COL_SITUACAO = 1
const ETIQUETA = 'Integração pendente (TI)'

/** Etiqueta "Integração pendente (TI)" na linha do dado com `integracaoPendente` (F5.17). */
describe('F5.17 — TabelaDadosExternos: etiqueta "Integração pendente (TI)"', () => {
  function renderizar(dados: DadoExterno[]) {
    render(
      <TabelaDadosExternos
        dados={dados}
        podeConcluir
        podeAlterarSituacao
        podeExcluir
        onConcluir={vi.fn()}
        onAlterarSituacao={vi.fn()}
        onExcluir={vi.fn()}
      />,
    )
  }

  const situacao = (nome: string) =>
    within(within(screen.getByRole('table', { name: 'Dados externos' })).getByText(nome).closest('tr')!).getAllByRole('cell')[
      COL_SITUACAO
    ]

  it('dado com integração pendente mostra a etiqueta na coluna Situação, junto da situação', () => {
    renderizar([FATURAMENTO, COBERTURA, CHAMADOS])

    expect(within(situacao('Cobertura de clientes')).getByText('Inativo')).toBeInTheDocument()
    expect(within(situacao('Cobertura de clientes')).getByText(ETIQUETA)).toBeInTheDocument()
    expect(within(situacao('Chamados atendidos no prazo')).getByText('Ativo')).toBeInTheDocument()
    expect(within(situacao('Chamados atendidos no prazo')).getByText(ETIQUETA)).toBeInTheDocument()
  })

  it('dado sem integração pendente não mostra a etiqueta', () => {
    renderizar([FATURAMENTO, COBERTURA])

    expect(within(situacao('Faturamento líquido')).queryByText(ETIQUETA)).not.toBeInTheDocument()
    expect(screen.getAllByText(ETIQUETA)).toHaveLength(1)
  })
})
