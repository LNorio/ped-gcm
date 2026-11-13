import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DATA_ATUAL_FALSA } from '../../test/periodoFalsos'
import { usuarioRapido } from '../../test/usuario'
import { DialogoAbrirPeriodo, type DialogoAbrirPeriodoProps } from './DialogoAbrirPeriodo'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const IMPACTO_NOVEMBRO =
  'O período 10/2026 será fechado para preenchimento e passará a ser só consulta. 11/2026 passará a ser o único período aberto, para todas as filiais. Os lançamentos já feitos continuam disponíveis para consulta.'

function renderizar(props: Partial<DialogoAbrirPeriodoProps> = {}) {
  const onConfirmar = props.onConfirmar ?? vi.fn()
  const onCancelar = props.onCancelar ?? vi.fn()
  const resultado = render(
    <DialogoAbrirPeriodo
      aberto={props.aberto ?? true}
      mesAberto={props.mesAberto ?? '2026-10-01'}
      salvando={props.salvando ?? false}
      erro={props.erro ?? null}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />,
  )
  return { onConfirmar, onCancelar, ...resultado }
}

const dialogo = () => screen.getByRole('dialog', { name: 'Abrir outro mês' })
const campoAno = () => within(dialogo()).getByRole('combobox', { name: 'Ano' })
const campoMes = () => within(dialogo()).getByRole('combobox', { name: 'Mês' })
const opcaoMes = (nome: string) => within(campoMes()).getByRole('option', { name: nome })
const botaoAbrir = () => within(dialogo()).getByRole('button', { name: 'Abrir mês' })

/**
 * "Abrir outro mês" (F9.11 — RF-75, RF-76, RNF-07): o Admin escolhe o mês (Ano de 2000 até o ano
 * atual; Mês de janeiro a dezembro) e vê a confirmação com o impacto. Só existe um mês aberto por vez,
 * comum a todas as filiais: abrir um mês novo fecha o aberto, que passa a ser só consulta. O mês já
 * aberto e os meses futuros não podem ser escolhidos (opções desabilitadas). Meses no formato
 * "MM/AAAA", como no protótipo.
 *
 * Componente controlado: a página chama `abrirPeriodo` em `onConfirmar(mesDeReferencia, reabertura)`
 * (mês como `AAAA-MM-01`) e devolve `salvando` e `erro` (mensagem da API, ex.: 400).
 *
 * Relógio fixo em 13/11/2026 (só `Date` é simulado): novembro/2026 é o mês atual; dezembro/2026 é
 * futuro. Mês aberto padrão: outubro/2026.
 */
