import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import {
  INDICADOR_CAPACITACAO_API,
  INDICADOR_COBERTURA_VISITAS_API,
  INDICADOR_FATURAMENTO_API,
  INDICADOR_ROTINAS_API,
} from '../../test/indicadoresFalsos'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador } from '../../types/dominio'
import { DialogoSituacaoIndicador } from './DialogoSituacaoIndicador'

const COBERTURA_VISITAS = paraIndicador(INDICADOR_COBERTURA_VISITAS_API)
const FATURAMENTO = paraIndicador(INDICADOR_FATURAMENTO_API)
const ROTINAS = paraIndicador(INDICADOR_ROTINAS_API)
const CAPACITACAO = paraIndicador(INDICADOR_CAPACITACAO_API)

const IMPACTO_INATIVAR =
  'Enquanto inativo, o indicador não pontua: seus pontos base ficam sem pontuação nos dashboards em que aparece. Imagens já congeladas são mantidas.'
const IMPACTO_REATIVAR = 'Reativado, o indicador volta a pontuar nos dashboards em que aparece.'

describe('F6.6 — DialogoSituacaoIndicador (confirmação de inativar/reativar — RF-38, RN-08, RNF-07)', () => {
  function renderizar(indicador: Indicador | null, alterando = false) {
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    render(<DialogoSituacaoIndicador indicador={indicador} alterando={alterando} onConfirmar={onConfirmar} onCancelar={onCancelar} />)
    return { onConfirmar, onCancelar }
  }

  it('com indicador null não renderiza nada', () => {
    renderizar(null)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('indicador ativo: "Inativar indicador" com o impacto da RN-08 e o botão "Inativar"', () => {
    renderizar(COBERTURA_VISITAS)

    const dialogo = screen.getByRole('dialog', { name: 'Inativar indicador' })
    expect(within(dialogo).getByText(IMPACTO_INATIVAR)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Inativar' })).toBeEnabled()
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('lista os dashboards afetados com os pontos base de cada um', () => {
    renderizar(FATURAMENTO)

    const dialogo = screen.getByRole('dialog', { name: 'Inativar indicador' })
    const lista = within(dialogo).getByRole('list', { name: 'Dashboards afetados' })
    expect(within(lista).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'PED Comercial (60 pontos base)',
      'PED Gerentes (30 pontos base)',
    ])
  })

  it('sem dashboards mostra "Nenhum dashboard é afetado."', () => {
    renderizar(ROTINAS)

    const dialogo = screen.getByRole('dialog', { name: 'Inativar indicador' })
    expect(within(dialogo).getByText('Nenhum dashboard é afetado.')).toBeInTheDocument()
    expect(within(dialogo).queryByRole('list', { name: 'Dashboards afetados' })).not.toBeInTheDocument()
  })

  it('indicador inativo: "Reativar indicador" com o impacto e o botão "Reativar"', () => {
    renderizar(CAPACITACAO)

    const dialogo = screen.getByRole('dialog', { name: 'Reativar indicador' })
    expect(within(dialogo).getByText(IMPACTO_REATIVAR)).toBeInTheDocument()
    expect(within(dialogo).getByText('Nenhum dashboard é afetado.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Reativar' })).toBeInTheDocument()
  })

  it('indicador inativo vinculado lista os dashboards que voltam a pontuar', () => {
    renderizar({ ...FATURAMENTO, ativo: false })

    const lista = within(screen.getByRole('dialog', { name: 'Reativar indicador' })).getByRole('list', { name: 'Dashboards afetados' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
  })

  it('confirmar chama onConfirmar; Cancelar e Esc chamam onCancelar', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar(COBERTURA_VISITAS)

    await user.click(screen.getByRole('button', { name: 'Inativar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onCancelar).toHaveBeenCalledTimes(2)
  })

  it('com alterando, o botão de confirmar fica desabilitado', () => {
    renderizar(COBERTURA_VISITAS, true)

    expect(screen.getByRole('button', { name: 'Inativar' })).toBeDisabled()
  })
})
