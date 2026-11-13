import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { simularSessaoPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

/**
 * Apontamentos do mês na aba Preenchimento (F9.5 — RF-64, RF-65, RNF-09): separados por tipo, com
 * contagem; cada um com nome, tipo de valor, situação, indicadores e dashboards/periodicidades; busca
 * por apontamento ou indicador em todos os tipos. Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.5 — Apontamentos por tipo, com contagem e busca (integração: /preenchimento)', () => {
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

  const regiao = (tipo: string) => screen.getByRole('region', { name: tipo })
  const linha = (nome: string) => screen.getByRole('article', { name: nome })

  async function abrirTela(opcoes: Parameters<typeof simularSessaoPreenchimento>[2] = {}) {
    simularSessaoPreenchimento(fetchFalso, 'preenchedor', opcoes)
    renderizarApp('/preenchimento')
    await screen.findByRole('region', { name: 'Resumo do mês' })
  }

  it('separa os apontamentos por tipo, com a contagem de cada um', async () => {
    await abrirTela()

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3))
    expect(within(regiao('Comercial')).getByText('2 apontamentos')).toBeInTheDocument()
    expect(within(regiao('Comercial')).getAllByRole('article')).toHaveLength(2)
    expect(within(regiao('Financeiro')).getByText('1 apontamento')).toBeInTheDocument()
    expect(within(regiao('Financeiro')).getByRole('article', { name: 'Inadimplência' })).toBeInTheDocument()
  })

  it('cada apontamento mostra tipo de valor, situação, indicadores e dashboards com a periodicidade', async () => {
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })

    const visitas = linha('Visitas a clientes')
    expect(within(visitas).getByText('Numeral')).toBeInTheDocument()
    expect(within(visitas).getByText('Preenchido')).toBeInTheDocument()
    expect(within(visitas).getByText('1.234,56')).toBeInTheDocument()
    expect(within(visitas).getByText('Indicadores: Cobertura de clientes')).toBeInTheDocument()
    expect(within(visitas).getByText('Dashboards: PED Comercial (mensal)')).toBeInTheDocument()

    const vitrine = linha('Vitrine montada')
    expect(within(vitrine).getByText('Booleano')).toBeInTheDocument()
    expect(within(vitrine).getByText('Pendente')).toBeInTheDocument()
    expect(within(vitrine).getByText('Indicadores: não vinculado')).toBeInTheDocument()
    expect(within(vitrine).getByText('Dashboards: nenhum')).toBeInTheDocument()

    const inadimplencia = linha('Inadimplência')
    expect(within(inadimplencia).getByText('Porcentagem')).toBeInTheDocument()
    expect(within(inadimplencia).getByText('Corrigido')).toBeInTheDocument()
    expect(within(inadimplencia).getByText('80,00%')).toBeInTheDocument()
    expect(within(inadimplencia).getByText('Dashboards: PED Gerentes (trimestral)')).toBeInTheDocument()
  })

  it('a busca por indicador procura em todos os tipos e mostra só os encontrados', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })

    await user.type(screen.getByLabelText('Buscar apontamento ou indicador'), 'cobertura')

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1))
    expect(within(regiao('Comercial')).getByRole('article', { name: 'Visitas a clientes' })).toBeInTheDocument()
    expect(within(regiao('Comercial')).getByText('1 apontamento')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Financeiro' })).not.toBeInTheDocument()
  })

  it('a busca sem resultado informa "Nenhum apontamento encontrado para “{busca}”."', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })

    await user.type(screen.getByLabelText('Buscar apontamento ou indicador'), 'estoque')

    expect(await screen.findByText('Nenhum apontamento encontrado para “estoque”.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('usuário sem apontamentos ativos nos seus tipos: "Nenhum apontamento ativo nos seus tipos."', async () => {
    await abrirTela({ tela: telaPreenchimentoApi({ tipos: [], progresso: { preenchidos: 0, total: 0 } }) })

    expect(await screen.findByText('Nenhum apontamento ativo nos seus tipos.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