describe('F9.11 — DialogoAbrirPeriodo (abrir outro mês com confirmação)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(DATA_ATUAL_FALSA)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('com aberto=false não renderiza nada', () => {
    renderizar({ aberto: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mostra o período aberto atual, os campos Ano e Mês, "Cancelar" e "Abrir mês" desabilitado até escolher o mês', () => {
    renderizar()

    expect(within(dialogo()).getByText('Período aberto: 10/2026.')).toBeInTheDocument()
    expect(campoAno()).toHaveValue('2026')
    expect(campoMes()).toHaveValue('')
    expect(within(campoMes()).getByRole('option', { name: 'Selecione o mês', selected: true })).toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(botaoAbrir()).toBeDisabled()
    expect(within(dialogo()).queryByText(/será fechado para preenchimento/)).not.toBeInTheDocument()
  })

  describe('limites da escolha (de 2000 até o mês atual, sem o mês já aberto)', () => {
    it('o Ano vai de 2000 até o ano atual (27 anos), sem anos futuros nem anteriores a 2000', () => {
      renderizar()

      const anos = within(campoAno())
        .getAllByRole('option')
        .map((opcao) => opcao.textContent)
      expect(anos).toHaveLength(27)
      expect(anos).toContain('2000')
      expect(anos).toContain('2026')
      expect(anos).not.toContain('2027')
      expect(anos).not.toContain('1999')
    })

    it('o Mês lista os 12 meses; no ano atual, o mês aberto (Outubro) e o futuro (Dezembro) ficam desabilitados', () => {
      renderizar()

      const nomes = within(campoMes())
        .getAllByRole('option')
        .map((opcao) => opcao.textContent)
      expect(nomes).toEqual(['Selecione o mês', ...MESES])
      expect(opcaoMes('Outubro')).toBeDisabled()
      expect(opcaoMes('Dezembro')).toBeDisabled()
      for (const nome of MESES.slice(0, 9)) expect(opcaoMes(nome)).toBeEnabled()
      expect(opcaoMes('Novembro')).toBeEnabled()
    })

    it('num ano passado, todos os meses podem ser escolhidos', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campoAno(), '2025')

      for (const nome of MESES) expect(opcaoMes(nome)).toBeEnabled()
    })

    it('com o mês atual já aberto (11/2026), Novembro e Dezembro ficam desabilitados', () => {
      renderizar({ mesAberto: '2026-11-01' })

      expect(within(dialogo()).getByText('Período aberto: 11/2026.')).toBeInTheDocument()
      expect(opcaoMes('Novembro')).toBeDisabled()
      expect(opcaoMes('Dezembro')).toBeDisabled()
      expect(opcaoMes('Outubro')).toBeEnabled()
    })

    it('com o mês aberto em outro ano (12/2025), no ano atual só os meses futuros ficam desabilitados', () => {
      renderizar({ mesAberto: '2025-12-01' })

      for (const nome of MESES.slice(0, 11)) expect(opcaoMes(nome)).toBeEnabled()
      expect(opcaoMes('Dezembro')).toBeDisabled()
    })

    it('ao trocar para um ano em que o mês escolhido não é permitido, a escolha do mês é desfeita', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campoAno(), '2025')
      await user.selectOptions(campoMes(), 'Dezembro')
      expect(campoMes()).not.toHaveValue('')

      await user.selectOptions(campoAno(), '2026')

      expect(campoMes()).toHaveValue('')
      expect(botaoAbrir()).toBeDisabled()
    })
  })

  describe('mês novo (posterior ao aberto)', () => {
    it('ao escolher Novembro/2026, descreve o impacto: o mês aberto fecha e passa a ser só consulta', async () => {
      const user = usuarioRapido()
      renderizar()

      await user.selectOptions(campoMes(), 'Novembro')

      expect(within(dialogo()).getByText(IMPACTO_NOVEMBRO)).toBeInTheDocument()
      expect(within(dialogo()).queryByText('Reabertura')).not.toBeInTheDocument()
      expect(within(dialogo()).queryByRole('button', { name: 'Reabrir mês' })).not.toBeInTheDocument()
      expect(botaoAbrir()).toBeEnabled()
    })

    it('"Abrir mês" chama onConfirmar com o mês (AAAA-MM-01) e reabertura false', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar()

      await user.selectOptions(campoMes(), 'Novembro')
      await user.click(botaoAbrir())

      expect(onConfirmar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).toHaveBeenCalledWith('2026-11-01', false)
      expect(onCancelar).not.toHaveBeenCalled()
    })

    it('com o mês aberto em 12/2025, Janeiro/2026 é um mês novo', async () => {
      const user = usuarioRapido()
      const { onConfirmar } = renderizar({ mesAberto: '2025-12-01' })

      await user.selectOptions(campoMes(), 'Janeiro')

      expect(
        within(dialogo()).getByText(
          'O período 12/2025 será fechado para preenchimento e passará a ser só consulta. 01/2026 passará a ser o único período aberto, para todas as filiais. Os lançamentos já feitos continuam disponíveis para consulta.',
        ),
      ).toBeInTheDocument()
      await user.click(botaoAbrir())
      expect(onConfirmar).toHaveBeenCalledWith('2026-01-01', false)
    })
  })

  describe('cancelar, gravando e erro', () => {
    it('"Cancelar" chama onCancelar e não confirma', async () => {
      const user = usuarioRapido()
      const { onConfirmar, onCancelar } = renderizar()

      await user.selectOptions(campoMes(), 'Novembro')
      await user.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))

      expect(onCancelar).toHaveBeenCalledTimes(1)
      expect(onConfirmar).not.toHaveBeenCalled()
    })

    it('Esc chama onCancelar', async () => {
      const user = usuarioRapido()
      const { onCancelar } = renderizar()

      await user.keyboard('{Escape}')

      expect(onCancelar).toHaveBeenCalledTimes(1)
    })

    it('com salvando=true, o botão de confirmar fica desabilitado', async () => {
      const user = usuarioRapido()
      const { rerender, onConfirmar, onCancelar } = renderizar()
      await user.selectOptions(campoMes(), 'Novembro')

      rerender(
        <DialogoAbrirPeriodo aberto mesAberto="2026-10-01" salvando erro={null} onConfirmar={onConfirmar} onCancelar={onCancelar} />,
      )

      expect(botaoAbrir()).toBeDisabled()
    })

    it('mostra o erro (mensagem da API) como alerta dentro do diálogo, mantendo a escolha', async () => {
      const user = usuarioRapido()
      const { rerender, onConfirmar, onCancelar } = renderizar()
      await user.selectOptions(campoMes(), 'Novembro')

      rerender(
        <DialogoAbrirPeriodo
          aberto
          mesAberto="2026-10-01"
          salvando={false}
          erro="Não é possível abrir um mês futuro."
          onConfirmar={onConfirmar}
          onCancelar={onCancelar}
        />,
      )

      expect(within(dialogo()).getByRole('alert')).toHaveTextContent('Não é possível abrir um mês futuro.')
      expect(within(dialogo()).getByText(IMPACTO_NOVEMBRO)).toBeInTheDocument()
      expect(botaoAbrir()).toBeEnabled()
    })

    it('sem erro, não há alerta', () => {
      renderizar()

      expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
