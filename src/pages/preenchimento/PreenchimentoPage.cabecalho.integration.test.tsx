import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { simularSessaoPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

/**
 * Cabeçalho do mês na aba Preenchimento (F9.4 — RF-63): filial, competência, situação, progresso
 * "X de Y apontamentos preenchidos" e quem abriu o período e quando; o progresso acompanha os
 * lançamentos gravados (a tela recarrega depois do `PUT`). Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.4 — Cabeçalho do mês (integração: /preenchimento)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0))
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('mostra filial, competência, situação "Aberto", progresso e quem abriu o período e quando', async () => {
    simularSessaoPreenchimento(fetchFalso, 'validador')

    renderizarApp('/preenchimento')

    const resumo = await screen.findByRole('region', { name: 'Resumo do mês' })
    expect(within(resumo).getByText('Filial 101 — CAMPO GRANDE')).toBeInTheDocument()
    expect(within(resumo).getByText('Competência: 10/2026')).toBeInTheDocument()
    expect(within(resumo).getByText('Aberto')).toBeInTheDocument()
    expect(within(resumo).getByText('2 de 3 apontamentos preenchidos')).toBeInTheDocument()
    expect(within(resumo).getByText('Período aberto por Ana Costa em 01/10/2026 08:00')).toBeInTheDocument()
  })

  it('depois de lançar o pendente, o progresso passa a "3 de 3 apontamentos preenchidos"', async () => {
    const user = usuarioRapido()
    simularSessaoPreenchimento(fetchFalso, 'preenchedor')
    renderizarApp('/preenchimento')
    const vitrine = await screen.findByRole('article', { name: 'Vitrine montada' })

    await user.click(within(vitrine).getByRole('button', { name: 'Sim' }))
    await user.click(screen.getByRole('button', { name: 'Salvar lançamentos' }))

    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: 'Resumo do mês' })).getByText('3 de 3 apontamentos preenchidos')).toBeInTheDocument(),
    )
  })
})
