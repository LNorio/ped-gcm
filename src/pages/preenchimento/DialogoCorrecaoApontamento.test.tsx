import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APONTAMENTO_INADIMPLENCIA, APONTAMENTO_VISITAS, APONTAMENTO_VITRINE } from '../../test/preenchimentoTelaFalsos'
import { colar, usuarioRapido } from '../../test/usuario'
import type { ApontamentoPreenchimento } from '../../types/dominio'
import { DialogoCorrecaoApontamento, type DialogoCorrecaoApontamentoProps } from './DialogoCorrecaoApontamento'

const VITRINE_SIM: ApontamentoPreenchimento = { ...APONTAMENTO_VITRINE, situacao: 'preenchido', valor: true }

/**
 * Diálogo "Corrigir lançamento" (F9.7 — RF-68, RNF-01, RNF-03). Controlado pela página:
 * - mostra o nome do apontamento e "Valor atual: {valor formatado}";
 * - "Novo valor" (o `CampoValorApontamento` com `rotulo="Novo valor"`: caixa de texto, ou Sim/Não no
 *   booleano) e "Motivo da correção" (obrigatório);
 * - "Salvar correção" valida: novo valor informado ("Informe o novo valor."), número válido e não
 *   negativo (mensagens de `lerValorDigitado`), diferente do atual ("O novo valor deve ser diferente do
 *   atual.") e motivo não vazio ("Informe o motivo da correção."); válido → `onConfirmar({ valor, motivo })`
 *   com o valor convertido e o motivo aparado;
 * - `erro` (falha da API) aparece no diálogo; `salvando` desabilita "Salvar correção";
 * - "Cancelar" chama `onFechar`; `apontamento` `null` não renderiza nada.
 */
