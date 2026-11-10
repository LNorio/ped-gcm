import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { paraIndicador } from '../../services/adaptadores'
import { INDICADOR_TICKET_MEDIO_API } from '../../test/indicadoresFalsos'
import { FILIAIS } from '../../test/sessaoFalsa'
import { usuarioRapido } from '../../test/usuario'
import type { Indicador, MetaDaFilial } from '../../types/dominio'
import { DialogoDefinirMetasPendentes, type DialogoDefinirMetasPendentesProps } from './DialogoDefinirMetasPendentes'

/**
 * F6.12 — Modal "Definir metas pendentes" (`src/pages/indicadores/DialogoDefinirMetasPendentes.tsx`).
 *
 * - Título "Definir metas pendentes" e o nome do indicador no corpo (como o "Definir meta").
 * - Visão "Todas as filiais" (`filialSelecionada` ausente, `null` ou `'todas'`): grupo "Filiais sem meta"
 *   com um campo por filial de `indicador.filiaisSemMeta`, na ordem dela, rótulo
 *   "Meta da filial {código} - {nome}" (nome de `indicador.metasPorFilial`; senão de `filiais`; sem nome,
 *   "Meta da filial {código}"). Campos não obrigatórios; em branco ficam de fora; nenhum preenchido →
 *   "Informe a meta de ao menos uma filial." no grupo; preenchido inválido ou <= 0 →
 *   "Informe uma meta maior que zero." no campo (mesmas regras/mensagens da F6.10, vírgula decimal).
 * - Visão de uma filial: um único campo obrigatório para ela, sem o grupo.
 * - "Salvar metas" → `onConfirmar(metas: MetaDaFilial[])` só com as preenchidas; "Cancelar" → `onCancelar`.
 * - `erro` (mensagem da API) no alerta; `errosFiliais` (`ErroDeFilial[]` de `errosPorFilial`) no campo de
 *   cada filial, com `aria-invalid` e descrição acessível; editar o campo limpa o erro daquela filial.
 * - `definindo` desabilita "Salvar metas".
 *
 * Ticket médio por filial: 100 MATRIZ com meta; 101 CAMPO GRANDE e 102 DOURADOS pendentes.
 */
const TICKET: Indicador = paraIndicador(INDICADOR_TICKET_MEDIO_API)
const MENSAGEM_META = 'Informe uma meta maior que zero.'
const MENSAGEM_NENHUMA_FILIAL = 'Informe a meta de ao menos uma filial.'

