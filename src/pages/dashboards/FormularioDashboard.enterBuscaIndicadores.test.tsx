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
import type { DadosDashboard } from '../../types/dominio'
import { FormularioDashboard, type ListasFormularioDashboard } from './FormularioDashboard'

const LISTAS: ListasFormularioDashboard = {
  indicadores: indicadoresParaDashboardApi().map(paraIndicador),
  dadosExternos: dadosExternosParaDashboardApi().map(paraDadoExterno),
  filiais: FILIAIS_VINCULO,
  cargos: CARGOS_VINCULO,
  colaboradores: COLABORADORES_VINCULO,
}

/** Erro que o envio do formulário vazio mostra; a ausência dele indica que não houve envio. */
const ERRO_NOME = 'Informe o nome do dashboard.'

/**
 * F1.18 — defeito do Enter (revisão de qualidade de 06/11/2026): no formulário de dashboard, Enter na
 * busca "Buscar indicador" (SeletorBusca de "Indicadores vinculados") enviava o formulário (envio
 * implícito), como já corrigido em Tipos. Enter na busca não envia: não chama onSalvar nem mostra os
 * erros de validação do envio.
 */
describe('F7.6 — FormularioDashboard: Enter na busca "Buscar indicador" não envia o formulário (F1.18)', () => {
  function renderizar() {
    const onSalvar = vi.fn<(dados: DadosDashboard) => void>()
    render(
      <FormularioDashboard
        listas={LISTAS}
        carregandoListas={false}
        erroListas={null}
        onPrevia={vi.fn().mockResolvedValue({ titulo: 'T', descricao: 'D' })}
        salvando={false}
        erro={null}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onSalvar }
  }

  const grupoIndicadores = () => screen.getByRole('group', { name: 'Indicadores vinculados' })
  const buscaIndicador = () => within(grupoIndicadores()).getByRole('searchbox', { name: 'Buscar indicador' })
  const enviar = () => screen.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' })

  async function abrirIndicadores(user: Usuario) {
    await user.click(within(grupoIndicadores()).getByRole('button', { name: 'Selecionar indicador' }))
  }

  it('Enter na busca "Buscar indicador" não envia: sem onSalvar e sem os erros de validação do envio', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await abrirIndicadores(user)

    await user.type(buscaIndicador(), 'cobertura{Enter}')

    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.queryByText(ERRO_NOME)).not.toBeInTheDocument()
    expect(buscaIndicador()).toHaveValue('cobertura')
  })

  it('Enter na busca "Buscar indicador" vazia também não envia', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await abrirIndicadores(user)
    await user.click(buscaIndicador())

    await user.keyboard('{Enter}')

    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.queryByText(ERRO_NOME)).not.toBeInTheDocument()
  })

  it('depois do Enter na busca, "Salvar e criar tarefa no Bitrix" continua enviando (mostra os erros do formulário vazio)', async () => {
    const user = usuarioRapido()
    renderizar()
    await abrirIndicadores(user)
    await user.type(buscaIndicador(), 'cobertura{Enter}')
    expect(screen.queryByText(ERRO_NOME)).not.toBeInTheDocument()

    await user.click(enviar())

    expect(screen.getByText(ERRO_NOME)).toBeInTheDocument()
  })
})
