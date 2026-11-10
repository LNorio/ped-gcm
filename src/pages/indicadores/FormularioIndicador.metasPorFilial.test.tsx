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
 * F6.10 — Meta por filial no cadastro de indicador.
 *
 * - Visão "Todas as filiais" (`filialSelecionada = 'todas'`): checkbox "Replicar a meta para todas as
 *   filiais", marcado por padrão. Marcado → campo "Meta" (como hoje, envia `meta`). Desmarcado → no
 *   lugar do campo, o grupo "Metas por filial" com um campo por filial do usuário
 *   ("Meta da filial {código} - {nome}"); envia `metasPorFilial` só com as preenchidas (sem `meta`).
 * - Visão de uma filial: sem checkbox; um campo "Meta da filial {código} - {nome}" e envio só para ela.
 *
 * Filiais (`FILIAIS`): 100 MATRIZ, 101 CAMPO GRANDE, 102 DOURADOS.
 */
const APONTAMENTOS: Apontamento[] = [APONTAMENTO_ROTEIRO_API].map(paraApontamento)
const DADOS_EXTERNOS: DadoExterno[] = [DADO_FATURAMENTO_API].map(paraDadoExterno)

const REPLICAR = 'Replicar a meta para todas as filiais'
const MENSAGEM_META = 'Informe uma meta maior que zero.'
const MENSAGEM_NENHUMA_FILIAL = 'Informe a meta de ao menos uma filial.'

