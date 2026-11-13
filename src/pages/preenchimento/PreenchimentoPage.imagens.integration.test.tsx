import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { corpoDaChamada } from '../../test/apiFalsa'
import { putsPreenchimento, simularSessaoPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { colar, usuarioRapido } from '../../test/usuario'

const AVISO =
  'Este mês já foi congelado na imagem de: PED Gerentes · 3º tri/2026 (IMG-000012). Uma correção agora vale só para os períodos ainda abertos; a imagem já gerada não muda.'

/**
 * Aviso de mês congelado em imagens (F9.8 — RF-70, RN-18). O apontamento "Inadimplência" já entrou na
 * imagem IMG-000012 (PED Gerentes · 3º tri/2026): a linha avisa quais imagens são e que a correção vale
 * só para os períodos abertos. A correção continua permitida (a imagem já gerada não muda).
 * Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.8 — Aviso de imagens congeladas (integração: /preenchimento)', () => {
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

  const linha = (nome: string) => screen.getByRole('article', { name: nome })

  async function abrirTela() {
    const sessao = simularSessaoPreenchimento(fetchFalso, 'validador')
    renderizarApp('/preenchimento')
    await screen.findByRole('article', { name: 'Inadimplência' })
    return sessao
  }

  it('o apontamento congelado em imagem mostra o aviso com a imagem; os demais não', async () => {
    await abrirTela()

    expect(within(linha('Inadimplência')).getByRole('note')).toHaveTextContent(AVISO)
    expect(within(linha('Visitas a clientes')).queryByText(/já foi congelado/)).not.toBeInTheDocument()
    expect(within(linha('Vitrine montada')).queryByText(/já foi congelado/)).not.toBeInTheDocument()
  })

  it('a correção continua permitida no apontamento congelado e é enviada normalmente', async () => {
    const user = usuarioRapido()
    const { chamadas } = await abrirTela()

    await user.click(within(linha('Inadimplência')).getByRole('button', { name: 'Corrigir' }))
    const dialogo = screen.getByRole('dialog', { name: 'Corrigir lançamento' })
    await user.type(within(dialogo).getByRole('textbox', { name: 'Novo valor' }), '82')
    await colar(user, within(dialogo).getByRole('textbox', { name: 'Motivo da correção' }), 'conferência do financeiro')
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar correção' }))

    await waitFor(() => expect(putsPreenchimento(chamadas)).toHaveLength(1))
    expect(corpoDaChamada(putsPreenchimento(chamadas)[0])).toEqual(
      expect.objectContaining({ itens: [{ 'id apontamento': 9, valor: 82, motivo: 'conferência do financeiro' }] }),
    )
  })

  it('o aviso também aparece na consulta de um mês fechado', async () => {
    const user = usuarioRapido()
    await abrirTela()

    const meses = await screen.findByRole('group', { name: 'Mês de competência' })
    await user.click(await within(meses).findByRole('button', { name: /^Setembro/ }))

    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: 'Resumo do mês' })).getByText('Competência: 09/2026')).toBeInTheDocument(),
    )
    expect(within(linha('Inadimplência')).getByRole('note')).toHaveTextContent(AVISO)
  })
})
