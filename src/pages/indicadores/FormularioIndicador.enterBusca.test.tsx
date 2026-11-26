import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento, paraDadoExterno } from '../../services/adaptadores'
import {
  APONTAMENTO_CHAMADOS_API,
  APONTAMENTO_ROTEIRO_API,
  APONTAMENTO_TREINAMENTOS_API,
} from '../../test/apontamentosFalsos'
import { DADO_CHAMADOS_API, DADO_FATURAMENTO_API, DADO_VOLUME_API } from '../../test/dadosExternosFalsos'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import type { Apontamento, DadoExterno, NovoIndicador } from '../../types/dominio'
import { FormularioIndicador } from './FormularioIndicador'

const APONTAMENTOS: Apontamento[] = [APONTAMENTO_ROTEIRO_API, APONTAMENTO_TREINAMENTOS_API, APONTAMENTO_CHAMADOS_API].map(paraApontamento)
const DADOS_EXTERNOS: DadoExterno[] = [DADO_FATURAMENTO_API, DADO_CHAMADOS_API, DADO_VOLUME_API].map(paraDadoExterno)

/** Erro que o envio do formulário vazio mostra; a ausência dele indica que não houve envio. */
const ERRO_NOME = 'Informe o nome.'

/**
 * F6.4 — Enter nas buscas da composição ("Buscar apontamento" e "Buscar dado externo", `SeletorComponentes`
 * de `FormularioIndicador.tsx`) não envia o formulário. Alteração de 24/11/2026: é o mesmo defeito da F1.18
 * (envio implícito pelo Enter numa busca dentro do `<form>`), em outro dropdown. Enter na busca não chama
 * `onSalvar` nem mostra os erros de validação do envio; o botão "Salvar" continua enviando.
 */
describe('F6.4 — FormularioIndicador: Enter na busca da composição não envia o formulário (alteração de 24/11/2026)', () => {
  function renderizar() {
    const onSalvar = vi.fn<(dados: NovoIndicador) => void>()
    render(
      <FormularioIndicador
        apontamentos={APONTAMENTOS}
        dadosExternos={DADOS_EXTERNOS}
        carregandoComponentes={false}
        erroComponentes={null}
        salvando={false}
        erro={null}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onSalvar }
  }

  const grupoApontamentos = () => screen.getByRole('group', { name: 'Apontamentos' })
  const grupoDadoExterno = () => screen.getByRole('group', { name: 'Dado externo' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })

  /** Preenche um formulário válido por apontamento (envio seria aceito). */
  async function preencherValido(user: Usuario) {
    await colar(user, screen.getByRole('textbox', { name: 'Nome' }), 'Positivação da carteira')
    await user.type(screen.getByRole('textbox', { name: 'Meta' }), '85')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sentido' }), 'Maior é melhor')
    await user.click(within(grupoApontamentos()).getByRole('button', { name: 'Selecionar apontamento' }))
    await user.click(
      within(within(grupoApontamentos()).getByRole('listbox', { name: 'Apontamentos' })).getByRole('option', {
        name: (nome) => nome.startsWith('Roteiro de visitas elaborado'),
      }),
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cálculo do realizado' }), 'Média')
  }

  it.each([
    ['com texto', 'treino'],
    ['vazia', ''],
  ])('Enter na busca "Buscar apontamento" %s não envia (sem onSalvar e sem os erros do envio)', async (_caso, texto) => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await user.click(within(grupoApontamentos()).getByRole('button', { name: 'Selecionar apontamento' }))

    await user.type(within(grupoApontamentos()).getByRole('searchbox', { name: 'Buscar apontamento' }), `${texto}{Enter}`)

    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.queryByText(ERRO_NOME)).not.toBeInTheDocument()
    expect(within(grupoApontamentos()).getByRole('searchbox', { name: 'Buscar apontamento' })).toHaveValue(texto)
  })

  it('Enter na busca "Buscar dado externo" não envia', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await user.click(within(grupoDadoExterno()).getByRole('button', { name: 'Selecionar dado externo' }))

    await user.type(within(grupoDadoExterno()).getByRole('searchbox', { name: 'Buscar dado externo' }), 'fatur{Enter}')

    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.queryByText(ERRO_NOME)).not.toBeInTheDocument()
    expect(within(grupoDadoExterno()).getByRole('searchbox', { name: 'Buscar dado externo' })).toHaveValue('fatur')
  })

  it('com o formulário válido, Enter na busca não grava o indicador; "Salvar" depois envia uma vez', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherValido(user)

    // Escolher o cálculo (clique fora) fechou o painel: reabre para usar a busca.
    await user.click(within(grupoApontamentos()).getByRole('button', { name: 'Selecionar apontamento' }))
    await user.type(within(grupoApontamentos()).getByRole('searchbox', { name: 'Buscar apontamento' }), 'chamados{Enter}')

    expect(onSalvar).not.toHaveBeenCalled()

    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
  })

  it('Enter num campo fora do dropdown (Nome) continua enviando o formulário (mostra os erros do formulário vazio)', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.type(screen.getByRole('textbox', { name: 'Nome' }), '{Enter}')

    expect(screen.getByText(ERRO_NOME)).toBeInTheDocument()
  })
})
