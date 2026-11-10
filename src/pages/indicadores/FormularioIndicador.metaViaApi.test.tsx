import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraApontamento, paraDadoExterno } from '../../services/adaptadores'
import { APONTAMENTO_ROTEIRO_API } from '../../test/apontamentosFalsos'
import { DADO_FATURAMENTO_API } from '../../test/dadosExternosFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { type Usuario, colar, usuarioRapido } from '../../test/usuario'
import type { Apontamento, DadoExterno, NovoIndicador } from '../../types/dominio'
import { FormularioIndicador, type FormularioIndicadorProps } from './FormularioIndicador'

/**
 * F6.11 — Meta buscada via API no cadastro de indicador (pedido do usuário de 10/11/2026).
 *
 * - Checkbox "Buscar metas via API", desmarcado por padrão (Admin e Validador; o formulário não
 *   depende do perfil).
 * - Marcado: somem os campos de meta (campo "Meta", "Replicar a meta para todas as filiais", grupo
 *   "Metas por filial" e o campo "Meta da filial ..." da visão de uma filial — F6.10) e também
 *   "Meta editável no preenchimento" (regra do usuário: com a meta via API não é possível editar a
 *   meta manualmente). Sentido, Descrição e Composição continuam.
 * - Salvar marcado: `onSalvar` com `origemDaMeta: 'terceiro'`, `metaEditavel: false` e sem `meta` nem
 *   `metasPorFilial`; a meta não é validada. Contrato final (10/11/2026): também `fonteDaMeta`
 *   (`integracao` aqui, pois o dado externo não fornece meta).
 * - Desmarcar volta ao comportamento da F6.10, com "Meta editável no preenchimento" no valor anterior.
 */
const APONTAMENTOS: Apontamento[] = [APONTAMENTO_ROTEIRO_API].map(paraApontamento)
/**
 * Contrato final (10/11/2026): o dado externo daqui NÃO fornece meta (`forneceMeta: false`), então a fonte
 * é sempre `integracao` e "Meta vinda do dado externo" não aparece — ver
 * `FormularioIndicador.fonteDaMeta.test.tsx` para a fonte `dado_externo`.
 */
const DADOS_EXTERNOS: DadoExterno[] = [DADO_FATURAMENTO_API].map((dado) => ({ ...paraDadoExterno(dado), forneceMeta: false }))

const BUSCAR_VIA_API = 'Buscar metas via API'
const REPLICAR = 'Replicar a meta para todas as filiais'
const META_EDITAVEL = 'Meta editável no preenchimento'

