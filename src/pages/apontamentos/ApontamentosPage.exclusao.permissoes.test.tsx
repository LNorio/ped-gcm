import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAcaoConfirmada } from '../../hooks/useAcaoConfirmada'
import { definirToken, limparToken } from '../../services/sessao'
import { podeExecutar } from '../../sessao/permissoes'
import { ProvedorSessaoFalso } from '../../test/ProvedorSessaoFalso'
import { simularApi } from '../../test/apiFalsa'
import { TIPOS_DO_USUARIO_API, apontamentosApi, rotaListarApontamentos } from '../../test/apontamentosFalsos'
import { FILIAIS, acessoFalso } from '../../test/sessaoFalsa'
import type { Perfil } from '../../types/dominio'
import { ApontamentosPage } from './ApontamentosPage'

// Envolve as implementações reais: o comportamento é o mesmo, mas o teste consegue verificar
// que a página consulta a matriz de ações e conduz o diálogo pelo hook genérico.
vi.mock('../../sessao/permissoes', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../sessao/permissoes')>()
  return { ...real, podeExecutar: vi.fn(real.podeExecutar) }
})
vi.mock('../../hooks/useAcaoConfirmada', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../hooks/useAcaoConfirmada')>()
  return { ...real, useAcaoConfirmada: vi.fn(real.useAcaoConfirmada) }
})

const ROTA = '/api/ped/apontamentos'

describe('F4.6 — ApontamentosPage: permissão de excluir pela matriz de ações e fluxo via useAcaoConfirmada', () => {
  let fetchFalso: ReturnType<typeof vi.spyOn<typeof globalThis, 'fetch'>>

  beforeEach(async () => {
    sessionStorage.clear()
    limparToken()
    definirToken('token-123')
    vi.stubEnv('VITE_API_URL', undefined)
    fetchFalso = vi.spyOn(globalThis, 'fetch')
    const real = await vi.importActual<typeof import('../../sessao/permissoes')>('../../sessao/permissoes')
    vi.mocked(podeExecutar).mockClear()
    vi.mocked(podeExecutar).mockImplementation(real.podeExecutar)
    vi.mocked(useAcaoConfirmada).mockClear()

    let lista = apontamentosApi()
    simularApi(fetchFalso, {
      [`GET ${ROTA}`]: rotaListarApontamentos(() => lista),
      [`DELETE ${ROTA}/4`]: () => {
        lista = lista.filter((a) => a.id !== 4)
        return new Response(null, { status: 204 })
      },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    limparToken()
  })

  async function abrirTela(perfil: Perfil) {
    const acesso =
      perfil === 'preenchedor'
        ? acessoFalso({ perfil, tipos: [TIPOS_DO_USUARIO_API[0]], todasAsFiliais: false, filiais: [FILIAIS[1]] })
        : acessoFalso({ perfil, tipos: TIPOS_DO_USUARIO_API, todasAsFiliais: true, filiais: FILIAIS })
    render(
      <ProvedorSessaoFalso sessao={{ acesso }}>
        <ApontamentosPage />
      </ProvedorSessaoFalso>,
    )
    await screen.findByRole('table', { name: 'Apontamentos' })
  }

  it('a página consulta podeExecutar(perfil, "excluir-apontamento") (via usePermissoes().podeAcao)', async () => {
    await abrirTela('admin')

    expect(podeExecutar).toHaveBeenCalledWith('admin', 'excluir-apontamento')
  })

  it('quem decide é a matriz de ações: com a exclusão negada, nem o Admin vê Excluir', async () => {
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao !== 'excluir-apontamento')
    await abrirTela('admin')

    expect(screen.queryByRole('button', { name: /^Excluir apontamento / })).not.toBeInTheDocument()
  })

  it('com a exclusão liberada pela matriz, o Validador passa a ver Excluir', async () => {
    vi.mocked(podeExecutar).mockImplementation((_perfil, acao) => acao === 'excluir-apontamento')
    await abrirTela('validador')

    expect(screen.getAllByRole('button', { name: /^Excluir apontamento / })).toHaveLength(5)
  })

  it('o diálogo de exclusão é conduzido por useAcaoConfirmada: abrir define o alvo e confirmar exclui', async () => {
    const user = userEvent.setup()
    await abrirTela('admin')
    expect(useAcaoConfirmada).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Excluir apontamento Chamados resolvidos no prazo' }))

    const alvos = vi.mocked(useAcaoConfirmada).mock.results.map((resultado) => (resultado.value as { alvo: unknown }).alvo)
    expect(alvos).toContainEqual(expect.objectContaining({ id: 4, nome: 'Chamados resolvidos no prazo' }))

    await user.click(within(screen.getByRole('dialog', { name: 'Excluir apontamento' })).getByRole('button', { name: 'Excluir' }))
    await screen.findByText('Apontamento excluído.')
    await waitFor(() => expect(screen.queryByText('Chamados resolvidos no prazo')).not.toBeInTheDocument())
  })
})
