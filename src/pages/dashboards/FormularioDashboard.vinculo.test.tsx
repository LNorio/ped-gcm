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

describe('F7.5 — FormularioDashboard: vínculo do dashboard no formulário (RF-49, RF-50, protótipo dashModal)', () => {
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

  const botaoTipo = () => screen.getByRole('button', { name: 'Tipo de vínculo do dashboard' })
  const enviar = () => screen.getByRole('button', { name: 'Salvar e criar tarefa no Bitrix' })

  async function escolherTipo(user: Usuario, rotulo: string) {
    await user.click(botaoTipo())
    await user.click(
      within(screen.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).getByRole('option', { name: (n) => n.startsWith(rotulo) }),
    )
  }

  it('o vínculo começa em "Cargos de colaboradores" (padrão do protótipo), com as listas recebidas da página', async () => {
    const user = usuarioRapido()
    renderizar()

    expect(botaoTipo()).toHaveTextContent('Cargos de colaboradores')
    expect(screen.getByText('Nenhum cargo selecionado.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Selecionar cargo de colaboradores' }))

    expect(within(screen.getByRole('listbox', { name: 'Cargos vinculados' })).getAllByRole('option')).toHaveLength(CARGOS_VINCULO.length)
  })

  it('não existe mais o erro "Selecione o tipo de vínculo." (o tipo sempre tem valor)', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.click(enviar())

    expect(screen.queryByText('Selecione o tipo de vínculo.')).not.toBeInTheDocument()
  })

  it.each([
    ['Filiais', 'Selecione ao menos uma filial.'],
    ['Cargos de colaboradores', 'Selecione ao menos um cargo de colaboradores.'],
    ['Colaboradores específicos', 'Selecione ao menos um colaborador.'],
  ])('tipo "%s" sem itens: "%s" e não salva', async (rotuloTipo, mensagem) => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()

    await escolherTipo(user, rotuloTipo)
    await user.click(enviar())

    expect(screen.getByText(mensagem)).toBeInTheDocument()
    expect(onSalvar).not.toHaveBeenCalled()
  })

  it('escolher um item limpa o erro dos itens', async () => {
    const user = usuarioRapido()
    renderizar()

    await escolherTipo(user, 'Filiais')
    await user.click(enviar())
    expect(screen.getByText('Selecione ao menos uma filial.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Selecionar todas' }))

    expect(screen.queryByText('Selecione ao menos uma filial.')).not.toBeInTheDocument()
    expect(screen.getByText('No encerramento serão geradas 7 imagens (uma por colaborador) nas filiais 100, 101, 102, 103.')).toBeInTheDocument()
  })

  it('trocar o tipo limpa o erro dos itens do tipo anterior', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.click(enviar())
    expect(screen.getByText('Selecione ao menos um cargo de colaboradores.')).toBeInTheDocument()

    await escolherTipo(user, 'Colaboradores específicos')

    expect(screen.queryByText('Selecione ao menos um cargo de colaboradores.')).not.toBeInTheDocument()
  })
})
