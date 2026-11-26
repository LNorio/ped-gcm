import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi } from '../../test/apiFalsa'
import { respostaDadosExternosApi } from '../../test/dadosExternosFalsos'
import {
  dadosExternosParaDashboardApi,
  dashboardsApi,
  indicadoresParaDashboardApi,
  previaTarefaApi,
  rotaListarDashboards,
  rotaVinculos,
} from '../../test/dashboardsFalsos'
import { respostaIndicadoresApi } from '../../test/indicadoresFalsos'
import { renderizarApp } from '../../test/renderizarApp'
import { type Usuario, usuarioRapido } from '../../test/usuario'

const ROTA = '/api/ped/dashboards'

/**
 * Alteração de 18/11/2026: os dropdowns com busca do formulário de dashboard (SeletorBusca, nos
 * indicadores e nos itens do vínculo) fecham ao clicar fora e com Esc, como qualquer lista suspensa.
 * O formulário abre num Dialogo: clicar fora do dropdown ou pressionar Esc fecha só a lista.
 */
describe('F7.5 / F7.6 — Dropdowns do formulário de dashboard fecham ao clicar fora (integração: /dashboards, alteração de 18/11/2026)', () => {
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

  function simularSessao() {
    const acesso = acessoApi({ perfil: 'admin', 'todas as filiais': true, filiais: FILIAIS_API })
    const lista = dashboardsApi().filter((d) => d.id !== 3)
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDashboards(() => lista),
      'GET /api/ped/indicadores-cadastro': () => respostaJson(respostaIndicadoresApi(indicadoresParaDashboardApi())),
      'GET /api/ped/dados-externos-cadastro': () => respostaJson(respostaDadosExternosApi(dadosExternosParaDashboardApi())),
      'GET /api/ped/vinculos': rotaVinculos(),
      [`POST ${ROTA}/previa-tarefa`]: (init) => {
        const { nome } = JSON.parse(String(init?.body)) as { nome: string }
        return respostaJson(previaTarefaApi(nome))
      },
    })
  }

  async function abrirCadastro(user: Usuario) {
    renderizarApp('/dashboards')
    await screen.findByRole('table', { name: 'Dashboards' })
    await user.click(screen.getByRole('button', { name: 'Novo dashboard' }))
    const dialogo = screen.getByRole('dialog', { name: 'Novo dashboard' })
    await waitFor(() => expect(within(dialogo).queryByText('Carregando dados do formulário...')).not.toBeInTheDocument())
    return dialogo
  }

  async function escolherTipoVinculo(user: Usuario, dialogo: HTMLElement, rotulo: string) {
    const d = within(dialogo)
    await user.click(d.getByRole('button', { name: 'Tipo de vínculo do dashboard' }))
    await user.click(
      within(d.getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).getByRole('option', {
        name: (nome) => nome.startsWith(rotulo),
      }),
    )
  }

  const titulo = (dialogo: HTMLElement) => within(dialogo).getByRole('heading', { name: 'Novo dashboard' })

  it('indicadores: com "Selecionar indicador" aberto, clicar no título do diálogo fecha a lista e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    const botao = within(indicadores).getByRole('button', { name: 'Selecionar indicador' })
    await user.click(botao)
    expect(within(indicadores).getByRole('listbox', { name: 'Indicadores' })).toBeInTheDocument()

    await user.click(titulo(dialogo))

    expect(within(indicadores).queryByRole('listbox', { name: 'Indicadores' })).not.toBeInTheDocument()
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
  })

  it('indicadores: escolher um indicador mantém a lista aberta; digitar o nome do dashboard (fora) a fecha', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    await user.click(within(indicadores).getByRole('button', { name: 'Selecionar indicador' }))

    await user.click(
      within(within(indicadores).getByRole('listbox', { name: 'Indicadores' })).getByRole('option', {
        name: (nome) => nome.startsWith('Cobertura de visitas'),
      }),
    )
    expect(within(indicadores).getByRole('listbox', { name: 'Indicadores' })).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('textbox', { name: 'Nome do dashboard' }))

    expect(within(indicadores).queryByRole('listbox', { name: 'Indicadores' })).not.toBeInTheDocument()
    expect(within(indicadores).getByRole('list', { name: 'Indicadores escolhidos' })).toHaveTextContent('Cobertura de visitas')
  })

  it('indicadores: Esc na busca fecha só a lista (o diálogo continua aberto) e devolve o foco ao botão', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    const botao = within(indicadores).getByRole('button', { name: 'Selecionar indicador' })
    await user.click(botao)
    await user.click(within(indicadores).getByRole('searchbox', { name: 'Buscar indicador' }))

    await user.keyboard('{Escape}')

    expect(within(indicadores).queryByRole('listbox', { name: 'Indicadores' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(botao).toHaveFocus()
  })

  it('vínculo: com "Selecionar colaborador" aberto, clicar no título do diálogo fecha a lista e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    await escolherTipoVinculo(user, dialogo, 'Colaboradores específicos')
    const botao = within(dialogo).getByRole('button', { name: 'Selecionar colaborador' })
    await user.click(botao)
    expect(within(dialogo).getByRole('listbox', { name: 'Colaboradores vinculados' })).toBeInTheDocument()

    await user.click(titulo(dialogo))

    expect(within(dialogo).queryByRole('listbox', { name: 'Colaboradores vinculados' })).not.toBeInTheDocument()
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
  })

  it('vínculo: Esc na busca de colaborador fecha só a lista e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    await escolherTipoVinculo(user, dialogo, 'Colaboradores específicos')
    const botao = within(dialogo).getByRole('button', { name: 'Selecionar colaborador' })
    await user.click(botao)
    await user.click(within(dialogo).getByRole('searchbox', { name: 'Buscar colaborador' }))

    await user.keyboard('{Escape}')

    expect(within(dialogo).queryByRole('listbox', { name: 'Colaboradores vinculados' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(botao).toHaveFocus()
  })

  it('vínculo: com a lista de filiais aberta, abrir "Selecionar indicador" deixa aberta só a lista de indicadores', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    await escolherTipoVinculo(user, dialogo, 'Filiais')
    await user.click(within(dialogo).getByRole('button', { name: 'Selecionar filial' }))
    expect(within(dialogo).getByRole('listbox', { name: 'Filiais vinculadas' })).toBeInTheDocument()

    const indicadores = within(dialogo).getByRole('group', { name: 'Indicadores vinculados' })
    await user.click(within(indicadores).getByRole('button', { name: 'Selecionar indicador' }))

    expect(within(dialogo).queryByRole('listbox', { name: 'Filiais vinculadas' })).not.toBeInTheDocument()
    expect(within(indicadores).getByRole('listbox', { name: 'Indicadores' })).toBeInTheDocument()
  })

  it('vínculo: com "Vincular dashboard a" aberto, clicar no título fecha a lista sem trocar o tipo; Esc fecha só a lista e o diálogo continua aberto', async () => {
    const user = usuarioRapido()
    simularSessao()
    const dialogo = await abrirCadastro(user)
    await escolherTipoVinculo(user, dialogo, 'Filiais')
    const botaoTipo = within(dialogo).getByRole('button', { name: 'Tipo de vínculo do dashboard' })

    await user.click(botaoTipo)
    expect(within(dialogo).getByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).toBeInTheDocument()
    await user.click(titulo(dialogo))

    expect(within(dialogo).queryByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).not.toBeInTheDocument()
    expect(botaoTipo).toHaveTextContent('Filiais')

    await user.click(botaoTipo)
    await user.keyboard('{Escape}')

    expect(within(dialogo).queryByRole('listbox', { name: 'Tipo de vínculo do dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Novo dashboard' })).toBeInTheDocument()
    expect(botaoTipo).toHaveFocus()
  })
})
