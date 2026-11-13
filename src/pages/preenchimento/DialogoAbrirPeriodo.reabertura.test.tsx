import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DATA_ATUAL_FALSA } from '../../test/periodoFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoAbrirPeriodo, type DialogoAbrirPeriodoProps } from './DialogoAbrirPeriodo'

const IMPACTO_REABRIR_AGOSTO =
  'Reabertura de mês já fechado: 08/2026 voltará a aceitar lançamentos e correções, para todas as filiais. Isto fechará o preenchimento de 10/2026, que passará a ser só consulta.'

function renderizar(props: Partial<DialogoAbrirPeriodoProps> = {}) {
  const onConfirmar = props.onConfirmar ?? vi.fn()
  const onCancelar = props.onCancelar ?? vi.fn()
  render(
    <DialogoAbrirPeriodo
      aberto
      mesAberto={props.mesAberto ?? '2026-10-01'}
      salvando={props.salvando ?? false}
      erro={props.erro ?? null}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />,
  )
  return { onConfirmar, onCancelar }
}

const dialogo = () => screen.getByRole('dialog', { name: 'Abrir outro mês' })
const campoAno = () => within(dialogo()).getByRole('combobox', { name: 'Ano' })
const campoMes = () => within(dialogo()).getByRole('combobox', { name: 'Mês' })

/**
 * Reabertura de mês passado já fechado (F9.12 — RF-76; A-06 resolvida em 06/11/2026). O mesmo diálogo
 * "Abrir outro mês" aceita um mês anterior ao aberto: a confirmação indica que é uma reabertura
 * (etiqueta "Reabertura", botão "Reabrir mês") e avisa "Isto fechará o preenchimento de <mês atual>",
 * porque só existe um mês aberto por vez. `onConfirmar(mesDeReferencia, true)`.
 *
 * Relógio fixo em 13/11/2026; mês aberto padrão: outubro/2026.
 */
describe('F9.12 — DialogoAbrirPeriodo (reabrir mês passado já fechado)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(DATA_ATUAL_FALSA)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ao escolher um mês anterior ao aberto (Agosto/2026), indica a reabertura e avisa que fechará o mês aberto', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.selectOptions(campoMes(), 'Agosto')

    expect(within(dialogo()).getByText('Reabertura')).toBeInTheDocument()
    expect(within(dialogo()).getByText(IMPACTO_REABRIR_AGOSTO)).toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Reabrir mês' })).toBeEnabled()
    expect(within(dialogo()).queryByRole('button', { name: 'Abrir mês' })).not.toBeInTheDocument()
  })

  it('"Reabrir mês" chama onConfirmar com o mês (AAAA-MM-01) e reabertura true', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.selectOptions(campoMes(), 'Agosto')
    await user.click(within(dialogo()).getByRole('button', { name: 'Reabrir mês' }))

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith('2026-08-01', true)
  })

  it('um mês de ano anterior (Março/2019) também é reabertura', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.selectOptions(campoAno(), '2019')
    await user.selectOptions(campoMes(), 'Março')

    expect(
      within(dialogo()).getByText(
        'Reabertura de mês já fechado: 03/2019 voltará a aceitar lançamentos e correções, para todas as filiais. Isto fechará o preenchimento de 10/2026, que passará a ser só consulta.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialogo()).getByRole('button', { name: 'Reabrir mês' }))
    expect(onConfirmar).toHaveBeenCalledWith('2019-03-01', true)
  })

  it('o limite inferior é janeiro de 2000', async () => {
    const user = usuarioRapido()
    const { onConfirmar } = renderizar()

    await user.selectOptions(campoAno(), '2000')
    await user.selectOptions(campoMes(), 'Janeiro')
    await user.click(within(dialogo()).getByRole('button', { name: 'Reabrir mês' }))

    expect(onConfirmar).toHaveBeenCalledWith('2000-01-01', true)
  })

  it('com o mês atual aberto (11/2026), Outubro/2026 é reabertura e avisa que fechará 11/2026', async () => {
    const user = usuarioRapido()
    renderizar({ mesAberto: '2026-11-01' })

    await user.selectOptions(campoMes(), 'Outubro')

    expect(
      within(dialogo()).getByText(
        'Reabertura de mês já fechado: 10/2026 voltará a aceitar lançamentos e correções, para todas as filiais. Isto fechará o preenchimento de 11/2026, que passará a ser só consulta.',
      ),
    ).toBeInTheDocument()
  })

  it('ao trocar de um mês passado para um mês novo, a confirmação deixa de indicar a reabertura', async () => {
    const user = usuarioRapido()
    renderizar()

    await user.selectOptions(campoMes(), 'Agosto')
    await user.selectOptions(campoMes(), 'Novembro')

    expect(within(dialogo()).queryByText('Reabertura')).not.toBeInTheDocument()
    expect(within(dialogo()).queryByText(IMPACTO_REABRIR_AGOSTO)).not.toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Abrir mês' })).toBeEnabled()
  })

  it('com salvando=true, "Reabrir mês" fica desabilitado', async () => {
    const user = usuarioRapido()
    const onConfirmar = vi.fn()
    const onCancelar = vi.fn()
    const { rerender } = render(
      <DialogoAbrirPeriodo aberto mesAberto="2026-10-01" salvando={false} erro={null} onConfirmar={onConfirmar} onCancelar={onCancelar} />,
    )
    await user.selectOptions(campoMes(), 'Agosto')

    rerender(<DialogoAbrirPeriodo aberto mesAberto="2026-10-01" salvando erro={null} onConfirmar={onConfirmar} onCancelar={onCancelar} />)

    expect(within(dialogo()).getByRole('button', { name: 'Reabrir mês' })).toBeDisabled()
  })
})
