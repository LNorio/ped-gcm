import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paraTabelaFaixas } from '../../services/adaptadores'
import { definirToken, limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { TABELA_COMERCIAL_101_API, historicoComNulosFaixasApi } from '../../test/faixasFalsos'
import { DialogoMotivoFaixas } from './DialogoMotivoFaixas'

const COMERCIAL_101 = paraTabelaFaixas(TABELA_COMERCIAL_101_API)
const ROTA = '/api/ped/faixas'

/**
 * D2 — "Ver motivo" quando a linha mais recente do histórico é o cadastro da versão 1 **sem motivo**
 * (`motivo: null`; resposta do back-end de 25/11/2026,
 * `docs/backend/FRONT-resposta-verificacao-swagger-2026-11-25.md`): o diálogo abre normalmente (o
 * histórico não é rejeitado) e o par "Motivo" mostra "—" (padrão do projeto para dado ausente).
 */
describe('F8.8 — DialogoMotivoFaixas: cadastro sem motivo (D2)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  const dialogo = () => screen.getByRole('dialog', { name: 'Motivo da última alteração' })
  function valor(rotulo: string): string | null {
    const termo = within(dialogo()).queryByText(rotulo, { selector: 'dt' })
    if (termo === null) return null
    return termo.nextElementSibling?.textContent ?? null
  }

  it('cadastro sem motivo como linha mais recente: Ação "Cadastro", Motivo "—", autor e data; sem erro', async () => {
    const [, , cadastro] = historicoComNulosFaixasApi()
    simularApi(fetchFalso, { [`GET ${ROTA}/1/historico`]: () => respostaJson([cadastro]) })

    render(<DialogoMotivoFaixas tabela={COMERCIAL_101} onFechar={vi.fn()} />)

    await waitFor(() => expect(valor('Ação')).toBe('Cadastro'))
    expect(valor('Motivo')).toBe('—')
    expect(valor('Autor')).toBe('Maria Souza')
    expect(valor('Data')).toBe('01/11/2026 08:00')
    expect(within(dialogo()).queryByRole('alert')).not.toBeInTheDocument()
  })
})