describe('F9.7 — DialogoCorrecaoApontamento (correção com valor diferente e motivo)', () => {
  function renderizar(props: Partial<DialogoCorrecaoApontamentoProps> = {}) {
    const onConfirmar = props.onConfirmar ?? vi.fn()
    const onFechar = props.onFechar ?? vi.fn()
    render(
      <DialogoCorrecaoApontamento
        apontamento={props.apontamento === undefined ? APONTAMENTO_INADIMPLENCIA : props.apontamento}
        salvando={props.salvando}
        erro={props.erro}
        onConfirmar={onConfirmar}
        onFechar={onFechar}
      />,
    )
    return { onConfirmar, onFechar }
  }

  const dialogo = () => screen.getByRole('dialog', { name: 'Corrigir lançamento' })
  const novoValor = () => within(dialogo()).getByRole('textbox', { name: 'Novo valor' })
  const motivo = () => within(dialogo()).getByRole('textbox', { name: 'Motivo da correção' })
  const salvar = () => within(dialogo()).getByRole('button', { name: 'Salvar correção' })

  it('com apontamento null não renderiza nada', () => {
    renderizar({ apontamento: null })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre "Corrigir lançamento" com o nome do apontamento e o valor atual formatado (Porcentagem)', () => {
    renderizar()

    expect(dialogo()).toHaveTextContent('Inadimplência')
    expect(within(dialogo()).getByText('Valor atual: 80,00%')).toBeInTheDocument()
    expect(novoValor()).toHaveValue('')
    expect(motivo()).toHaveValue('')
  })

  it('Numeral: valor atual no padrão pt-BR', () => {
    renderizar({ apontamento: APONTAMENTO_VISITAS })

    expect(within(dialogo()).getByText('Valor atual: 1.234,56')).toBeInTheDocument()
  })

  it('o motivo é obrigatório (aria-required)', () => {
    renderizar()

    expect(motivo()).toHaveAttribute('aria-required', 'true')
  })

  it('valor e motivo válidos: onConfirmar com o número convertido e o motivo aparado', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.type(novoValor(), '85,5')
    await colar(user, motivo(), '  digitação errada  ')
    await user.click(salvar())

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith({ valor: 85.5, motivo: 'digitação errada' })
  })

  it('sem novo valor: "Informe o novo valor." e não confirma', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await colar(user, motivo(), 'ajuste')
    await user.click(salvar())

    expect(within(dialogo()).getByText('Informe o novo valor.')).toBeInTheDocument()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('valor negativo: "O valor não pode ser negativo." e não confirma', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.type(novoValor(), '-2')
    await colar(user, motivo(), 'ajuste')
    await user.click(salvar())

    expect(within(dialogo()).getByText('O valor não pode ser negativo.')).toBeInTheDocument()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('valor fora do padrão pt-BR: mensagem de número inválido e não confirma', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.type(novoValor(), '85.5')
    await colar(user, motivo(), 'ajuste')
    await user.click(salvar())

    expect(within(dialogo()).getByText('Informe um número válido, com vírgula decimal (ex.: 1.234,56).')).toBeInTheDocument()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('valor igual ao atual (80 = 80,00): "O novo valor deve ser diferente do atual." e não confirma', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.type(novoValor(), '80,00')
    await colar(user, motivo(), 'ajuste')
    await user.click(salvar())

    expect(within(dialogo()).getByText('O novo valor deve ser diferente do atual.')).toBeInTheDocument()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it.each(['', '   '])('motivo vazio ("%s"): "Informe o motivo da correção." e não confirma', async (texto) => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.type(novoValor(), '90')
    if (texto) await colar(user, motivo(), texto)
    await user.click(salvar())

    expect(within(dialogo()).getByText('Informe o motivo da correção.')).toBeInTheDocument()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  describe('Booleano', () => {
    it('mostra "Valor atual: Sim" e o grupo "Novo valor" com Sim/Não', () => {
      renderizar({ apontamento: VITRINE_SIM })

      expect(within(dialogo()).getByText('Valor atual: Sim')).toBeInTheDocument()
      const grupo = within(dialogo()).getByRole('group', { name: 'Novo valor' })
      expect(within(grupo).getByRole('button', { name: 'Sim' })).toBeInTheDocument()
      expect(within(grupo).getByRole('button', { name: 'Não' })).toBeInTheDocument()
    })

    it('escolher "Não" e informar o motivo: onConfirmar({ valor: false, motivo })', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ apontamento: VITRINE_SIM })

      await user.click(within(dialogo()).getByRole('button', { name: 'Não' }))
      await colar(user, motivo(), 'vitrine desmontada')
      await user.click(salvar())

      expect(onConfirmar).toHaveBeenCalledWith({ valor: false, motivo: 'vitrine desmontada' })
    })

    it('escolher o mesmo valor ("Sim"): "O novo valor deve ser diferente do atual."', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ apontamento: VITRINE_SIM })

      await user.click(within(dialogo()).getByRole('button', { name: 'Sim' }))
      await colar(user, motivo(), 'ajuste')
      await user.click(salvar())

      expect(within(dialogo()).getByText('O novo valor deve ser diferente do atual.')).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('sem escolher: "Informe o novo valor."', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ apontamento: VITRINE_SIM })

      await colar(user, motivo(), 'ajuste')
      await user.click(salvar())

      expect(within(dialogo()).getByText('Informe o novo valor.')).toBeInTheDocument()
      expect(onConfirmar).not.toHaveBeenCalled()
    })
  })

  it('erro da API aparece como alerta no diálogo', () => {
    renderizar({ erro: 'O mês informado não está aberto.' })

    expect(within(dialogo()).getByRole('alert')).toHaveTextContent('O mês informado não está aberto.')
  })

  it('salvando: "Salvar correção" desabilitado', () => {
    renderizar({ salvando: true })

    expect(salvar()).toBeDisabled()
  })

  // Revisão da F9 em 13/11/2026: não dá para fechar o diálogo enquanto a correção está sendo salva.
  it('salvando: "Cancelar" desabilitado', () => {
    renderizar({ salvando: true })

    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })

  it('salvando: Esc não fecha (onFechar não é chamado)', async () => {
    const user = usuarioRapido()
    const { onFechar } = renderizar({ salvando: true })

    await user.keyboard('{Escape}')

    expect(onFechar).not.toHaveBeenCalled()
    expect(dialogo()).toBeInTheDocument()
  })

  it('sem salvar: Esc chama onFechar', async () => {
    const user = usuarioRapido()
    const { onFechar } = renderizar()

    await user.keyboard('{Escape}')

    expect(onFechar).toHaveBeenCalledTimes(1)
  })

  it('"Cancelar" chama onFechar e não confirma', async () => {
    const user = usuarioRapido()
    const { onConfirmar, onFechar } = renderizar()

    await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))

    expect(onFechar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).not.toHaveBeenCalled()
  })
})