describe('F6.11 — FormularioIndicador: "Buscar metas via API"', () => {
  function renderizar(props: Partial<FormularioIndicadorProps> = {}) {
    const onSalvar = props.onSalvar ?? vi.fn<(dados: NovoIndicador) => void>()
    render(
      <FormularioIndicador
        apontamentos={APONTAMENTOS}
        dadosExternos={DADOS_EXTERNOS}
        carregandoComponentes={false}
        erroComponentes={null}
        salvando={false}
        erro={null}
        filialSelecionada={props.filialSelecionada === undefined ? 'todas' : props.filialSelecionada}
        filiais={props.filiais ?? FILIAIS}
        onSalvar={onSalvar}
        onCancelar={vi.fn()}
      />,
    )
    return { onSalvar }
  }

  const buscarViaApi = () => screen.getByRole('checkbox', { name: BUSCAR_VIA_API })
  const metaUnica = () => screen.queryByRole('textbox', { name: 'Meta' })
  const replicar = () => screen.queryByRole('checkbox', { name: REPLICAR })
  const metaEditavel = () => screen.queryByRole('checkbox', { name: META_EDITAVEL })
  const grupoFiliais = () => screen.queryByRole('group', { name: 'Metas por filial' })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })

  /** Preenche Nome, Sentido e a composição por um dado externo (sem a meta). */
  async function preencherSemMeta(user: Usuario) {
    await colar(user, screen.getByRole('textbox', { name: 'Nome' }), 'Atingimento de faturamento')
    const sentido = screen.getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
    const grupoDado = screen.getByRole('group', { name: 'Dado externo' })
    await user.click(within(grupoDado).getByRole('button', { name: 'Selecionar dado externo' }))
    const lista = within(grupoDado).getByRole('listbox', { name: 'Dados externos' })
    await user.click(within(lista).getByRole('option', { name: (nome) => nome.startsWith('Faturamento líquido') }))
  }

  it('mostra o checkbox "Buscar metas via API" desmarcado, com os campos de meta da F6.10 e "Meta editável no preenchimento"', () => {
    renderizar()

    expect(buscarViaApi()).not.toBeChecked()
    expect(metaUnica()).toBeInTheDocument()
    expect(replicar()).toBeInTheDocument()
    expect(metaEditavel()).toBeInTheDocument()
  })

  it('marcado: esconde "Meta", "Replicar a meta para todas as filiais" e "Meta editável no preenchimento"; Sentido, Descrição e Composição continuam', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.click(buscarViaApi())

    expect(buscarViaApi()).toBeChecked()
    expect(metaUnica()).not.toBeInTheDocument()
    expect(replicar()).not.toBeInTheDocument()
    expect(grupoFiliais()).not.toBeInTheDocument()
    expect(metaEditavel()).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Sentido' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Dado externo' })).toBeInTheDocument()
  })

  it('marcado depois de desmarcar "Replicar": esconde também o grupo "Metas por filial"', async () => {
    const user = usuarioRapido()
    renderizar()
    await user.click(replicar()!)
    expect(grupoFiliais()).toBeInTheDocument()

    await user.click(buscarViaApi())

    expect(grupoFiliais()).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^Meta da filial/ })).not.toBeInTheDocument()
  })

  it('visão de uma filial: marcado esconde o campo "Meta da filial {código} - {nome}"', async () => {
    const user = usuarioRapido()
    renderizar({ filialSelecionada: FILIAIS[1] })
    expect(screen.getByRole('textbox', { name: 'Meta da filial 101 - CAMPO GRANDE' })).toBeInTheDocument()

    await user.click(buscarViaApi())

    expect(screen.queryByRole('textbox', { name: 'Meta da filial 101 - CAMPO GRANDE' })).not.toBeInTheDocument()
  })

  it('salvar marcado: onSalvar com origemDaMeta "terceiro", fonteDaMeta "integracao", metaEditavel false e sem meta nem metasPorFilial', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherSemMeta(user)

    await user.click(buscarViaApi())
    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
    const dados = onSalvar.mock.calls[0][0]
    expect(dados).toEqual({
      nome: 'Atingimento de faturamento',
      descricao: null,
      origemDaMeta: 'terceiro',
      fonteDaMeta: 'integracao',
      sentido: 'maior_melhor',
      metaEditavel: false,
      dadoExterno: 1,
    })
    expect(dados).not.toHaveProperty('meta')
    expect(dados).not.toHaveProperty('metasPorFilial')
  })

  it('"Meta editável no preenchimento" marcada antes: com a meta via API o envio leva metaEditavel false', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherSemMeta(user)
    await user.click(metaEditavel()!)

    await user.click(buscarViaApi())
    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ origemDaMeta: 'terceiro', metaEditavel: false })
  })

  it('marcado, a meta não é validada: meta inválida digitada antes não impede o envio nem mostra erro', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherSemMeta(user)
    await user.type(metaUnica()!, 'abc')

    await user.click(buscarViaApi())
    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
    expect(onSalvar.mock.calls[0][0]).not.toHaveProperty('meta')
    expect(screen.queryByText('Informe uma meta maior que zero.')).not.toBeInTheDocument()
  })

  it('marcado, as demais validações continuam: sem Sentido não chama onSalvar', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await colar(user, screen.getByRole('textbox', { name: 'Nome' }), 'Atingimento de faturamento')

    await user.click(buscarViaApi())
    await user.click(salvar())

    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.getByText('Selecione o sentido.')).toBeInTheDocument()
    expect(screen.queryByText('Informe uma meta maior que zero.')).not.toBeInTheDocument()
  })

  it('desmarcar volta os campos de meta e "Meta editável no preenchimento" com o valor anterior (marcado)', async () => {
    const user = usuarioRapido()
    renderizar()
    await user.click(metaEditavel()!)
    expect(metaEditavel()).toBeChecked()

    await user.click(buscarViaApi())
    await user.click(buscarViaApi())

    expect(buscarViaApi()).not.toBeChecked()
    expect(metaUnica()).toBeInTheDocument()
    expect(replicar()).toBeChecked()
    expect(metaEditavel()).toBeChecked()
  })

  it('desmarcar volta "Meta editável no preenchimento" com o valor anterior (desmarcado)', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.click(buscarViaApi())
    await user.click(buscarViaApi())

    expect(metaEditavel()).not.toBeChecked()
  })

  it('desmarcado de novo, salvar volta a exigir a meta e não envia origemDaMeta "terceiro"', async () => {
    const user = usuarioRapido()
    const { onSalvar } = renderizar()
    await preencherSemMeta(user)
    await user.click(buscarViaApi())
    await user.click(buscarViaApi())

    await user.click(salvar())

    expect(onSalvar).not.toHaveBeenCalled()
    expect(screen.getByText('Informe uma meta maior que zero.')).toBeInTheDocument()

    await user.type(metaUnica()!, '10')
    await user.click(salvar())

    expect(onSalvar).toHaveBeenCalledTimes(1)
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ meta: 10 })
    expect(onSalvar.mock.calls[0][0].origemDaMeta).not.toBe('terceiro')
  })
})
