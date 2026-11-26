/**
 * F11.5 (F12.12* do plano, RNF-04) — últimas alterações do Início formatadas pelo `"tipo de valor"` de
 * `GET /api/ped/inicio` (Swagger de 25/11/2026; integração: app completo com a rede simulada).
 *
 * Com o campo: porcentagem com "%" ("5,00% → 6,50%"), numeral com 2 casas ("1.234,50 → 1.300,00") e
 * booleano "Não → Sim". Sem o campo (formato anterior), o formato atual continua (ver
 * `InicioPage.ultimas.integration.test.tsx`: "5,00 → 6,50").
 */
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { respostaJson, simularApi } from '../../test/apiFalsa'
import { ULTIMAS_COM_TIPO_DE_VALOR_API, inicioAdminApi, rotasDoInicio } from '../../test/inicioFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const TITULO = 'Últimas alterações em apontamentos'

describe('F11.5 — Início: últimas alterações formatadas pelo tipo de valor (integração)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    sessionStorage.clear()
    limparToken()
    sessionStorage.setItem('ped.token', 'token-salvo')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const regiao = () => screen.getByRole('region', { name: TITULO })
  const itens = () => within(regiao()).getAllByRole('listitem')

  it('Admin: porcentagem com "%", numeral com 2 casas e booleano Sim/Não, na ordem da API', async () => {
    simularApi(
      fetchFalso,
      rotasDoInicio('admin', {
        'GET /api/ped/inicio': () => respostaJson(inicioAdminApi({ 'ultimas alteracoes': ULTIMAS_COM_TIPO_DE_VALOR_API })),
      }),
    )
    renderizarApp('/')

    await screen.findByText('Devoluções')

    const [porcentagem, lancamentoPorcentagem, numeral, booleano, semValorNovo] = itens()
    expect(itens()).toHaveLength(5)
    expect(within(porcentagem).getByText('Competência 10/2026 · Filial 101 · 5,00% → 6,50%')).toBeInTheDocument()
    expect(within(lancamentoPorcentagem).getByText('Competência 10/2026 · Filial 101 · 12,50%')).toBeInTheDocument()
    expect(within(numeral).getByText('Competência 10/2026 · Filial 100 · 1.234,50 → 1.300,00')).toBeInTheDocument()
    expect(within(booleano).getByText('Competência 10/2026 · Filial 102 · Não → Sim')).toBeInTheDocument()
    expect(within(semValorNovo).getByText('Competência 10/2026 · Filial 102')).toBeInTheDocument()
  })
})
