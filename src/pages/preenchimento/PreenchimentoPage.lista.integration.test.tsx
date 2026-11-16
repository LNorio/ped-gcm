import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { telaPreenchimentoApi } from '../../test/preenchimentoFalsos'
import { simularSessaoPreenchimento } from '../../test/preenchimentoTelaFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { usuarioRapido } from '../../test/usuario'

/**
 * Apontamentos do mês na aba Preenchimento (F9.5 — RF-64, RF-65, RNF-09): em subabas por tipo
 * ("Tipos de apontamento", padrão de abas do WAI-ARIA, como no protótipo), com a contagem em cada aba;
 * cada apontamento com nome, tipo de valor, situação, indicadores e dashboards/periodicidades; busca por
 * apontamento ou indicador em todos os tipos (com texto, as abas somem e cada encontrado mostra o seu
 * tipo). Relógio fixo em 13/11/2026 (só `Date`).
 */
describe('F9.5 — Apontamentos em subabas por tipo, com contagem e busca (integração: /preenchimento)', () => {
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

  const comecaCom = (inicio: string) => (nome: string) => nome.startsWith(inicio)
  const abas = () => screen.getByRole('tablist', { name: 'Tipos de apontamento' })
  const aba = (tipo: string) => within(abas()).getByRole('tab', { name: comecaCom(tipo) })
  const painel = () => screen.getByRole('tabpanel')
  const linha = (nome: string) => screen.getByRole('article', { name: nome })
  const busca = () => screen.getByLabelText('Buscar apontamento ou indicador')
  const nomesDasLinhas = () => screen.getAllByRole('article').map((artigo) => within(artigo).getByRole('heading').textContent)

  async function abrirTela(opcoes: Parameters<typeof simularSessaoPreenchimento>[2] = {}) {
    simularSessaoPreenchimento(fetchFalso, 'preenchedor', opcoes)
    renderizarApp('/preenchimento')
    await screen.findByRole('region', { name: 'Resumo do mês' })
  }

  it('separa os apontamentos em subabas por tipo, com a contagem de cada um; a primeira começa selecionada', async () => {
    await abrirTela()

    await screen.findByRole('tablist', { name: 'Tipos de apontamento' })
    const todas = within(abas()).getAllByRole('tab')
    expect(todas).toHaveLength(2)
    expect(todas[0]).toHaveTextContent(/^Comercial\s*2$/)
    expect(todas[1]).toHaveTextContent(/^Financeiro\s*1$/)
    expect(aba('Comercial')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: comecaCom('Comercial') })).toBeInTheDocument()
    expect(within(painel()).getAllByRole('article')).toHaveLength(2)
    expect(screen.queryByRole('article', { name: 'Inadimplência' })).not.toBeInTheDocument()
  })

  it('escolher a aba Financeiro mostra só os apontamentos dela', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })

    await user.click(aba('Financeiro'))

    expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
    expect(within(painel()).getAllByRole('article')).toHaveLength(1)
    expect(within(painel()).getByRole('article', { name: 'Inadimplência' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Visitas a clientes' })).not.toBeInTheDocument()
  })

  it('as setas do teclado trocam de aba', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })
    await user.click(aba('Comercial'))

    await user.keyboard('{ArrowRight}')

    expect(aba('Financeiro')).toHaveFocus()
    expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
    expect(linha('Inadimplência')).toBeInTheDocument()
  })

  it('cada apontamento mostra tipo de valor, situação, indicadores e dashboards com a periodicidade', async () => {
    const user = usuarioRapido()
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

    await user.click(aba('Financeiro'))
    const inadimplencia = linha('Inadimplência')
    expect(within(inadimplencia).getByText('Porcentagem')).toBeInTheDocument()
    expect(within(inadimplencia).getByText('Corrigido')).toBeInTheDocument()
    expect(within(inadimplencia).getByText('80,00%')).toBeInTheDocument()
    expect(within(inadimplencia).getByText('Dashboards: PED Gerentes (trimestral)')).toBeInTheDocument()
  })

  it('a busca por indicador procura em todos os tipos: as abas somem e só os encontrados aparecem', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })

    await user.type(busca(), 'cobertura')

    await waitFor(() => expect(nomesDasLinhas()).toEqual(['Visitas a clientes']))
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Buscando em todos os seus tipos de apontamento.')).toBeInTheDocument()
    expect(within(linha('Visitas a clientes')).getByText('Comercial')).toBeInTheDocument()
  })

  it('a busca encontra apontamento de um tipo que não é o da aba selecionada, com o nome do tipo na linha', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })

    await user.type(busca(), 'inadimpl')

    await waitFor(() => expect(nomesDasLinhas()).toEqual(['Inadimplência']))
    expect(within(linha('Inadimplência')).getByText('Financeiro')).toBeInTheDocument()
  })

  it('limpar a busca volta às abas, na aba que estava selecionada', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })
    await user.click(aba('Financeiro'))

    await user.type(busca(), 'vitrine')
    await user.clear(busca())

    expect(aba('Financeiro')).toHaveAttribute('aria-selected', 'true')
    expect(nomesDasLinhas()).toEqual(['Inadimplência'])
  })

  it('a busca sem resultado informa "Nenhum apontamento encontrado para “{busca}”."', async () => {
    const user = usuarioRapido()
    await abrirTela()
    await screen.findByRole('article', { name: 'Visitas a clientes' })

    await user.type(busca(), 'estoque')

    expect(await screen.findByText('Nenhum apontamento encontrado para “estoque”.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('usuário sem apontamentos ativos nos seus tipos: "Nenhum apontamento ativo nos seus tipos.", sem abas', async () => {
    await abrirTela({ tela: telaPreenchimentoApi({ tipos: [], progresso: { preenchidos: 0, total: 0 } }) })

    expect(await screen.findByText('Nenhum apontamento ativo nos seus tipos.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})
