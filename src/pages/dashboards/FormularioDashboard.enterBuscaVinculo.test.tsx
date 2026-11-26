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
 * F1.18 — defeito do Enter (revisão de qualidade de 06/11/2026): no formulário de dashboard, Enter nas
 * buscas do vínculo ("Buscar cargo" e "Buscar colaborador", SeletorBusca da SecaoVinculo) enviava o
 * formulário (envio implícito), como já corrigido em Tipos. Enter na busca não envia: não chama
 * onSalvar nem mostra os erros de validação do envio.
 */
describe('F7.5 — FormularioDashboard: Enter nas buscas do vínculo não envia o formulário (F1.18)', () => {
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

  const enviar = () => screen.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' })

  async function escolherTipo(user: Usuario, rotulo: string) {
    await user.click(screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' }))
    await user.click(
      within(screen.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).getByRole('option', { name: (n) => n.startsWith(rotulo) }),
    )
  }

  it.each([
    ['Cargos de colaboradores', 'Selecionar cargo de colaboradores', 'Buscar cargo', 'gerente'],
    ['Colaboradores específicos', 'Selecionar colaborador', 'Buscar colaborador', 'ana'],
  ])('vínculo "%s": Enter na busca não envia (sem onSalvar e sem os erros do envio)', async (tipo, rotuloBotao, rotuloBusca, texto) => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await escolherTipo(user, tipo)
    await user.click(screen.getByRole('button', { name: rotuloBotao }))

    await user.type(screen.getByRole('searchbox', { name: rotuloBusca }), `${texto}{Enter}`)

    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.queryByText(ERRO_NOME)).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: rotuloBusca })).toHaveValue(texto)
  })

  it('depois do Enter na busca "Buscar colaborador", "Salvar e criar tarefa no Bitrix" continua enviando (mostra os erros do formulário vazio)', async () => {
    const user = usuarioRapido()
    renderizar()
    await escolherTipo(user, 'Colaboradores específicos')
    await user.click(screen.getByRole('button', { name: 'Selecionar colaborador' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar colaborador' }), 'ana{Enter}')
    expect(screen.queryByText(ERRO_NOME)).not.toBeInTheDocument()

    await user.click(enviar())

    expect(screen.getByText(ERRO_NOME)).toBeInTheDocument()
    expect(screen.getByText('Selecione ao menos um colaborador.')).toBeInTheDocument()
  })
})