describe('F6.10 — FormularioIndicador: meta por filial', () => {
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

  const replicar = () => screen.getByRole('checkbox', { name: REPLICAR })
  const replicarOpcional = () => screen.queryByRole('checkbox', { name: REPLICAR })
  const metaUnica = () => screen.queryByRole('textbox', { name: 'Meta' })
  const grupoFiliais = () => screen.getByRole('group', { name: 'Metas por filial' })
  const grupoFiliaisOpcional = () => screen.queryByRole('group', { name: 'Metas por filial' })
  const metaDaFilial = (rotulo: string) => screen.getByRole('textbox', { name: `Meta da filial ${rotulo}` })
  const salvar = () => screen.getByRole('button', { name: 'Salvar' })

  /** Preenche Nome, Sentido e a composição por um dado externo (sem a meta). */
  async function preencherSemMeta(user: Usuario) {
    await colar(user, screen.getByRole('textbox', { name: 'Nome' }), 'Ticket médio por filial')
    const sentido = screen.getByRole('combobox', { name: 'Sentido' })
    await user.selectOptions(sentido, within(sentido).getByRole('option', { name: 'Maior é melhor' }))
    const grupoDado = screen.getByRole('group', { name: 'Dado externo' })
    await user.click(within(grupoDado).getByRole('button', { name: 'Selecionar dado externo' }))
    const lista = within(grupoDado).getByRole('listbox', { name: 'Dados externos' })
    await user.click(within(lista).getByRole('option', { name: (nome) => nome.startsWith('Faturamento líquido') }))
  }

  describe('visão "Todas as filiais"', () => {
    it('mostra o checkbox "Replicar a meta para todas as filiais" já marcado e o campo único "Meta"', () => {
      renderizar()

      expect(replicar()).toBeChecked()
      expect(metaUnica()).toBeInTheDocument()
      expect(metaUnica()).toHaveAttribute('aria-required', 'true')
      expect(grupoFiliaisOpcional()).not.toBeInTheDocument()
    })

    it('sem filialSelecionada informada, o formulário se comporta como na visão "Todas as filiais"', () => {
      render(
        <FormularioIndicador
          apontamentos={APONTAMENTOS}
          dadosExternos={DADOS_EXTERNOS}
          carregandoComponentes={false}
          erroComponentes={null}
          salvando={false}
          erro={null}
          filiais={FILIAIS}
          onSalvar={vi.fn()}
          onCancelar={vi.fn()}
        />,
      )

      expect(replicar()).toBeChecked()
      expect(metaUnica()).toBeInTheDocument()
    })

    it('com o checkbox marcado, salva com a meta única (vírgula decimal) e sem metasPorFilial', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherSemMeta(user)
      await user.type(metaUnica()!, '1.500,50')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      const dados = onSalvar.mock.calls[0][0]
      expect(dados).toEqual({
        nome: 'Ticket médio por filial',
        descricao: null,
        meta: 1500.5,
        sentido: 'maior_melhor',
        metaEditavel: false,
        dadoExterno: 1,
      })
      expect(dados).not.toHaveProperty('metasPorFilial')
    })

    it('desmarcar o checkbox troca o campo "Meta" pelo grupo "Metas por filial", com um campo por filial, na ordem recebida', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(replicar())

      expect(replicar()).not.toBeChecked()
      expect(metaUnica()).not.toBeInTheDocument()
      const campos = within(grupoFiliais()).getAllByRole('textbox')
      expect(campos).toHaveLength(3)
      expect(metaDaFilial('100 - MATRIZ')).toBeInTheDocument()
      expect(metaDaFilial('101 - CAMPO GRANDE')).toBeInTheDocument()
      expect(metaDaFilial('102 - DOURADOS')).toBeInTheDocument()
      expect(campos).toEqual([metaDaFilial('100 - MATRIZ'), metaDaFilial('101 - CAMPO GRANDE'), metaDaFilial('102 - DOURADOS')])
      for (const campo of campos) {
        expect(campo).toHaveValue('')
        expect(campo).not.toHaveAttribute('aria-required', 'true')
      }
    })

    it('marcar de novo volta a mostrar só o campo "Meta"', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.click(replicar())
      await user.click(replicar())

      expect(replicar()).toBeChecked()
      expect(metaUnica()).toBeInTheDocument()
      expect(grupoFiliaisOpcional()).not.toBeInTheDocument()
    })

    it('com a lista, salva metasPorFilial só com as filiais preenchidas (vírgula decimal), sem meta; em branco ficam de fora', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherSemMeta(user)
      await user.click(replicar())
      await user.type(metaDaFilial('100 - MATRIZ'), '1.500,50')
      await user.type(metaDaFilial('102 - DOURADOS'), '900')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      const dados = onSalvar.mock.calls[0][0]
      expect(dados).toEqual({
        nome: 'Ticket médio por filial',
        descricao: null,
        metasPorFilial: [
          { filial: '100', meta: 1500.5 },
          { filial: '102', meta: 900 },
        ],
        sentido: 'maior_melhor',
        metaEditavel: false,
        dadoExterno: 1,
      })
      expect(dados).not.toHaveProperty('meta')
    })

    it('com a lista, um campo só com espaços conta como em branco', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherSemMeta(user)
      await user.click(replicar())
      await user.type(metaDaFilial('100 - MATRIZ'), '   ')
      await user.type(metaDaFilial('101 - CAMPO GRANDE'), '10')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ metasPorFilial: [{ filial: '101', meta: 10 }] }))
    })

    it('com a lista toda em branco, mostra "Informe a meta de ao menos uma filial." e não salva', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherSemMeta(user)
      await user.click(replicar())

      await user.click(salvar())

      expect(within(grupoFiliais()).getByText(MENSAGEM_NENHUMA_FILIAL)).toBeInTheDocument()
      expect(screen.queryByText(MENSAGEM_META)).not.toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('preencher uma filial depois do erro "ao menos uma filial" remove a mensagem', async () => {
      const user = usuarioRapido()
      renderizar()
      await preencherSemMeta(user)
      await user.click(replicar())
      await user.click(salvar())

      await user.type(metaDaFilial('101 - CAMPO GRANDE'), '5')

      expect(screen.queryByText(MENSAGEM_NENHUMA_FILIAL)).not.toBeInTheDocument()
    })

    it.each(['0', '0,00', '-10', 'abc'])(
      'com a lista, o valor "%s" em uma filial é recusado com "Informe uma meta maior que zero." no próprio campo',
      async (valor) => {
        const user = usuarioRapido()
        const { onSalvar } = renderizar()
        await preencherSemMeta(user)
        await user.click(replicar())
        await user.type(metaDaFilial('100 - MATRIZ'), '1.500,50')
        await user.type(metaDaFilial('101 - CAMPO GRANDE'), valor)

        await user.click(salvar())

        expect(metaDaFilial('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
        expect(metaDaFilial('101 - CAMPO GRANDE')).toHaveAccessibleDescription(MENSAGEM_META)
        expect(metaDaFilial('100 - MATRIZ')).not.toHaveAttribute('aria-invalid', 'true')
        expect(metaDaFilial('102 - DOURADOS')).not.toHaveAttribute('aria-invalid', 'true')
        expect(onSalvar).not.toHaveBeenCalled()
      },
    )

    it('com a lista, a validação do Nome, do Sentido e da composição continua valendo', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await user.click(replicar())
      await user.type(metaDaFilial('100 - MATRIZ'), '10')

      await user.click(salvar())

      expect(screen.getByText('Informe o nome.')).toBeInTheDocument()
      expect(screen.getByText('Selecione o sentido.')).toBeInTheDocument()
      expect(screen.getByText('Escolha ao menos um apontamento ou um dado externo.')).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('com o checkbox marcado, a meta única continua obrigatória ("Informe uma meta maior que zero.")', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar()
      await preencherSemMeta(user)

      await user.click(salvar())

      expect(metaUnica()).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText(MENSAGEM_META)).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })
  })

  describe('visão de uma filial específica', () => {
    it('não mostra o checkbox nem o grupo; mostra um único campo obrigatório "Meta da filial {código} - {nome}"', () => {
      renderizar({ filialSelecionada: FILIAIS[1] })

      expect(replicarOpcional()).not.toBeInTheDocument()
      expect(grupoFiliaisOpcional()).not.toBeInTheDocument()
      expect(metaUnica()).not.toBeInTheDocument()
      expect(metaDaFilial('101 - CAMPO GRANDE')).toHaveAttribute('aria-required', 'true')
      expect(screen.queryByRole('textbox', { name: /^Meta da filial 100/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /^Meta da filial 102/ })).not.toBeInTheDocument()
    })

    it('salva metasPorFilial só com a filial do cabeçalho e sem meta', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialSelecionada: FILIAIS[1] })
      await preencherSemMeta(user)
      await user.type(metaDaFilial('101 - CAMPO GRANDE'), '250,5')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledTimes(1)
      const dados = onSalvar.mock.calls[0][0]
      expect(dados).toEqual({
        nome: 'Ticket médio por filial',
        descricao: null,
        metasPorFilial: [{ filial: '101', meta: 250.5 }],
        sentido: 'maior_melhor',
        metaEditavel: false,
        dadoExterno: 1,
      })
      expect(dados).not.toHaveProperty('meta')
    })

    it('o campo da filial é obrigatório: vazio ou "0" mostra "Informe uma meta maior que zero." e não salva', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialSelecionada: FILIAIS[2] })
      await preencherSemMeta(user)

      await user.click(salvar())
      expect(metaDaFilial('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
      expect(metaDaFilial('102 - DOURADOS')).toHaveAccessibleDescription(MENSAGEM_META)

      await user.type(metaDaFilial('102 - DOURADOS'), '0')
      await user.click(salvar())

      expect(screen.getByText(MENSAGEM_META)).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('a filial usada é a do cabeçalho mesmo que não esteja na lista de filiais recebida', async () => {
      const user = usuarioRapido()
      const { onSalvar } = renderizar({ filialSelecionada: FILIAIS[2], filiais: [FILIAIS[0]] })
      await preencherSemMeta(user)
      await user.type(metaDaFilial('102 - DOURADOS'), '7')

      await user.click(salvar())

      expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ metasPorFilial: [{ filial: '102', meta: 7 }] }))
    })
  })
})
