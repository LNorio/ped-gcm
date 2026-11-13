import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MesPreenchimento } from '../../types/dominio'
import { usuarioRapido } from '../../test/usuario'
import { SeletorMesCompetencia, type SeletorMesCompetenciaProps } from './SeletorMesCompetencia'

const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/** Os 12 meses do ano no domínio: antes de `aberto` fechados, `aberto` com pendentes, depois futuros. */
function meses(ano: number, aberto: number | null, pendentes = 1): MesPreenchimento[] {
  return Array.from({ length: 12 }, (_, indice) => {
    const mes = indice + 1
    const mesDeReferencia = `${ano}-${String(mes).padStart(2, '0')}-01`
    if (aberto === null || mes < aberto) return { mes, mesDeReferencia, situacao: 'fechado', pendentes: null }
    if (mes === aberto) return { mes, mesDeReferencia, situacao: 'aberto', pendentes }
    return { mes, mesDeReferencia, situacao: 'futuro', pendentes: null }
  })
}

/**
 * Seletor do mês de competência e do ano (F9.3 — RF-61, RF-62). Componente controlado:
 * - grupo "Mês de competência" com 12 botões (nome acessível começando pelo nome do mês por extenso);
 *   o mês aberto mostra "aberto" e "N pendente(s)"; os demais passados, "fechado · consulta"; os futuros
 *   ficam desabilitados e mostram "futuro". O mês selecionado fica com `aria-pressed="true"`;
 * - ano por setas ("Ano anterior"/"Próximo ano") ou digitação (campo numérico "Ano"), de 2000 ao ano
 *   atual (relógio do sistema);
 * - atalho "Ir para o período aberto", visível quando o mês selecionado não é o aberto ou o ano exibido
 *   não é o do período aberto.
 * Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.3 — SeletorMesCompetencia (mês de competência e ano)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderizar(props: Partial<SeletorMesCompetenciaProps> = {}) {
    const completas: SeletorMesCompetenciaProps = {
      ano: 2026,
      meses: meses(2026, 10),
      mesSelecionado: '2026-10-01',
      periodoAberto: '2026-10-01',
      onSelecionarMes: vi.fn(),
      onMudarAno: vi.fn(),
      onIrParaPeriodoAberto: vi.fn(),
      ...props,
    }
    render(<SeletorMesCompetencia {...completas} />)
    return completas
  }

  const grupo = () => screen.getByRole('group', { name: 'Mês de competência' })
  const botaoMes = (nome: string) => within(grupo()).getByRole('button', { name: new RegExp(`^${nome}`) })

  describe('meses (RF-61)', () => {
    it('mostra os 12 meses do ano, de Janeiro a Dezembro, na ordem', () => {
      renderizar()

      const botoes = within(grupo()).getAllByRole('button')
      expect(botoes).toHaveLength(12)
      botoes.forEach((botao, indice) => expect(botao.textContent).toMatch(new RegExp(`^${NOMES[indice]}`)))
    })

    it('o mês aberto mostra "aberto" e a quantidade de pendentes (singular e plural)', () => {
      renderizar()
      expect(within(botaoMes('Outubro')).getByText('aberto')).toBeInTheDocument()
      expect(within(botaoMes('Outubro')).getByText('1 pendente')).toBeInTheDocument()
    })

    it('pendentes no plural: "3 pendentes"', () => {
      renderizar({ meses: meses(2026, 10, 3) })

      expect(within(botaoMes('Outubro')).getByText('3 pendentes')).toBeInTheDocument()
    })

    it('meses passados não abertos mostram "fechado · consulta" e ficam habilitados', () => {
      renderizar()

      for (const nome of NOMES.slice(0, 9)) {
        expect(within(botaoMes(nome)).getByText('fechado · consulta')).toBeInTheDocument()
        expect(botaoMes(nome)).toBeEnabled()
        expect(within(botaoMes(nome)).queryByText('aberto')).not.toBeInTheDocument()
      }
    })

    it('meses futuros ficam desabilitados e mostram "futuro"', () => {
      renderizar()

      for (const nome of ['Novembro', 'Dezembro']) {
        expect(botaoMes(nome)).toBeDisabled()
        expect(within(botaoMes(nome)).getByText('futuro')).toBeInTheDocument()
      }
    })

    it('o mês selecionado fica com aria-pressed="true" e os demais com "false"', () => {
      renderizar({ mesSelecionado: '2026-09-01' })

      expect(botaoMes('Setembro')).toHaveAttribute('aria-pressed', 'true')
      expect(botaoMes('Outubro')).toHaveAttribute('aria-pressed', 'false')
      expect(botaoMes('Janeiro')).toHaveAttribute('aria-pressed', 'false')
    })

    it('clicar em um mês fechado chama onSelecionarMes com "AAAA-MM-01"', async () => {
      const user = usuarioRapido()
      const props = renderizar()

      await user.click(botaoMes('Setembro'))

      expect(props.onSelecionarMes).toHaveBeenCalledWith('2026-09-01')
    })

    it('clicar no mês aberto chama onSelecionarMes com o mês aberto', async () => {
      const user = usuarioRapido()
      const props = renderizar({ mesSelecionado: '2026-03-01' })

      await user.click(botaoMes('Outubro'))

      expect(props.onSelecionarMes).toHaveBeenCalledWith('2026-10-01')
    })

    it('clicar em um mês futuro não chama onSelecionarMes', async () => {
      const user = usuarioRapido()
      const props = renderizar()

      await user.click(botaoMes('Dezembro'))

      expect(props.onSelecionarMes).not.toHaveBeenCalled()
    })

    it('ano anterior sem mês aberto: os 12 meses como "fechado · consulta"', () => {
      renderizar({ ano: 2025, meses: meses(2025, null), mesSelecionado: '2026-10-01' })

      expect(within(grupo()).getAllByText('fechado · consulta')).toHaveLength(12)
      expect(within(grupo()).queryByText('aberto')).not.toBeInTheDocument()
    })
  })

  describe('ano (setas e digitação, de 2000 ao ano atual)', () => {
    const campoAno = () => screen.getByRole('spinbutton', { name: 'Ano' })

    it('mostra o ano exibido no campo "Ano"', () => {
      renderizar()

      expect(campoAno()).toHaveValue(2026)
    })

    it('"Ano anterior" chama onMudarAno(ano - 1)', async () => {
      const user = usuarioRapido()
      const props = renderizar()

      await user.click(screen.getByRole('button', { name: 'Ano anterior' }))

      expect(props.onMudarAno).toHaveBeenCalledWith(2025)
    })

    it('"Próximo ano" fica desabilitado no ano atual (2026)', () => {
      renderizar()
      expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeDisabled()
    })

    it('"Próximo ano" em 2024 chama onMudarAno(2025)', async () => {
      const user = usuarioRapido()
      const props = renderizar({ ano: 2024, meses: meses(2024, null) })

      expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeEnabled()
      await user.click(screen.getByRole('button', { name: 'Próximo ano' }))

      expect(props.onMudarAno).toHaveBeenCalledWith(2025)
    })

    it('"Ano anterior" fica desabilitado em 2000', () => {
      renderizar({ ano: 2000, meses: meses(2000, null) })

      expect(screen.getByRole('button', { name: 'Ano anterior' })).toBeDisabled()
    })

    it('digitar um ano válido (2023) chama onMudarAno(2023) uma única vez', async () => {
      const user = usuarioRapido()
      const props = renderizar()

      await user.clear(campoAno())
      await user.type(campoAno(), '2023')

      expect(props.onMudarAno).toHaveBeenCalledTimes(1)
      expect(props.onMudarAno).toHaveBeenCalledWith(2023)
    })

    it.each(['1999', '2027', '2100'])('digitar um ano fora de 2000 até o ano atual (%s) não chama onMudarAno', async (ano) => {
      const user = usuarioRapido()
      const props = renderizar()

      await user.clear(campoAno())
      await user.type(campoAno(), ano)

      expect(props.onMudarAno).not.toHaveBeenCalled()
    })

    it('o campo "Ano" limita a digitação entre 2000 e o ano atual (min/max)', () => {
      renderizar()

      expect(campoAno()).toHaveAttribute('min', '2000')
      expect(campoAno()).toHaveAttribute('max', '2026')
    })

    it('trocar a prop ano atualiza o campo, mesmo com uma digitação incompleta (ex.: depois de "Ir para o período aberto")', () => {
      const comuns = { mesSelecionado: '2026-10-01', periodoAberto: '2026-10-01', onSelecionarMes: vi.fn(), onMudarAno: vi.fn(), onIrParaPeriodoAberto: vi.fn() }
      const { rerender } = render(<SeletorMesCompetencia {...comuns} ano={2024} meses={meses(2024, null)} />)
      fireEvent.change(campoAno(), { target: { value: '20' } })

      rerender(<SeletorMesCompetencia {...comuns} ano={2026} meses={meses(2026, 10)} />)

      expect(campoAno()).toHaveValue(2026)
      expect(comuns.onMudarAno).not.toHaveBeenCalled()
    })
  })

  describe('"Ir para o período aberto"', () => {
    it('não aparece com o mês aberto selecionado no ano do período aberto', () => {
      renderizar()

      expect(screen.queryByRole('button', { name: 'Ir para o período aberto' })).not.toBeInTheDocument()
    })

    it('aparece com outro mês selecionado e chama onIrParaPeriodoAberto', async () => {
      const user = usuarioRapido()
      const props = renderizar({ mesSelecionado: '2026-09-01' })

      await user.click(screen.getByRole('button', { name: 'Ir para o período aberto' }))

      expect(props.onIrParaPeriodoAberto).toHaveBeenCalledTimes(1)
    })

    it('aparece quando o ano exibido não é o do período aberto, mesmo com o mês aberto selecionado', () => {
      renderizar({ ano: 2025, meses: meses(2025, null), mesSelecionado: '2026-10-01' })

      expect(screen.getByRole('button', { name: 'Ir para o período aberto' })).toBeInTheDocument()
    })
  })
})