describe('F6.12 — DialogoDefinirMetasPendentes', () => {
  function renderizar(props: Partial<DialogoDefinirMetasPendentesProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn<(metas: MetaDaFilial[]) => void>()
    const onCancelar = props.onCancelar ?? vi.fn()
    const utils = render(
      <DialogoDefinirMetasPendentes
        indicador={props.indicador === undefined ? TICKET : props.indicador}
        definindo={props.definindo ?? false}
        erro={props.erro ?? null}
        errosFiliais={props.errosFiliais}
        filialSelecionada={props.filialSelecionada === undefined ? 'todas' : props.filialSelecionada}
        filiais={props.filiais ?? FILIAIS}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    )
    return { ...utils, onConfirmar, onCancelar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Definir metas pendentes' })
  const grupo = () => within(dialogo()).getByRole('group', { name: 'Filiais sem meta' })
  const campo = (rotulo: string) => within(dialogo()).getByRole('textbox', { name: `Meta da filial ${rotulo}` })
  const campoOpcional = (rotulo: string) => within(dialogo()).queryByRole('textbox', { name: `Meta da filial ${rotulo}` })
  const salvar = () => within(dialogo()).getByRole('button', { name: 'Salvar metas' })

  it('com indicador null não renderiza nada', () => {
    renderizar({ indicador: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  describe('visão "Todas as filiais"', () => {
    it('abre com o título e o nome do indicador e lista só as filiais sem meta, na ordem', () => {
      renderizar()

      expect(dialogo()).toHaveTextContent('Ticket médio por filial')
      const campos = within(grupo()).getAllByRole('textbox')
      expect(campos).toHaveLength(2)
      expect(campos[0]).toHaveAccessibleName('Meta da filial 101 - CAMPO GRANDE')
      expect(campos[1]).toHaveAccessibleName('Meta da filial 102 - DOURADOS')
      expect(campoOpcional('100 - MATRIZ')).not.toBeInTheDocument()
      expect(campo('101 - CAMPO GRANDE')).not.toHaveAttribute('aria-required', 'true')
    })

    it('sem o nome em metasPorFilial, usa o nome da filial do acesso; sem nenhum, só o código', () => {
      renderizar({
        indicador: { ...TICKET, metasPorFilial: [], filiaisSemMeta: ['102', '305'] },
      })

      expect(campo('102 - DOURADOS')).toBeInTheDocument()
      expect(within(dialogo()).getByRole('textbox', { name: 'Meta da filial 305' })).toBeInTheDocument()
    })

    it('salva só as filiais preenchidas, com vírgula decimal', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(campo('102 - DOURADOS'), '1.200,50')
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith([{ filial: '102', meta: 1200.5 }])
    })

    it('com as duas preenchidas, envia na ordem das filiais sem meta', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(campo('102 - DOURADOS'), '900')
      await user.type(campo('101 - CAMPO GRANDE'), '980')
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledWith([
        { filial: '101', meta: 980 },
        { filial: '102', meta: 900 },
      ])
    })

    it('nenhuma preenchida (ou só espaços): "Informe a meta de ao menos uma filial." no grupo e não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(campo('101 - CAMPO GRANDE'), '   ')
      await user.click(salvar())

      expect(within(grupo()).getByText(MENSAGEM_NENHUMA_FILIAL)).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('a mensagem do grupo some ao digitar em uma filial', async () => {
      const user = usuarioRapido()
      renderizar()
      await user.click(salvar())

      await user.type(campo('102 - DOURADOS'), '5')

      expect(within(dialogo()).queryByText(MENSAGEM_NENHUMA_FILIAL)).not.toBeInTheDocument()
    })

    it.each(['0', '-3', 'abc'])('valor preenchido "%s" mostra "Informe uma meta maior que zero." no próprio campo e não confirma', async (valor) => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar()

      await user.type(campo('101 - CAMPO GRANDE'), valor)
      await user.type(campo('102 - DOURADOS'), '900')
      await user.click(salvar())

      expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
      expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription(MENSAGEM_META)
      expect(campo('102 - DOURADOS')).not.toHaveAttribute('aria-invalid', 'true')
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('visão de uma filial', () => {
    it('um único campo obrigatório para a filial do cabeçalho, sem o grupo', () => {
      renderizar({ filialSelecionada: FILIAIS[1] })

      expect(within(dialogo()).queryByRole('group', { name: 'Filiais sem meta' })).not.toBeInTheDocument()
      expect(within(dialogo()).getAllByRole('textbox')).toHaveLength(1)
      expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-required', 'true')
      expect(campoOpcional('102 - DOURADOS')).not.toBeInTheDocument()
    })

    it('salva só a filial do cabeçalho', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ filialSelecionada: FILIAIS[1] })

      await user.type(campo('101 - CAMPO GRANDE'), '75,5')
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledWith([{ filial: '101', meta: 75.5 }])
    })

    it('em branco: "Informe uma meta maior que zero." no campo e não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ filialSelecionada: FILIAIS[1] })

      await user.click(salvar())

      expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
      expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription(MENSAGEM_META)
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  describe('erros da API', () => {
    it('a mensagem geral aparece no alerta do diálogo', () => {
      renderizar({ erro: 'a filial 101 ja tem meta' })

      expect(within(dialogo()).getByRole('alert')).toHaveTextContent('a filial 101 ja tem meta')
    })

    it('cada erro com filial vai para o campo daquela filial (aria-invalid e descrição acessível)', () => {
      renderizar({
        erro: 'a filial 101 ja tem meta',
        errosFiliais: [
          { filial: '101', mensagem: 'a filial 101 ja tem meta' },
          { filial: '102', mensagem: 'a meta da filial 102 ("1.500") e ambigua' },
        ],
      })

      expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
      expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription('a filial 101 ja tem meta')
      expect(campo('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
      expect(campo('102 - DOURADOS')).toHaveAccessibleDescription('a meta da filial 102 ("1.500") e ambigua')
    })

    it('erro com filial null fica só no alerta geral (nenhum campo inválido)', () => {
      renderizar({ erro: 'informe as metas por filial', errosFiliais: [{ filial: null, mensagem: 'informe as metas por filial' }] })

      expect(within(dialogo()).getByRole('alert')).toHaveTextContent('informe as metas por filial')
      expect(campo('101 - CAMPO GRANDE')).not.toHaveAttribute('aria-invalid', 'true')
      expect(campo('102 - DOURADOS')).not.toHaveAttribute('aria-invalid', 'true')
    })

    it('editar o campo limpa o erro daquela filial e mantém o das outras', async () => {
      const user = usuarioRapido()
      renderizar({
        erro: 'x',
        errosFiliais: [
          { filial: '101', mensagem: 'a filial 101 ja tem meta' },
          { filial: '102', mensagem: 'meta invalida' },
        ],
      })

      await user.type(campo('101 - CAMPO GRANDE'), '1')

      expect(campo('101 - CAMPO GRANDE')).not.toHaveAttribute('aria-invalid', 'true')
      expect(within(dialogo()).queryByText('a filial 101 ja tem meta')).not.toBeInTheDocument()
      expect(campo('102 - DOURADOS')).toHaveAttribute('aria-invalid', 'true')
    })

    it('na visão de uma filial, o erro daquela filial vai para o campo único', () => {
      renderizar({ filialSelecionada: FILIAIS[1], erro: 'x', errosFiliais: [{ filial: '101', mensagem: 'a filial 101 ja tem meta' }] })

      expect(campo('101 - CAMPO GRANDE')).toHaveAttribute('aria-invalid', 'true')
      expect(campo('101 - CAMPO GRANDE')).toHaveAccessibleDescription('a filial 101 ja tem meta')
    })
  })

  it('enquanto definindo, "Salvar metas" fica desabilitado', () => {
    renderizar({ definindo: true })

    expect(salvar()).toBeDisabled()
  })

  it('"Cancelar" chama onCancelar e não confirma', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onCancelar } = renderizar()
    await user.type(campo('101 - CAMPO GRANDE'), '10')

    await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))

    expect(onCancelar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })
})
