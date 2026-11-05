import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  INDICADOR_COBERTURA_CARTEIRA_API,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_CUSTO_FRETE_API,
  INDICADOR_ROTINAS_API,
  indicadoresApi,
} from '../../test/indicadoresFalsos'
import { escolherAcao, rotuloAcoesIndicador } from '../../test/menuAcoes'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { AvisoComponenteDesativado } from './AvisoComponenteDesativado'
import { TabelaIndicadores } from './TabelaIndicadores'

const COBERTURA_VISITAS = paraIndicador(INDICADOR_COBERTURA_VISITAS_API)
const ROTINAS = paraIndicador(INDICADOR_ROTINAS_API)
const CUSTO_FRETE = paraIndicador(INDICADOR_CUSTO_FRETE_API)
const COBERTURA_CARTEIRA = paraIndicador(INDICADOR_COBERTURA_CARTEIRA_API)

const ORIENTACAO = 'Reative o componente ou inative o indicador.'

describe('F6.9 — AvisoComponenteDesativado (impacto do componente desativado — RF-40)', () => {
  function renderizar(indicador: Indicador) {
    render(<AvisoComponenteDesativado indicador={indicador} />)
  }

  const aviso = () => screen.getByRole('note')

  it('sem problema não renderiza nada', () => {
    renderizar(COBERTURA_VISITAS)

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('é um Aviso de alerta com o título "Componente desativado"', () => {
    renderizar(COBERTURA_CARTEIRA)

    expect(aviso()).toHaveClass('aviso--alerta')
    expect(within(aviso()).getByText('Componente desativado')).toBeInTheDocument()
  })

  it('dado externo desativado: nomeia o dado e avisa que o indicador fica sem resultado', () => {
    renderizar(COBERTURA_CARTEIRA)

    expect(within(aviso()).getByText('O dado externo Cobertura de clientes está desativado: o indicador fica sem resultado.')).toBeInTheDocument()
    expect(within(aviso()).getByText(ORIENTACAO)).toBeInTheDocument()
  })

  it('todos os apontamentos desativados: avisa que o indicador fica sem resultado', () => {
    renderizar(CUSTO_FRETE)

    expect(within(aviso()).getByText('Todos os apontamentos estão desativados: o indicador fica sem resultado.')).toBeInTheDocument()
    expect(within(aviso()).getByText(ORIENTACAO)).toBeInTheDocument()
  })

  it('parte dos apontamentos desativada (um): nomeia o apontamento e avisa que o cálculo segue sem ele e pode distorcer o resultado', () => {
    renderizar(ROTINAS)

    expect(
      within(aviso()).getByText(
        'O apontamento Conciliação bancária concluída está desativado: o cálculo segue sem ele e pode distorcer o resultado.',
      ),
    ).toBeInTheDocument()
    expect(within(aviso()).getByText(ORIENTACAO)).toBeInTheDocument()
  })

  it('parte dos apontamentos desativada (vários): lista os desativados no plural', () => {
    renderizar({
      ...ROTINAS,
      composicao: {
        tipo: 'apontamentos',
        itens: [
          { id: 2, nome: 'Conciliação bancária concluída', ativo: false },
          { id: 7, nome: 'Fechamento contábil entregue', ativo: true },
          { id: 10, nome: 'Fluxo de caixa enviado', ativo: false },
        ],
      },
    })

    expect(
      within(aviso()).getByText(
        'Os apontamentos Conciliação bancária concluída e Fluxo de caixa enviado estão desativados: o cálculo segue sem eles e pode distorcer o resultado.',
      ),
    ).toBeInTheDocument()
  })

  it('tipo de problema desconhecido: mostra a mensagem da API e a orientação', () => {
    renderizar({ ...ROTINAS, problema: { tipo: 'outro_problema', mensagem: 'Mensagem enviada pela API.' } })

    expect(within(aviso()).getByText('Mensagem enviada pela API.')).toBeInTheDocument()
    expect(within(aviso()).getByText(ORIENTACAO)).toBeInTheDocument()
  })

  describe('na TabelaIndicadores', () => {
    function renderizarTabela() {
      render(
        <TabelaIndicadores
          indicadores={indicadoresApi().map(paraIndicador)}
          podeDefinirMeta
          podeVerHistorico
          podeAlterarSituacao
          podeExcluir
          onDefinirMeta={vi.fn()}
          onVerHistorico={vi.fn()}
          onAlterarSituacao={vi.fn()}
          onExcluir={vi.fn()}
        />,
      )
    }

    function detalhesDe(nome: string) {
      const linha = within(screen.getByRole('table', { name: 'Indicadores' }))
        .getAllByRole('row')
        .find((l) => within(l).queryAllByRole('cell')[0]?.textContent?.includes(nome))!
      return linha.nextElementSibling as HTMLElement
    }

    it('os detalhes de um indicador com componente desativado trazem o aviso', async () => {
      const user = usuarioRapido()
      renderizarTabela()

      await escolherAcao(user, rotuloAcoesIndicador('Cobertura da carteira'), 'Ver detalhes')

      const detalhes = detalhesDe('Cobertura da carteira')
      expect(within(detalhes).getByRole('note')).toHaveTextContent('O dado externo Cobertura de clientes está desativado: o indicador fica sem resultado.')
      expect(within(detalhes).getByRole('note')).toHaveTextContent(ORIENTACAO)
    })

    it('os detalhes de um indicador sem problema não trazem o aviso', async () => {
      const user = usuarioRapido()
      renderizarTabela()

      await escolherAcao(user, rotuloAcoesIndicador('Cobertura de visitas'), 'Ver detalhes')

      expect(within(detalhesDe('Cobertura de visitas')).queryByRole('note')).not.toBeInTheDocument()
    })
  })
})
