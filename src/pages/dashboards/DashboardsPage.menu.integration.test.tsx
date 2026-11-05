import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { dashboardsApi, rotaListarDashboards } from '../../test/dashboardsFalsos'
import { escolherAcao, itensPorMenuAcoes, rotuloAcoesDashboard } from '../../test/menuAcoes'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'
const COMUNS = ['Ver pesos dos indicadores', 'Histórico de modificações']
const NOMES = ['PED Comercial', 'PED Gerentes', 'PED Supervisores', 'PED Logística', 'PED Financeiro']

describe('F7.3 — Menu de ações por dashboard conforme perfil e situação (integração: /dashboards)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador') {
    const acesso = acessoApi({ perfil, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(dashboardsApi),
    })
  }

  async function abrirTela() {
    const resultado = renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })
    return resultado
  }

  it('Admin vê "Novo dashboard" e, por situação, os itens do RF-48 (Ativar/Desativar fora da TI; Concluir quando em TI; Excluir sempre)', async () => {
    const user = usuarioRapido()
    simularSessao('admin')
    await abrirTela()

    expect(screen.getByRole('button', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(await itensPorMenuAcoes(user, NOMES.map(rotuloAcoesDashboard))).toEqual([
      ['Editar', ...COMUNS, 'Preencher apontamentos', 'Desativar', 'Excluir'],
      ['Editar', ...COMUNS, 'Preencher apontamentos', 'Desativar', 'Excluir'],
      ['Editar', ...COMUNS, 'Concluir construção (TI)', 'Excluir'],
      ['Editar', ...COMUNS, 'Concluir modificação (TI)', 'Excluir'],
      ['Editar', ...COMUNS, 'Ativar', 'Excluir'],
    ])
  })

  it('Validador vê "Novo dashboard" e só Editar, Ver pesos, Histórico e Preencher apontamentos (no ativo)', async () => {
    const user = usuarioRapido()
    simularSessao('validador')
    await abrirTela()

    expect(screen.getByRole('button', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(await itensPorMenuAcoes(user, NOMES.map(rotuloAcoesDashboard))).toEqual([
      ['Editar', ...COMUNS, 'Preencher apontamentos'],
      ['Editar', ...COMUNS, 'Preencher apontamentos'],
      ['Editar', ...COMUNS],
      ['Editar', ...COMUNS],
      ['Editar', ...COMUNS],
    ])
  })

  it('"Preencher apontamentos" abre a aba Preenchimento com o dashboard na URL (/preenchimento?dashboard={id})', async () => {
    const user = usuarioRapido()
    simularSessao('validador')
    const { roteador } = await abrirTela()

    await escolherAcao(user, rotuloAcoesDashboard('PED Gerentes'), 'Preencher apontamentos')

    await waitFor(() => expect(roteador.state.location.pathname).toBe('/preenchimento'))
    expect(roteador.state.location.search).toBe('?dashboard=2')
    expect(await screen.findByRole('heading', { level: 1, name: 'Preenchimento' })).toBeInTheDocument()
  })
})
