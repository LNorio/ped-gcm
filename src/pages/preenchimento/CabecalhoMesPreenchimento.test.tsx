import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { telaMesFechado, telaPreenchimento } from '../../test/preenchimentoTelaFalsos'
import type { TelaPreenchimento } from '../../types/dominio'
import { CabecalhoMesPreenchimento } from './CabecalhoMesPreenchimento'

/**
 * Cabeçalho do mês (F9.4 — RF-63; aviso de consulta do RF-62). Região "Resumo do mês" com, cada um
 * no próprio elemento:
 * - "Filial {código} — {nome}" (sem nome: "Filial {código}");
 * - "Competência: MM/AAAA";
 * - a situação do mês em etiqueta: "Aberto" ou "Fechado";
 * - o progresso "X de Y apontamentos preenchidos";
 * - no mês aberto, "Período aberto por {usuário} em dd/mm/aaaa hh:mm" (partes ausentes omitidas);
 * - fora do mês aberto (`editavel: false`), o aviso de somente consulta com o mês aberto (RF-62).
 */
describe('F9.4 — CabecalhoMesPreenchimento (filial, situação, progresso e abertura do período)', () => {
  function renderizar(tela: TelaPreenchimento = telaPreenchimento()) {
    render(<CabecalhoMesPreenchimento tela={tela} />)
    return screen.getByRole('region', { name: 'Resumo do mês' })
  }

  it('mostra a filial com código e nome', () => {
    const resumo = renderizar()

    expect(within(resumo).getByText('Filial 101 — CAMPO GRANDE')).toBeInTheDocument()
  })

  it('filial sem nome: "Filial {código}"', () => {
    const resumo = renderizar(telaPreenchimento({ filial: '305', nomeFilial: null }))

    expect(within(resumo).getByText('Filial 305')).toBeInTheDocument()
  })

  it('mostra a competência como MM/AAAA', () => {
    const resumo = renderizar()

    expect(within(resumo).getByText('Competência: 10/2026')).toBeInTheDocument()
  })

  it('mês aberto: etiqueta "Aberto"', () => {
    const resumo = renderizar()

    expect(within(resumo).getByText('Aberto')).toBeInTheDocument()
    expect(within(resumo).queryByText('Fechado')).not.toBeInTheDocument()
  })

  it('mês fechado: etiqueta "Fechado" e a competência do mês consultado', () => {
    const resumo = renderizar(telaMesFechado())

    expect(within(resumo).getByText('Fechado')).toBeInTheDocument()
    expect(within(resumo).getByText('Competência: 09/2026')).toBeInTheDocument()
  })

  it('progresso "X de Y apontamentos preenchidos"', () => {
    const resumo = renderizar()

    expect(within(resumo).getByText('2 de 3 apontamentos preenchidos')).toBeInTheDocument()
  })

  it('progresso zerado: "0 de 0 apontamentos preenchidos"', () => {
    const resumo = renderizar(telaPreenchimento({ progresso: { preenchidos: 0, total: 0 }, tipos: [] }))

    expect(within(resumo).getByText('0 de 0 apontamentos preenchidos')).toBeInTheDocument()
  })

  it('mês aberto: quem abriu o período e quando (dd/mm/aaaa hh:mm)', () => {
    const resumo = renderizar()

    expect(within(resumo).getByText('Período aberto por Ana Costa em 01/10/2026 08:00')).toBeInTheDocument()
  })

  it('sem a data da abertura: só quem abriu; sem o usuário: só a data', () => {
    const { unmount } = render(<CabecalhoMesPreenchimento tela={telaPreenchimento({ abertoEm: null })} />)
    expect(screen.getByText('Período aberto por Ana Costa')).toBeInTheDocument()
    unmount()

    render(<CabecalhoMesPreenchimento tela={telaPreenchimento({ abertoPor: null })} />)
    expect(screen.getByText('Período aberto em 01/10/2026 08:00')).toBeInTheDocument()
  })

  it('sem usuário nem data da abertura: nada sobre a abertura', () => {
    const resumo = renderizar(telaPreenchimento({ abertoPor: null, abertoEm: null }))

    expect(within(resumo).queryByText(/^Período aberto/)).not.toBeInTheDocument()
  })

  it('mês aberto e editável: sem o aviso de somente consulta', () => {
    const resumo = renderizar()

    expect(within(resumo).queryByText(/Somente consulta/)).not.toBeInTheDocument()
  })

  describe('mês fora do período aberto (RF-62)', () => {
    it('mostra o aviso de somente consulta com o mês aberto (MM/AAAA)', () => {
      const resumo = renderizar(telaMesFechado())

      expect(within(resumo).getByRole('note')).toHaveTextContent(
        'Somente consulta: o único período aberto para preenchimento é 10/2026. Os demais meses não aceitam lançamentos nem correções.',
      )
    })

    it('não mostra quem abriu o período (a informação é do mês aberto)', () => {
      const resumo = renderizar(telaMesFechado())

      expect(within(resumo).queryByText(/^Período aberto por/)).not.toBeInTheDocument()
    })

    it('sem o período aberto informado: "Somente consulta: este mês não aceita lançamentos nem correções."', () => {
      const resumo = renderizar(telaMesFechado({ periodoAberto: null }))

      expect(within(resumo).getByRole('note')).toHaveTextContent('Somente consulta: este mês não aceita lançamentos nem correções.')
    })
  })
})
