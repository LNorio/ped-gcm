import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { limparToken } from '../../services/sessao'
import {
  FILIAIS_API,
  acessoApi,
  cabecalhoDaChamada,
  respostaJson,
  simularApi,
  type ChamadaRegistrada,
} from '../../test/apiFalsa'
import {
  APONTAMENTO_RELATORIO_API,
  APONTAMENTO_ROTEIRO_API,
  NOMES_APONTAMENTOS,
  TIPOS_DO_USUARIO_API,
  apontamentosApi,
  rotaListarApontamentos,
  type ApontamentoApiFalso,
} from '../../test/apontamentosFalsos'
import { renderizarApp } from '../../test/renderizarApp'

describe('F4.3 — Filtros de apontamentos (integração: /apontamentos)', () => {
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

  /** Usuário com o relógio falso (a digitação avança os timers falsos). */
  const configurarUsuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  /** Avança o relógio falso e deixa as promessas resolverem. */
  async function avancar(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  function simularSessao(perfil: 'admin' | 'validador' | 'preenchedor', lista: ApontamentoApiFalso[] = apontamentosApi()) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoApi({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], 'todas as filiais': false, filiais: [FILIAIS_API[1]] })
        : acessoApi({ perfil, tipos: TIPOS_DO_USUARIO_API, 'todas as filiais': true, filiais: FILIAIS_API })
    return simularApi(fetchFalso, {
      'GET /api/ped/acesso': () => respostaJson(acesso),
      'GET /api/ped/apontamentos': rotaListarApontamentos(() => lista),
    })
  }

  function gets(chamadas: ChamadaRegistrada[]) {
    return chamadas.filter((c) => c.metodo === 'GET' && c.caminho === '/api/ped/apontamentos')
  }

  function ultimoGet(chamadas: ChamadaRegistrada[]) {
    const lista = gets(chamadas)
    return lista[lista.length - 1]
  }

  function nomesListados() {
    return within(screen.getByRole('table', { name: 'Apontamentos' }))
      .getAllByRole('row')
      .slice(1)
      .filter((linha) => !linha.classList.contains('tabela__detalhes'))
      .map((linha) => {
        const celulaNome = within(linha).getAllByRole('cell')[0]
        return NOMES_APONTAMENTOS.find((nome) => within(celulaNome).queryByText(nome) !== null) ?? celulaNome.textContent
      })
  }

  function chipTipo(nome: string) {
    const chip = within(screen.getByRole('group', { name: 'Tipo' }))
      .getAllByRole('button')
      .find((botao) => within(botao).queryByText(nome) !== null)
    if (!chip) throw new Error(`Chip de tipo "${nome}" não encontrado`)
    return chip
  }

  function opcaoSituacao(rotulo: string) {
    const opcao = within(screen.getByRole('listbox', { name: 'Situação' }))
      .getAllByRole('option')
      .find((item) => within(item).queryByText(rotulo) !== null)
    if (!opcao) throw new Error(`Opção "${rotulo}" não encontrada`)
    return opcao
  }

  it('Admin digita na busca: após a espera de 500 ms, um único GET /api/ped/apontamentos?busca=... com o Bearer e a tabela mostra a resposta', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('admin')
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })
    const getsAntes = gets(chamadas).length

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'treinamento')
    expect(gets(chamadas)).toHaveLength(getsAntes)
    await avancar(500)

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('busca')).toBe('treinamento'))
    await avancar(1000)
    expect(gets(chamadas).filter((c) => c.url.searchParams.has('busca')).map((c) => c.url.searchParams.get('busca'))).toEqual([
      'treinamento',
    ])
    expect(cabecalhoDaChamada(ultimoGet(chamadas), 'Authorization')).toBe('Bearer token-salvo')
    await waitFor(() => expect(nomesListados()).toEqual(['Horas de treinamento realizadas']))
  })

  it('Admin filtra por situação e por tipo: a query recebe situacao e tipo e as contagens vêm da API', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('admin')
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })

    await user.click(opcaoSituacao('Ativos'))
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('ativos'))
    await waitFor(() => expect(nomesListados()).toHaveLength(3))
    expect(within(chipTipo('Comercial')).getByText('1')).toBeInTheDocument()

    await user.click(chipTipo('Comercial'))
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('tipo')).toBe('1'))
    await waitFor(() => expect(nomesListados()).toEqual(['Roteiro de visitas elaborado']))

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(nomesListados()).toHaveLength(5))
  })

  it('Validador usa os mesmos filtros', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('validador')
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })

    await user.click(opcaoSituacao('Com problemas'))

    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('problemas'))
    await waitFor(() => expect(nomesListados()).toEqual(['Conciliação bancária concluída']))
  })

  it('Preenchedor vê só os botões de tipo que a API devolve na contagem (seus tipos) e filtra por eles', async () => {
    const user = configurarUsuario()
    const chamadas = simularSessao('preenchedor', [APONTAMENTO_ROTEIRO_API, APONTAMENTO_RELATORIO_API])
    renderizarApp('/apontamentos')
    await screen.findByRole('table', { name: 'Apontamentos' })

    const chips = within(screen.getByRole('group', { name: 'Tipo' })).getAllByRole('button')
    expect(chips).toHaveLength(1)
    expect(within(chipTipo('Comercial')).getByText('2')).toBeInTheDocument()

    await user.click(opcaoSituacao('Inativos'))
    await waitFor(() => expect(ultimoGet(chamadas).url.searchParams.get('situacao')).toBe('inativos'))
    await waitFor(() => expect(nomesListados()).toEqual(['Relatório mensal entregue']))
  })
})
