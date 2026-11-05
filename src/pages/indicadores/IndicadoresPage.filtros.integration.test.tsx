import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import { FILIAIS_API, acessoApi, respostaJson, simularApi, type ChamadaRegistrada } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import {
  INDICADOR_COBERTURA_VISITAS_API,
  indicadoresApi,
  rotaListarIndicadores,
  type IndicadorApiFalso,
} from '../../test/indicadoresFalsos'
import { renderizarApp } from '../../test/renderizarApp'

const ROTA = '/api/ped/indicadores-cadastro'
const ATRASO_BUSCA_MS = 500

describe('F6.3 — Filtros, alertas da aba e sinal no menu (integração: /indicadores)', () => {
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

  function simularSessao(perfil: 'admin' | 'validador' = 'admin', lista: IndicadorApiFalso[] = indicadoresApi()) {
    const acesso = acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      [`GET ${ROTA}`]: rotaListarIndicadores(() => lista),
      'GET /api/ped/apontamentos': rotaListarApontamentos(apontamentosApi),
    })
  }

  const gets = (chamadas: ChamadaRegistrada[]) => chamadas.filter((c) => c.metodo === 'GET' && c.caminho === ROTA)
  const ultimoGet = (chamadas: ChamadaRegistrada[]) => gets(chamadas)[gets(chamadas).length - 1]

  async function abrirTela() {
    renderizarApp('/indicadores')
    return await screen.findByRole('table', { name: 'Indicadores' })
  }

  function opcaoSituacao(rotulo: string) {
    return within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((opcao) => within(opcao).queryByText(rotulo) !== null)!
  }

  const linkIndicadores = () => within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: /^Indicadores/ })

  it('campo "Buscar" com o placeholder "Indicador, apontamento ou dado externo"', async () => {
    simularSessao()
    await abrirTela()

    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveAttribute('placeholder', 'Indicador, apontamento ou dado externo')
  })

  it('situações Todas, Ativos, Inativos, Aguardando meta e Com problemas, com "Todas" selecionada', async () => {
    simularSessao()
    await abrirTela()

    const opcoes = within(screen.getByRole('listbox', { name: 'Situação' })).getAllByRole('option')
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Todas', 'Ativos', 'Inativos', 'Aguardando meta', 'Com problemas'])
    expect(opcaoSituacao('Todas')).toHaveAttribute('aria-selected', 'true')
  })

  it('digitar o nome de um apontamento consulta a API 500 ms após a última tecla e mostra só os indicadores devolvidos', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'roteiro')
    expect(gets(chamadas)).toHaveLength(1)
    await avancar()

    await waitFor(() => expect(gets(chamadas)).toHaveLength(2))
    expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('roteiro')
    await waitFor(() => expect(within(tabela).queryByText('Faturamento líquido mensal')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Cobertura de visitas')).toBeInTheDocument()
  })

  it('escolher "Aguardando meta" consulta na hora com situacao=meta', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Aguardando meta'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('meta'))
    await waitFor(() => expect(within(tabela).queryByText('Cobertura de visitas')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Devoluções (dado externo)', { selector: '.etiqueta--dourado' })).toBeInTheDocument()
    expect(opcaoSituacao('Aguardando meta')).toHaveAttribute('aria-selected', 'true')
  })

  it('"Com problemas" envia situacao=problemas e lista só os ativos com componente desativado', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Com problemas'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('problemas'))
    await waitFor(() => expect(within(tabela).queryByText('Cobertura de visitas')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Rotinas financeiras em dia')).toBeInTheDocument()
    expect(within(tabela).getByText('Custo de frete por entrega')).toBeInTheDocument()
    expect(within(tabela).getByText('Cobertura da carteira')).toBeInTheDocument()
  })

  it('"Inativos" envia situacao=inativos', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Inativos'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos'))
    await waitFor(() => expect(within(tabela).queryByText('Cobertura de visitas')).not.toBeInTheDocument())
    expect(within(tabela).getByText('Capacitação')).toBeInTheDocument()
  })

  it('sem resultados para os filtros mostra "Nenhum indicador encontrado para os filtros."; "Limpar filtros" volta à lista completa', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao()
    const tabela = await abrirTela()

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'inexistente')
    await avancar()

    expect(await within(tabela).findByText('Nenhum indicador encontrado para os filtros.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => expect(within(tabela).getByText('Cobertura de visitas')).toBeInTheDocument())
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('')
    expect(ultimoGet(chamadas).url.search).toBe('')
  })

  it('a aba mostra os alertas de indicadores aguardando meta e com componente desativado', async () => {
    simularSessao()
    await abrirTela()

    expect(screen.getByText('1 indicador aguardando definição de meta.').closest('[role="note"]')).not.toBeNull()
    expect(screen.getByText('3 indicadores com componente desativado.').closest('[role="note"]')).not.toBeNull()
  })

  it('os alertas da aba não mudam ao filtrar (contam todos os indicadores ativos)', async () => {
    const user = configurarUsuario()
    simularSessao()
    const tabela = await abrirTela()

    await user.click(opcaoSituacao('Inativos'))
    await waitFor(() => expect(within(tabela).queryByText('Cobertura de visitas')).not.toBeInTheDocument())

    expect(screen.getByText('1 indicador aguardando definição de meta.')).toBeInTheDocument()
    expect(screen.getByText('3 indicadores com componente desativado.')).toBeInTheDocument()
  })

  it('com alertas, a aba "Indicadores" do menu ganha o marcador "Com alertas", que permanece ao mudar de aba', async () => {
    const user = configurarUsuario()
    simularSessao()
    await abrirTela()

    expect(within(linkIndicadores()).getByRole('img', { name: 'Com alertas' })).toBeInTheDocument()

    await user.click(within(screen.getByRole('navigation', { name: 'Abas' })).getByRole('link', { name: 'Apontamentos' }))
    await screen.findByRole('heading', { level: 1, name: 'Apontamentos' })

    expect(within(linkIndicadores()).getByRole('img', { name: 'Com alertas' })).toBeInTheDocument()
  })

  it('sem indicadores aguardando meta nem com componente desativado, não há alertas na aba nem marcador no menu', async () => {
    simularSessao('admin', [INDICADOR_COBERTURA_VISITAS_API])
    await abrirTela()

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(within(linkIndicadores()).queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument()
  })

  it('Validador usa os mesmos filtros e vê os mesmos alertas', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('validador')
    await abrirTela()

    await user.click(opcaoSituacao('Ativos'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('ativos'))
    expect(screen.getByText('1 indicador aguardando definição de meta.')).toBeInTheDocument()
  })
})
