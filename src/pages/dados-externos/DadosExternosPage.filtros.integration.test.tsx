import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API } from '../../test/apontamentosFalsos'
import {
  type DadoExternoApiFalso,
  dadosExternosAdminApi,
  dadosExternosApi,
  identificadoresApi,
  rotaListarDadosExternos,
} from '../../test/dadosExternosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/dados-externos-cadastro'
const ATRASO_BUSCA_MS = 500

describe('F5.3 — Filtros dos dados externos (integração: /dados-externos)', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
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

  const configurarUsuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  async function avancar(ms = ATRASO_BUSCA_MS) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor' = 'admin', obterLista: () => DadoExternoApiFalso[] = dadosExternosApi) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarDadosExternos(obterLista),
      [`GET ${ROTA}/identificadores`]: () => respostaJson(identificadoresApi()),
    })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const ultimoGet = (chamadas: ChamadaRegistrada[]) => gets(chamadas)[gets(chamadas).length - 1]

  async function abrirTela() {
    renderizarApp('/dados-externos')
    return await screen.findByRole('table', { name: 'Dados externos' })
  }

  function opcaoSituacao(rotulo: string) {
    return within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText(rotulo) !== null)!
  }

  it('campo "Buscar" com o placeholder "Nome, origem, identificador, campo, tipo ou referência"', async () => {
    simularSessao()
    await abrirTela()

    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveAttribute(
      'placeholder',
      'Nome, origem, identificador, campo, tipo ou referência',
    )
  })

  it('Admin: situações Todas, Ativos, Inativos, Em construção, Com problemas e Integração pendente (TI), com "Todas" selecionada', async () => {
    simularSessao()
    await abrirTela()

    const opcoes = within(screen.getByRole('listbox', { name: 'Situação' })).getAllByRole('option')
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
      'Todas',
      'Ativos',
      'Inativos',
      'Em construção',
      'Com problemas',
      'Integração pendente (TI)',
    ])
    expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'true')
  })

  it.each(['validador', 'preenchedor'] as const)(
    '%s: situações Todas, Ativos, Inativos, Em construção e Com problemas (sem "Integração pendente (TI)", que é só do Admin)',
    async (perfil) => {
      simularSessao(perfil)
      await abrirTela()

      const opcoes = within(screen.getByRole('listbox', { name: 'Situação' })).getAllByRole('option')
      expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Todas', 'Ativos', 'Inativos', 'Em construção', 'Com problemas'])
    },
  )

  it('Admin: "Integração pendente (TI)" consulta na hora com situacao=integracao_pendente e mostra só os pendentes', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('admin', dadosExternosAdminApi)
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Integração pendente (TI)'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('integracao_pendente'))
    await waitFor(() => expect(within(tabela).queryByText('Faturamento líquido')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Cobertura de clientes')).toBeInTheDocument()
    expect(within(tabela).getByText('Chamados atendidos no prazo')).toBeInTheDocument()
    expect(opcaoSituacao('Integração pendente (TI)')).toHaveAttribute('aria-selected', 'true')
  })

  it('digitar na busca consulta a API 500 ms após a última tecla e mostra só o que ela devolveu', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'cobertura')
    expect(gets(chamadas)).toHaveLength(1)
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('cobertura')
    await waitFor(() => expect(within(tabela).queryByText('Faturamento líquido')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Cobertura de clientes')).toBeInTheDocument()
  })

  it('escolher "Em construção" consulta na hora com situacao=construcao', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Em construção'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('construcao'))
    await waitFor(() => expect(within(tabela).queryByText('Faturamento líquido')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Devoluções de venda')).toBeInTheDocument()
    expect(within(tabela).getByText('Prazo médio de recebimento')).toBeInTheDocument()
    expect(opcaoSituacao('Em construção')).toHaveAttribute('aria-selected', 'true')
  })

  it('"Com problemas" envia situacao=problemas', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Com problemas'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('problemas'))
    await waitFor(() => expect(within(tabela).queryByText('Volume de vendas')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Cobertura de clientes')).toBeInTheDocument()
  })

  it('sem resultados para os filtros mostra "Nenhum dado externo encontrado para os filtros."; "Limpar filtros" volta à lista completa', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'inexistente')
    await avancar()

    expect(await within(tabela).findByText('Nenhum dado externo encontrado para os filtros.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => expect(within(tabela).getByText('Faturamento líquido')).toBeInTheDocument())
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('')
    expect(ultimoGet(chamadas).url.search).toBe('')
  })

  it('Preenchedor usa os mesmos filtros', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('preenchedor')
    await abrirTela()

    await user.click(opcaoSituacao('Inativos'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos'))
  })
})
