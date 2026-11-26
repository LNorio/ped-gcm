import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type RotaFalsa } from '../../test/apiFalsa'
import {
  FECHAMENTO_COMERCIAL_API,
  FECHAMENTO_GERENTES_API,
  FECHAMENTO_VENDEDORES_API,
  copiarFechamento,
  criarApiFechamentosFalsa,
  type FechamentoApiFalso,
} from '../../test/fechamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const LEGENDA = 'Fechamentos por dashboard'

/**
 * F12.2 (RNF-03, revisão de formatos pt-BR de 24/11/2026) — aba Fechamentos com a aplicação completa:
 * progresso no singular ou no plural pelo total ("0 de 1 lançamento") e contagens com separador de milhar
 * ("1.234 de 1.500 lançamentos", "1.500 colaboradores vinculados").
 */
describe('F12.2 — Aba Fechamentos: plural pelo total e separador de milhar (integração)', () => {
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

  function com(base: FechamentoApiFalso, mudancas: Partial<FechamentoApiFalso>): FechamentoApiFalso {
    return { ...copiarFechamento(base), ...mudancas }
  }

  function simularSessao(fechamentos: FechamentoApiFalso[]) {
    const api = criarApiFechamentosFalsa({ fechamentos })
    const rotas: Record<string, RotaFalsa> = {
      ...api.rotas,
      'GET /api/ped/acesso': () => respostaJson(acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })),
    }
    simularApi(fetchFalso, rotas)
  }

  function linha(tabela: HTMLElement, nome: string): HTMLElement {
    const tr = within(tabela).getByText(nome).closest('tr')
    if (!tr) throw new Error(`Linha de ${nome} não encontrada`)
    return tr
  }

  it('mostra "1.234 de 1.500 lançamentos", "0 de 1 lançamento" e "1.500 colaboradores vinculados"', async () => {
    simularSessao([
      com(FECHAMENTO_GERENTES_API, { progresso: { preenchidos: 1234, total: 1500 } }),
      com(FECHAMENTO_COMERCIAL_API, { progresso: { preenchidos: 0, total: 1 } }),
      com(FECHAMENTO_VENDEDORES_API, {
        'itens vinculados': Array.from({ length: 1500 }, (_, i) => i + 1),
        'unidades de imagem': 1500,
      }),
    ])

    renderizarApp('/fechamentos')
    const tabela = await screen.findByRole('table', { name: LEGENDA })
    await within(tabela).findByText('PED Gerentes')

    expect(within(linha(tabela, 'PED Gerentes')).getByText('1.234 de 1.500 lançamentos')).toBeInTheDocument()
    expect(within(linha(tabela, 'PED Comercial')).getByText('0 de 1 lançamento')).toBeInTheDocument()
    expect(within(linha(tabela, 'PED Vendedores')).getByText('1.500 colaboradores vinculados')).toBeInTheDocument()
    expect(within(linha(tabela, 'PED Vendedores')).getByText('1.500 colaboradores')).toBeInTheDocument()
  })
})
